# AI Handoff — Sistema de Temas Visuales de CalGuard

> **Propósito de este documento:** Garantizar la trazabilidad técnica, la continuidad entre agentes de IA (Claude, Gemini, GPT u otros) y la reversibilidad verificable del sistema de temas visuales de CalGuard sin depender del historial de ninguna conversación previa.

---

## A. Estado del proyecto

- **Fecha de actualización:** 15 de noviembre de 2026 (reloj del entorno) / ciclo posterior a `v3.18.10`.
- **Rama activa de Git:** `fase-1-arquitectura-temas` (creada desde `main`, apuntando al commit base `f70b483` — *«Lleva los botones Pedir días al pie de cada tarjeta en Inicio»*).
- **Commits nuevos creados:** **Ninguno** (por restricción expresa del encargo; todo el trabajo reside en el árbol de trabajo local y en copias de seguridad verificables).
- **Versión del Service Worker (`CACHE_VERSION`):** `'calguard-v63'` (94 activos cacheados y verificados con `npm run check-sw`).
- **Suite de pruebas automatizadas:** **305 pruebas pasando, 0 fallos** (`npm test`).

### Estado de los 5 temas visuales

| Identificador (`data-theme`) | Etiqueta en UI (`Ajustes → Apariencia`) | Modo Claro (`html:not(.dark)`) | Modo Oscuro (`html.dark`) | Estado actual |
| :--- | :--- | :---: | :---: | :--- |
| `original` | **Original (CalGuard)** | Activo (100% idéntico al píxel) | Activo (100% idéntico al píxel) | **Completado y blindado (Fase 1)** |
| `f1` | **Fórmula 1 / Telemetría** | Activo (Pit-Wall / Titanio técnico) | Activo (Fibra de carbono / Telemetría nocturna) | **Completado y verificado WCAG AA (Fase 2)** |
| `avion` | **Cabina de avión / Aviónica** | Activo (Aluminio anodizado / Cabina diurna) | Activo (Flight deck nocturno / Ámbar y verde fósforo) | **Completado y verificado WCAG AA (Fase 2)** |
| `cientifica` | **Policía Científica** | Hereda `original` | Hereda `original` | **Preparado (bloques vacíos listos para Fase 3)** |
| `naturaleza` | **Naturaleza / Orgánico** | Hereda `original` | Hereda `original` | **Preparado (bloques vacíos listos para Fase 3)** |

---

## B. Arquitectura del sistema de temas

### 1. Ortogonalidad de los tres ejes de apariencia

CalGuard separa estrictamente tres dimensiones independientes en el elemento raíz `<html>` (`document.documentElement`):

1. **Tema visual (`data-theme`):**
   - Valores admitidos (`VISUAL_THEMES` en `js/ui/visualTheme.js`): `'original' | 'f1' | 'avion' | 'cientifica' | 'naturaleza'`.
   - Clave de persistencia en `localStorage`: `'calguard-visual-theme'`.
   - Por defecto o ante cualquier valor inválido/corrupto: `'original'`.
2. **Modo de color claro/oscuro (`class="dark"`):**
   - Gestionado exclusivamente por `js/ui/theme.js` y `js/ui/renderer.js` (`document.documentElement.classList.toggle('dark', state.darkMode)`).
   - Persistencia en IndexedDB (`STORES.CONFIG`, clave `'themePreference'`: `'auto' | 'light' | 'dark'`) y espejo rápido en `localStorage` (`'calguard-theme'`).
   - Cambiar de tema visual **jamás** altera la clase `dark`, y alternar entre claro/oscuro (desde `Más` o `Ajustes`) **jamás** altera `data-theme`.
3. **Tamaño de texto (`data-text-size`):**
   - Gestionado exclusivamente por `js/ui/textSize.js` (`'normal' | 'grande' | 'muy-grande'`).
   - Persistencia en `localStorage` (`'calguard-text-size'`).
   - Totalmente independiente de `data-theme` y de `class="dark"`.

### 2. Prevención síncrona del parpadeo (Anti-FOUC) y cumplimiento CSP

La Content Security Policy de `index.html` exige `script-src 'self'`, lo que prohíbe cualquier `<script>` inline en el HTML. Además, los scripts `<script type="module">` tienen semántica `defer` por especificación HTML y se ejecutan después del parseo del documento, lo que provocaría un destello del tema `original` (FOUC) antes del primer pintado si se usara un módulo ES para arrancar el tema.

