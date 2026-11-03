# DATA_MODEL.md - Esquema de datos CalGuard v3

## Base de datos

- **Motor**: IndexedDB (navegador)
- **Nombre**: `calguardDB`
- **Versión**: 3

## Entidades

### Profile
Perfiles de usuario (aislamiento de datos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (UUID) | Clave primaria |
| `name` | string | Nombre del perfil |
| `role` | 'usuario' \| 'supervisor' \| 'admin' | Rol |
| `createdAt` | ISO datetime | Fecha de creación |
| `settings` | object | Ajustes propios: `asuntosAnuales`, `vacacionesAnuales`, `diasPorGuardia` (si difiere del grupo), `diasPorFestivo` (INC suelto en festivo: días por cada uno; vacío = cuenta como guardia), `carryovers`, `libresExentos` (fechas de libres concedidos que no computan) |
| `cuadranteName` | string (opcional) | Nombre canónico de la persona en el cuadrante del grupo (vínculo) |
| `syncDesde` | YYYY-MM-DD (opcional) | Desde qué fecha se sincroniza con el cuadrante |
| `lastSyncAt` | ISO datetime (opcional) | Última sincronización |
| `settingsMeta` | object (opcional) | Cuándo cambió cada dato personal: `{ 'asuntosAnuales': ISO, 'carry.2026.ap': ISO, … }` (manda el cambio más reciente) |
| `fichaAdminAt` | ISO datetime (opcional) | Última vez que se aplicó la ficha publicada por el administrador |

`settings.carryovers[año] = { libres, ap, vacaciones, primerLibre, primerAP, primerVac, caducaAP }`
(`caducaAP`: hasta cuándo valen los AP del año anterior; por defecto el 25 de marzo, regla `apPlazo: '03-25'`):
lo pendiente del año anterior y la fecha del primer día disfrutado del año nuevo
(lo anterior a esa fecha consume el arrastre, no el cupo).

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
- `EVENTO` - Eventos especiales del día, sin efecto en saldos (meta: `{items: [{id, kind: JUICIO|TIRO|CURSO|REUNION|EVENTO|OTRO, title, hora, lugar, nota}]}`)

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
| `sourceRef` | string | Referencia origen (ej: "G.03/02", o "ARRASTRE") |
| `note` | string | Descripción |
| `festivo` | boolean (opcional) | Crédito de un festivo suelto (`sourceRef` `F.dd/mm`), no cuenta como guardia |
| `origin` | 'cuadrante' \| 'manual' | Quién lo creó: la sincronización lo sustituye solo si es `cuadrante` |
| `createdAt` | ISO datetime | Fecha de creación |

Las etiquetas importadas llevan `meta.source = 'cuadrante'`; las apuntadas a mano no,
y la sincronización nunca las toca.

**Saldos** (no se guardan: se derivan en `js/domain/balances.js`):
- Libres: `disponibles = arrastre restante + generados (guardias cuyo lunes ya llegó) + ajustes − disfrutados − pedidos futuros`
  (una guardia que cruza de año cuenta en el año de su domingo: `guardYear(lunes)`)
- AP / vacaciones: `disponibles = arrastre restante + cupo − disfrutados − pedidos`
- Sin arrastre indicado (0 y sin fecha de corte), el arrastre se **deduce**: libres ya disfrutados que no cubre ninguna guardia del año, y AP/vacaciones ya disfrutados que exceden el cupo, cuentan como del año anterior (`arrastreEstimado`)

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
- `appConfig` - Configuración general (reglas, tipos de servicio, orden del escalafón, `carryovers` por año, etc.). `carryovers` es un objeto `{ "2026": { libres, ap, vacaciones } }` con el arrastre manual del año anterior que la contabilidad anual suma al saldo del año.
- `pinHash` - Registro del PIN de bloqueo: `{salt, hash, v:3}` (formato legado v2: string hex)
- `pinAttempts` - Contador de intentos fallidos de PIN: `{count, lastFailAt}`
- `darkMode` - Preferencia de modo oscuro
- `lastProfileId` - Último perfil activo

### Cuadrante
Cuadrante grupal importado (Excel/PDF). Añadido en la v3; antes vivía en localStorage (`calguard-cuadrante`) y se migra automáticamente al primer acceso. Se incluye en el backup desde la versión 3 del formato de backup.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `key` | string | Clave primaria (`'grupal'`) |
| `data` | object | `{entries, names, importedAt, fileName}` |
| `updatedAt` | ISO datetime | Última modificación |

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


## Cuadrante compartido (publicado cifrado)

Archivo `data/cuadrante.enc.json` en el repositorio (servido por GitHub Pages, que es público):

```json
{ "format": "calguard-cuadrante-grupo", "v": 1, "publishedAt": "ISO", "gz": true,
  "payload": "base64( salt(16) + iv(12) + AES-GCM( gzip( {entries, fileName, fichas} ) ) )" }
```

La clave se deriva de la contraseña del grupo con PBKDF2-SHA256 (600 000 iteraciones). En cada
dispositivo, `config.groupKey` guarda la contraseña; solo el del administrador guarda además
`config.ghPublish = {token, owner, repo, branch, lastPublishedAt}`.

`fichas` = `{ 'TESA': { values: { asuntosAnuales: 11, diasPorGuardia: 7, 'carry.2026.ap': 2, … }, meta: { <campo>: ISO } } }`.
Al sincronizar un perfil se aplica la ficha de su persona: por cada campo gana la fecha más
reciente entre la del administrador (`meta`) y la del propio perfil (`settingsMeta`).
