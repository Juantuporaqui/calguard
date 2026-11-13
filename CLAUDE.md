# CalGuard — reglas permanentes

PWA offline-first en JavaScript, sin dependencias remotas (cuadrantes de guardia de un grupo policial).

- No modificar la lógica de `js/domain/*` salvo petición expresa; está cubierta por tests.
- Mantener offline-first y cero dependencias remotas (nada de CDN ni librerías nuevas).
- Todo texto de interfaz en español llano, tuteando, sin jerga (INC, CH, ledger, arrastre).
- Ningún `font-size` por debajo de `.75rem`; todo lo pulsable mide al menos 44x44 px.
- Los diálogos se hacen solo con `js/ui/sheet.js` (`openSheet` / `confirmDialog`).
- Todo dato interpolado en HTML pasa por `esc()` de `js/ui/utils.js`.
- Cualquier cambio de esquema de datos pasa por `js/persistence/migrations.js`.
- Cada entrega: `npm test` en verde, incrementar `CACHE_VERSION` en `service-worker.js`, añadir los archivos nuevos a `ASSETS_TO_CACHE` y anotar el cambio en `CHANGELOG.md`.
- Probar a 320, 390 y 768 px de ancho, en tema claro y oscuro.
