# PLAN MAESTRO — CalGuard: de app profesional a app magistral

> **ESTADO DE EJECUCIÓN** (actualizado en esta misma rama):
> - ✅ **FASE 1 completa** (P0-1 a P0-6): implementada y verificada. No repetir.
> - ✅ **FASE 3 completa** (P1-5, P1-6): `npm test` (43 tests en verde), CI en `.github/workflows/ci.yml`, `scripts/check-sw-assets.mjs`. No repetir.
> - ⬜ FASE 2 (P1-1 parcial: el SW ya es cache-first sin skipWaiting automático; quedan P1-2, P1-3, P1-4), FASE 4 y FASE 5: **pendientes** — empezar por P1-2.
>
> **Documento de ejecución para IA implementadora.**
> Auditoría realizada sobre el commit `2b85c2f` (main). Cada tarea indica: archivo exacto, línea aproximada, qué hacer, cómo verificarlo y qué NO hacer.
> **Ejecuta las fases EN ORDEN. No saltes a la Fase 4 sin completar la Fase 1.**

---

## 0. Contexto: qué es esta app y qué la hace valiosa

CalGuard es una **PWA offline-first, sin framework y sin build step** (ES Modules nativos) para gestión de cuadrantes de guardia, libranzas, bitácora de servicios y estadísticas de un grupo de Policía Científica (CNP). Arquitectura actual:

- **Estado**: reducer central en `js/state/store.js` (patrón Redux simplificado).
- **Persistencia**: IndexedDB (`js/persistence/db.js`, esquema en `DATA_MODEL.md`), cifrado opcional AES-GCM (`js/persistence/crypto.js`).
- **UI**: renderizado por `innerHTML` orquestado en `js/ui/renderer.js`; una función `render*` por pantalla.
- **Dominio**: reglas de guardias/libranzas en `js/domain/rules.js`, contabilidad en `js/domain/ledger.js`.
- **Importación**: parser de cuadrantes Excel/PDF en `js/imports/cuadranteParser.js`.
- **PWA**: `service-worker.js` (stale-while-revalidate), `manifest.webmanifest`.

**Principio rector (NO negociable): la app debe seguir funcionando 100 % offline, sin build step obligatorio, sin analytics, sin llamadas remotas en runtime.** Toda mejora que viole esto queda descartada.

---

## GUARDARRAÍLES PARA LA IA IMPLEMENTADORA (leer antes de tocar nada)

1. **Un commit por tarea**, con el ID de tarea en el mensaje (ej: `fix(P0-1): banner de actualización bloqueado por CSP`).
2. **No introduzcas frameworks** (React, Vue, etc.), ni bundlers obligatorios, ni TypeScript. JSDoc ya cumple la función de tipos.
3. **No reescribas módulos enteros**: haz cambios mínimos y localizados. Si un cambio toca más de 3 archivos, divídelo.
4. **No borres datos ni cambies el esquema de IndexedDB sin migración** (patrón en `js/persistence/migrations.js`).
5. **No modifiques la lógica contable del ledger** (`js/domain/ledger.js`) salvo donde este plan lo indique: es el corazón del sistema y los usuarios tienen datos reales.
6. Tras cada tarea, ejecuta la **verificación** indicada. Si no puedes verificar, no des la tarea por cerrada.
7. Textos de UI **siempre en español**.
8. Si el service worker cambia o cambia cualquier asset, **incrementa `CACHE_VERSION`** en `service-worker.js:7`.

---

## FASE 1 — P0: Bugs reales y seguridad (obligatoria, ~1 día)

### P0-1. El botón "Actualizar" del banner de nueva versión NO funciona (bloqueado por CSP)

- **Dónde**: `js/ui/renderer.js:62-66`.
- **Problema**: el banner usa `onclick="import('./js/app.js')..."` inline. La CSP de `index.html:6` (`script-src 'self'` sin `'unsafe-inline'`) **bloquea todos los handlers inline**, así que el botón no hace nada. El usuario nunca puede actualizar desde el banner.
- **Qué hacer**:
  1. Quitar el `onclick` inline del template del banner.
  2. Tras insertar el banner en el DOM, añadir:
     ```js
     import { applyUpdate } from '../app.js'; // arriba del módulo
     document.querySelector('#update-banner button')?.addEventListener('click', applyUpdate);
     ```
  3. Ojo: el banner solo se inserta cuando cambia la pantalla (`state.currentScreen !== lastScreen`). Muévelo a un contenedor fijo propio (`<div id="update-banner-container">`) que se actualice en cada render, igual que `toast-container`.
