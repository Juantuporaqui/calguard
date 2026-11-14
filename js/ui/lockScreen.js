/**
 * @module ui/lockScreen
 * PIN lock screen + auto-lock by inactivity
 */

import { getState, Actions, subscribe } from '../state/store.js';
import { verifyPIN, hashPIN } from '../persistence/crypto.js';
import { get, put, STORES } from '../persistence/db.js';
import { unlockVault, lockVault } from '../persistence/vaultSession.js';
import { icon } from './icons.js';
import { canUseDeviceUnlock, getDeviceUnlock, unlockWithDevice } from '../persistence/deviceUnlock.js';

const MAX_FREE_ATTEMPTS = 5;
const MAX_DELAY_SECONDS = 60;

/** Seconds the user must wait before the next attempt, 0 if none. */
export function throttleDelaySeconds(attempts) {
  if (!attempts || attempts.count < MAX_FREE_ATTEMPTS) return 0;
  const delay = Math.min(MAX_DELAY_SECONDS, 2 ** (attempts.count - MAX_FREE_ATTEMPTS + 1));
  const elapsed = (Date.now() - attempts.lastFailAt) / 1000;
  return Math.max(0, Math.ceil(delay - elapsed));
}

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

  let locked = getState().locked;
  subscribe(state => {
    if (state.locked === locked) return;
    locked = state.locked;
    if (locked) clearTimeout(autoLockTimer);
    else resetTimer();
  });
  resetTimer();
}

/**
 * Render the lock screen
 * @param {HTMLElement} container
 */
export function renderLockScreen(container) {
  lockVault(); // bloqueada: la clave del token se olvida
  container.innerHTML = `
    <div class="lock-screen">
      <div class="lock-card">
        <div class="lock-icon" aria-hidden="true">${icon('lock')}</div>
        <h2>CalGuard está bloqueada</h2>
        <p id="lock-instructions">Escribe tu PIN para entrar</p>
        <button type="button" class="btn btn-primary btn-block" id="unlock-device" hidden>Desbloquear con el móvil</button>
        <p id="unlock-device-message" role="status" hidden></p>
        <div class="pin-input-group">
          <input type="password" id="pin-input" maxlength="8" inputmode="none"
                 pattern="[0-9]*" autocomplete="off" aria-label="PIN de desbloqueo" aria-describedby="pin-error">
          <div class="pin-dots" aria-hidden="true">${'<i></i>'.repeat(8)}</div>
        </div>
        <p id="pin-error" class="error-text" role="alert" hidden>PIN incorrecto</p>
        <div class="pin-pad" role="group" aria-label="Teclado del PIN">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => `<button type="button" class="pin-key" data-digit="${d}">${d}</button>`).join('')}
          <button type="button" class="pin-key pin-key-fn" data-act="del" aria-label="Borrar la última cifra">${icon('backspace')}</button>
          <button type="button" class="pin-key" data-digit="0">0</button>
          <button type="button" id="pin-submit" class="pin-key pin-key-ok" aria-label="Entrar">Entrar</button>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('pin-input');
  const deviceButton = container.querySelector('#unlock-device');
  const deviceMessage = container.querySelector('#unlock-device-message');
  const submit = document.getElementById('pin-submit');
  const error = document.getElementById('pin-error');
  const keys = [...container.querySelectorAll('.pin-key')];
  const dots = [...container.querySelectorAll('.pin-dots i')];
  const paintDots = () => dots.forEach((d, i) => d.classList.toggle('on', i < input.value.length));
  const setDisabled = (on) => { input.disabled = on; keys.forEach(k => { k.disabled = on; }); };

  let countdownTimer = null;
  let verifying = false;

  const showThrottle = (seconds) => {
    clearInterval(countdownTimer);
    let remaining = seconds;
    setDisabled(true);
    error.hidden = false;
    error.textContent = `Demasiados intentos. Espera ${remaining} s`;
    countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        setDisabled(false);
        error.hidden = true;
        error.textContent = 'PIN incorrecto';
        input.focus();
      } else {
        error.textContent = `Demasiados intentos. Espera ${remaining} s`;
      }
    }, 1000);
  };

  const tryUnlock = async () => {
    const pin = input.value.trim();
    if (!pin || input.disabled || verifying) return;

    error.hidden = true;
    verifying = true;
    try {
      await checkPin(pin);
    } finally {
      verifying = false;
    }
  };

  const checkPin = async (pin) => {
    const state = getState();

    // Brute-force throttle: exponential wait after repeated failures
    const attemptsCfg = await get(STORES.CONFIG, 'pinAttempts');
    const attempts = attemptsCfg?.value || null;
    const wait = throttleDelaySeconds(attempts);
    if (wait > 0) {
      showThrottle(wait);
      return;
    }

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
      // Transparent migration: re-save legacy v2 (fixed-salt) hashes as v3
      if (typeof storedHash === 'string') {
        const record = await hashPIN(pin);
        await put(STORES.CONFIG, { key: 'pinHash', value: record });
        Actions.setConfig({ pinHash: record });
      }
      await put(STORES.CONFIG, { key: 'pinAttempts', value: null });
      // modo administrador: clave del token en memoria (y migración del token antiguo en claro)
      await unlockVault(pin);
      Actions.setLocked(false);
      input.value = '';
      paintDots();
    } else {
      const next = { count: (attempts?.count || 0) + 1, lastFailAt: Date.now() };
      await put(STORES.CONFIG, { key: 'pinAttempts', value: next });
      error.textContent = 'PIN incorrecto';
      error.hidden = false;
      input.value = '';
      paintDots();
      const nextWait = throttleDelaySeconds(next);
      if (nextWait > 0) {
        showThrottle(nextWait);
      } else {
        input.focus();
      }
    }
  };

  Promise.all([getDeviceUnlock(), canUseDeviceUnlock()]).then(([saved, available]) => {
    if (!saved || !available || !deviceButton.isConnected) return;
    deviceButton.hidden = false;
    container.querySelector('#lock-instructions').textContent = 'Desbloquea con el móvil o escribe tu PIN';
    deviceButton.addEventListener('click', async () => {
      if (verifying) return;
      verifying = true;
      deviceButton.disabled = true;
      deviceMessage.hidden = true;
      try {
        if (await unlockWithDevice(saved) && deviceButton.isConnected && getState().locked) {
          clearInterval(countdownTimer);
          // Este acceso solo abre la pantalla. El token sigue esperando el PIN.
          Actions.setLocked(false);
          return;
        }
        deviceMessage.textContent = 'No se pudo desbloquear. Puedes entrar con tu PIN.';
      } catch {
        deviceMessage.textContent = 'No se completó el desbloqueo. Puedes entrar con tu PIN.';
      } finally {
        verifying = false;
        deviceButton.disabled = false;
      }
      deviceMessage.hidden = false;
    });
  }).catch(() => { /* El teclado del PIN sigue disponible. */ });

  submit.addEventListener('click', tryUnlock);
  container.querySelectorAll('[data-digit]').forEach(k => k.addEventListener('click', () => {
    if (input.disabled || input.value.length >= 8) return;
    input.value += k.dataset.digit;
    error.hidden = true;
    paintDots();
  }));
  container.querySelector('[data-act="del"]').addEventListener('click', () => {
    input.value = input.value.slice(0, -1);
    paintDots();
  });
  // teclado físico: cifras, borrar e Intro
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 8); paintDots(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
  });

  setTimeout(() => {
    if (input.isConnected && document.activeElement === document.body) input.focus({ preventScroll: true });
  }, 100);
}
