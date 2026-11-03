# CHANGELOG - CalGuard

## v3.4.2 - Panel más claro y ayuda

- **Próximamente**: las guardias salen como **semana completa** («Guardia · semana completa · 14–20 dic»), no solo los días con INC; un festivo pegado alarga el tramo (29 dic – 6 ene) y una guardia empezada dice «en curso»
- **Tocar Asuntos propios o Vacaciones** en Inicio muestra qué días son: del año anterior (con su caducidad), disfrutados y pedidos, agrupados en tramos
- **Ayuda** dentro de la app: botón «?» en la cabecera y en Ajustes (instalarla, primeros pasos, cómo cuenta, copias, administrador) y **«Enviar instrucciones a un compañero»**, un mensaje listo para WhatsApp (la contraseña del grupo va aparte)
- 117 tests. CACHE_VERSION v23

## v3.4.1 - Compensación por festivo suelto (la jefa)

- Nuevo dato en la ficha y en «Mi contabilidad»: **días por festivo suelto**. Un INC en un festivo sin guardia esa semana (ni pegada) deja de contar como guardia y genera esos días **por cada festivo**; las semanas con INC en fin de semana siguen siendo guardias con sus «días por guardia»
- Caso TESA (3 por guardia, 2 por festivo): 6 ene → 2 días (libra 9 y 12 ene), guardia del 22-23 ago → 3 (1, 18 y 21 sep), 9 oct → 2 (23 y 26 oct). En el mapa: «6 ene · festivo 2/2»
- Si el dato está vacío (resto del grupo), todo sigue igual. 115 tests. CACHE_VERSION v22

## v3.4.0 - Fichas de cada policía, botón Actualizar y festivos

- **Fichas de cada policía** (administrador): en Ajustes → Cuadrante compartido → *Fichas de cada policía* se ponen los AP y vacaciones de cada uno, sus días libres por guardia (p. ej. la jefa) y lo pendiente del año anterior con la caducidad de sus AP. Viajan **cifradas** con el cuadrante publicado: al instalar la app y decir quién eres, tu contabilidad ya está configurada
- **Cada uno puede cambiar lo suyo**: por cada dato manda el cambio **más reciente** (el tuyo o el del administrador). Republicar sin tocar un dato no pisa lo que cambiaste; si el administrador lo corrige después, manda su corrección. En «Mi contabilidad» se indica cuándo la configuró el administrador
- **Botón «Actualizar»** en el panel: descarga el cuadrante publicado si hay uno nuevo, rehace tu contabilidad y busca versión nueva de la app
- **Festivos**: una semana de guardia son siempre 5 días (o los del perfil), haya festivos o no. Un festivo con INC pegado a una guardia (p. ej. lunes 12 de octubre tras la guardia del 5 al 11, o martes 6 de enero) ya no cuenta como otra guardia
- 113 tests (nuevos: fichas y festivos). CACHE_VERSION v21

## v3.3.1 - Guardias que cruzan de año y lectura de diciembre de 2025

- **Lectura del Excel**: un bloque de mes con filas vacías entre el nombre del mes y la fila de días (DICIEMBRE de 2025 en el cuadrante real) se saltaba entero. Ahora se busca la fila de días unas filas más abajo
- **Guardia que cruza de año**: cuenta en el **año en que termina** (su domingo). La de Mario del 29/12/2025 al 04/01/2026 suma sus 5 libres a 2026, donde se gastaron (13-15 ene). En el mapa de guardias aparece como «29 dic ’25». La del 28/12/2026 contará en 2027
- 105 tests (nuevos: lector con filas vacías y caso MARIO). CACHE_VERSION v20

## v3.3.0 - Cuadrante compartido, actualizaciones solas y más control