- **Además**: `applyUpdate()` en `js/app.js:151-162` tiene una condición de carrera: hace `postMessage({SKIP_WAITING})` y llama a `location.reload()` inmediatamente, antes de que el SW nuevo tome el control. Corregir: recargar en el evento `controllerchange` (que ya se escucha en `js/app.js:143` con cuerpo vacío):
  ```js
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  ```
  y eliminar el `location.reload()` directo de `applyUpdate`.
- **Verificación**: servir la app (`python3 -m http.server`), cargarla, incrementar `CACHE_VERSION`, recargar → aparece banner → clic en "Actualizar" → la página se recarga con la versión nueva. Comprobar en consola que no hay errores de CSP.

### P0-2. XSS mediante archivos Excel/PDF importados (nombres sin escapar)

- **Dónde**:
  - `js/ui/settings.js:402` → `selectEl.innerHTML += `<option value="${name}">${name}</option>``
  - `js/ui/cuadrante.js:317` → `<td class="cq-name-cell" title="${name}">${abbr}</td>`
  - `js/ui/cuadrante.js:334` → `data-person="${name}" title="Importar turnos de ${name}"`
  - `js/ui/cuadrante.js:242` → `<h3>Importar turnos de ${name}</h3>`
- **Problema**: los nombres provienen del archivo importado (contenido no confiable). Un XLSX manipulado con un nombre tipo `"><img src=x onerror=...>` inyecta HTML. `escapeHtml` existe pero solo en `js/ui/registry.js:243` (privada).
- **Qué hacer**:
  1. Crear `js/ui/utils.js`:
     ```js
     /** Escapa texto para interpolar en HTML (contenido y atributos entre comillas dobles). */
     export function esc(str) {
       return String(str ?? '')
         .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
         .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
     }
     ```
  2. Sustituir TODAS las interpolaciones de datos de usuario/importados (`name`, `abbr`, `nombre`, notas, etiquetas, tipos de servicio personalizados) por `esc(...)` en: `cuadrante.js`, `settings.js`, `calendar.js` (labels de tag `OTRO`, meta.label), `contextMenu.js`, `stats.js`, `dashboard.js`.
  3. Borrar el `escapeHtml` local de `registry.js` e importar `esc` desde `utils.js`.
  4. Añadir `./js/ui/utils.js` a `ASSETS_TO_CACHE` en `service-worker.js` e incrementar `CACHE_VERSION`.
- **Regla de búsqueda**: grep de `\$\{` en `js/ui/*.js`; toda interpolación cuyo origen no sea una constante del código debe pasar por `esc()`.
- **Verificación**: importar un XLSX con un nombre de persona `<img src=x onerror=alert(1)>` → debe verse el texto literal, sin ejecutar nada.

### P0-3. Dependencias CDN contradicen el modelo offline/seguridad (SheetJS y pdf.js)

- **Dónde**: `js/imports/cuadranteParser.js:66-110` carga `https://cdn.sheetjs.com/xlsx-0.20.3/...` y `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/...`; la CSP de `index.html:6` los permite en `script-src` y `worker-src`.
- **Problema**: (a) el README promete "cero dependencias externas, ni CDN"; (b) la importación falla sin internet — rompe el contrato offline-first; (c) riesgo de cadena de suministro: un CDN comprometido ejecuta código con acceso a todos los datos locales.
- **Qué hacer**:
  1. Crear carpeta `vendor/` y descargar UNA VEZ (verificando integridad):
     - `vendor/xlsx.full.min.js` (SheetJS 0.20.3, misma versión que hoy).
     - `vendor/pdf.min.mjs` y `vendor/pdf.worker.min.mjs` (pdf.js 4.4.168).
  2. En `cuadranteParser.js`: cambiar las URLs por rutas locales (`./vendor/...` relativas a `index.html`). Mantener la carga perezosa (solo al importar un archivo) para no penalizar el arranque. Eliminar el fallback a pdf.js 3.x (`:104-107`): con archivo local no hay fallback que valga.
  3. Endurecer la CSP en `index.html:6` a: `script-src 'self'; worker-src 'self' blob:;` (eliminar ambos CDNs).
  4. Añadir los tres archivos de `vendor/` a `ASSETS_TO_CACHE` + bump de `CACHE_VERSION`. **Atención**: son ~1-2 MB; está bien, es una app instalable.
  5. Actualizar `README.md` y `SECURITY.md` para reflejar que las librerías están vendorizadas (versión y origen documentados).
