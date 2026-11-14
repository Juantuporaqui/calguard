# CHANGELOG - CalGuard

## v3.17.0 - Primeros pasos sin ayuda

- **Asistente de primer uso** (solo en una instalación limpia; quien ya tiene datos no lo ve). Tres pasos que se pueden saltar:
  1. **Contraseña del grupo**, comprobada al momento descargando el cuadrante. Si no lo abre, lo dice claro («Revisa mayúsculas, espacios y tildes…») y no la guarda. Sin conexión, la guarda y se comprobará sola
  2. **¿Quién eres?**: tu nombre del cuadrante con botones grandes. Tu perfil se crea con tu nombre y tu calendario se rellena solo
  3. **Instala la app**: botón «Instalar CalGuard» en Android; en iPhone, los pasos con dibujos (Compartir → Añadir a pantalla de inicio → Añadir). Si ya está instalada, no sale
  Sustituye la creación silenciosa de «Mi perfil». De instalación limpia a Inicio con tus días: unos segundos
- **Pantallas sin datos**: una frase y un solo botón. Inicio (poner la contraseña / comprobar ahora / elegir mi nombre), Cuadrante (poner la contraseña / cargar el Excel), Biblioteca (poner o cambiar la contraseña / reintentar) y Bitácora (apuntar un servicio / quitar el filtro)
- **Ayuda con buscador** (sin importar mayúsculas ni tildes), una sección «PIN y bloqueo» y otra «Palabras de la app». Junto a **días del año pasado, compensación, guardia cerrada y no computa** hay un **ⓘ** que lo explica en dos líneas
- **«Sin conexión»** discreto en la cabecera mientras no hay red
- **Pantalla del PIN con teclado propio** de botones grandes (no sale el teclado del móvil); el teclado físico sigue valiendo
- **Iconos SVG** en lugar de los emojis 🛡️ 🎁 💬 (y los de «Más», la Ayuda y los tipos de evento), con el mismo trazo que la barra de abajo
- **Contraste AA (4,5:1)** en todas las pastillas y letras de tipo de día, en claro y en oscuro (medido en Inicio, calendario mes y semana, leyenda, cuadrante y hoja del día). Colores cambiados:
  - Texto de color sobre fondo suave (claro): guardia y juicio #991b1b, guardia prevista y vacaciones #9a3412, libre #854d0e, asunto propio #6d28d9, mañana #92400e, tarde #9a3412, formación #155e75, baja #075985, fin de semana #166534. En oscuro: tonos claros (#fca5a5, #fdba74, #fde047, #c4b5fd, #fcd34d, #67e8f9, #7dd3fc)
  - Letras con fondo de color: guardia #b91c1c, guardia prevista #c2410c, vacaciones #9a3412, asunto propio #6d28d9, tarde #b45309, formación #0e7490, juicio #be123c, baja #0369a1, noche y otros #475569 (texto blanco); libre #eab308 y mañana #f59e0b con texto oscuro. Las pastillas de hoy en Inicio usan esos mismos fondos
  - Texto gris secundario: #9ca3af → #5f6673 (claro) y #64748b → #94a3b8 (oscuro)
  - Los días pasados ya no se atenúan con transparencia (bajaba el contraste): su número va más fino
- **Movimiento reducido**: además de animaciones y transiciones, se quitan el desplazamiento suave y las animaciones en bucle
- **Al repintar una pantalla se conservan el scroll y el foco** (también en el calendario y en Inicio)
- 279 tests (nuevos: asistente, estados vacíos, glosario, buscador e iconos). CACHE_VERSION v49

## v3.16.0 - Ajustes más sencillos y token del administrador cifrado

