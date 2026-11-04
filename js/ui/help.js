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
      <li>Lo que <strong>pides</strong> se descuenta ya, aunque sea para más adelante.</li>
      <li>Los <strong>AP del año anterior</strong> valen hasta el 25 de marzo (se puede cambiar en tu ficha).</li>
      <li>Si no indicas arrastre, la app deduce lo que es del año anterior y te lo avisa.</li>
    </ul>`],
  ['💾 Tus datos y copias', `
    <p>Tus datos están <strong>solo en tu móvil</strong>. Haz <em>Ajustes → Copias de seguridad → Guardar copia</em> de vez en cuando (te avisa a los 30 días) y antes de cambiar de móvil. En modo incógnito no se guarda nada.</p>`],
  ['🛡️ Administrador', `
    <ul>
      <li>Carga el Excel en <em>Cuadrante</em> y pulsa <strong>Publicar</strong>: se sube <strong>cifrado</strong> con la contraseña del grupo; sin ella nadie puede leerlo.</li>
      <li><em>Fichas de cada policía</em>: cupos, días por guardia, festivos y lo pendiente del año anterior de cada uno; llegan al publicar.</li>
      <li>Necesitas un token de GitHub (Contents: Read and write, solo este repositorio) guardado en tu móvil.</li>
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