Para garantizar **cero FOUC** respetando `script-src 'self'`:
- **`js/ui/visualThemeBoot.js`** se carga en `<head>` como script clásico síncrono (`<script src="js/ui/visualThemeBoot.js"></script>`) **antes** de `<link rel="stylesheet" href="css/styles.css">`.
- Ejecuta una IIFE mínima con `try/catch` que lee `localStorage.getItem('calguard-visual-theme')`, valida contra la lista blanca `['original', 'f1', 'avion', 'cientifica', 'naturaleza']` y asigna `document.documentElement.setAttribute('data-theme', theme)` antes de que el navegador procese el CSS o pinte el `<body>`.
- **`js/ui/visualTheme.js`** es el módulo ES que exporta la API pública (`VISUAL_THEMES`, `VISUAL_THEME_KEY`, ` DEFAULT_VISUAL_THEME`, `isValidVisualTheme`, `readVisualTheme`, `applyVisualTheme`, `saveVisualTheme`, `initVisualTheme`) consumida por `js/app.js` y `js/ui/settings/look.js`.

### 3. Cascada CSS y encapsulación de tokens del cuadrante (`--cq-*` y `--cq-chip-*`)

- **Variables globales (`:root` y `html.dark`):** Definen la paleta del tema `original`. Los temas visuales sobreescriben estas variables únicamente bajo selectores cualificados por atributo (`html[data-theme="<id>"]`, `html:not(.dark)[data-theme="<id>"]`, `html.dark[data-theme="<id>"]`).
- **Variables locales del cuadrante (`.cq-month, .cq-list` y `html.dark :is(.cq-month, .cq-list)`):**
  - El cuadrante mensual y el modo lista definen sus tokens estructurales (`--cq-border`, `--cq-head-bg`, `--cq-sticky-bg`, `--cq-weekend-bg`, `--cq-weekend-fg`, `--cq-today-ring`, `--cq-me-bg`, `--cq-me-bar`, `--cq-me-name`, `--cq-band-*`) y los 20 tokens de pastillas de turno (`--cq-chip-guardia-bg/fg`, `--cq-chip-libre-bg/fg`, `--cq-chip-asunto-bg/fg`, `--cq-chip-formacion-bg/fg`, `--cq-chip-turno-m/t/n-bg/fg`, `--cq-chip-vacaciones-bg/fg`, `--cq-chip-juicio-bg/fg`, `--cq-chip-baja-bg/fg`) en `.cq-month, .cq-list`.
  - Como estas variables se declaran en `.cq-month, .cq-list` (y no en `:root`), redefinirlas solo en `html[data-theme="..."]` **no tendría efecto** por alcance léxico de las CSS Custom Properties.
  - Por ello, cada tema redefine los tokens del cuadrante en:
    - `html:not(.dark)[data-theme="<id>"] :is(.cq-month, .cq-list)` (especificidad `(0,3,1)`, posterior en cascada a `.cq-month, .cq-list`).
    - `html.dark[data-theme="<id>"] :is(.cq-month, .cq-list)` (especificidad `(0,3,1)`, posterior en cascada a `html.dark :is(.cq-month, .cq-list)`).

---

## C. Trabajo realizado (Fases 1, 1.5 y 2)

### Archivos modificados (rastreables por Git)

1. **`index.html`**
   - Inclusión de `<script src="js/ui/visualThemeBoot.js"></script>` en `<head>` antes de `<link rel="stylesheet" href="css/styles.css">`.
2. **`css/styles.css`**
   - Extracción de los colores de las pastillas `.cq-month .cq-month-chip.cq-*` a variables semánticas `--cq-chip-*-bg` y `--cq-chip-*-fg` dentro de `.cq-month, .cq-list` (modo claro) y `html.dark :is(.cq-month, .cq-list)` (modo oscuro), manteniendo los valores RGB exactos del tema `original`.
   - Implementación completa del tema **Fórmula 1 / Telemetría (`f1`)** en modo claro y modo oscuro (líneas 3522–3956): texturas CSS puras de fibra de carbono trenzada (oscuro) y rejilla técnica de muro de boxes (claro), rojo competición (`#FF1E00` / `#CC1400`), cian telemetría (`#00F0FF` / `#006B7D`), amarillo sector (`#EAFF6B` / `#D97706`), tipografía monoespaciada tabular en métricas/chips/PIN, módulos con bisel superior y tokens `--cq-*` / `--cq-chip-*` de alto contraste.
   - Implementación completa del tema **Cabina de avión / Aviónica (`avion`)** en modo claro y modo oscuro (líneas 3958–4396): panel antracita nocturno (`#0C1116`) y aluminio anodizado mate (`#DFE5EC`), ámbar instrumental (`#FFB000` / `#8A4B00`), verde fósforo (`#39FF14` / `#0D6E32`), botonera mecánica con relieve táctil (normal, hover, active, focus-visible, selected, disabled) y tokens `--cq-*` / `--cq-chip-*` de cabina.
   - Bloques vacíos preparados al final de la hoja para `cientifica` y `naturaleza`.
