/**
 * @module ui/help
 * Ayuda dentro de la app (botón «?» de la cabecera y Ajustes) y el mensaje
 * de instalación listo para enviar por WhatsApp a los compañeros.
 */

import { Actions } from '../state/store.js';
import { openSheet, confirmDialog } from './sheet.js';

/** Version installed on this device (the service worker's cache), e.g. "v26". */
export async function installedVersion() {
  try {
    const keys = await caches.keys();
    const v = keys.map(k => /^calguard-v(\d+)$/.exec(k)).filter(Boolean).map(m => Number(m[1])).sort((a, b) => b - a)[0];
    return v ? `v${v}` : null;
  } catch {
    return null;
  }
}

/**
 * Last resort if a phone does not show the latest changes: forget the
 * downloaded app (not the data, which lives apart) and load it again.
 */
export async function forceUpdate() {
  const ok = await confirmDialog({
    title: 'Forzar actualización',
    message: 'Se vuelve a descargar la aplicación completa. Tus datos, perfiles y la contraseña del grupo NO se tocan.',
    confirmLabel: 'Actualizar ya'
  });
  if (!ok) return;
  Actions.setBusy('Descargando la última versión…');
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== 'calguard-shared').map(k => caches.delete(k)));
  } catch { /* nothing cached */ }
  location.replace(`${location.pathname}?actualizado=${Date.now()}`);
}

/** Public address of the app (works also when opened from the installed icon). */
export function appUrl() {
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/index\.html$/, '');
}

/** Short install message for colleagues (the group password goes separately). */
export function installMessage() {
  return [
    '📲 *CalGuard* – cuadrante, guardias y días libres',
    '',
    `1️⃣ Abre ${appUrl()}`,
    '   • *iPhone*: en *Safari* → botón Compartir (cuadrado con flecha) → «Añadir a pantalla de inicio» → Añadir.',
    '   • *Android*: en *Chrome* → menú ⋮ → «Instalar aplicación».',
    '2️⃣ Abre CalGuard desde el icono nuevo.',
    '3️⃣ Ajustes → «Cuadrante compartido del grupo» → escribe la *contraseña del grupo* → Guardar.',
    '4️⃣ Elige tu nombre en «¿Quién eres?». Tu calendario y tu contabilidad se cargan solos.',
    '',
    'Para ponerte al día: botón *Actualizar* en Inicio. Tus datos se quedan solo en tu móvil.'
  ].join('\n');
}

