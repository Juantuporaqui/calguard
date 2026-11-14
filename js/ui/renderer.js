/**
 * @module ui/renderer
 * Main renderer. Re-renders only what changed:
 *  - the screen, when its inputs change (data, config, profile, view state);
 *  - the header, when the profile or screen changes;
 *  - overlays (toast, busy, update banner) on every state change.
 * A toast appearing therefore never wipes a form the user is filling in.
 */

import { applyUpdate } from '../app.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar } from './calendar.js';
import { renderCuadrante } from './cuadrante.js';
import { renderRegistry } from './registry.js';
import { renderBiblioteca } from './biblioteca.js';
import { renderStats } from './stats.js';
import { renderMore } from './more.js';
import { renderSettings } from './settings.js';
import { renderDiagnostics } from './diagnostics.js';
import { renderToast } from './toast.js';
import { renderLockScreen } from './lockScreen.js';
import { dismissSheetsForLock } from './sheet.js';
import { renderNav } from './nav.js';
import { renderHeader } from './header.js';
import { esc } from './utils.js';
import { HOME } from './router.js';

/** Qué pinta cada pantalla de la tabla de router.js (los ids tienen que coincidir). */
const RENDERERS = {
  dashboard: renderDashboard,
  calendar: renderCalendar,
  cuadrante: renderCuadrante,
  registry: renderRegistry,
  biblioteca: renderBiblioteca,
  more: renderMore,
  stats: renderStats,
  settings: renderSettings,
  diagnostics: renderDiagnostics
};

/** State slices a screen depends on. */
const SCREEN_INPUTS = [
  'currentScreen', 'days', 'ledger', 'services', 'config', 'activeProfile', 'profiles',
  'calendarYear', 'calendarMonth', 'calendarView', 'calendarWeekAnchor',
  'rangeSelection', 'multiSelect', 'balances'
];
const HEADER_INPUTS = ['currentScreen', 'activeProfile', 'profiles'];

let shellMounted = false;
let lastLocked = null;
let lastDark = null;
let lastScreenInputs = null;
let lastHeaderInputs = null;
let rendering = false;
let pending = false;

function changed(state, keys, prev) {
  if (!prev) return true;
  return keys.some(k => state[k] !== prev[k]);
}

function snapshot(state, keys) {
  const o = {};
  for (const k of keys) o[k] = state[k];
  return o;
}

/**
 * Force the active screen to re-render on the next state change (used by
 * screens with local state, e.g. after a filter changes).
 */
export function invalidateScreen() {
  lastScreenInputs = null;
}

/**
 * Main render function - called on every state change
 * @param {Object} state
 */
export function renderApp(state) {
  if (rendering) { pending = true; return; }
  rendering = true;
  try {
    doRender(state);
  } finally {
    rendering = false;
  }
  // A dispatch happened while rendering: render the latest state once more
  if (pending) {
    pending = false;
    queueMicrotask(() => import('../state/store.js').then(m => renderApp(m.getState())));
  }
}