**Ajustes en tres bloques**
- **Mis ajustes**: Mi perfil, Mis días (cupos y días del año pasado, con Compensaciones), Contraseña del grupo, Seguridad, Copia de seguridad y Apariencia
- **Administración**: token de GitHub, publicar el cuadrante y fichas de cada policía. Solo aparece en el móvil que ya tiene token; en los demás hay un enlace discreto **«Soy administrador»** al final
- **Avanzado** (plegado): importar cuadrante a este perfil, exportar, reglas del grupo, tipos de servicio, diagnóstico, forzar actualización y, al final, **borrar**
- **Cada dato se guarda solo** al cambiarlo y sale «Guardado». Ya no hay botones «Guardar…». Si un dato no vale, el error sale **debajo del campo** y no se guarda; lo que estabas escribiendo no se pierde
- **Una sola «Guardar copia»** con la casilla «Proteger con contraseña» (sustituye a «Copia cifrada»)
- **«Borrar este perfil» y «Borrar todos los datos»** están al final y piden **escribir BORRAR**
- **Tamaño del texto**: Normal, Grande o Muy grande (agranda toda la app). Con texto grande en móviles estrechos, la barra de abajo enseña el nombre de la pestaña en la que estás
- `settings.js` se divide en un archivo por sección (`js/ui/settings/*`)

**Seguridad**
- **El token de GitHub del administrador se guarda cifrado** (AES-GCM, clave sacada del PIN con PBKDF2 de 600.000 vueltas). El modo administrador exige PIN. El token antiguo en claro se cifra solo en el primer desbloqueo; si algo falla, no se pierde y se reintenta. Un administrador sin PIN puede seguir publicando: al hacerlo, la app le pide crear el PIN. Sigue sin ir en las copias
- **PIN nuevo de 6 a 8 cifras** (los de 4 o 5 que ya tenías siguen valiendo). La sección explica que el PIN bloquea la pantalla pero no cifra los datos
- **CSP sin `'unsafe-inline'` en los estilos**: ningún HTML generado lleva `style="…"` (clases y `style.setProperty` tras pintar)
- La app pide al navegador **almacenamiento persistente** al arrancar
- 270 tests (nuevos: cifrado del token, migración, cambio de PIN y CSP). CACHE_VERSION v48

## v3.15.3 - «Varios días» también desde la hoja del día

- En la hoja de un día, **Libre** y **Asunto propio** se parten en dos: arriba, este día; abajo, **«＋ Varios días»**, que empieza a elegir días con ese ya marcado
- 246 tests. CACHE_VERSION v47

## v3.15.2 - Pedir libres y asuntos propios con la misma facilidad

- El botón flotante del calendario se parte en dos mitades iguales: **«＋ Libres» | «＋ Asuntos propios»**. Cada una empieza a elegir días de ese tipo
- Mientras eliges, la barra de arriba tiene un interruptor **Libres / Asuntos propios** para cambiar de tipo sin perder los días que ya has tocado
- Los días elegidos se ven bien marcados (borde y fondo verdes) también en tema oscuro
- 246 tests. CACHE_VERSION v46

## v3.15.1 - Quitar solo una cosa del día, y sin turno cuando no trabajas

- En la hoja del día, **cada cosa apuntada tiene su «✕»** para quitar solo esa: el libre, la mañana, la formación… lo demás se queda. Quitar un libre también lo quita de la cuenta; quitar una guardia la quita de toda su semana. Siempre con «Deshacer». «Borrar todo lo de este día» sigue en «Más opciones»
- **Al coger libre, asunto propio, vacaciones o baja se quita el turno** (mañana, tarde o noche) de ese día: si no trabajas, no tienes turno. «Deshacer» lo devuelve
- 246 tests. CACHE_VERSION v45

## v3.15.0 - Calendario más fácil: hoja del día, «＋ Pedir días» y letras en su sitio

