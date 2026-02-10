/**
 * @module ui/lockScreen
 * PIN lock screen + auto-lock by inactivity
 */

import { getState, Actions } from '../state/store.js';
import { verifyPIN } from '../persistence/crypto.js';
import { get, STORES } from '../persistence/db.js';

let autoLockTimer = null;

/**
 * Initialize auto-lock listeners
 */
export function initLockScreen() {
  const resetTimer = () => {
    const state = getState();
    if (!state.config.pinHash || state.locked) return;

    clearTimeout(autoLockTimer);
    const minutes = state.config.autoLockMinutes || 5;
    autoLockTimer = setTimeout(() => {
      if (getState().config.pinHash && !getState().locked) {
        Actions.setLocked(true);
      }
    }, minutes * 60 * 1000);
  };

  ['click', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetTimer, { passive: true });
  });

  resetTimer();
}

/**
 * Render the lock screen
 * @param {HTMLElement} container
 */
export function renderLockScreen(container) {
  container.innerHTML = `
    <div class="lock-screen">
      <div class="lock-card">
        <div class="lock-icon" aria-hidden="true">&#128274;</div>
        <h2>CalGuard Bloqueado</h2>
        <p>Introduce tu PIN para continuar</p>
        <div class="pin-input-group">
          <input type="password" id="pin-input" maxlength="8" inputmode="numeric"
                 pattern="[0-9]*" placeholder="PIN" autocomplete="off"
                 aria-label="PIN de desbloqueo">
          <button id="pin-submit" class="btn btn-primary" aria-label="Desbloquear">
            Desbloquear
          </button>
        </div>
        <p id="pin-error" class="error-text" hidden>PIN incorrecto</p>
      </div>
    </div>
  `;

  const input = document.getElementById('pin-input');
  const submit = document.getElementById('pin-submit');
  const error = document.getElementById('pin-error');

  const tryUnlock = async () => {
    const pin = input.value.trim();
    if (!pin) return;

    error.hidden = true;
    const state = getState();

    // Try stored hash from config
    let storedHash = state.config.pinHash;
    if (!storedHash) {
      const cfg = await get(STORES.CONFIG, 'pinHash');
      storedHash = cfg?.value;
    }

    if (!storedHash) {
      // No PIN set, just unlock
      Actions.setLocked(false);
      return;
    }

    const valid = await verifyPIN(pin, storedHash);
    if (valid) {
      Actions.setLocked(false);
      input.value = '';
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  };

  submit.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });

  setTimeout(() => input.focus(), 100);
}