- **Verificación**: con DevTools en modo offline (tras primera carga), importar un XLSX y un PDF → ambos funcionan. En la pestaña Network no debe aparecer ninguna petición a dominios externos.

### P0-4. PIN con salt fijo y sin límite de intentos

- **Dónde**: `js/persistence/crypto.js:81-93` (`salt = 'calguard-pin-salt-v2'`), `js/ui/lockScreen.js`.
- **Problema**: salt fijo y público → un atacante con acceso al hash puede precomputar los 10 000 PINs de 4 dígitos una sola vez y romper cualquier dispositivo. Sin throttling, también por fuerza bruta en vivo.
- **Qué hacer**:
  1. Nuevo formato de almacenamiento del PIN: `{ salt: <base64 16 bytes aleatorios>, hash: <hex>, v: 3 }` en la clave `pinHash` de config.
  2. `hashPIN(pin, saltB64)`: si no recibe salt, genera uno con `crypto.getRandomValues`. Devuelve `{salt, hash}`.
  3. `verifyPIN(pin, stored)`: retrocompatible — si `stored` es un string (formato v2), verificar con el salt fijo antiguo y, si acierta, **regrabar inmediatamente en formato v3** (migración transparente al primer desbloqueo).
  4. En `lockScreen.js`: contador de intentos fallidos persistido en config (`pinAttempts`); a partir del 5.º fallo, retardo exponencial (`2^(n-4)` segundos, tope 60 s) con cuenta atrás visible y campo deshabilitado. Resetear contador al acertar.
- **NO hacer**: no cambies `PBKDF2_ITERATIONS` ni el cifrado AES-GCM del backup: son correctos.
- **Verificación**: crear PIN, recargar, desbloquear (migra a v3 — comprobar en DevTools > IndexedDB que `pinHash` es objeto). Fallar 6 veces → aparece espera. Un PIN v2 antiguo sigue desbloqueando.

### P0-5. El cuadrante grupal vive en localStorage: fuera del backup y del modelo de datos

- **Dónde**: `js/ui/cuadrante.js:12,39-50` (`localStorage['calguard-cuadrante']`).
- **Problema**: todos los demás datos están en IndexedDB con perfiles y entran en el backup (`js/persistence/backup.js`); el cuadrante grupal no. Un restore en móvil nuevo pierde el cuadrante silenciosamente. Además localStorage es síncrono y con límite ~5 MB.
- **Qué hacer**:
  1. Añadir store `cuadrante` a IndexedDB: bump de versión de BD en `js/persistence/db.js` (v2 → v3) creando el store en `onupgradeneeded` (keyPath `key`). Guardar como `{ key: 'grupal', data, updatedAt }`.
  2. En `cuadrante.js`: sustituir `loadData/saveData` por `get/put` asíncronos del store nuevo. Migración perezosa: si el store está vacío y existe `localStorage['calguard-cuadrante']`, copiarlo y borrar la clave de localStorage.
  3. Incluir el store en `backup.js` (export e import) y en la validación de esquema.
  4. Documentar el store en `DATA_MODEL.md`.
- **Verificación**: cargar cuadrante → exportar backup → borrar datos del sitio → restaurar backup → el cuadrante grupal reaparece.

### P0-6. Hardcode de nombres reales del grupo en el código fuente

- **Dónde**: `js/ui/cuadrante.js:19` → `ESCALAFON_ORDER = ['TESA', 'PACO', ...]`.
- **Problema**: datos personales reales incrustados en un repositorio de código; además el orden del escalafón no es configurable para otros grupos.
- **Qué hacer**: mover a `config.escalafonOrder` (array de strings, por defecto `[]` = orden alfabético). Añadir en Ajustes un textarea "Orden del escalafón (un nombre por línea)". `sortByEscalafon` lo lee del estado. Eliminar la constante del código.
- **Verificación**: sin configurar → orden alfabético; configurando nombres → ese orden manda.

---

## FASE 2 — P1: Robustez de arquitectura (~1-2 días)

