# CHANGELOG - CalGuard

## v2.3.0 - Contabilidad automática de libres desde el cuadrante

### Contabilidad automática (libranzas)
- Al importar el cuadrante, la app **lleva la cuenta sola**: cada semana con guardia (INC) genera 5 días libres fijos y cada libre disfrutado (CH) se descuenta, **cargándolo automáticamente a la guardia más antigua con saldo**
- Distingue **generados** vs **disfrutados** y calcula **cuántos te quedan**; nueva tarjeta de resumen en el panel (Generados − Disfrutados = Te quedan)
- Núcleo de reconciliación **puro e idempotente** (`js/domain/reconcile.js`): reimportar el mismo cuadrante no duplica movimientos; se puede reejecutar sin riesgo
- Nuevo campo en Ajustes: **saldo inicial de libres** (arrastre de periodos anteriores), materializado como ajuste contable
- 11 tests nuevos del motor contable + verificación end-to-end con un cuadrante real (155 generados / 119 disfrutados / 36 restantes, reconciliación idempotente)

## v2.2.0 - Vista semana y cuadrante compartible

### Calendario
- **Vista semana**: nuevo selector Semana / Mes / Año en el calendario. La vista semanal muestra cada día como una fila con los eventos con nombre completo y los servicios de la bitácora de ese día; navegación por semanas y clic para editar el día
- Botón "Hoy" devuelve a la semana/mes actual en cualquier vista

### Cuadrante grupal compartible
- **Compartir → CalGuard**: la app instalada se registra como destino de compartir (Web Share Target). Al recibir el cuadrante (.xlsx, .pdf, .csv o .json) por correo o WhatsApp, basta con "Compartir → CalGuard" y se importa automáticamente
- Botón "Compartir con el grupo (JSON)": comparte el cuadrante ya interpretado por WhatsApp/correo con la Web Share API (con descarga como alternativa); los compañeros lo importan con un toque
- El input de archivo del cuadrante acepta también .json y .csv/.txt
- Accesos directos de la app instalada (pulsación larga del icono): Calendario, Cuadrante, Bitácora; arranque por hash (`#calendar`, `#cuadrante`...)

### Ajustes
- Sección "Reglas y cupos personales" con explicación: cada funcionario configura sus propios asuntos propios, vacaciones y días por guardia

## v2.1.0 - Seguridad, offline real y base de tests

### Correcciones críticas
- **Banner de actualización**: el botón "Actualizar" no funcionaba (handler inline bloqueado por la CSP). Ahora usa `addEventListener` y la recarga espera al `controllerchange` del nuevo service worker
- **XSS**: todos los datos no confiables (nombres importados de Excel/PDF, notas, tipos configurables) se escapan con `esc()` (`js/ui/utils.js`) antes de interpolarse en HTML

### Offline y cadena de suministro
- SheetJS y pdf.js **vendorizados** en `vendor/` (antes se cargaban de CDN): la importación de Excel/PDF funciona sin conexión
- CSP endurecida: `script-src 'self'` sin CDNs externos
- Service worker: estrategia cache-first coherente por versión (sin mezcla de módulos viejos/nuevos), fallback a `index.html` en navegaciones offline, sin `skipWaiting` automático (la actualización solo se aplica al aceptar el banner)

### Seguridad del PIN
- Formato v3: salt aleatorio por registro (antes salt fijo), comparación en tiempo constante, migración automática desde v2 al desbloquear
- Límite de intentos con espera exponencial y cuenta atrás

### Datos
- Base de datos `calguardDB v3`: nuevo store `cuadrante`; el cuadrante grupal se migra automáticamente desde localStorage y **ahora entra en el backup/restore**
- El orden del escalafón ya no está hardcodeado: se configura en Ajustes (`config.escalafonOrder`)

### Calidad
- Suite de tests del dominio con `node:test` (cero dependencias): reglas, contadores, conflictos, parser, cifrado y escape HTML
- CI en GitHub Actions: tests + verificación de coherencia del precache del service worker (`scripts/check-sw-assets.mjs`)

## v2.0.0 - Reescritura completa

### Arquitectura
- Reescritura completa del monolito `events.js` en módulos ES separados
- Nuevo esquema modular: `domain/`, `persistence/`, `ui/`, `state/`, `exports/`
- Patrón reducer para gestión de estado centralizado (`state/store.js`)
- Base de datos `calguardDB v2` con esquema versionado y migración automática
- Eliminación de `nueva_carpeta/` y `app.js` (código duplicado)
- Eliminación del directorio `scripts/` (reemplazado por `js/`)

### Calendario
- Eliminados años hardcodeados (2024/2025/2026)
- Navegación dinámica por mes y año (sin límites)
- Vista de mes individual o año completo
- Selector "Hoy" para volver al mes actual

### Modelo de datos
- Nuevo modelo `Day.tags[]` (un día puede tener múltiples tipos)
- Ledger de movimientos con trazabilidad completa
- Servicios (bitácora) como entidad independiente
- Perfiles para aislamiento de datos
- Auditoría de cambios

### Guardias y libranzas
- Motor de guardias con reglas configurables
- Ledger contable: CREDIT (guardia realizada) / DEBIT (libre gastado) / ADJUST
- Ordinal de días libres (D.1, D.2... de cada guardia)
- Detección de conflictos (guardia vs vacaciones, etc.)
- Prohibición de saldo negativo con flujo de resolución

### Bitácora de servicios
- Registro de servicios operativos con campos no sensibles
- Tipos configurables (IO, Levantamiento, Laboratorio, etc.)
- Etiquetas y filtros
- Estadísticas por tipo, período y mes
- Advertencia contra introducción de PII

### Exportaciones
- iCalendar (.ics) para importar en otros calendarios
- CSV para movimientos, servicios y días
- Vista imprimible con CSS @media print
- Plantillas de mensaje (resumen semanal, guardias, solicitud días)
- Compartir vía Web Share API o copiar al portapapeles

### Seguridad
- PIN local con hash PBKDF2 (600k iteraciones)
- Auto-bloqueo configurable (1-60 min)
- Content Security Policy estricta en index.html
- Backup cifrado con AES-GCM + PBKDF2
- Cero llamadas externas

### PWA
- Service Worker reescrito con stale-while-revalidate
- Cache completo de todos los assets
- Limpieza de caches antiguos por versión
- Banner de actualización con acción "Actualizar"
- skipWaiting + clientsClaim

### UI/UX
- Diseño mobile-first profesional
- Modo oscuro con variables CSS
- Barra de navegación inferior (5 secciones)
- Menú contextual organizado por categorías
- Accesibilidad: ARIA labels, keyboard navigation, focus visible
- Tipografía sistema (sin fuentes externas)
- Responsive: móvil, tablet, desktop
- Estilos de impresión

### Diagnóstico
- Pantalla de diagnóstico interno con 10 tests automáticos
- Test de IndexedDB, ledger, contadores, duplicados, SW, cache, perfiles, tags
- Informe descargable en texto plano (sin datos sensibles)

### Backup/Restore
- Exportación JSON completa con todos los stores
- Exportación cifrada con passphrase
- Importación con validación de esquema
- Modo reemplazar o fusionar
- Migración de versión en importación