- **Tocar un día abre una hoja** con la fecha en grande, lo que hay apuntado y cuatro botones grandes: **Libre, Asunto propio, Vacaciones y Evento**. Lo demás (guardia, guardia prevista, mañana, tarde, formación, baja, otros eventos, pedir varios libres, borrar) está en «Más opciones». Sustituye al menú que salía junto al día. Marcar un libre: dos toques
- **Botón «＋ Pedir días»** siempre a mano en el calendario: empiezas a tocar los días que quieres
- **Mientras eliges días, una barra arriba** dice qué hacer y cuántos llevas («Toca los días · 2 seleccionados»), con Cancelar y Confirmar. Las vacaciones se eligen igual: primer día, último día y Confirmar (se ve el rango marcado)
- **Cabecera más clara**: «‹ Noviembre 2026 ›». Tocando el mes eliges cualquier mes y año. Siguen «Hoy» y Semana / Mes / Año
- **Las letras de cada día van siempre en el mismo sitio**, debajo del número (M, T, N, L, G…). Si hay dos cosas, dos letras; si hay más, la primera y «+N». También en la vista año
- La **leyenda de colores** está plegada bajo el calendario y trae todos los tipos con su letra
- Al cambiar de mes hay una transición breve (no la hay si tu móvil tiene activado «reducir movimiento»); deslizar de lado sigue funcionando
- Con teclado: los días son botones; las flechas mueven de día en día, arriba y abajo una semana, RePág y AvPág un mes
- Mañana, tarde, formación, baja y asunto propio ahora también se pueden deshacer desde el aviso
- 244 tests. CACHE_VERSION v44

## v3.14.0 - Avisos claros, pedir sin saldo explica por qué, y «Actualizar» dice qué ha cambiado

- **Actualizar dice cuántos días han cambiado**: «Sin cambios», «1 día actualizado», «3 días actualizados». Si el cuadrante nuevo te mueve una guardia, sale un aviso en Inicio: «Tu guardia del 7 dic pasa al 14 dic»
- **Avisos de Inicio más cortos y con solución a un toque** (máximo 120 letras, sin jerga):
  - «Tus libres del 4 y 5 nov no corresponden a ninguna guardia. ¿Te los concedieron?» [Revisar] [Sí, no descontar]: el segundo botón los marca como concedidos desde el propio aviso
  - «2 de tus libres (3 y 4 ene) parecen de 2025. ¿Es correcto?» [Sí] [No, corregir]
  - Se ven 2 como mucho; el resto, tras «Ver N avisos más». Cada uno se puede quitar con «✕» (no vuelve a salir en tu perfil, salvo que la situación cambie)
- **Los botones de pedir ya no se apagan**: si no te quedan días, explican por qué y cuándo llegan los siguientes (con tu próxima guardia, o el cupo nuevo el 1 de enero). Vale para «Pedir días libres», los «Pedir días» de asuntos propios y vacaciones, y las opciones del menú de cada día del calendario
- 236 tests. CACHE_VERSION v43

## v3.13.1 - La semana de Inicio dice qué tienes cada día

- Cada día de la tira «Esta semana» muestra la letra de lo que tienes, con su color: **M** mañana, **T** tarde, **N** noche, **L** libre, **G** guardia, **P** guardia prevista, **V** vacaciones, **A** asunto propio, **B** baja… Si ese día hay algo más (un juicio, una formación), sale además un punto
- Primero se ve la guardia o la ausencia, luego el turno y después lo demás
- 222 tests. CACHE_VERSION v42

## v3.13.0 - Avisos que se leen y un solo tipo de ventana

- **Avisos**: duran lo que hace falta para leerlos (al menos 4 segundos, más si el texto es largo) y se apilan hasta 3 en vez de taparse unos a otros; los demás esperan su turno
- **Los errores no se van solos**: se quedan en rojo hasta que los cierras con «✕», dicen qué ha pasado en una frase sencilla y guardan el detalle técnico tras «Ver detalle» (útil para pasárselo al administrador)
- **Todas las ventanas son iguales**: el formulario de la bitácora, «Otros eventos», «Eventos del día» y el de juicio pasan a ser hojas como el resto. Botones siempre en el mismo orden: el secundario a la izquierda y el principal a la derecha
- Con una hoja abierta, el teclado no se escapa de ella (Tab da la vuelta dentro) y lo de detrás no se puede tocar; los avisos sí, para poder deshacer o cerrarlos
- **Bitácora**: el botón rojo «Eliminar» de cada servicio pasa a un menú «⋯». Borrar ya no pregunta: el aviso ofrece «Deshacer», como en el calendario
- 222 tests. CACHE_VERSION v41

## v3.12.0 - Inicio: la semana primero, que se desliza, y pedir asuntos propios y vacaciones