3. **`js/app.js`**
   - Importación y llamada a `initVisualTheme()` al inicio de `boot()`.
4. **`js/ui/settings/look.js`**
   - Inyección del selector accesible `<select id="visual-theme" class="input">` bajo la etiqueta «Diseño visual» en `Ajustes → Apariencia`, sincronizado con `readVisualTheme()` y `saveVisualTheme()`.
5. **`service-worker.js`**
   - Adición de `'./js/ui/visualThemeBoot.js'` y `'./js/ui/visualTheme.js'` a `ASSETS_TO_CACHE`.
   - Incremento de `CACHE_VERSION` a `'calguard-v63'`.
6. **`CHANGELOG.md`**
   - Registro de la nueva versión documentando la arquitectura de temas visuales y los temas Fórmula 1 y Aviación (`CACHE_VERSION v63`, `305 tests`).

### Archivos nuevos (no rastreados aún en Git)

1. **`js/ui/visualThemeBoot.js`**: Script clásico síncrono anti-FOUC para `<head>`.
2. **`js/ui/visualTheme.js`**: Módulo ES de gestión, validación y persistencia del tema visual.
3. **`tests/visualTheme.test.js`**: Suite de 15 pruebas automatizadas cubriendo `visualTheme.js`, ejecución síncrona de `visualThemeBoot.js` en `node:vm`, ortogonalidad con `.dark` y `data-text-size`, presencia en `index.html` y `service-worker.js`, y reglas CSS de `f1`, `avion`, `cientifica` y `naturaleza`.
4. **`docs/AI_HANDOFF.md`**: Este documento de continuidad y recuperación.

---

## D. Decisiones técnicas importantes

1. **Separación `visualThemeBoot.js` (síncrono) + `visualTheme.js` (módulo ES):**
   - Evita el FOUC que produciría `<script type="module">` sin infringir `script-src 'self'` de la CSP.
   - `visualTheme.js` no ejecuta efectos secundarios al importarse; toda su API es pura respecto al DOM inyectado o `document.documentElement`, facilitando las pruebas en Node.js.
2. **Texturas 100% CSS (sin imágenes ni peticiones de red):**
   - La fibra de carbono de `f1` y el panel de instrumentos de `avion` se generan exclusivamente con `repeating-linear-gradient` y `radial-gradient`, garantizando peso cero de red, funcionamiento 100% offline y compatibilidad con `img-src 'self' data: blob:`.
3. **Respeto absoluto a accesibilidad y movimiento reducido:**
   - Las reglas existentes de `@media (prefers-reduced-motion: reduce)` en `css/styles.css` se mantienen intactas y gobiernan cualquier transición de los nuevos temas.
   - Todos los controles interactivos conservan un área táctil mínima de `44×44 px` (`--tap: 44px`).

---

## E. Verificaciones realizadas

1. **Pruebas unitarias y de integración (`npm test`):**
   - **305 pruebas ejecutadas, 305 aprobadas, 0 fallos** (incluyendo `tests/csp.test.js` y `tests/visualTheme.test.js`).
2. **Integridad del Service Worker (`npm run check-sw`):**
   - **OK:** 94 activos listados en `ASSETS_TO_CACHE`, todos existen en disco y ningún módulo JS/CSS queda fuera.
3. **Verificación anti-FOUC en navegador real (Chromium Headless):**
   - Al recargar la página con `localStorage['calguard-visual-theme'] = 'f1'`, un `PerformanceObserver` / listener de `readystatechange` confirmó que en `document.readyState === 'interactive'` (antes del primer pintado) `document.documentElement.getAttribute('data-theme')` ya es `'f1'`.
