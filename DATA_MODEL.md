# DATA_MODEL.md - Esquema de datos CalGuard v2

## Base de datos

- **Motor**: IndexedDB (navegador)
- **Nombre**: `calguardDB`
- **Versión**: 2

## Entidades

### Profile
Perfiles de usuario (aislamiento de datos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (UUID) | Clave primaria |
| `name` | string | Nombre del perfil |
| `role` | 'usuario' \| 'supervisor' \| 'admin' | Rol |
| `createdAt` | ISO datetime | Fecha de creación |
| `settings` | object | Configuración específica del perfil |

### Day
Un día del calendario con múltiples tags.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `profileId` | string | FK a Profile |
| `dateISO` | string (YYYY-MM-DD) | Fecha |
| `tags` | TagEntry[] | Lista de tags del día |
| `updatedAt` | ISO datetime | Última modificación |

**Clave primaria**: `[profileId, dateISO]` (compuesta)

### TagEntry
Tipo de evento asignado a un día.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | TagType | Tipo de tag |
| `meta` | object (opcional) | Metadatos según tipo |

**TagType enum**:
- `GUARDIA_REAL` - Guardia realizada
- `GUARDIA_PLAN` - Guardia planificada
- `LIBRE` - Día libre (meta: `{guardRef, ordinal}`)
- `VACACIONES` - Vacaciones (meta: `{rangeId}`)
- `AP` - Asunto propio
- `TURNO_M` - Turno de mañana
- `TURNO_T` - Turno de tarde
- `TURNO_N` - Turno de noche
- `FORMACION` - Formación
- `JUICIO` - Juicio/citación
- `OTRO` - Otro evento (meta: `{label, diasAfectados}`)

### LedgerMovement
Movimientos contables de días libres.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (UUID) | Clave primaria |
| `profileId` | string | FK a Profile |
| `dateISO` | string | Fecha del movimiento |
| `kind` | 'CREDIT' \| 'DEBIT' \| 'ADJUST' | Tipo de movimiento |
| `category` | 'GUARDIA' \| 'LIBRE' \| 'OTROS' \| 'ADJUST' | Categoría |
| `amount` | number | Cantidad (+/-) |
| `sourceRef` | string | Referencia origen (ej: "G.03/02") |
| `note` | string | Descripción |
| `createdAt` | ISO datetime | Fecha de creación |

### ServiceLog
Registro de servicios operativos (bitácora).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (UUID) | Clave primaria |
| `profileId` | string | FK a Profile |
| `dateISO` | string | Fecha del servicio |
| `startTime` | string (HH:MM) | Hora inicio (opcional) |
| `endTime` | string (HH:MM) | Hora fin (opcional) |
| `durationMin` | number | Duración en minutos |
| `type` | string | Tipo de servicio (configurable) |
| `locationGeneral` | string | Municipio/distrito |
| `unit` | string | Unidad/área |
| `tags` | string[] | Etiquetas |
| `notes` | string | Notas operativas |
| `sensitivity` | 'NORMAL' \| 'SENSIBLE' | Nivel de sensibilidad |
| `createdAt` | ISO datetime | Fecha de creación |

### Config
Configuración clave-valor de la aplicación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `key` | string | Clave primaria |
| `value` | any | Valor |

Claves principales:
- `appConfig` - Configuración general (reglas, tipos de servicio, etc.)
- `pinHash` - Hash del PIN de bloqueo
- `darkMode` - Preferencia de modo oscuro
- `lastProfileId` - Último perfil activo

### Audit
Log de auditoría de cambios.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (UUID) | Clave primaria |
| `profileId` | string | FK a Profile |
| `action` | string | Tipo de acción |
| `detail` | string | Detalle |
| `timestamp` | ISO datetime | Timestamp |

## Migración desde v1 (calendarioDB)

La migración automática convierte:

| v1 (calendarioDB) | v2 (calguardDB) |
|---|---|
| Store `dias` (fecha, tipo, detalle) | Store `days` con tags[] |
| tipo='guardia' | tag GUARDIA_REAL |
| tipo='proxima-guardia' | tag GUARDIA_PLAN |
| tipo='libre' | tag LIBRE |
| tipo='vacaciones' | tag VACACIONES |
| tipo='asunto' | tag AP |
| tipo='tarde' | tag TURNO_T |
| tipo='mañana' | tag TURNO_M |
| tipo='otros' | tag OTRO con meta |
| Store `configuracion` → guardiasRealizadas | Store `ledger` (movimientos CREDIT) |
| Store `registro` | Store `audit` |

La migración se ejecuta una sola vez en el primer arranque y se marca como completada. Los datos originales no se eliminan por seguridad.

## Índices

| Store | Índice | Campo |
|-------|--------|-------|
| profiles | name | name |
| days | profileId | profileId |
| days | dateISO | dateISO |
| ledger | profileId | profileId |
| ledger | dateISO | dateISO |
| ledger | kind | kind |
| ledger | category | category |
| services | profileId | profileId |
| services | dateISO | dateISO |
| services | type | type |
| audit | profileId | profileId |
| audit | timestamp | timestamp |