function doRender(state) {
  const app = document.getElementById('app');
  if (!app) return;

  if (state.darkMode !== lastDark) {
    document.documentElement.classList.toggle('dark', state.darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.darkMode ? '#0b1121' : '#1a2332');
    lastDark = state.darkMode;
  }

  if (state.loading) {
    app.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Cargando CalGuard…</p></div>';
    shellMounted = false;
    return;
  }

  if (state.locked) {
    if (lastLocked !== true) {
      dismissSheetsForLock();
      renderLockScreen(app);
      lastLocked = true;
      shellMounted = false;
    }
    return;
  }
  lastLocked = false;

  if (!shellMounted) {
    app.innerHTML = `
      <div id="update-banner-container"></div>
      <header id="app-header"></header>
      <main id="screen-content" tabindex="-1"></main>
      <nav id="main-nav"></nav>
      <div id="toast-container" aria-live="polite"></div>
      <div id="busy-container"></div>
    `;
    shellMounted = true;
    lastScreenInputs = null;
    lastHeaderInputs = null;
  }

  const screenChanged = !lastScreenInputs || state.currentScreen !== lastScreenInputs.currentScreen;

  if (changed(state, HEADER_INPUTS, lastHeaderInputs)) {
    renderHeader(document.getElementById('app-header'));
    renderNav(document.getElementById('main-nav'));
    lastHeaderInputs = snapshot(state, HEADER_INPUTS);
  }

  document.body.classList.toggle('screen-cuadrante', state.currentScreen === 'cuadrante');

  if (changed(state, SCREEN_INPUTS, lastScreenInputs)) {
    const content = document.getElementById('screen-content');
    const render = RENDERERS[state.currentScreen] || RENDERERS[HOME];
    lastScreenInputs = snapshot(state, SCREEN_INPUTS);
    // repintar la misma pantalla no debe mover el scroll ni quitar el foco
    const keep = screenChanged ? null : captureView(content);
    const done = render(content);
    if (keep) {
      restoreView(content, keep);
      if (done && typeof done.then === 'function') done.then(() => restoreView(content, keep)).catch(() => {});
    }
    if (screenChanged) {
      content.classList.remove('screen-enter');
      void content.offsetWidth; // restart the entry animation
      content.classList.add('screen-enter');
      window.scrollTo({ top: 0 });
    }
  }

  renderUpdateBanner(state);
  renderToast(document.getElementById('toast-container'));
  renderBusy(state);
}

/**
 * Cómo encontrar de nuevo el elemento con el foco tras repintar: por su id o,
 * si no tiene, por sus atributos data-* y su texto.
 */
export function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return { id: el.id };
  const data = [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value]);
  if (!data.length && !el.getAttribute('aria-label')) return null;
  return { tag: el.tagName, data, label: el.getAttribute('aria-label') || '', text: (el.textContent || '').trim().slice(0, 40) };
}

function findByKey(root, key) {
  if (!key) return null;
  if (key.id) return root.querySelector(`#${CSS.escape(key.id)}`);
  const sel = key.tag.toLowerCase() + key.data.map(([n, v]) => `[${n}="${CSS.escape(v)}"]`).join('');
  const all = [...root.querySelectorAll(sel)];
  return all.find(e => (e.getAttribute('aria-label') || '') === key.label && (e.textContent || '').trim().slice(0, 40) === key.text) || all[0] || null;
}

function captureView(content) {
  const active = document.activeElement;
  const inside = active && content.contains(active);
  return { y: window.scrollY, x: window.scrollX, focus: inside ? focusKey(active) : null };
}

function restoreView(content, keep) {
  if (keep.focus && (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) {
    findByKey(content, keep.focus)?.focus({ preventScroll: true });
  }
  if (Math.abs(window.scrollY - keep.y) > 1) window.scrollTo({ left: keep.x, top: keep.y, behavior: 'instant' });
}

function renderUpdateBanner(state) {
  const el = document.getElementById('update-banner-container');
  if (!el) return;
  const has = !!el.firstElementChild;
  if (state.updateAvailable && !has) {
    el.innerHTML = `
      <div class="update-banner" id="update-banner" role="status">
        <span>Hay una versión nueva de CalGuard</span>
        <button type="button">Actualizar</button>
      </div>`;
    el.querySelector('button').addEventListener('click', applyUpdate);
  } else if (!state.updateAvailable && has) {
    el.innerHTML = '';
  }
}

function renderBusy(state) {
  const el = document.getElementById('busy-container');
  if (!el) return;
  if (state.busy) {
    el.innerHTML = `<div class="busy-overlay" role="alert" aria-busy="true"><div class="busy-card"><div class="spinner"></div><p>${esc(state.busy)}</p></div></div>`;
  } else if (el.firstElementChild) {
    el.innerHTML = '';
  }
}
