/**
 * @module ui/settings/security
 * «Seguridad»: PIN de bloqueo y bloqueo automático.
 * El PIN bloquea la pantalla, pero no cifra los datos (sí cifra el token del administrador).
 */

import { Actions } from '../../state/store.js';
import { isValidNewPin } from '../../persistence/tokenVault.js';
import { savePin, removePin, PIN_RULE } from '../pin.js';
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
}