### P1-1. Service worker: versiones mixtas de módulos y precache frágil

- **Dónde**: `service-worker.js`.
- **Problemas**:
  - *Stale-while-revalidate* por archivo puede servir `app.js` viejo con `store.js` nuevo tras un deploy (estados intermedios corruptos).
  - `cache.addAll` es todo-o-nada sin control de error: si un asset falla, el SW no instala y no hay log.
- **Qué hacer** (mantener la simplicidad, sin Workbox):
  1. Estrategia **cache-first estricta** para todos los assets de `ASSETS_TO_CACHE` (nunca red si hay caché): la versión desplegada es siempre coherente porque el precache de `install` descarga el conjunto completo de la versión nueva en una caché nueva (`CACHE_VERSION`), y solo se activa al completarse. Eliminar la actualización en segundo plano por archivo.
  2. En `install`, usar `cache.addAll` dentro de `event.waitUntil` con `.catch(err => { console.error('[SW] precache failed', err); throw err; })`.
  3. En `install`, **quitar `self.skipWaiting()` automático** (línea 47): contradice el flujo de banner "Actualizar" — hoy el SW nuevo se activa solo y el banner es decorativo. `skipWaiting` solo debe ejecutarse al recibir el mensaje `SKIP_WAITING` (ya implementado en `:91-95`).
  4. Para navegaciones (`event.request.mode === 'navigate'`), responder con `caches.match('./index.html')` como fallback offline.
- **Verificación**: deploy de una versión con cambio visible → la versión vieja sigue sirviéndose íntegra → banner → "Actualizar" → versión nueva íntegra. Offline: abrir la app desde el icono instalado funciona.

### P1-2. Estado: contadores derivados automáticamente y `getState` seguro

- **Dónde**: `js/state/store.js`, `js/app.js:167-171`.
- **Problemas**: (a) `recalcCounters()` debe invocarse manualmente tras cada mutación (hoy se importa desde la UI creando dependencia circular `ui/calendar.js → app.js`); olvidar llamarlo = contadores desincronizados. (b) `getState()` dice devolver "read-only copy" pero devuelve la referencia viva.
- **Qué hacer**:
  1. En el reducer, tras las acciones `SET_DAYS`, `UPDATE_DAY`, `REMOVE_DAY_TAG`, `SET_LEDGER`, `ADD_LEDGER`, `REMOVE_LEDGER`, `SET_CONFIG`: recalcular `counters` con `calculateCounters(nuevo.days, nuevo.ledger, nuevo.config)` dentro del propio reducer (importar desde `domain/rules.js` — el dominio no importa nada de UI, no hay ciclo).
  2. Eliminar `recalcCounters` de `app.js` y todas sus llamadas (grep `recalcCounters` en `js/ui/*.js`); eliminar la acción `SET_COUNTERS` si queda sin usos.
  3. `getState`: dejar la referencia (rendimiento) pero corregir el comentario y congelar en desarrollo: `return state;` con JSDoc `@returns {Readonly<AppState>}`. No usar `Object.freeze` en producción (coste por dispatch).
- **Verificación**: marcar guardia en el calendario → el contador del dashboard cambia sin código extra. Grep `recalcCounters` → 0 resultados.

### P1-3. Rendimiento de render: delegación de eventos e índice de días

- **Dónde**: `js/ui/calendar.js` (922 líneas), `js/ui/renderer.js`.
- **Problemas**: cada dispatch re-renderiza la pantalla activa completa con `innerHTML` y re-ata decenas de listeners (uno por celda de día, `:102-109`); en vista año son ~365. Además la búsqueda de un día es `days.find(...)` O(n) por celda → O(n²) por render.
- **Qué hacer**:
  1. **Delegación**: un único listener `click` en `#calendar-grid-container` que resuelva `e.target.closest('.day[data-date]')`. Eliminar el bucle de listeners por celda. Aplicar el mismo patrón en `cuadrante.js` (botones por fila) y `registry.js` (botones por tarjeta).
  2. **Índice**: construir una vez por render `const dayMap = new Map(state.days.map(d => [d.dateISO, d]))` y pasarlo a `renderMonth`/`renderFullYear` en lugar de hacer `find` por celda.
  3. Limpiar estado muerto: `calendarRendered`/`forceRender` (`calendar.js:16,39-41`) se calculan y no se usan — eliminarlos.
  4. En `renderer.js`, evitar re-render de pantalla cuando la acción solo afecta a overlays: si únicamente cambian `toast`/`contextMenu`, actualizar solo esos contenedores. Implementación simple: guardar referencia del último `state` y comparar campos relevantes por pantalla.