### Mantenimiento sin esfuerzo
- **Actualización automática**: la versión nueva se instala sola y la app se recarga en cuanto no estás haciendo nada (si tienes una ventana abierta, espera). Se comprueba al abrir, al volver a la app y cada pocas horas. Se acabó el modo incógnito para ver la última versión
- **Cuadrante compartido del grupo (cifrado)**: el administrador carga el Excel y pulsa *Publicar para el grupo*; la app lo comprime, lo **cifra con la contraseña del grupo** (AES-GCM) y lo sube al repositorio con su token de GitHub. Cada compañero guarda una vez la contraseña y su móvil lo descarga solo al abrir la app; su contabilidad se pone al día sola. El repositorio es público, pero sin la contraseña el archivo es ilegible
- **Copias de seguridad**: botón *Guardar copia* que en el móvil abre «Compartir» (correo, Drive, WhatsApp), estado de la última copia y aviso en el panel si pasan 30 días sin copia. Se pide al navegador almacenamiento persistente

### Contabilidad
- **AP del año anterior caducan el 25/03** (configurable por año): hasta esa fecha los AP gastan primero los del año anterior; después, lo que quede caduca. El panel avisa de cuántos quedan y hasta cuándo
- **Días libres por guardia propios de cada perfil** (p. ej. la jefa con otra compensación); al cambiarlo se recalculan sus guardias
- **Libres concedidos que no computan** («regalo de la jefa»): desde el menú del día; quedan en el calendario con 🎁 y no restan ni consumen guardia

### Calendario y panel
- **Eventos especiales con bocadillo**: juicio ⚖️, tiro 🎯, curso 📚, reunión 👥, evento 📌… con título, hora, lugar y nota; varios por día; salen en el calendario, en la vista semana, en *Próximamente* y en la exportación .ics (con hora)
- **Pulsar una guardia** muestra en qué fechas se disfrutaron sus días y cuáles están pedidos
- Las copias de seguridad **no incluyen** la contraseña del grupo ni el token de GitHub (se vuelven a escribir tras restaurar)
- Correcciones: base64 por bloques en el cifrado (los archivos grandes ya no desbordan), .ics con fin de día correcto y texto escapado. 102 tests. CACHE_VERSION v19

## v3.2.1 - Sin recarga sorpresa en la primera visita

- La primera vez que se abría la app, el service worker tomaba el control y la página se **recargaba sola** a los pocos segundos (si estabas cargando el cuadrante, se perdía). Ahora solo se recarga al aceptar una actualización real. CACHE_VERSION v18

## v3.2.0 - Saldos que cuadran con el cuadrante real (caso JUAN)

- **Arrastre deducido del cuadrante** mientras no se indique a mano:
  - un **libre ya disfrutado que no cubre ninguna guardia del año** (todas las anteriores agotadas) es del año anterior y ya no resta del saldo
  - los **AP / días de vacaciones ya disfrutados que pasan del cupo** son del año anterior (los primeros del año)
  - El panel lo avisa con las fechas («1 libre (22 jun)…, 3 asuntos propios (9, 12 y 13 ene)…») y Ajustes lo muestra. Lo que se indique a mano siempre manda
- **Guardias del año**: cada guardia separa **disfrutados** de **pedidos** («3 ago · 3/5 +2 pedidos») con leyenda
- **Tarjeta de libres**: «12 por disfrutar: 10 para pedir + 2 ya pedidos (4 y 5 nov)»; el anillo muestra los libres **para pedir**
- Caso real verificado con el cuadrante de la brigada: JUAN pasa de 9 a 10 para pedir / 12 por disfrutar y de −3 a 0 AP. 93 tests. CACHE_VERSION v17

## v3.1.1 - «¿Quién eres?» también para quien ya usaba la app

- La app recuerda **cuál es tu perfil** (marcado «tú») y, si aún no lo sabe y hay cuadrante cargado, **pregunta al abrirla** (una vez; «Ahora no» deja de preguntar)
- Si tu perfil actual tiene datos de otra persona, elegir tu nombre **crea tu perfil aparte** sin tocar el existente; si ya tenías perfil, lo abre
- Siempre disponible: **«¿Quién eres? / Cambiar quién soy»** en la hoja de perfiles (chip de arriba), botón **«¿Quién soy yo?»** en Ajustes → Perfiles y **«Soy yo»** en la ficha de cada compañero del cuadrante
- El panel muestra 0 en vez de «−0». CACHE_VERSION v16

