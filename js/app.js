/**
 * @module app
 * CalGuard - Main Application Entry Point
 * Cuadrante + Bitácora Operativa para Policía Científica CNP
 */

import { openDB, get, put, getAll, getAllByIndex, STORES } from './persistence/db.js';
import { isMigrationDone, migrateFromLegacy } from './persistence/migrations.js';
import { hashPIN, verifyPIN } from './persistence/crypto.js';
import { getState, Actions, subscribe } from './state/store.js';
import { calculateCounters, todayISO } from './domain/rules.js';
import { loadLedger } from './domain/ledger.js';
import { loadServices } from './domain/services.js';
import { renderApp } from './ui/renderer.js';
import { initLockScreen } from './ui/lockScreen.js';

/**
 * Boot the application
 */
async function boot() {
  try {
    // 1. Open database
    await openDB();

    // 2. Check for existing profile or create default
    let profiles = await getAll(STORES.PROFILES);
    let activeProfile = null;

    if (profiles.length === 0) {
      // First run - create default profile
      activeProfile = {
        id: crypto.randomUUID(),
        name: 'Mi Perfil',
        role: 'usuario',
        createdAt: new Date().toISOString(),
        settings: {}
      };
      await put(STORES.PROFILES, activeProfile);
    } else {
      // Load last used profile or first
      const lastProfileId = await get(STORES.CONFIG, 'lastProfileId');
      if (lastProfileId && lastProfileId.value) {
        activeProfile = profiles.find(p => p.id === lastProfileId.value) || profiles[0];
      } else {
        activeProfile = profiles[0];
      }
    }

    Actions.setProfile(activeProfile);
    await put(STORES.CONFIG, { key: 'lastProfileId', value: activeProfile.id });

    // 3. Run migration if needed
    const migrated = await isMigrationDone();
    if (!migrated) {
      const result = await migrateFromLegacy(activeProfile.id);
      if (result.migrated) {
        console.log(`Migration completed: ${result.count} days migrated`);
        if (result.errors.length > 0) {
          console.warn('Migration warnings:', result.errors);
        }
      }
    }

    // 4. Load config
    const savedConfig = await get(STORES.CONFIG, 'appConfig');
    if (savedConfig && savedConfig.value) {
      Actions.setConfig(savedConfig.value);
    }

    // Load UI prefs
    const darkMode = await get(STORES.CONFIG, 'darkMode');
    if (darkMode && darkMode.value) {
      Actions.setDarkMode(true);
    }

    // 5. Load data
    const days = await getAllByIndex(STORES.DAYS, 'profileId', activeProfile.id);
    Actions.setDays(days);

    await loadLedger();
    await loadServices();

    // 6. Calculate counters
    const state = getState();
    const counters = calculateCounters(state.days, state.ledger, state.config);
    Actions.setCounters(counters);

    // 7. Check PIN lock
    const pinConfig = await get(STORES.CONFIG, 'pinHash');
    if (pinConfig && pinConfig.value) {
      Actions.setConfig({ pinHash: pinConfig.value });
      Actions.setLocked(true);
    }

    // 8. Subscribe renderer
    subscribe(renderApp);

    // 9. Init lock screen
    initLockScreen();

    // 10. Register service worker
    registerSW();

    // 11. Deep link: manifest shortcuts and share-target redirect use hashes
    applyHashScreen();

    // 12. Done
    Actions.setLoading(false);

    // Initial render
    renderApp(getState());

    // 13. If a file was shared to the app (Web Share Target), import it now
    importSharedFile();

  } catch (err) {
    console.error('Boot error:', err);
    document.getElementById('app').innerHTML = `
      <div style="padding:2rem;text-align:center;color:#c0392b">
        <h2>Error al iniciar CalGuard</h2>
        <p>${err.message}</p>
        <button onclick="location.reload()">Reintentar</button>
      </div>`;
  }
}

/**
 * Register service worker with update detection
 */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js').then(reg => {
    // Check for updates
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          Actions.setUpdateAvailable(true);
        }
      });
    });
  }).catch(err => {
    console.warn('SW registration failed:', err);
  });

  // Reload once the new SW takes control (after SKIP_WAITING)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
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

const HASH_SCREENS = ['dashboard', 'calendar', 'cuadrante', 'registry', 'stats', 'settings', 'diagnostics'];

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
 * redirects here with #shared-import; we pick it up and import it as
 * the group cuadrante.
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
    const file = new File([blob], name, { type: blob.type });

    const { importCuadranteFile } = await import('./ui/cuadrante.js');
    const result = await importCuadranteFile(file);
    Actions.setScreen('cuadrante');
    Actions.showToast(`Cuadrante actualizado: ${result.entries} turnos de ${result.names} personas`);
    history.replaceState(null, '', location.pathname + location.search);
  } catch (err) {
    console.error('Shared file import failed:', err);
    Actions.showToast('Error al importar el archivo compartido: ' + err.message);
  }
}

/**
 * Recalculate counters from current state
 */
export function recalcCounters() {
  const state = getState();
  const counters = calculateCounters(state.days, state.ledger, state.config);
  Actions.setCounters(counters);
}

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
