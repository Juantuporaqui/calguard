/**
 * @module ui/renderer
 * Main renderer - orchestrates all UI components based on state
 */

import { getState, Actions } from '../state/store.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar } from './calendar.js';
import { renderCuadrante } from './cuadrante.js';
import { renderRegistry } from './registry.js';
import { renderStats } from './stats.js';
import { renderSettings } from './settings.js';
import { renderDiagnostics } from './diagnostics.js';
import { renderContextMenu } from './contextMenu.js';
import { renderToast } from './toast.js';
import { renderLockScreen } from './lockScreen.js';
import { renderNav } from './nav.js';

let lastScreen = null;
let lastLocked = null;
let lastDarkMode = null;
let rendering = false;

/**
 * Main render function - called on every state change
 * @param {Object} state
 */
export function renderApp(state) {
  if (rendering) return;
  rendering = true;

  try {
    const app = document.getElementById('app');
    if (!app) return;

    // Dark mode
    if (state.darkMode !== lastDarkMode) {
      document.documentElement.classList.toggle('dark', state.darkMode);
      lastDarkMode = state.darkMode;
    }

    // Loading state
    if (state.loading) {
      app.innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>Cargando CalGuard...</p></div>`;
      return;
    }

    // Lock screen
    if (state.locked) {
      if (lastLocked !== true) {
        app.innerHTML = '';
        renderLockScreen(app);
        lastLocked = true;
        lastScreen = null;
      }
      return;
    }
    lastLocked = false;

    // Update banner
    const updateBanner = state.updateAvailable
      ? `<div class="update-banner" id="update-banner">
           Nueva versión disponible
           <button onclick="import('./js/app.js').then(m=>m.applyUpdate())">Actualizar</button>
         </div>`
      : '';

    // Only re-render screen content if screen changed or forced
    if (state.currentScreen !== lastScreen) {
      lastScreen = state.currentScreen;

      app.innerHTML = `
        ${updateBanner}
        <nav id="main-nav"></nav>
        <main id="screen-content"></main>
        <div id="context-menu-container"></div>
        <div id="toast-container"></div>
      `;

      renderNav(document.getElementById('main-nav'));
    }

    document.body.classList.toggle('screen-cuadrante', state.currentScreen === 'cuadrante');

    // Render active screen
    const content = document.getElementById('screen-content');
    if (content) {
      switch (state.currentScreen) {
        case 'dashboard': renderDashboard(content); break;
        case 'calendar': renderCalendar(content); break;
        case 'cuadrante': renderCuadrante(content); break;
        case 'registry': renderRegistry(content); break;
        case 'stats': renderStats(content); break;
        case 'settings': renderSettings(content); break;
        case 'diagnostics': renderDiagnostics(content); break;
      }
    }

    // Context menu overlay
    renderContextMenu(document.getElementById('context-menu-container'));

    // Toast
    renderToast(document.getElementById('toast-container'));

  } finally {
    rendering = false;
  }
}