- **NO hacer**: no introducir virtual DOM ni librerías de diffing.
- **Verificación**: en vista "año completo", abrir Performance de DevTools y hacer clic en un día: el render debe bajar de forma apreciable y no debe haber cientos de listeners (Memory > Event Listeners).

### P1-4. Accesibilidad real (WCAG AA)

- **Dónde**: `index.html`, `js/ui/calendar.js`, `js/ui/contextMenu.js`, `js/ui/toast.js`, `js/ui/nav.js`.
- **Qué hacer** (lista cerrada):
  1. `index.html:18`: quitar `role="main"` del `<div id="app">` (ya se genera `<main>` dentro; roles duplicados confunden a lectores de pantalla).
  2. Celdas de día: son `<div>` clicables. Añadir `role="button"`, `tabindex="0"`, `aria-label` descriptivo (`"12 de marzo, Guardia realizada"`) y manejar `Enter`/`Espacio` en el listener delegado (`keydown`).
  3. Menú contextual (`contextMenu.js`): `role="menu"`/`role="menuitem"`, foco al abrirse en el primer ítem, cierre con `Escape`, y devolución del foco a la celda de origen al cerrar.
  4. Toast (`toast.js`): contenedor con `aria-live="polite"` permanente en el DOM (no crear/destruir, si no el lector no lo anuncia).
  5. Nav (`nav.js`): `aria-current="page"` en la pestaña activa.
  6. Contraste: verificar con DevTools que los chips de colores de tags sobre fondo oscuro alcanzan 4.5:1; ajustar variables en `css/styles.css` si no.
- **Verificación**: navegar toda la app solo con teclado (Tab/Enter/Escape) sin quedar atrapado; Lighthouse Accessibility ≥ 95.

---

## FASE 3 — P1: Tests y CI (la base para que "una IA inferior no cometa errores") (~1 día)

**Este es el multiplicador de seguridad de todo el plan: sin tests, cualquier modelo que toque el ledger puede corromper datos reales sin enterarse.**

### P1-5. Suite de tests del dominio con `node:test` (cero dependencias)

- **Qué hacer**:
  1. Crear `package.json` mínimo: `{ "name": "calguard", "private": true, "type": "module", "scripts": { "test": "node --test tests/" } }`. **No añadir dependencias.** `node:test` + `node:assert` vienen con Node ≥ 20.
  2. Crear `tests/` con estos archivos y casos (mínimo):
     - `tests/rules.test.js`: `getWeekDates` (lunes-domingo, cambio de año), `getDateRange`, `countWorkingDays`, `isWeekend`, `detectConflict` (todas las combinaciones de la matriz de `rules.js:104-125`), `calculateCounters` (crédito de guardia +5, débito de libre, ADJUST, AP restantes, vacaciones con/sin fines de semana según `excludeWeekendsVacation`), `firstDayOffset` (enero 2026 = jueves → offset 3), `getLibreOrdinal`.
     - `tests/ledger.test.js`: importar funciones puras de `ledger.js`; si dependen de IndexedDB, extraer la lógica pura (cálculo de saldo, `findAvailableGuard`) a funciones sin I/O y testear esas. **Refactor permitido solo para separar I/O de cálculo, sin cambiar resultados.**
     - `tests/cuadranteParser.test.js`: testear las funciones puras de parseo de celdas/tokens (mapeo texto→TagType) con strings representativos de `IMPORT_EXAMPLES.md`.
     - `tests/crypto.test.js`: roundtrip `encrypt`→`decrypt`, `verifyPIN` v2 y v3 (en Node 20 `globalThis.crypto` existe).
  3. Los módulos de dominio no deben importar nada de `ui/` ni de `persistence/db.js` para ser testeables; si algún import lo impide, invertir la dependencia (pasar datos como argumentos).
- **Verificación**: `npm test` en verde, ≥ 40 asserts.

### P1-6. CI en GitHub Actions

