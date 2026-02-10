# CalGuard - Cuadrante y Bitácora Operativa

**Policía Científica - Cuerpo Nacional de Policía**

Aplicación web progresiva (PWA) offline-first para la gestión de cuadrantes de guardia, libranzas, servicios y estadísticas operativas del Grupo de Policía Científica.

## Características principales

- **Calendario multi-año dinámico** sin años hardcodeados, con navegación mes/año
- **Motor de guardias** con reglas configurables (5 días libres por guardia semanal)
- **Ledger de libranzas** con trazabilidad completa (créditos, débitos, ajustes)
- **Bitácora de servicios** para registro de actividad operativa (IO, levantamientos, laboratorio, etc.)
- **Estadísticas** por tipo, período y carga de trabajo
- **Exportaciones**: ICS (calendario), CSV (movimientos/servicios), vista imprimible (PDF vía navegador)
- **Backup/restore** con validación de esquema y cifrado opcional (AES-GCM)
- **Seguridad**: PIN local + auto-bloqueo por inactividad + CSP estricta
- **PWA offline**: Service Worker con stale-while-revalidate + banner de actualización
- **Diagnóstico interno** para validar integridad sin pruebas manuales
- **Modo oscuro** y diseño accesible (keyboard navigation, ARIA labels)
- **Cero dependencias externas**: ni CDN, ni analytics, ni llamadas remotas

## Instalación / Uso

1. Sirve los archivos desde cualquier servidor HTTP estático (Apache, Nginx, `python -m http.server`, etc.)
2. Abre `index.html` en el navegador
3. En móvil: "Añadir a pantalla de inicio" para instalar como app
4. Funciona completamente offline tras la primera carga

### Requisitos

- Navegador moderno con soporte ES Modules (Chrome 80+, Firefox 80+, Safari 14+)
- IndexedDB habilitado
- JavaScript habilitado

## Estructura del proyecto

```
calguard/
├── index.html              # Punto de entrada con CSP
├── manifest.webmanifest    # PWA manifest
├── service-worker.js       # SW v2 (stale-while-revalidate)
├── css/
│   └── styles.css          # Estilos (light/dark, responsive, print)
├── js/
│   ├── app.js              # Bootstrap de la aplicación
│   ├── domain/
│   │   ├── rules.js        # Reglas de guardia, validaciones, fechas
│   │   ├── ledger.js       # Contabilidad de libranzas (movimientos)
│   │   └── services.js     # Bitácora operativa
│   ├── persistence/
│   │   ├── db.js           # IndexedDB wrapper (calguardDB v2)
│   │   ├── migrations.js   # Migración desde versión anterior
│   │   ├── crypto.js       # WebCrypto (PBKDF2 + AES-GCM)
│   │   └── backup.js       # Export/import backup
│   ├── state/
│   │   └── store.js        # Estado central (patrón reducer)
│   ├── ui/
│   │   ├── renderer.js     # Orquestador de vistas
│   │   ├── nav.js          # Barra de navegación
│   │   ├── dashboard.js    # Panel principal
│   │   ├── calendar.js     # Vista de calendario
│   │   ├── contextMenu.js  # Menú contextual de día
│   │   ├── registry.js     # Bitácora de servicios
│   │   ├── stats.js        # Estadísticas
│   │   ├── settings.js     # Configuración
│   │   ├── diagnostics.js  # Diagnóstico interno
│   │   ├── lockScreen.js   # Pantalla de bloqueo PIN
│   │   └── toast.js        # Notificaciones
│   └── exports/
│       ├── ics.js          # Exportación iCalendar
│       ├── csv.js          # Exportación CSV
│       └── templates.js    # Plantillas de mensaje
├── icons/
│   ├── icon-192x192.png
│   └── icon-512x512.png
└── docs/                   # Documentación
```

## Modelo de datos

Ver [DATA_MODEL.md](DATA_MODEL.md) para el esquema completo.

## Seguridad

Ver [SECURITY.md](SECURITY.md) para detalles de CSP, PIN, cifrado y recomendaciones.

## Manual operativo

Ver [MANUAL_OPERATIVO_POLICIA_CIENTIFICA.md](MANUAL_OPERATIVO_POLICIA_CIENTIFICA.md) para la guía de uso completa.

## Changelog

Ver [CHANGELOG.md](CHANGELOG.md).

## Licencia

Uso interno - Policía Científica CNP.