- **Orden de Inicio**: cabecera, esta semana, próximamente, días libres, guardias, y asuntos propios y vacaciones. El aviso de copia sigue siendo una línea al final
- **Esta semana se desliza de lado**: lleva cinco semanas seguidas (la actual y las cuatro siguientes). El título cambia según la semana que miras («Esta semana», «Semana que viene», «Semana del 23 nov») y «Ver semana» abre esa semana en el calendario. Cada lunes empieza una semana y es donde se detiene al deslizar
- **Pedir días de asuntos propios y de vacaciones desde Inicio**: cada tarjeta lleva su enlace «Pedir días»
  - Asuntos propios: eliges los días en el calendario, confirmas y te queda el mensaje listo para enviar (con «Deshacer»)
  - Vacaciones: eliges el primer y el último día, confirmas y te queda el mensaje listo para enviar
  - Si no te quedan días, el enlace está apagado. Atrás cancela la selección
- Asuntos propios y vacaciones van lado a lado también en pantallas de 320 px
- Los textos pequeños (`small`) ya no bajan de .75 rem
- 215 tests. CACHE_VERSION v40

## v3.11.0 - Inicio más corto y en el orden en que se mira

- **Orden nuevo**: cabecera, libres para pedir, guardias, esta semana, próximamente, asuntos propios y vacaciones. El aviso de copia de seguridad pasa a una línea pequeña al final (solo sale cuando toca guardar)
- **Cabecera más pequeña**: «Cuadrante del 12/11» en vez de «actualizado hace…»; con quién compartes turno hoy («Mañana · con Rafa y Tesa», solo la gente con tu mismo turno que no libra); Jefatura es una cajita arriba a la derecha, solo para quien ya la tenía
- **Actualizar es el botón de las dos flechas en círculo**, junto al de ayuda, y gana una fila de pantalla
- Asuntos propios y vacaciones van uno al lado del otro (en pantallas de 320 px, uno debajo del otro)
- Se quita la fila de atajos del final de Inicio: ya están en la barra de abajo (Estadísticas, en «Más»)
- A 320 px la cabecera cabe con el botón nuevo
- 209 tests. CACHE_VERSION v39

## v3.10.0 - El botón Atrás del móvil funciona y la barra tiene «Más»

- **Atrás**: cierra lo que esté abierto (hoja, menú del día, diálogo, modo de elegir días del calendario) y, si no hay nada abierto, vuelve a la pantalla anterior. La app solo se cierra con Atrás desde Inicio y sin nada abierto. Si abres CalGuard desde un acceso directo (por ejemplo, Calendario), Atrás te lleva primero a Inicio
- **La dirección refleja la pantalla** (`#calendar`, `#cuadrante`…) y «Compartir → CalGuard» sigue llevando al cuadrante
- **Barra inferior de 5 pestañas**: Inicio, Calendario, Cuadrante, Biblioteca y **Más**. Los nombres caben enteros incluso en pantallas de 320 px
- **Pantalla «Más»**, con filas grandes: Estadísticas, Bitácora de servicios, Jefatura (solo si ya la ves en Inicio), Ajustes, Ayuda y Copia de seguridad (con la fecha de tu última copia). Cualquier pantalla está a dos toques
- En Estadísticas, Bitácora, Ajustes y Diagnóstico, la cabecera muestra **‹ Volver** y la barra deja marcada «Más»
- Se quita el enlace a la Bitácora del pie de la Biblioteca. Los accesos directos de la app son ahora Calendario, Cuadrante, Biblioteca y Bitácora de servicios
- Al salir del calendario se cancela la selección de días que estuviera a medias
- La Bitácora y sus filtros ya no se salen de la pantalla a 320 px
- 199 tests. CACHE_VERSION v38

## v3.9.3 - Mismos nombres, letra legible y botones fáciles de pulsar

