/**
 * @module ui/nav
 * Bottom navigation bar (SVG icons: same look on every device).
 */

import { getState, Actions } from '../state/store.js';

const ICONS = {
  dashboard: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  cuadrante: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.6c2.4-.3 4.4 1.2 4.9 4.4"/>',
  registry: '<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14.5 3v4.5H19M8.5 12.5h7M8.5 16.5h5"/>',
  biblioteca: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2v15a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 1 4 17V4.5ZM20 4.5A1.5 1.5 0 0 0 18.5 3H14a2 2 0 0 0-2 2v15a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 17V4.5Z"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'
};

const TABS = [
  { id: 'dashboard', label: 'Inicio' },
  { id: 'calendar', label: 'Calendario' },
  { id: 'cuadrante', label: 'Cuadrante' },
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'settings', label: 'Ajustes' }
];

/**
 * @param {HTMLElement} container
 */
export function renderNav(container) {
  if (!container) return;
  const current = getState().currentScreen;

  container.setAttribute('aria-label', 'Navegación principal');
  container.innerHTML = `
    <div class="nav-bar">
      ${TABS.map(t => `
        <button type="button" class="nav-tab ${current === t.id ? 'active' : ''}" data-screen="${t.id}"
                ${current === t.id ? 'aria-current="page"' : ''}>
          <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[t.id]}</svg>
          <span class="nav-label">${t.label}</span>
        </button>`).join('')}
    </div>`;

  container.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => Actions.setScreen(btn.dataset.screen));
  });
}
