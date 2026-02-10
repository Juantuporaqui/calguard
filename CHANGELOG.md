# CHANGELOG - CalGuard

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