- **Un solo nombre para cada tipo de día**, en todas las pantallas: Guardia, Guardia prevista, Libre, Asunto propio, Vacaciones, Mañana, Tarde, Noche, Formación, Juicio, Baja, Otro y Evento. Las letras de las insignias son las mismas en el calendario, la leyenda y el cuadrante (la guardia prevista pasa de «PG» a «P» y el asunto propio de «AP» a «A»)
- Lo que pides para más adelante se llama siempre «pedidos»; lo que traías del año anterior se llama «días del año pasado». Botones y títulos solo con la primera letra en mayúscula («Nuevo servicio»)
- **Letra**: nada se ve más pequeño que .75 rem. Donde el texto no cabía, ahora hay un punto o un color sin letra: la semana del Inicio y el «+» de «Otro» en el calendario
- **Botones y casillas de al menos 44 × 44 px**: botones, enlaces, pestañas, días del calendario (mes y año), semana de Inicio, casillas del cuadrante, cerrar «✕», casillas de marcar y campos de texto. En móvil, el calendario ocupa todo el ancho para que quepan siete columnas de ese tamaño; el cuadrante del mes se desplaza de lado
- En pantallas de 320 px, solo la pestaña activa enseña su nombre y los atajos de Inicio van en dos filas. Inicio y Estadísticas ya no se salen por la derecha
- El foco del teclado se ve siempre (antes se quitaba en algunos campos)
- 162 tests. CACHE_VERSION v37

## v3.9.2 - Limpieza interna y manifiesto

- Los iconos de la app se declaran por separado para pantalla normal y para iconos adaptables, y la app ya no fuerza la orientación vertical
- Se quita código antiguo sin uso que refrescaba los contadores
- Se añade CLAUDE.md con las reglas del proyecto y se corrige el README (la app se actualiza sola)
- 162 tests. CACHE_VERSION v36

## v3.9.1 - Jefatura: le llega a quien tiene la ficha marcada

- **Quién ve Jefatura**: el administrador y quien tenga «Jefatura» en su ficha publicada. Manda la ficha publicada, así que sale en cuanto llega la publicación. Antes, si alguien había pulsado «Ahora no» en «¿Quién eres?» y abierto su contabilidad desde el cuadrante, no le salía aunque su ficha lo tuviera (caso de Tesa). Ahora cuenta como suyo el único perfil vinculado al cuadrante. En el móvil de otro compañero no sale, aunque abra la contabilidad de Tesa
- **El administrador ve en Jefatura quién la ve** («La ves tú (administrador) y Tesa») y si hay una ficha marcada o desmarcada que aún no se ha publicado
- Cargar un Excel en el móvil ya no borra las fichas recibidas con la publicación (los días por guardia de cada uno en Jefatura)
- 162 tests. CACHE_VERSION v35

## v3.9.0 - Biblioteca por temas, con fichas para el móvil

- **Temas con botón**: la Biblioteca abre con una cuadrícula de temas (icono, nombre y cuántos documentos tiene); dentro, primero las fichas en su orden y luego originales y enlaces. «Otros» para lo que no tiene tema
- **Fichas**: textos prácticos y resumidos que se leen dentro de la app (títulos, listas, tablas, avisos destacados; teléfonos y correos pulsables). Van en el índice cifrado, así que se consultan sin conexión y la búsqueda encuentra también su contenido
- **Importar paquete** (administrador): un archivo con temas, fichas y documentos que la app cifra con la contraseña del grupo y sube de una vez; lo que tenga la misma clave se sustituye
- Al subir un documento o un enlace se puede elegir su tema
- 158 tests. CACHE_VERSION v34

## v3.8.0 - CH en orden para quien no pide los días correlativamente

- **Jefatura → persona → «Poner sus CH en orden…»** (administrador): desde una fecha, cada CH de esa persona cuenta para la guardia abierta más antigua, aunque la nota diga otra. Vista previa (para pedir ahora → en orden) antes de aplicar; se publica cifrado con el cuadrante y llega a todos
- **Lista para corregir el Excel**: la nota que debería llevar cada CH («CH incid 27 julio-2 agosto. Día 1º»…), para compartir con la jefatura; también la ve quien tiene «Jefatura»
- En el detalle de una guardia, los días puestos en orden lo indican y muestran lo que decía su nota
- Caso REINOSO (desde el 1 de septiembre): su guardia del 27/07 queda compensada en orden; le quedan 9 (4 de la de septiembre y 5 de la de noviembre)
- 155 tests. CACHE_VERSION v33

