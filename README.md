# CalGuard - Cuadrante y Bitácora Operativa

**Policía Científica - Cuerpo Nacional de Policía**

Aplicación web progresiva (PWA) offline-first para la gestión de cuadrantes de guardia, libranzas, servicios y estadísticas operativas del Grupo de Policía Científica.

## Características principales

- **Un perfil por funcionario**: cada uno con su calendario, sus cupos de AP/vacaciones y su arrastre del año anterior; se cambia desde la cabecera
- **Contabilidad automática desde el cuadrante**: cada semana de guardia (INC) genera 5 libres al llegar su lunes; los libres (CH), AP y vacaciones se descuentan, también los pedidos a futuro, para no pedir de más. Panel con disponibles, disfrutados, pedidos y guardias previstas
- **Importar = sincronizar**: reimportar el cuadrante actualiza sin duplicar y respeta lo apuntado a mano; con vista previa
- **Deshacer** en las acciones importantes y mensaje listo para enviar al pedir días
- **Cuadrante compartido cifrado**: el administrador lo publica con un toque y cada compañero lo recibe solo al abrir la app (contraseña del grupo)
- **Actualizaciones automáticas**: la app se pone al día sola, sin borrar caché ni usar incógnito
- **Eventos especiales** (juicio, tiro, curso…) con bocadillo en el calendario y libres concedidos que no computan
- **Calendario multi-año dinámico** con vistas semana / mes / año y navegación libre
- **Cuadrante grupal compartible**: importa el cuadrante del grupo (Excel/PDF/CSV/JSON) y compártelo interpretado por WhatsApp/correo; con la app instalada, "Compartir → CalGuard" lo importa automáticamente
- **Motor de guardias** con reglas configurables (5 días libres por guardia semanal)
- **Ledger de libranzas** con trazabilidad completa (créditos, débitos, ajustes)
- **Bitácora de servicios** para registro de actividad operativa (IO, levantamientos, laboratorio, etc.)
- **Estadísticas** por tipo, período y carga de trabajo
- **Exportaciones**: ICS (calendario), CSV (movimientos/servicios), vista imprimible (PDF vía navegador)
- **Backup/restore** con validación de esquema y cifrado opcional (AES-GCM)
- **Seguridad**: PIN local + auto-bloqueo por inactividad + CSP estricta
- **PWA offline**: Service Worker con stale-while-revalidate; la app se actualiza sola, sin avisos
- **Diagnóstico interno** para validar integridad sin pruebas manuales
- **Modo oscuro** y diseño accesible (keyboard navigation, ARIA labels)
- **Cero dependencias remotas**: ni CDN, ni analytics, ni llamadas remotas (SheetJS y pdf.js vendorizadas en `vendor/`, carga perezosa)
- **Tests + CI**: suite de dominio con `node:test` (sin dependencias) y GitHub Actions que verifica además la coherencia del precache offline

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
├── service-worker.js       # Service Worker (la versión de caché es CACHE_VERSION en este archivo)
├── css/
│   └── styles.css          # Estilos (light/dark, responsive, print)
├── js/
│   ├── app.js              # Bootstrap de la aplicación
│   ├── domain/
│   │   ├── rules.js        # Reglas de guardia, validaciones, fechas
│   │   ├── balances.js     # Saldos anuales (libres, AP, vacaciones, guardias)
│   │   ├── reconcile.js    # Cuadrante → movimientos; asignación de libres a guardias
│   │   ├── cuadranteSync.js# Importar como sincronización (respeta lo manual)
│   │   ├── groupCuadrante.js # Cuadrante del grupo y plantilla (escalafón)
│   │   ├── profiles.js     # Un perfil por funcionario
│   │   ├── changes.js      # Cambios atómicos con deshacer
│   │   ├── ledger.js       # Contabilidad de libranzas (movimientos)
│   │   └── services.js     # Bitácora operativa
│   ├── persistence/
│   │   ├── db.js           # IndexedDB wrapper (calguardDB v3)
│   │   ├── migrations.js   # Migración desde versión anterior
│   │   ├── crypto.js       # WebCrypto (PBKDF2 + AES-GCM)
│   │   └── backup.js       # Export/import backup
│   ├── state/
│   │   └── store.js        # Estado central (patrón reducer)
│   ├── ui/
│   │   ├── renderer.js     # Orquestador de vistas (renderizado selectivo)
│   │   ├── header.js       # Cabecera con el perfil activo
│   │   ├── nav.js          # Barra de navegación
│   │   ├── sheet.js        # Hojas y diálogos accesibles
│   │   ├── flows.js        # Flujos: cambiar perfil, abrir contabilidad, sincronizar
│   │   ├── theme.js        # Tema automático / claro / oscuro
│   │   ├── cuadrante.js    # Cuadrante del grupo
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
├── vendor/                 # Librerías vendorizadas (SheetJS, pdf.js) - carga perezosa
├── tests/                  # Tests de dominio (node --test, sin dependencias)
├── scripts/
│   └── check-sw-assets.mjs # Verifica coherencia del precache del SW
├── icons/
│   ├── icon-192x192.png
│   └── icon-512x512.png
└── docs/                   # Documentación
```

## Desarrollo

```bash
npm test        # Tests de dominio (requiere Node >= 20, sin npm install)
npm run check-sw  # Comprueba que ningún módulo quede fuera del precache offline
```

Al añadir cualquier archivo `.js` nuevo bajo `js/` o `vendor/`, añádelo también a
`ASSETS_TO_CACHE` en `service-worker.js` e incrementa `CACHE_VERSION` (el CI lo verifica).

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
