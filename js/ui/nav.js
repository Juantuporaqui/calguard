/**
 * @module ui/nav
 * Bottom navigation bar
 */

import { getState, Actions } from '../state/store.js';

const tabs = [
  { id: 'dashboard', label: 'Inicio', icon: '&#9750;' },
  { id: 'calendar', label: 'Calendario', icon: '&#128197;' },
  { id: 'cuadrante', label: 'Cuadrante', icon: '&#128101;' },
  { id: 'registry', label: 'Bitácora', icon: '&#128221;' },
  { id: 'stats', label: 'Estadísticas', icon: '&#128200;' },
  { id: 'settings', label: 'Ajustes', icon: '&#9881;' }
];

/**
 * @param {HTMLElement} container
 */
export function renderNav(container) {
  if (!container) return;
  const state = getState();

  container.innerHTML = `
    <div class="nav-bar" role="navigation" aria-label="Navegación principal">
      ${tabs.map(t => `
        <button class="nav-tab ${state.currentScreen === t.id ? 'active' : ''}"
                data-screen="${t.id}"
                aria-label="${t.label}"
                aria-current="${state.currentScreen === t.id ? 'page' : 'false'}"
                tabindex="0">
          <span class="nav-icon">${t.icon}</span>
          <span class="nav-label">${t.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      Actions.setScreen(btn.dataset.screen);
    });
  });
}