## v3.7.2 - Manda el cuadrante: arrastre y días apuntados a mano

- **Arrastre**: si el cuadrante y sus notas dan lo pendiente del año anterior, se usa eso; el apuntado a mano en la ficha (una estimación de antes de leer las notas) ya no lo contradice. Caso Rafael: con 3 a mano en su ficha salía −1 en Jefatura y con 2 en su móvil −2; ahora 0 en los dos, que es la realidad (todo pedido). La ficha, Ajustes y Jefatura avisan de que ese valor no se usa
- Un libre apuntado en la app que el cuadrante también tiene como CH: cuenta el del cuadrante, con su nota (antes se quedaba el apuntado y podía ir a otra guardia)
- **Pedir días** desde el calendario: cada día va a la guardia abierta más antigua (nunca a una cerrada) y queda unido a esa guardia
- 154 tests. CACHE_VERSION v32

## v3.7.1 - «CH 5º día» sin guardia va a su guardia

- Una nota con solo el ordinal («CH 5º DIA . FALTA MINUTA») va a la guardia cuyos días 1º–4º se anotaron justo antes (misma persona, últimos 4 meses). Caso Rafael: el 17/04 es el 5º día de su guardia del 2–8 de marzo, que queda completa
- Un «Día 1º» sin guardia no se adivina: sigue yendo a la más antigua con días
- 151 tests. CACHE_VERSION v31

## v3.7.0 - Los días se gastan por orden

- **Por orden**: cuando una guardia se ha compensado entera, lo que quede de las anteriores ya no cuenta (guardia *cerrada*). Así no quedan días colgando de guardias de hace un año que en el cuadrante no se apuntaron. Lo ya pedido a una guardia se respeta
- Las guardias de 2025 cerradas desaparecen del arrastre y de «Guardias 2026»; las de 2026 cerradas salen como «cerrada» y su detalle explica por qué
- **Para pedir, por guardia**: lo cogido por adelantado a cuenta de una guardia aún por hacer lo cubre esa guardia (antes restaba ya y podía salir negativo); «+N más al hacer…» descuenta lo ya cogido
- Jefatura: cerradas por orden en cada persona; pendientes sin las cerradas
- **Jefatura a un toque desde Inicio** (solo jefatura y administrador)
- Con el cuadrante publicado el 07/11 (2220 notas): Tesa 0, Rafael 0, Carmen 5, Mario 0, Juan 9, Reinoso 5, Nuria −1
- 150 tests. CACHE_VERSION v30

## v3.6.2 - El cuadrante siempre se publica con sus notas

- **Arreglado**: «Comprobar ahora» (y guardar la contraseña del grupo) descargaba el cuadrante publicado aunque en el dispositivo hubiera un Excel cargado después; así, el Excel con notas recién cargado por el administrador podía quedar sustituido por la publicación anterior (sin notas) y «Publicar» volvía a enviar esa. Ahora un cuadrante cargado después de la publicación se conserva siempre
- La app **guarda el Excel original** y lo vuelve a leer sola cuando una versión nueva lo lee mejor (mismo archivo, misma fecha)
- Si falta leer las notas, **«Publicar» pide el Excel en el mismo aviso** y publica a continuación; en Cuadrante, el administrador ve el aviso con el botón «Elegir el Excel y publicar»
- Antes de subirlo, el archivo cifrado **se descifra y se comprueba** (mismos turnos, mismas notas); el archivo publicado indica cuántos turnos y notas lleva (solo cifras, sin nombres ni fechas)
- Comprobado de punta a punta con el Excel real: administrador → compañero, REINOSO pasa de 4 (publicación sin notas) a 13; los siete saldos coinciden con la auditoría independiente
- 147 tests. CACHE_VERSION v29

## v3.6.1 - No publicar el cuadrante sin sus notas

- Si el cuadrante guardado en el dispositivo del administrador **no tiene las notas del Excel** (se cargó con una versión anterior a la v27), «Publicar» avisa y propone volver a cargar el Excel antes de enviarlo al grupo: así nadie recibe las cuentas sin notas por error
- Al cargar el Excel se indica cuántas **notas** se han leído («2220 notas leídas») y al publicar, cuántas van en el archivo cifrado
- Contabilidad comprobada con un segundo cálculo independiente (otro lector del Excel y otra lógica): los siete saldos coinciden con la app
- 145 tests. CACHE_VERSION v28

