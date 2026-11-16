# CalGuard — continuidad de temas y paneles

Actualización: 15/11/2026. Base verificada: `d10395698997a05e8b0b0aa85ad4706f325345e7` en main (v3.19.0, temas F1/Aviación, cache v63). La información anterior sobre cambios sin commit y copias en otro equipo estaba desactualizada. El punto de recuperación real es ese commit.

F1 y Aviación Instrumental se publicaron en `3ca0e09`. Naturaleza y Policía Científica se añadieron en v3.22.0 y v3.23.0 respectivamente (cache actual v69). Las pruebas iniciales y sus límites están en [INSTRUMENTAL_QA.md](INSTRUMENTAL_QA.md).

## Cuatro preferencias independientes

| Preferencia | Representación | Persistencia |
|---|---|---|
| Tema visual | `html[data-theme]` | `calguard-visual-theme` |
| Claro/oscuro | `html.dark` | mecanismos existentes de `theme.js` |
| Tamaño de texto | mecanismo existente | `theme.js` / configuración existente |
| Panel de inicio | `html[data-dashboard="clasico\|instrumental"]` | `calguard-dashboard` |

La última columna guarda la preferencia, mientras `data-dashboard` expresa la presentación **efectiva**. Instrumental funciona con `f1`, `avion`, `cientifica` y `naturaleza`. Al volver desde un tema no compatible se recupera la preferencia. Un valor inválido vuelve a Clásico; si el almacenamiento falla, la selección funciona durante la sesión.

`visualThemeBoot.js` aplica ambos atributos antes del CSS mediante un script clásico síncrono, con acceso al almacenamiento protegido. `visualTheme.js` mantiene actualizado el panel al cambiar el tema. `settings/look.js` permite elegir el panel sin cambiar el estado operativo.

## Arquitectura de presentación

- `dashboard.js` sigue siendo dueño de todos los cálculos y de la única pasada de enlace de eventos. El HTML de Clásico no cambia.
- `dashboardInstrumental.js` recibe los saldos y las fechas ya disponibles. Antes de enlazar eventos, añade los SVG y mueve los mismos módulos existentes. Conserva IDs, campos, avisos, acciones y actualizaciones asíncronas. El orden DOM móvil coincide con el visual: libres, próxima guardia, cupos, semana, acontecimientos y guardias.
- `instruments.js` contiene geometría y conversión de fechas ISO a distancia en días naturales, sin imports de dominio. La escala incluye los valores negativos y superiores a la referencia; la cifra original nunca se recorta.
- F1 usa arcos concéntricos y cupos semicirculares. Aviación utiliza aguja, bisel, lectura inferior y escalas lineales segmentadas. Comparten datos, pero varían geometría y composición.
- `css/instrumental.css` solo afecta a `.dash-instrumental`. Las reglas cualificadas por `data-dashboard` resuelven la especificidad de los temas existentes. `css/styles.css` sigue siendo la hoja común para los temas visuales.
- No hay `js/ui/dataSizes.js`: el mecanismo existente se llama `applyDataSizes` y reside en `js/ui/utils.js`. Los nuevos SVG utilizan exclusivamente atributos nativos, sin estilos en línea.

## Ampliación futura

Para añadir Instrumental a un tema: crear su composición y estilos encapsulados, habilitar el identificador en `INSTRUMENTAL_THEMES` y en la comprobación síncrona de `visualThemeBoot.js`, y ampliar las pruebas de equivalencia entre arranque y runtime. No habilitar un tema antes de tener su presentación. Los temas visuales Científica y Naturaleza tienen estilos propios. En Naturaleza, `natureInstruments.js` añade relieve, hojas y gotas sobre los datos actuales de Inicio. `scienceInstruments.js` muestra una huella vectorial, los cupos en bandas y el desglose del saldo a demanda.

No duplicar lógica de cupos ni tocar `js/domain/*`. Mantener la independencia de las preferencias, la ruta intacta de Clásico y los controles existentes. Añadir cualquier módulo nuevo a `ASSETS_TO_CACHE` e incrementar la versión de caché.

## Verificación reproducible

`npm test` y `npm run check-sw`. Para navegador: `node scripts/prepare-instrumental-qa.mjs /ruta/al/checkout/d103956`, servir `dist/` en un origen **local de pruebas aislado** y abrir `qa.html`. La herramienta solo emplea datos sintéticos y nunca debe publicarse: `qa-refresh.html` elimina exclusivamente las cachés locales CalGuard y desregistra sus Service Workers en ese origen. No contiene credenciales reales. El fixture fija la fecha a 15/11/2026; no cambia los archivos de producción.

Las capturas muestran los paneles de la aplicación ejecutándose en Chromium, no imágenes generadas. No se ha realizado una auditoría integral de accesibilidad ni una comprobación de biometría en dispositivo físico.