## v3.1.0 - Nombres desde una lista, sin errores de escritura

- **Nuevo perfil**: el funcionario se elige en un desplegable con la plantilla del cuadrante (quien ya tiene perfil aparece desactivado). Queda vinculado y su contabilidad se rellena sola. Escribir a mano solo para quien no está en el cuadrante; si lo escrito coincide con alguien de la plantilla («nuria»), se usa la persona del cuadrante
- **«Crear los N que faltan»**: crea de una vez los perfiles de toda la plantilla
- **«¿Quién eres?»** al cargar el cuadrante por primera vez: eliges tu nombre y el perfil inicial («Mi perfil») pasa a llamarse como tú, vinculado y sincronizado
- **«Soy yo»** no duplica: si esa persona ya tiene perfil en el dispositivo, ofrece abrirlo
- **Escalafón**: desplegable «Añadir del cuadrante» con los nombres del Excel que aún no están en la plantilla (para altas nuevas)
- Correcciones: Intro en un diálogo ya no reabre la hoja de perfiles; el aviso inferior sube cuando hay una hoja abierta para no tapar sus controles. CACHE_VERSION v15

## v3.0.0 - La versión definitiva: un perfil por funcionario, saldos claros y diseño nuevo

### Contabilidad (corrige "solo 1 día de vacaciones" y "no salen las guardias futuras")
- **Motor de saldos nuevo** (`js/domain/balances.js`, puro y probado): para libres, AP y vacaciones distingue **arrastre del año anterior**, **disfrutados**, **pedidos (futuros)** y **disponibles**. Las guardias futuras aparecen como **previstas** (no generan días hasta su lunes) y la próxima se señala en el panel
- Al pedir días libres la app los **carga a una guardia concreta** (la más antigua con saldo y ya trabajada, nunca a una posterior al día pedido) y **bloquea si pides más de los que tienes**
- Arreglos de fondo: referencias `G.dd/mm` sin año ya no se mezclan entre años; un libre no se puede cargar a una guardia posterior; el resumen de importación cuenta las vacaciones como la contabilidad (sin fines de semana)

### Un perfil por funcionario
- Cada perfil tiene **su calendario, sus cupos (AP, vacaciones) y su arrastre**. Chip de perfil en la cabecera para cambiar en un toque
- Desde el **cuadrante del grupo**, tocar un nombre abre su ficha: **«Ver su contabilidad»** crea/abre su perfil y lo sincroniza; **«Soy yo»** vincula tu perfil
- **Importar = sincronizar**: reimportar sustituye lo que vino del cuadrante (si un libre cambió de día, el viejo desaparece) y **respeta lo apuntado a mano**. Todo en una única transacción; vista previa antes de aplicar. Al cargar un cuadrante nuevo, tu perfil vinculado se pone al día solo

### Diseño y usabilidad
- **Panel de inicio nuevo**: tarjeta de bienvenida, anillo de libres disponibles con el desglose (arrastre, generados, disfrutados, pedidos), barras de AP y vacaciones (disfrutado / pedido / libre), semana actual, línea de tiempo «Próximamente» y mapa de guardias del año con sus 5 días
- Cabecera fija con perfil, iconos de navegación vectoriales, **hojas y diálogos propios** (adiós a los `alert/confirm` del navegador), tema **Automático / Claro / Oscuro**, maquetación de dos columnas en escritorio
- **Deshacer** en todo lo importante (pedir libres, marcar guardia, borrar día, vacaciones, borrar servicio) desde el aviso inferior
- Tras pedir días, **mensaje listo para enviar** (copiar / compartir) con la guardia de cada día
- Cuadrante en móvil vertical: tabla deslizable con nombres fijos (antes quedaba tapada), filas «Guardia esta semana / Próxima semana / Trabajan hoy / Ausentes hoy»
- Estadísticas: el año en cifras y gráfico mes a mes de libres, vacaciones, AP y guardias
- Ajustes reorganizados por secciones plegables (contabilidad, perfiles, importar, reglas, apariencia, seguridad, copias, exportar, avanzado)