## v3.6.0 - Notas del cuadrante, compensaciones, Jefatura y Biblioteca

- **Las notas de las casillas del Excel cuentan**: cada CH va a la guardia que dice su nota («CH incid 9-15 marzo. Día 3º», «CH1-inc22-28 diciembre», «2/3 mayo», por adelantado…); sin nota, a la más antigua como siempre. Se leen los códigos combinados («M JUI») y nuevos (JUI, CU/CUR, P, ENF)
- Un CH por **juicio, elecciones, ExpoJove, el Patrón o un servicio extraordinario** no gasta guardias; uno que cita una guardia a nombre de otro (hizo de lunes a viernes), tampoco
- **Cambios de fin de semana**: si dos hacen un día cada uno, la guardia es de quien tiene las notas (caso Reinoso/Carmen, febrero y mayo)
- **Arrastre automático** del año anterior según el cuadrante y sus notas; AP y vacaciones con «2025» en la nota cuentan del año anterior. Lo indicado a mano manda. Sin notas, todo como antes
- Caso REINOSO comprobado: 13 libres para pedir (antes 4), arrastre 10 de 2025, 4 CH por juicios aparte
- **Compensaciones** aparte de guardias: Inicio → «＋ Compensaciones» (juicio ½ día, elecciones, servicio, evento, Patrón u otro); en un día con juicio, «Me lo compensan». El administrador las apunta para el grupo y llegan cifradas al publicar
- **Jefatura** (Ajustes; administrador y quien tenga «Jefatura» en su ficha): días pendientes de cada uno por guardia y por motivo, y lo que conviene revisar
- **Biblioteca** en lugar de la pestaña Bitácora: manuales, instrucciones, órdenes y enlaces, cifrados con la contraseña del grupo; los PDF se leen dentro de la app y lo abierto queda sin conexión. La Bitácora sigue en Estadísticas
- 143 tests. CACHE_VERSION v27

## v3.5.1 - Actualización fiable en el móvil y cuadrante más continuo

- **Las actualizaciones llegan siempre completas**: al instalar una versión nueva, la app descarga cada archivo saltándose la caché del servidor (antes, durante unos minutos tras publicar, un móvil podía quedarse con archivos de la versión anterior)
- **«Forzar actualización»** en Ayuda («Estar al día») y al pie de Ajustes, con la versión instalada: vuelve a descargar la app sin tocar datos, perfiles ni la contraseña del grupo
- Cuadrante: el nombre del archivo, «Toca un nombre…» y el aviso de deslizar pasan **debajo de la tabla**; la tarjeta del día queda pegada al cuadrante y con filas algo más juntas
- CACHE_VERSION v26

## v3.5.0 - Cuadrante más legible en el móvil

- **Vista Semana** (selector «Mes | Semana», se recuerda): los 7 días caben en la pantalla con casillas grandes; flechas o deslizar el dedo para cambiar de semana
- **Fila «Guardia»** bajo los días: quién está de guardia cada semana (semanas con INC en fin de semana; los festivos sueltos no). En semanas partidas por el mes, inicial o tres letras
- **Línea entre domingo y lunes** en la vista Mes para leer cada semana de un vistazo
- La vista Mes sigue siendo la de partida y no cambia de colores ni de letras. CACHE_VERSION v25

## v3.4.3 - Cuadrante: toca un día y mira quién trabaja

- En la pantalla Cuadrante, **tocar cualquier día** (la cabecera o una casilla) muestra arriba ese día: guardia de esa semana, quién trabaja de **mañana** y de **tarde**, quién **libra o está ausente** (con su código) y quién no tiene turno; «Volver a hoy» regresa. La tabla no se redibuja ni pierde el desplazamiento; la columna elegida se marca. En fin de semana solo se muestra lo que hay
- La tabla y sus colores no cambian. CACHE_VERSION v24

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