- **Qué hacer**: crear `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22 }
        - run: npm test
        - name: Comprobar coherencia del precache del SW
          run: node scripts/check-sw-assets.mjs
  ```
  Crear `scripts/check-sw-assets.mjs`: lee `ASSETS_TO_CACHE` de `service-worker.js` (regex sobre el array) y falla si (a) algún archivo listado no existe, o (b) existe algún `.js` bajo `js/` o `vendor/` que no esté listado. Esto elimina la clase entera de bugs "módulo nuevo que no funciona offline".
- **Verificación**: push a una rama → workflow verde; borrar un archivo del array → workflow rojo.

---

## FASE 4 — P2: Diseño y UX de nivel magistral (~2-3 días)

Regla general: **pulir lo que ya existe antes que añadir**. Todo en `css/styles.css` usa ya variables CSS; apóyate en ellas.

### P2-1. Microinteracciones y percepción de calidad

1. **Transiciones de pantalla**: al cambiar de vista, aplicar en `#screen-content` una animación CSS de 150 ms (`opacity` + `translateY(4px)` → 0). Solo con `@media (prefers-reduced-motion: no-preference)`.
2. **Feedback táctil**: en móvil, `navigator.vibrate?.(10)` al marcar/desmarcar un tag de día y al confirmar acciones destructivas (envuélvelo en try/catch; iOS lo ignora).
3. **Estados vacíos con acción**: cada pantalla sin datos debe ofrecer el siguiente paso (ej. en Estadísticas sin servicios: botón "Registrar primer servicio" que navega a Bitácora). Ya existe el patrón `.empty-state` en `cuadrante.js:120`; generalizarlo.
4. **Esqueletos**: sustituir el spinner de arranque por un esqueleto del dashboard (bloques grises pulsantes con la MISMA geometría que las tarjetas reales) — reduce la percepción de espera.
5. **Pulsación larga en móvil** sobre una celda de día (500 ms, `touchstart`/`touchend`) para abrir el menú contextual, además del clic.

### P2-2. Calendario: gestos y densidad de información

1. **Swipe horizontal** para cambiar de mes: listeners `touchstart`/`touchend` en `#calendar-grid-container`; umbral 50 px; reutilizar los handlers de `prev-month`/`next-month`. Animación de deslizamiento de 150 ms.
2. **Indicador "hoy" persistente**: si el mes visible no contiene hoy, mostrar botón flotante discreto "Hoy" (ya existe `#goto-today`, hacerlo sticky).
3. **Mini-resumen del mes** bajo el grid: "2 guardias · 3 libres · 1 juicio" calculado del `dayMap` ya construido.
4. **Vista año como mapa de calor**: en la vista año completo, además de los puntos de tags, tintar sutilmente cada día según carga (nº de servicios registrados ese día) con `background: color-mix(in srgb, var(--accent) X%, transparent)`.

### P2-3. Dashboard como centro de mando

- **Dónde**: `js/ui/dashboard.js`.
1. Bloque "**Próximos eventos**": lista de los 5 próximos días con tags futuros (guardias planificadas, juicios, vacaciones) con cuenta regresiva ("Guardia en 6 días"). Datos: filtrar `state.days` por `dateISO >= todayISO()`, ordenar, cortar a 5.
2. Bloque "**Salud del saldo**": barra de progreso de libres acumulados vs. gastados del año + AP restantes + vacaciones restantes (los datos ya están en `state.counters`).
3. **Aviso de backup**: si la última exportación de backup (guardar `lastBackupAt` en config al exportar en `backup.js`) tiene más de 30 días, mostrar tarjeta amarilla "Hace N días del último backup" con botón directo a exportar.

### P2-4. Tema e identidad visual

1. **Modo oscuro automático**: si el usuario no ha elegido manualmente (nueva clave `themePreference: 'auto'|'light'|'dark'` en config), seguir `matchMedia('(prefers-color-scheme: dark)')` y reaccionar a su evento `change`. Selector de 3 estados en Ajustes.
2. **`theme-color` dinámico**: actualizar el `<meta name="theme-color">` al alternar tema (oscuro `#1a2332`, claro el fondo claro del CSS).
3. **Iconos**: generar `icons/maskable-512.png` con safe-zone del 80 % y declararlo en `manifest.webmanifest` con `"purpose": "maskable"`; añadir `"shortcuts"` al manifest ("Calendario", "Bitácora") que abran con hash (`./#calendar`) y leer ese hash en el boot de `app.js` para fijar la pantalla inicial.
4. **Densidad**: revisar `styles.css` para que en pantallas < 360 px el calendario no desborde (usar `clamp()` en tamaños de celda).

