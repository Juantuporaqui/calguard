/**
 * @module ui/pin
 * Poner, cambiar y quitar el PIN, y abrir el modo administrador (que exige PIN
 * porque el token de GitHub se guarda cifrado con él).
 */

import { getState, Actions } from '../state/store.js';
import { get, put, applyBatch, STORES } from '../persistence/db.js';
import { DEVICE_UNLOCK_KEY } from '../persistence/migrations.js';
import { getDeviceUnlock } from '../persistence/deviceUnlock.js';
import { throttleDelaySeconds } from './lockScreen.js';
import { hashPIN, verifyPIN } from '../persistence/crypto.js';
import { isValidNewPin } from '../persistence/tokenVault.js';
import { rekeyVault, unlockVault, clearVault, hasAdminRecord, getVaultKey, lockVault } from '../persistence/vaultSession.js';
import { getPublishSettings } from '../domain/sharedCuadrante.js';
import { saveGlobalConfig } from './settings/common.js';
import { promptDialog, confirmDialog } from './sheet.js';

export const PIN_RULE = 'El PIN nuevo tiene que tener de 6 a 8 cifras';

/** Guarda un PIN nuevo (6–8 cifras) y vuelve a cifrar el token del administrador con él. */
export async function savePin(pin) {
  if (!isValidNewPin(pin)) throw new Error(PIN_RULE);
  if (getState().config.pinHash && await getDeviceUnlock()
      && !await askCurrentPin('Confirma el PIN actual para cambiarlo.')) {
    throw new Error('Para cambiar el PIN, escribe antes el actual');
  }
  // el token va cifrado con el PIN actual: sin poder leerlo, cambiar el PIN lo dejaría inservible
  if (getState().config.pinHash && !getVaultKey() && (await hasAdminRecord())
      && !(await ensureVaultKey('Tu token de administrador va cifrado con el PIN actual. Escríbelo para poder cambiarlo.'))) {
    throw new Error('Para cambiar el PIN, escribe antes el actual');
  }
  const record = await hashPIN(pin);
  if (getState().locked) throw new Error('Desbloquea CalGuard para cambiar el PIN.');
  await applyBatch({ [STORES.CONFIG]: {
    puts: [{ key: 'pinHash', value: record }], deletes: [DEVICE_UNLOCK_KEY]
  } });
  await saveGlobalConfig({ pinHash: record });
  await rekeyVault(pin);
}

/** Quita el PIN. Si este móvil tiene modo administrador, también el token (sin PIN no puede guardarse). */
export async function removePin() {
  const admin = await hasAdminRecord();
  const ok = await confirmDialog({
    title: 'Quitar PIN',
    message: admin
      ? 'La app se abrirá sin pedir PIN. Como el token de administrador se guarda cifrado con el PIN, también se quitará de este móvil: tendrás que pegarlo de nuevo.'
      : 'La app se abrirá sin pedir PIN.',
    confirmLabel: 'Quitar',
    danger: true
  });
  if (!ok) return false;
  if (await getDeviceUnlock() && !await askVerifiedPin()) return false;
  if (admin) await clearVault();
  await applyBatch({ [STORES.CONFIG]: {
    puts: [{ key: 'pinHash', value: null }], deletes: [DEVICE_UNLOCK_KEY]
  } });
  await saveGlobalConfig({ pinHash: null });
  Actions.showToast(admin ? 'PIN y token quitados' : 'PIN quitado');
  return true;
}

let checkingPin = false;

/** Confirma el PIN actual antes de dar acceso a un ajuste de seguridad. */
export async function askVerifiedPin(message) {
  if (checkingPin) return null;
  checkingPin = true;
  try {
    const pin = await promptDialog({ title: 'Escribe tu PIN', message, label: 'PIN', type: 'password', inputmode: 'numeric', confirmLabel: 'Seguir' });
    if (pin === null || getState().locked) return null;
    const [stored, attemptsRecord] = await Promise.all([get(STORES.CONFIG, 'pinHash'), get(STORES.CONFIG, 'pinAttempts')]);
    const hash = stored ? stored.value : getState().config.pinHash;
    const attempts = attemptsRecord?.value;
    const wait = throttleDelaySeconds(attempts);
    if (wait) {
      Actions.showToast('Demasiados intentos. Espera ' + wait + ' s.', { level: 'error' });
      return null;
    }
    if (!await verifyPIN(pin, hash)) {
      await put(STORES.CONFIG, { key: 'pinAttempts', value: { count: (attempts?.count || 0) + 1, lastFailAt: Date.now() } });
      Actions.showToast('PIN incorrecto', { level: 'error' });
      return null;
    }
    if (getState().locked) return null;
    await put(STORES.CONFIG, { key: 'pinAttempts', value: null });
    return { pin, hash };
  } finally {
    checkingPin = false;
  }
}

/** Pide el PIN actual y prepara la clave del token. */
async function askCurrentPin(reason) {
  const verified = await askVerifiedPin(reason);
  if (!verified) return false;
  await unlockVault(verified.pin, { force: true });
  if (getState().locked) {
    lockVault();
    return false;
  }
  return Boolean(getVaultKey());
}

/** Pide un PIN nuevo (dos veces) y lo guarda. */
async function askNewPin(reason) {
  const pin = await promptDialog({ title: 'Pon un PIN', message: `${reason} El PIN también bloqueará la app al abrirla.`, label: 'PIN nuevo (6 a 8 cifras)', type: 'password', inputmode: 'numeric', confirmLabel: 'Seguir' });
  if (pin === null) return false;
  if (!isValidNewPin(pin)) { Actions.showToast(PIN_RULE, { level: 'error' }); return false; }
  const again = await promptDialog({ title: 'Repite el PIN', label: 'Escríbelo otra vez', type: 'password', inputmode: 'numeric', confirmLabel: 'Guardar PIN' });
  if (again === null) return false;
  if (again !== pin) { Actions.showToast('Los dos PIN no coinciden', { level: 'error' }); return false; }
  await savePin(pin);
  Actions.showToast('PIN guardado: la app pedirá el PIN al abrirla');
  return true;
}

/**
 * Deja la clave del token lista para guardar o usar el token. Sin PIN, pide
 * ponerlo; con PIN pero sin clave en memoria, pide escribirlo.
 * @returns {Promise<boolean>} true si ya se puede guardar o leer el token
 */
export async function ensureVaultKey(reason = 'El token de administrador se guarda cifrado con tu PIN.') {
  if (getVaultKey()) return true;
  if (!getState().config.pinHash) return askNewPin(reason);
  return askCurrentPin(reason);
}

/**
 * Antes de publicar o subir a la Biblioteca: que el token se pueda leer. Un
 * administrador de una versión anterior sin PIN tiene que ponerlo ahora (una vez).
 * @returns {Promise<boolean>}
 */
export async function ensureAdminToken() {
  let cfg = await getPublishSettings();
  if (cfg?.token) return true;
  if (!cfg) return false;
  if (!(await ensureVaultKey('Para publicar, el token de administrador tiene que ir cifrado con un PIN.'))) return false;
  cfg = await getPublishSettings();
  return Boolean(cfg?.token);
}