### Robustez
- Saldos derivados automáticamente en el estado (ya no hay contadores desfasados); se recalculan al volver a la app
- Escrituras atómicas en IndexedDB; renderizado selectivo (los avisos ya no borran formularios a medio rellenar)
- Errores inesperados visibles como aviso en vez de fallos silenciosos; restaurar copia ya no mezcla perfiles
- 89 tests en verde + prueba de punta a punta en Chromium. CACHE_VERSION v14

## v2.6.1 - Contabilidad "al día" asimétrica (ganar vs. gastar)

- Se corrige la regla "al día" para que sea **asimétrica**:
  - **Ganar** (guardias): los días sólo se generan al llegar el lunes de esa semana (no antes de trabajarla). Sin cambios
  - **Gastar** (libres pedidos): un libre solicitado se descuenta **ya, aunque el día de disfrute sea futuro**, para no pedir de más. Antes se difería igual que las guardias, lo cual permitía sobre-solicitar
- El panel muestra "Disfr./pedidos" (incluye los reservados a futuro). 63 tests en verde. CACHE_VERSION v13

## v2.6.0 - Contabilidad "al día" y unificación de nombres

- **Contabilidad al día**: las guardias/incidencias futuras quedan reflejadas en el calendario, pero **no generan sus días libres hasta que llega el lunes de esa semana**. Los contadores (`calculateCounters`, `summariseLibresForYear`) solo cuentan los movimientos con fecha ≤ hoy, así el saldo refleja lo realmente devengado
- **Unificación de nombres**: variantes de escritura del mismo funcionario (p. ej. "CARMEN" y "Mª CARMEN") se agrupan en una sola fila/persona según el escalafón, evitando duplicados
- 61 tests (nuevos de la regla "al día") en verde. CACHE_VERSION v12

## v2.5.0 - Fechas de corte del arrastre y escalafón actual

- **Fechas de corte por tipo**: en Ajustes se indica la fecha del primer AP / primera vacación / primer libre del año en curso. Lo disfrutado antes de esa fecha se imputa al arrastre del año anterior (periodo de gracia), no al cupo nuevo. Corrige que AP de enero (que son del año anterior) descontaran del cupo del año actual
- **Importar desde una fecha** (por defecto 1 de enero del año): la importación solo trae turnos desde esa fecha, evitando arrastrar el histórico completo
- **Escalafón = plantilla actual**: el cuadrante grupal ahora **filtra** por el escalafón configurado y oculta a quien ya no trabaja en la brigada. Plantilla por defecto: TESA, RAFAEL, CARMEN, MARIO, JUAN, REINOSO, NURIA (editable en Ajustes)
- 59 tests (nuevo del corte de AP) en verde. CACHE_VERSION v11

## v2.4.0 - Contabilidad anual con arrastre del año anterior

- La contabilidad ahora es **anual**: los contadores (libres, AP, vacaciones, guardias) solo cuentan los movimientos/etiquetas del año en curso, no los 14 años del histórico importado
- **Arrastre manual por año** (`config.carryovers` por año): libres pendientes de compensar, asuntos propios y vacaciones que traes del año anterior; se suman al saldo del año. Sección nueva en Ajustes ("Arrastre a 1 de enero de AAAA")
- Panel de inicio: tarjeta `Arrastre + Generados − Disfrutados = Te quedan` referida al año actual
- Se elimina el "saldo inicial de libres" global (sustituido por el arrastre por año); la contabilidad del arrastre ya no crea un movimiento en el ledger, se aplica al calcular
- `summariseLibresForYear` y `calculateCounters(...year)` acotados por año; `getCarryover` para leer el arrastre. 58 tests (nuevos de año y arrastre) en verde

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