### P2-5. Deshacer (undo) — la característica que separa lo profesional de lo magistral

- **Alcance acotado**: solo para las 3 acciones más frecuentes y arriesgadas: quitar tag de día, borrar servicio de bitácora, borrar movimiento de ledger.
- **Implementación**: antes de ejecutar el borrado, guardar el objeto completo en una variable módulo `lastDeleted = { kind, payload, expiresAt }`. El toast pasa a admitir acción: `showToast('Servicio eliminado', { actionLabel: 'Deshacer', onAction })` (ampliar `js/ui/toast.js`, hoy 22 líneas). `onAction` re-inserta con el mismo `id` vía `put` + dispatch. Ventana de 6 s.
- **Verificación**: borrar un servicio → toast con "Deshacer" → clic → el servicio reaparece idéntico (mismo id, mismos campos) en UI y en IndexedDB.

---

## FASE 5 — P3: Funcionalidades de gran creador (solo tras completar 1-4)

Ordenadas por relación impacto/esfuerzo. Implementar de una en una.

1. **Exportar cuadrante personal como imagen** para compartir por WhatsApp con el grupo: render del mes a `<canvas>` (dibujo manual, sin librerías) → `canvas.toBlob` → `navigator.share({files})` con fallback a descarga. Es la función más viral en un grupo real.
2. **Notificaciones locales de guardia**: con la app instalada, `Notification.requestPermission()` + comprobación al abrir ("Mañana tienes guardia"). Sin push remoto (violaría el principio offline); basta un check en el boot + `showNotification` del SW registration.
3. **Búsqueda global en bitácora** (`registry.js`): input de filtro por texto libre sobre tipo/lugar/notas/etiquetas, con debounce de 200 ms. Los datos ya están en memoria (`state.services`).
4. **Informe mensual imprimible**: vista `@media print` ya existe en CSS; añadir botón "Informe del mes" en Estadísticas que componga página con calendario del mes + tabla de servicios + totales, y llame a `window.print()`.
5. **Multi-perfil visible**: el modelo de datos ya soporta perfiles (`DATA_MODEL.md`); exponer en Ajustes: crear perfil, cambiar de perfil (recarga datos con `getAllByIndex` por `profileId`, ya usado en `app.js:77`), renombrar. Útil para compañeros que comparten dispositivo.
6. **Importación iCal inversa**: además de exportar ICS, permitir importar un .ics (parser propio de ~80 líneas: `BEGIN:VEVENT`/`DTSTART`/`SUMMARY`) mapeando por palabras clave a TagTypes.

---

## Definición de "hecho" global (checklist final)

- [ ] `npm test` verde con ≥ 40 asserts y CI activo.
- [ ] Cero peticiones a dominios externos en runtime (pestaña Network, sesión completa incluyendo importar Excel y PDF).
- [ ] CSP sin CDNs: `script-src 'self'`.
- [ ] Lighthouse (móvil): PWA instalable, Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- [ ] Flujo de actualización: banner → clic → nueva versión, verificado dos veces seguidas.
- [ ] Backup → restore reproduce el 100 % del estado (incluido cuadrante grupal y preferencias).
- [ ] Sin nombres de personas reales en el código fuente.
- [ ] Navegación completa por teclado sin trampas de foco.
- [ ] `README.md`, `DATA_MODEL.md` y `SECURITY.md` actualizados con cada cambio de esta lista.

## Orden de ejecución recomendado para la IA implementadora

```
P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P0-6   (seguridad y bugs: 6 commits)
P1-5 → P1-6                                (tests ANTES de refactors: 2 commits)
P1-2 → P1-3 → P1-1 → P1-4                  (arquitectura, protegida por tests)
P2-1 … P2-5                                (UX, un commit por bloque)
P3 (uno a uno, cada uno con su test si toca dominio)
```

> **Última advertencia a la IA implementadora**: si en algún punto una instrucción de este plan contradice lo que ves en el código real (líneas movidas, funciones renombradas), manda el código real: adapta la instrucción a su intención, no a su literalidad. Y nunca, bajo ninguna circunstancia, hagas un cambio en `domain/ledger.js` o `persistence/` sin un test que lo cubra primero.
