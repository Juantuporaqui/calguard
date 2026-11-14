/**
 * @module ui/settings
 * Ajustes en tres bloques:
 *  - Mis ajustes: perfil, mis días, contraseña del grupo, seguridad, copia y apariencia
 *  - Administración: solo en el móvil del administrador (el resto ve «Soy administrador»)
 *  - Avanzado (plegado): importar, exportar, reglas, tipos de servicio, diagnóstico y borrar
 * Cada sección vive en js/ui/settings/*. Cada campo se guarda solo al cambiarlo.
 */

import { getState } from '../state/store.js';
import { avatarHTML } from './flows.js';
import { openJefatura, canSeeJefatura } from './jefatura.js';
import { openHelp, installedVersion } from './help.js';
import { esc } from './utils.js';
import { icon } from './icons.js';
import { openSections, setFieldError } from './settings/common.js';
import { profileHTML, bindProfile } from './settings/profile.js';
import { daysHTML, bindDays } from './settings/days.js';
import { groupHTML, bindGroup } from './settings/group.js';
import { securityHTML, bindSecurity } from './settings/security.js';
import { backupHTML, bindBackup } from './settings/backup.js';
import { lookHTML, bindLook } from './settings/look.js';
import { adminHTML, adminLinkHTML, adminVisible, checkAdmin, bindAdmin } from './settings/admin.js';
import { advancedHTML, bindAdvanced } from './settings/advanced.js';
import { dangerHTML, bindDanger } from './settings/danger.js';

const ADVANCED = 'advanced-group';
const SKIP_KEEP = new Set(['checkbox', 'radio', 'file', 'button', 'submit']);

/**
 * Al repintar (p. ej. tras guardar un campo) no se pierde lo que se está
 * escribiendo: el campo con el foco y los que tienen un error conservan su texto.
 */
function captureEdits(container) {
  const keep = [];
  const active = document.activeElement;
  container.querySelectorAll('input[id], textarea[id], select[id]').forEach(el => {
    if (SKIP_KEEP.has(el.type)) return;
    const focused = el === active;
    const invalid = el.getAttribute('aria-invalid') === 'true';
    if (!focused && !invalid) return;
    let sel = null;
    try { sel = focused && el.selectionStart !== null ? [el.selectionStart, el.selectionEnd] : null; } catch { /* number/date */ }
    const errorEl = invalid ? container.querySelector(`#${CSS.escape(el.id)}-error`) : null;
    keep.push({ id: el.id, value: el.value, focused, sel, error: errorEl?.textContent || '' });
  });
  return keep;
}

function restoreEdits(container, keep) {
  for (const k of keep) {
    const el = container.querySelector(`#${CSS.escape(k.id)}`);
    if (!el) continue;
    if (el.tagName !== 'SELECT' || [...el.options].some(o => o.value === k.value)) el.value = k.value;
    if (k.error) setFieldError(el, k.error);
    if (k.focused) {
      el.focus({ preventScroll: true });
      try { if (k.sel) el.setSelectionRange(k.sel[0], k.sel[1]); } catch { /* sin selección */ }
    }
  }
}

/**
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  const state = getState();
  const profile = state.activeProfile;
  const keep = container.querySelector('.settings-view') ? captureEdits(container) : [];
  const admin = adminVisible();

  container.innerHTML = `
    <div class="settings-view">
      <div class="settings-profile-head">
        ${avatarHTML(profile.name, 'avatar-lg')}
        <div><small>Ajustes de</small><strong>${esc(profile.name)}</strong></div>
      </div>

      <div class="help-cta">
        <button type="button" class="action-item" id="open-help">
          <span class="action-ico" aria-hidden="true">${icon('help')}</span><span><strong>Ayuda</strong><small>Instalarla, primeros pasos, cómo cuenta y copias</small></span>
        </button>
        <button type="button" class="action-item" id="open-jefatura" hidden>
          <span class="action-ico" aria-hidden="true">${icon('shield')}</span><span><strong>Jefatura</strong><small>Días pendientes de cada uno y compensaciones del grupo</small></span>
        </button>
      </div>

      <h2 class="set-block-title">Mis ajustes</h2>
      ${profileHTML(state)}
      ${daysHTML(state)}
      ${groupHTML(state)}
      ${securityHTML(state)}
      ${backupHTML(state)}
      ${lookHTML(state)}

      ${admin ? `<h2 class="set-block-title">Administración</h2>${adminHTML(state)}` : ''}

      <details class="set-group" data-section="${ADVANCED}" ${openSections.has(ADVANCED) ? 'open' : ''}>
        <summary><span class="set-block-title">Avanzado</span><span class="set-sub">Importar, exportar, reglas del grupo, tipos de servicio, diagnóstico y borrar</span></summary>
        <div class="set-group-body">
          ${advancedHTML(state)}
          ${dangerHTML(state)}
        </div>
      </details>

      <p class="app-version">CalGuard <span id="app-installed-version"></span> · funciona sin conexión · tus datos no salen de este móvil
        ${admin ? '' : `<br>${adminLinkHTML()}`}</p>
    </div>
  `;

  container.querySelectorAll('details[data-section]').forEach(d => {
    d.addEventListener('toggle', () => {
      if (d.open) openSections.add(d.dataset.section); else openSections.delete(d.dataset.section);
    });
  });

  const rerender = () => {
    if (container.isConnected && getState().currentScreen === 'settings') renderSettings(container);
  };

  bindProfile(container);
  bindDays(container);
  bindGroup(container);
  bindSecurity(container);
  bindBackup(container);
  bindLook(container);
  bindAdmin(container, rerender);
  bindAdvanced(container);
  bindDanger(container);

  container.querySelector('#open-help')?.addEventListener('click', openHelp);
  container.querySelector('#open-jefatura')?.addEventListener('click', () => openJefatura());
  canSeeJefatura().then(v => { const el = container.querySelector('#open-jefatura'); if (el) el.hidden = !v; }).catch(() => {});
  installedVersion().then(v => { const el = container.querySelector('#app-installed-version'); if (el && v) el.textContent = v; });
  checkAdmin(rerender);

  restoreEdits(container, keep);
}
