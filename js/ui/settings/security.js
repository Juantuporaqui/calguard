/**
 * @module ui/settings/security
 * «Seguridad»: PIN de bloqueo y bloqueo automático.
 * El PIN bloquea la pantalla, pero no cifra los datos (sí cifra el token del administrador).
 */

import { Actions, getState } from '../../state/store.js';
import { isValidNewPin } from '../../persistence/tokenVault.js';
import { savePin, removePin, PIN_RULE, askVerifiedPin } from '../pin.js';
import { canUseDeviceUnlock, getDeviceUnlock, enrollDeviceUnlock, removeDeviceUnlock } from '../../persistence/deviceUnlock.js';
import { openSheet } from '../sheet.js';
import { section, autosave, intRange, saveGlobalConfig, setFieldError } from './common.js';

export function securityHTML(state) {
  const config = state.config;
  return section('security', 'Seguridad', config.pinHash ? 'PIN activado' : 'Sin PIN', `
    <p class="set-help">El <strong>PIN bloquea la pantalla</strong> de CalGuard al abrirla y tras un rato sin usarla. <strong>No cifra tus datos</strong>: siguen guardados tal cual en el navegador de este móvil, así que protege también el móvil con su propio bloqueo. Si eres administrador, el PIN sí cifra tu token de GitHub.</p>
    <div class="form-grid two">
      <label class="field"><span>${config.pinHash ? 'PIN nuevo' : 'PIN'} (6 a 8 cifras)</span><input type="password" id="cfg-pin" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password"></label>
      <label class="field"><span>Repite el PIN</span><input type="password" id="cfg-pin2" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password"></label>
      <label class="field"><span>Bloqueo automático (minutos)</span><input type="number" id="cfg-autolock" min="1" max="60" inputmode="numeric" value="${config.autoLockMinutes || 5}"></label>
    </div>
    ${config.pinHash ? `<div class="btn-row">
      <button type="button" class="btn" id="lock-now">Bloquear ahora</button>
      <button type="button" class="btn btn-danger" id="remove-pin">Quitar PIN</button>
    </div>
    <div class="device-unlock-settings" id="device-unlock-settings" hidden>
      <p class="set-help" id="device-unlock-status"></p>
      <button type="button" class="btn" id="device-unlock-setting"></button>
    </div>` : ''}`);
}

export function bindSecurity(root) {
  const pin1 = root.querySelector('#cfg-pin');
  const pin2 = root.querySelector('#cfg-pin2');
  // el PIN se guarda cuando los dos coinciden
  const tryPin = async () => {
    setFieldError(pin1, ''); setFieldError(pin2, '');
    const a = pin1.value.trim(), b = pin2.value.trim();
    if (!a && !b) return;
    if (a && !isValidNewPin(a)) { setFieldError(pin1, PIN_RULE); return; }
    if (!b) return;
    if (a !== b) { setFieldError(pin2, 'Los dos PIN no coinciden'); return; }
    try {
      await savePin(a);
      pin1.value = ''; pin2.value = '';
      Actions.showToast('PIN guardado: la app lo pedirá al abrirla');
    } catch (err) {
      setFieldError(pin1, err.message);
    }
  };
  pin1?.addEventListener('change', tryPin);
  pin2?.addEventListener('change', tryPin);

  autosave(root.querySelector('#cfg-autolock'), {
    validate: intRange(1, 60),
    save: async (v) => { await saveGlobalConfig({ autoLockMinutes: Number(v) }); }
  });
  root.querySelector('#remove-pin')?.addEventListener('click', removePin);
  root.querySelector('#lock-now')?.addEventListener('click', () => Actions.setLocked(true));
  bindDeviceUnlock(root);
}

function bindDeviceUnlock(root) {
  const section = root.querySelector('#device-unlock-settings');
  if (!section) return;
  const status = section.querySelector('#device-unlock-status');
  const button = section.querySelector('#device-unlock-setting');
  const refresh = async () => {
    const [saved, available] = await Promise.all([getDeviceUnlock(), canUseDeviceUnlock()]);
    if (!section.isConnected) return;
    section.hidden = !saved && !available;
    button.textContent = saved ? 'Quitar desbloqueo con el móvil' : 'Activar desbloqueo con el móvil';
    status.textContent = saved
      ? 'Desbloqueo con el móvil activado. Puedes seguir usando tu PIN.'
      : 'Entra con la huella, la cara o el código de tu móvil, según cómo lo tengas configurado. Para administrar se sigue usando el PIN de CalGuard.';
  };
  refresh().catch(() => {});
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const saved = await getDeviceUnlock();
      if (saved) {
        if (!await askVerifiedPin('Confirma tu PIN para quitar el desbloqueo con el móvil.')) return;
        await removeDeviceUnlock();
        await refresh();
        Actions.showToast('Desbloqueo con el móvil desactivado.');
        return;
      }
      const verified = await askVerifiedPin('Confirma tu PIN para activar el desbloqueo con el móvil.');
      if (verified && !getState().locked) showDeviceSetup(verified.hash, refresh);
    } catch {
      Actions.showToast('No se pudo cambiar el desbloqueo con el móvil.', { level: 'error' });
    } finally {
      button.disabled = false;
    }
  });
}

function showDeviceSetup(hash, refresh) {
  const controller = new AbortController();
  openSheet({
    title: 'Activar desbloqueo con el móvil',
    variant: 'dialog',
    body: '<p class="dialog-message">El móvil te pedirá que confirmes con su bloqueo. La próxima vez podrás elegir cómo entrar.</p>',
    footer: '<button type="button" class="btn" data-act="cancel">Cancelar</button><button type="button" class="btn btn-primary" data-act="activate">Activar</button>',
    onMount(root, close) {
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      const activate = root.querySelector('[data-act="activate"]');
      activate.addEventListener('click', async () => {
        activate.disabled = true;
        try {
          await enrollDeviceUnlock(hash, controller.signal);
          if (controller.signal.aborted) return;
          close();
          await refresh();
          Actions.showToast('Desbloqueo con el móvil activado.');
        } catch {
          if (!controller.signal.aborted) {
            Actions.showToast('No se activó el desbloqueo con el móvil. Puedes seguir usando tu PIN.', { level: 'error' });
          }
        } finally {
          activate.disabled = false;
        }
      });
    },
    onClose: () => controller.abort()
  });
}