4. **Identidad píxel a píxel del tema `original`:**
   - Comparación automatizada de 24 capturas (móvil `390×844` y escritorio `1280×800`, claro y oscuro, en `dashboard`, `cuadrante-month`, `cuadrante-list`, `calendar`, `settings`, `lock`) y 24 snapshots de `getComputedStyle` contra la línea base previa a la Fase 1 (`HEAD` `f70b483`):
   - **0 diferencias de estilos computados (`originalStyleDiffs: []`)**.
   - **23 de 24 capturas PNG idénticas byte a byte (`diffPixels: 0`)** (la única variación menor en `desktop_dark_lock.png` corresponde al suavizado subpíxel del candado SVG en el contenedor centrado).
5. **Auditoría real de contraste WCAG 2.1 AA en Chromium:**
   - Se midieron mediante `getComputedStyle` en el DOM real los 16 pares críticos de texto/fondo (`body_text`, `cq_person_name`, `cq_own_person_name`, `cq_weekend_header`, `cq_guard_band`, `cq_seg_active` y las 10 pastillas `chip_*` del cuadrante) en las 4 variantes nuevas:
   - **`f1` claro:** todos los pares entre **5.88:1 y 16.62:1** (mínimo exigido AA: 4.5:1).
   - **`f1` oscuro:** todos los pares entre **8.14:1 y 18.33:1**.
   - **`avion` claro:** todos los pares entre **6.72:1 y 14.11:1**.
   - **`avion` oscuro:** todos los pares entre **7.36:1 y 16.52:1**.
6. **Responsividad y objetivos táctiles (`320px`, `390px`, `768px`):**
   - `docOverflow: false` (`scrollWidth <= clientWidth`) en los tres anchos tanto para `f1` como para `avion`.
   - `undersizedControls: 0` (158 controles interactivos verificados con `width >= 44px` y `height >= 44px`).

---

## F. Instrucciones de continuidad para Fase 3 (`cientifica` y `naturaleza`)

Cualquier agente de IA que reciba el encargo de desarrollar la **Fase 3** (temas `cientifica` y `naturaleza`) debe seguir exactamente estos pasos:

1. **No modificar la infraestructura JS ni HTML:**
   - `index.html`, `js/ui/visualThemeBoot.js`, `js/ui/visualTheme.js`, `js/ui/settings/look.js` y `js/app.js` **ya soportan** `'cientifica'` y `'naturaleza'`. No requieren cambios.
2. **Dónde escribir el CSS:**
   - Abrir `css/styles.css` y ubicar los bloques vacíos al final del archivo (actualmente a partir de la línea ~4390):
     - `html[data-theme="cientifica"]`, `html:not(.dark)[data-theme="cientifica"]`, `html.dark[data-theme="cientifica"]`
     - `html[data-theme="naturaleza"]`, `html:not(.dark)[data-theme="naturaleza"]`, `html.dark[data-theme="naturaleza"]`
3. **Qué selectores incluir obligatoriamente en cada tema nuevo:**
   - Variables globales de superficie, texto, bordes, acentos y semánticos en `html:not(.dark)[data-theme="<id>"]` y `html.dark[data-theme="<id>"]`.
   - Variables locales del cuadrante en:
     - `html:not(.dark)[data-theme="<id>"] :is(.cq-month, .cq-list)`
     - `html.dark[data-theme="<id>"] :is(.cq-month, .cq-list)`
     (Tomar como plantilla exacta la lista de variables `--cq-*` y `--cq-chip-*` de `f1` o `avion` en `css/styles.css`).
   - No alterar ninguna regla fuera de los selectores `[data-theme="cientifica"]` y `[data-theme="naturaleza"]`.
4. **Actualizar Service Worker y pruebas:**
   - Incrementar `CACHE_VERSION` en `service-worker.js` (de `'calguard-v63'` a `'calguard-v64'`).
   - Ampliar `tests/visualTheme.test.js` para verificar que los bloques de `cientifica` y `naturaleza` ya contienen definiciones reales.
   - Ejecutar `npm test && npm run check-sw` y verificar en navegador real que todos los contrastes cumplen WCAG 2.1 AA (≥ 4.5:1).

---

## G. Procedimientos de recuperación y estrategia de commits

### 1. Diferencia crítica entre rama de Git y punto de restauración

