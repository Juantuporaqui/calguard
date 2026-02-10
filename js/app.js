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

    // 11. Done
    Actions.setLoading(false);

    // Initial render
    renderApp(getState());

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

  // Handle controller change (after skipWaiting)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // New SW activated
  });
}

/**
 * Apply update: tell new SW to take over, then reload
 */
export function applyUpdate() {
  if (!navigator.serviceWorker.controller) {
    location.reload();
    return;
  }
  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    location.reload();
  });
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