const SECTIONS = [
  ['📲 Instalarla en el móvil', `
    <p><strong>iPhone:</strong> abre la dirección en <strong>Safari</strong> → botón <em>Compartir</em> (cuadrado con flecha) → <em>Añadir a pantalla de inicio</em> → <em>Añadir</em>. Ábrela siempre desde el icono.</p>
    <p><strong>Android:</strong> en <strong>Chrome</strong> → menú ⋮ → <em>Instalar aplicación</em>.</p>
    <p class="muted">En iPhone, la app instalada guarda sus datos aparte de Safari.</p>`],
  ['🔑 Primeros pasos', `
    <ol>
      <li><em>Ajustes → Cuadrante compartido del grupo</em>: escribe la <strong>contraseña del grupo</strong> (te la da el administrador) y pulsa <em>Guardar</em>.</li>
      <li>Elige tu nombre en <strong>«¿Quién eres?»</strong>. Tu calendario y tu contabilidad se rellenan solos, con la ficha que haya preparado el administrador.</li>
      <li>Revisa <em>Ajustes → Mi contabilidad</em>: si algo no cuadra (lo que traes del año anterior, tus cupos…), cámbialo. Tu cambio manda.</li>
    </ol>`],
  ['🔄 Estar al día', `
    <p>La app se actualiza sola y descarga el cuadrante nuevo al abrirla. Si quieres forzarlo, pulsa <strong>Actualizar</strong> en Inicio.</p>
    <p>¿No ves algún cambio que te han anunciado? <button type="button" class="link-btn" data-act="force">Forzar actualización</button> <span class="muted" data-version></span></p>`],
  ['🗓️ El día a día', `
    <ul>
      <li><strong>Pedir libres:</strong> Inicio → <em>Pedir días libres</em>, marca los días y confirma. Se descuentan ya y te prepara el mensaje para enviarlo.</li>
      <li><strong>Tocar un día</strong> del calendario: guardia, AP, vacaciones, eventos (juicio, tiro, curso…) o «no computa» para un libre concedido.</li>
      <li><strong>Tocar una guardia</strong> en Inicio: en qué fechas gastaste sus días. <strong>Tocar AP o vacaciones:</strong> qué días has cogido.</li>
      <li>Casi todo se puede <strong>deshacer</strong> desde el aviso de abajo.</li>
    </ul>`],
  ['🧮 Cómo cuenta', `
    <ul>
      <li>Cada <strong>semana de guardia</strong> da sus días (5 normalmente) cuando llega su lunes, haya festivos o no. Una guardia que cruza de año cuenta en el año en que termina.</li>
      <li>Cada CH va a la guardia que dice su <strong>nota en el cuadrante</strong> («CH incid 9-15 marzo. Día 3º»); si no tiene nota, a la guardia más antigua con días.</li>
      <li>Un CH por <strong>juicio, elecciones, ExpoJove, el Patrón o un servicio</strong> (según su nota) no gasta días de guardia.</li>
      <li>Si dos hacéis un día cada uno del fin de semana, la guardia es de quien tiene las notas de compensación (un cambio).</li>
      <li><strong>Por orden</strong>: los días se gastan de la guardia más antigua a la más reciente. Cuando una guardia se ha compensado entera, lo que quede de las anteriores ya no cuenta (sale como <em>cerrada</em>).</li>
      <li><strong>Arrastre</strong>: lo que dejaron pendiente las guardias del año anterior lo calcula el cuadrante con sus notas (sin las cerradas). El que se apunta a mano en la ficha solo se usa si el cuadrante no lo trae.</li>
      <li>Si un día libre que apuntaste en la app también está en el cuadrante como CH, cuenta el del cuadrante (con su nota). Los días que pides van a la guardia abierta más antigua.</li>
      <li>Lo que <strong>pides</strong> se descuenta ya, aunque sea para más adelante; lo cogido a cuenta de una guardia que aún no has hecho lo cubre esa guardia. Los <strong>AP del año anterior</strong> valen hasta el 25 de marzo.</li>
    </ul>`],
  ['➕ Compensaciones (juicios, elecciones…)', `
    <ul>
      <li>Inicio → <em>＋ Compensaciones</em>: apunta los días que te compensan aparte de las guardias: medio día por un <strong>juicio</strong> fuera de tu turno, el día de las <strong>elecciones</strong>, un servicio, un evento u otro motivo.</li>
      <li>En el calendario, al tocar un día con juicio: <em>Me lo compensan (½ día)</em>.</li>
      <li>Suman a tus libres cuando llega su fecha. Un CH cuya nota dice el motivo («CH juicio…») los gasta.</li>
      <li>El administrador puede apuntarlas para todo el grupo (Ajustes → Jefatura) y llegan al publicar.</li>
    </ul>`],
  ['📚 Biblioteca', `
    <p>Manuales operativos, instrucciones, órdenes y enlaces del grupo. Busca por título o categoría y ábrelos dentro de la app; lo que abras queda guardado para consultarlo <strong>sin conexión</strong>. El administrador los añade desde la propia Biblioteca y se suben <strong>cifrados</strong> con la contraseña del grupo.</p>
    <p class="muted">La Bitácora de servicios sigue en Estadísticas → <em>Abrir bitácora</em>.</p>`],
  ['💾 Tus datos y copias', `
    <p>Tus datos están <strong>solo en tu móvil</strong>. Haz <em>Ajustes → Copias de seguridad → Guardar copia</em> de vez en cuando (te avisa a los 30 días) y antes de cambiar de móvil. En modo incógnito no se guarda nada.</p>`],
  ['🛡️ Administrador', `
    <ul>
      <li>Carga el Excel en <em>Cuadrante</em> y pulsa <strong>Publicar</strong>: se sube <strong>cifrado</strong> con la contraseña del grupo; sin ella nadie puede leerlo.</li>
      <li><em>Fichas de cada policía</em>: cupos, días por guardia, festivos y lo pendiente del año anterior de cada uno; llegan al publicar.</li>
      <li>Necesitas un token de GitHub (Contents: Read and write, solo este repositorio) guardado en tu móvil.</li>
      <li>Las <strong>notas de las casillas</strong> del Excel viajan con el cuadrante. Al cargar el Excel verás cuántas se han leído y al publicar, cuántas van (la app lo comprueba antes de subirlo). La app guarda el Excel y lo vuelve a leer sola si una versión nueva lo lee mejor; si falta, «Publicar» te pide elegirlo. Un Excel recién cargado nunca se sustituye por el publicado.</li>
      <li><strong>Jefatura</strong> (Ajustes): días pendientes de cada uno y por qué, y compensaciones para el grupo. La ve el administrador y quien tenga marcada «Jefatura» en su ficha.</li>
    </ul>`]
];

/** Help sheet. */
export function openHelp() {
  openSheet({
    title: 'Ayuda',
    body: `
      <div class="help">
        ${SECTIONS.map(([title, html], i) => `
          <details class="help-item" ${i === 0 ? 'open' : ''}>
            <summary>${title}</summary>
            <div class="help-body">${html}</div>
          </details>`).join('')}
      </div>`,
    footer: `
      <button type="button" class="btn" data-act="copy">Copiar instrucciones</button>
      <button type="button" class="btn btn-primary" data-act="share">Enviar a un compañero</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="force"]')?.addEventListener('click', () => { close(); forceUpdate(); });
      installedVersion().then(v => { const el = root.querySelector('[data-version]'); if (el && v) el.textContent = `(tienes la ${v})`; });
      root.querySelector('[data-act="share"]').addEventListener('click', () => shareInstructions());
      root.querySelector('[data-act="copy"]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(installMessage());
          Actions.showToast('Instrucciones copiadas: pégalas en WhatsApp');
        } catch {
          Actions.showToast('No se pudo copiar');
        }
      });
    }
  });
}

/** Share the install message (WhatsApp, email…); the password must go separately. */
export async function shareInstructions() {
  const text = installMessage();
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* cancelled */ return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
