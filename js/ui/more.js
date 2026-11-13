/**
 * @module ui/more
 * Pantalla «Más»: lo que no cabe en la barra inferior, en filas grandes
 * (icono, título y subtítulo). Cada cosa está a un toque desde aquí.
 */

import { Actions } from '../state/store.js';
import { quickBackup, daysSinceBackup } from './flows.js';
import { openHelp } from './help.js';
import { esc } from './utils.js';
import { titleOf } from './router.js';

function backupSubtitle() {
  const days = daysSinceBackup();
  if (!Number.isFinite(days)) return 'Aún no tienes ninguna copia';
  if (days <= 0) return 'Tu última copia es de hoy';
  return `Tu última copia es de hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

/** Filas de la pantalla, en este orden. `jefatura` solo se enseña a quien ya la ve en Inicio. */
function rows() {
  return [
    { id: 'stats', icon: '📊', title: titleOf('stats'), sub: 'Tus cifras del año, mes a mes', run: () => Actions.setScreen('stats') },
    { id: 'registry', icon: '📒', title: titleOf('registry'), sub: 'Apunta y consulta tus servicios', run: () => Actions.setScreen('registry') },
    { id: 'jefatura', icon: '🛡️', title: 'Jefatura', sub: 'Los días de todo el grupo', hidden: true, run: () => import('./jefatura.js').then(m => m.openJefatura()) },
    { id: 'settings', icon: '⚙️', title: titleOf('settings'), sub: 'Tu ficha, el cuadrante, la seguridad y las copias', run: () => Actions.setScreen('settings') },
    { id: 'help', icon: '❓', title: 'Ayuda', sub: 'Cómo se usa CalGuard', run: () => openHelp() },
    { id: 'backup', icon: '💾', title: 'Copia de seguridad', sub: backupSubtitle(), run: () => quickBackup() }
  ];
}

/**
 * @param {HTMLElement} container
 */
export function renderMore(container) {
  const list = rows();
  container.innerHTML = `
    <div class="more-view">
      <ul class="more-list">
        ${list.map(r => `
          <li${r.hidden ? ' hidden' : ''} data-row="${r.id}">
            <button type="button" class="more-row" data-row-btn="${r.id}">
              <span class="more-ico" aria-hidden="true">${r.icon}</span>
              <span class="more-text">
                <span class="more-title">${esc(r.title)}</span>
                <span class="more-sub">${esc(r.sub)}</span>
              </span>
              <span class="more-go" aria-hidden="true">›</span>
            </button>
          </li>`).join('')}
      </ul>
    </div>`;

  list.forEach(r => {
    container.querySelector(`[data-row-btn="${r.id}"]`)?.addEventListener('click', () => r.run());
  });

  // Jefatura: la misma regla que el acceso de Inicio
  import('./jefatura.js').then(async m => {
    if (!(await m.canSeeJefatura())) return;
    const li = container.querySelector('[data-row="jefatura"]');
    if (li) li.hidden = false;
  }).catch(() => {});
}