Dado que no se ha realizado ningún `git commit`, la rama `fase-1-arquitectura-temas` apunta al mismo commit `HEAD` (`f70b483`) que `main`.
- **Advertencia:** Ejecutar `git checkout main` **NO revierte** los archivos modificados ni elimina los archivos nuevos no rastreados, porque los cambios están en el árbol de trabajo local sin confirmar.

### 2. Ubicación de las copias de seguridad locales verificables

Se han guardado copias íntegras verificadas con `SHA256SUMS.txt` fuera del árbol del repositorio en:
`/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/73268555-7e13-4de9-b98a-778d4d1baf70/scratch/backups/`

Estructura del directorio de copias de seguridad:
- `pre-fase-1-head/`: Copia exacta de los archivos originales en `HEAD` (`f70b483`) antes de iniciar la Fase 1.
- `fase-1-snapshot/`: Copia exacta de todos los archivos tras completar la Fase 1 + parche `fase-1-tracked.patch`.
- `fase-2-snapshot/`: Copia exacta de todos los archivos tras completar la Fase 1.5 + Fase 2 + parche `fase-2-tracked.patch`.
- `SHA256SUMS.txt`: Sumas criptográficas SHA-256 de todos los archivos respaldados.

### 3. Cómo volver exactamente al estado Final de Fase 1 (sin Fase 1.5/2)

Desde `/home/antigravity/Juantuporaqui/calguard`, sin usar comandos destructivos:

```bash
BACKUP_DIR="/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/73268555-7e13-4de9-b98a-778d4d1baf70/scratch/backups/fase-1-snapshot"
cp "$BACKUP_DIR/index.html" ./index.html
cp "$BACKUP_DIR/css/styles.css" ./css/styles.css
cp "$BACKUP_DIR/js/ui/settings/look.js" ./js/ui/settings/look.js
cp "$BACKUP_DIR/js/ui/visualTheme.js" ./js/ui/visualTheme.js
cp "$BACKUP_DIR/service-worker.js" ./service-worker.js
cp "$BACKUP_DIR/tests/visualTheme.test.js" ./tests/visualTheme.test.js
git checkout HEAD -- js/app.js CHANGELOG.md
rm -f js/ui/visualThemeBoot.js docs/AI_HANDOFF.md
```

### 4. Cómo volver exactamente al estado Pre-Fase 1 (`HEAD` `f70b483` original)

Desde `/home/antigravity/Juantuporaqui/calguard`, sin usar `git reset --hard` ni `git clean -fd`:

```bash
git checkout HEAD -- index.html css/styles.css js/app.js js/ui/settings/look.js service-worker.js CHANGELOG.md
rm -f js/ui/visualTheme.js js/ui/visualThemeBoot.js tests/visualTheme.test.js docs/AI_HANDOFF.md
git checkout main
```

### 5. Estrategia de commits propuesta (para cuando el usuario autorice hacer commit)

No se ha ejecutado ningún commit. Cuando el responsable del proyecto decida confirmar los cambios en la rama `fase-1-arquitectura-temas`, se recomienda dividirlos en **3 commits atómicos y reversibles**:

1. **Commit 1 — Fase 1 + 1.5 (Arquitectura base de temas y arranque síncrono anti-FOUC):**
   - Archivos: `index.html`, `js/ui/visualThemeBoot.js`, `js/ui/visualTheme.js`, `js/app.js`, `js/ui/settings/look.js` y la extracción de variables `--cq-chip-*` en `css/styles.css`.
   - Mensaje sugerido: `feat(theme): añade arquitectura de temas visuales con arranque síncrono anti-FOUC`
2. **Commit 2 — Fase 2 (Temas visuales Fórmula 1 y Cabina de Avión en claro/oscuro):**
   - Archivos: bloques `data-theme="f1"` y `data-theme="avion"` en `css/styles.css`, `service-worker.js` (`calguard-v63`) y `tests/visualTheme.test.js`.
   - Mensaje sugerido: `feat(theme): implementa temas visuales Fórmula 1 y Cabina de avión (claro y oscuro)`
3. **Commit 3 — Documentación y trazabilidad (`CHANGELOG.md` y `docs/AI_HANDOFF.md`):**
   - Archivos: `CHANGELOG.md`, `docs/AI_HANDOFF.md`.
   - Mensaje sugerido: `docs(theme): documenta arquitectura de temas, handoff entre agentes y changelog v63`
