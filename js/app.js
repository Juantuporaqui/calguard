/**
 * @module app
 * CalGuard - Main Application Entry Point
 * Cuadrante + Bitácora Operativa para Policía Científica CNP
 */

import { openDB, get, put, STORES } from './persistence/db.js';
import { isMigrationDone, migrateFromLegacy } from './persistence/migrations.js';
import { getState, Actions, subscribe, effectiveConfig } from './state/store.js';
import { loadProfiles, loadProfileData, migratePersonalSettings } from './domain/profiles.js';
import { importGroupCuadranteFile, currentRoster, notesCount, rereadIfOutdated } from './domain/groupCuadrante.js';
import { autoSyncIfStale } from './domain/cuadranteSync.js';
import { renderApp } from './ui/renderer.js';
import { invalidateCuadranteCache } from './ui/cuadrante.js';
import { initLockScreen } from './ui/lockScreen.js';
import { applyTheme, watchSystemTheme } from './ui/theme.js';
import { askWhoAmIIfNeeded, loadMe, loadBackupInfo, pullSharedCuadrante, loadGroupComps, canPublish, publishSharedCuadrante, notifyCuadranteChanged } from './ui/flows.js';

/**
 * Boot the application
 */
async function boot() {
  installGlobalErrorHandlers();
  try {
    // 1. Database
    await openDB();

    // 2. Profiles: create the first one on first run
    let profiles = await loadProfiles();
    if (profiles.length === 0) {
      await put(STORES.PROFILES, {
        id: crypto.randomUUID(),
        name: 'Mi perfil',
        role: 'usuario',
        createdAt: new Date().toISOString(),
        settings: {}
      });
      profiles = await loadProfiles();
    }
    const last = await get(STORES.CONFIG, 'lastProfileId');
    const activeProfile = profiles.find(p => p.id === last?.value) || profiles[0];

    // 3. Legacy migration (calendarioDB → calguardDB), once
    if (!(await isMigrationDone())) {
      const result = await migrateFromLegacy(activeProfile.id);
      if (result.errors?.length) console.warn('Migration warnings:', result.errors);
    }

    // 4. Global config + theme
    const savedConfig = await get(STORES.CONFIG, 'appConfig');
    if (savedConfig?.value) Actions.setConfig(savedConfig.value);
    await loadMe();
    await loadGroupComps();
    await loadBackupInfo();
    const theme = await get(STORES.CONFIG, 'themePreference');
    const legacyDark = await get(STORES.CONFIG, 'darkMode');
    applyTheme(theme?.value || (legacyDark?.value ? 'dark' : 'auto'));
    watchSystemTheme();

    // 5. Active profile and its data, in a single render
    Actions.setProfile(activeProfile);
    await put(STORES.CONFIG, { key: 'lastProfileId', value: activeProfile.id });
    await migratePersonalSettings();
    Actions.setData(await loadProfileData(activeProfile.id));

    // 6. PIN lock
    const pinConfig = await get(STORES.CONFIG, 'pinHash');
    if (pinConfig?.value) {
      Actions.setConfig({ pinHash: pinConfig.value });
      Actions.setLocked(true);
    }

    // 7. UI
    subscribe(renderApp);
    initLockScreen();
    registerSW();
    applyHashScreen();
    Actions.setLoading(false);
    renderApp(getState());
    announceUpdate();

    // "Al día": balances depend on today's date — refresh when coming back
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      Actions.refreshDerived();
      // the administrator may have published a newer cuadrante meanwhile
      pullSharedCuadrante({ throttleMs: 10 * 60 * 1000 }).catch(err => console.warn('pull failed', err));
    });

    // 8. Background work after first paint
    await rereadWithNewVersion();
    await importSharedFile();
    await pullSharedCuadrante().catch(err => console.warn('pull failed', err));
    await runAutoSync();
    await askWhoAmIIfNeeded();
  } catch (err) {
    console.error('Boot error:', err);
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="boot-error">
        <h2>No se pudo iniciar CalGuard</h2>
        <p></p>
        <button type="button" class="btn btn-primary">Reintentar</button>
      </div>`;
    app.querySelector('p').textContent = err.message;
    app.querySelector('button').addEventListener('click', () => location.reload());
  }
}

/** Sync the active profile with the group cuadrante if it is newer. */
export async function runAutoSync() {
  try {
    const summary = await autoSyncIfStale();
    if (summary) {
      const name = getState().activeProfile?.name || '';
      Actions.showToast(`Contabilidad de ${name} actualizada con el cuadrante`);
    }
  } catch (err) {
    console.error('Auto-sync failed:', err);
    Actions.showToast('No se pudo sincronizar con el cuadrante: ' + err.message);
  }
}

/**
 * Any unexpected error becomes a visible, non-blocking notice instead of a
 * silent failure, and is kept in the console for diagnosis.
 */
function installGlobalErrorHandlers() {
  const notify = (err) => {
    const msg = err?.message || String(err || 'Error desconocido');
    if (/ResizeObserver|Script error/.test(msg)) return;
    try { Actions.showToast('Algo ha fallado: ' + msg); } catch { /* store not ready */ }
  };
  window.addEventListener('error', (e) => { console.error(e.error || e.message); notify(e.error || e.message); });
  window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); notify(e.reason); });
}

const UPDATE_CHECK_MS = 30 * 60 * 1000; // look for a new version at most every 30 min
const UPDATED_FLAG = 'calguard-just-updated';

/**
 * Service worker with automatic updates:
 *  - the SW script is never taken from the HTTP cache (updateViaCache: 'none');
 *  - a new version is looked for on start, when the app comes back to the
 *    foreground and every few hours while it stays open;
 *  - the new SW activates by itself and the page reloads as soon as it is
 *    safe (no sheet open, no form being typed, nothing in progress).
 */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // On the very first visit the page has no controller: the SW claiming it is
  // not an update, and reloading then would interrupt the user (e.g.
  // mid-import). Every later change of controller is a new version.
  let initialClaim = !navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (initialClaim) { initialClaim = false; return; }
    if (refreshing) return;
    refreshing = true;
    reloadWhenSafe();
  });

  navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).then(reg => {
    if (!reg) return;
    // A worker left waiting by an older version of the app: let it in now
    if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    let lastCheck = Date.now();
    const check = (force = false) => {
      if (!force && Date.now() - lastCheck < UPDATE_CHECK_MS) return;
      lastCheck = Date.now();
      reg.update().catch(() => { /* offline: try later */ });
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(() => check(true), 4 * 60 * 60 * 1000);
  }).catch(err => {
    console.warn('SW registration failed:', err);
  });
}

/** Something on screen that a reload would lose? */
function userIsBusy() {
  const s = getState();
  const el = document.activeElement;
  return Boolean(
    document.querySelector('.sheet-backdrop, .modal-overlay') || s.busy || s.multiSelect?.active ||
    s.rangeSelection || (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
  );
}

/** Reload into the new version now, or as soon as the user is not in the middle of something. */
function reloadWhenSafe() {
  const go = () => {
    try { sessionStorage.setItem(UPDATED_FLAG, '1'); } catch { /* private mode */ }
    location.reload();
  };
  if (document.visibilityState === 'hidden' || !userIsBusy()) { go(); return; }
  Actions.showToast('Hay una versión nueva de CalGuard: se aplicará al terminar lo que estás haciendo');
  const timer = setInterval(() => {
    if (document.visibilityState === 'hidden' || !userIsBusy()) { clearInterval(timer); go(); }
  }, 1500);
}

/** After an automatic update, say so once. */
function announceUpdate() {
  try {
    if (sessionStorage.getItem(UPDATED_FLAG)) {
      sessionStorage.removeItem(UPDATED_FLAG);
      Actions.showToast('CalGuard se ha actualizado a la última versión');
    }
  } catch { /* private mode */ }
}

/**
 * Apply update: tell the waiting SW to take over; the reload happens
 * on 'controllerchange' once the new SW actually controls the page.
 */
export function applyUpdate() {
  if (!navigator.serviceWorker.controller) {
    location.reload();
    return;
  }
  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      location.reload();
    }
  });
}

const HASH_SCREENS = ['dashboard', 'calendar', 'cuadrante', 'biblioteca', 'registry', 'stats', 'settings', 'diagnostics'];

/**
 * Set the initial screen from the URL hash (#calendar, #cuadrante...).
 * '#shared-import' is the redirect target of the share-target flow.
 */
function applyHashScreen() {
  const hash = location.hash.replace('#', '');
  if (hash === 'shared-import') {
    Actions.setScreen('cuadrante');
  } else if (HASH_SCREENS.includes(hash)) {
    Actions.setScreen(hash);
  }
}

/**
 * Import a file shared to the installed app (Web Share Target).
 * The service worker stashes it in the 'calguard-shared' cache and
 * redirects here with #shared-import.
 */
async function importSharedFile() {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('calguard-shared');
    const resp = await cache.match('./shared-file');
    if (!resp) return;
    await cache.delete('./shared-file');

    const blob = await resp.blob();
    const name = decodeURIComponent(resp.headers.get('X-File-Name') || 'cuadrante.xlsx');
    const result = await importGroupCuadranteFile(new File([blob], name, { type: blob.type }));
    invalidateCuadranteCache();
    Actions.setScreen('cuadrante');
    const plantilla = currentRoster(result.data.names, effectiveConfig(getState()).escalafonOrder || []).length;
    const notas = notesCount(result.data);
    Actions.showToast(`Cuadrante actualizado: ${plantilla} en plantilla${notas ? ` · ${notas.toLocaleString('es-ES')} notas leídas` : ''}`);
    history.replaceState(null, '', location.pathname + location.search);
  } catch (err) {
    console.error('Shared file import failed:', err);
    Actions.showToast('Error al importar el archivo compartido: ' + err.message);
  }
}

/**
 * A new version of the reader: read this device's Excel again (same file,
 * kept since it was loaded) so its notes count, and offer the administrator
 * to publish it.
 */
async function rereadWithNewVersion() {
  try {
    const r = await rereadIfOutdated();
    if (!r) return;
    invalidateCuadranteCache();
    notifyCuadranteChanged();
    await autoSyncIfStale();
    if (await canPublish()) {
      Actions.showToast(`El Excel se ha vuelto a leer con la versión nueva (${r.notas} notas). Publícalo para que les llegue a todos.`,
        { actionLabel: 'Publicar', onAction: () => publishSharedCuadrante(), duration: 12000 });
    }
  } catch (err) {
    console.warn('re-read failed', err);
  }
}

/**
 * @deprecated Counters are derived automatically by the store. Kept so older
 * call sites keep working; it just forces a refresh.
 */
export function recalcCounters() {
  Actions.refreshDerived();
}

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
