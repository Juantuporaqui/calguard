/**
 * @module ui/nav
 * Bottom navigation bar (SVG icons: same look on every device).
 */

import { getState, Actions } from '../state/store.js';
import { navScreens, navLabelOf, tabOf } from './router.js';

const ICONS = {
  dashboard: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  cuadrante: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.6c2.4-.3 4.4 1.2 4.9 4.4"/>',
  biblioteca: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2v15a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 1 4 17V4.5ZM20 4.5A1.5 1.5 0 0 0 18.5 3H14a2 2 0 0 0-2 2v15a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 17V4.5Z"/>',
  more: '<circle cx="5.5" cy="12" r="1.7" class="nav-dot"/><circle cx="12" cy="12" r="1.7" class="nav-dot"/><circle cx="18.5" cy="12" r="1.7" class="nav-dot"/>'
};

/**
 * @param {HTMLElement} container
 */
export function renderNav(container) {
  if (!container) return;
  // la pestaña que se resalta es la madre de la pantalla (en Ajustes o Estadísticas, «Más»)
  const current = tabOf(getState().currentScreen);

  container.setAttribute('aria-label', 'Navegación principal');
  container.innerHTML = `
    <div class="nav-bar">
      ${navScreens().map(t => `
        <button type="button" class="nav-tab ${current === t.id ? 'active' : ''}" data-screen="${t.id}"
                ${current === t.id ? 'aria-current="page"' : ''}>
          <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[t.id]}</svg>
          <span class="nav-label">${navLabelOf(t.id)}</span>
        </button>`).join('')}
    </div>`;

  container.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => Actions.setScreen(btn.dataset.screen));
  });
}
