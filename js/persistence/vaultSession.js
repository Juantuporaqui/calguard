/**
 * @module persistence/vaultSession
 * La clave que descifra el token del administrador, solo en memoria y solo
 * mientras la app está desbloqueada. Se deriva del PIN al desbloquear (si este
 * móvil tiene modo administrador) y se olvida al bloquear.
 *
 * Al primer desbloqueo tras actualizar, el token antiguo en claro se cifra;
 * si algo falla, se deja como estaba y se reintenta en el siguiente.
 */

import * as db from './db.js';
import { deriveVaultKey, newVaultSalt, openPublish, sealPublish } from './tokenVault.js';
import { migrateGhPublish } from './migrations.js';

const KEY_SALT = 'secretSalt';   // sal del dispositivo para la clave (excluida de las copias)
const KEY_PUBLISH = 'ghPublish'; // ajustes de publicar del administrador

let sessionKey = null;

/** Dónde se guarda: el almacén de configuración de IndexedDB. */
let config = {
  get: (key) => db.get(db.STORES.CONFIG, key),
  put: (record) => db.put(db.STORES.CONFIG, record),
  remove: (key) => db.remove(db.STORES.CONFIG, key)
};

/** Solo para las pruebas: un almacén en memoria con get/put/remove. */
export function useConfigStoreForTests(store) {
  config = store;
  sessionKey = null;
}

/** Clave de la sesión, o null si no hay (app bloqueada, sin PIN o no administrador). */
export function getVaultKey() {
  return sessionKey;
}

/** Al bloquear: se olvida la clave. */
export function lockVault() {
  sessionKey = null;
}

async function salt({ fresh = false } = {}) {
  const saved = (await config.get(KEY_SALT))?.value;
  if (saved && !fresh) return saved;
  const s = newVaultSalt();
  await config.put({ key: KEY_SALT, value: s });
  return s;
}

/** ¿Hay modo administrador guardado en este móvil (token cifrado o antiguo en claro)? */
export async function hasAdminRecord() {
  const raw = (await config.get(KEY_PUBLISH))?.value;
  return Boolean(raw?.tokenEnc || raw?.token);
}

/**
 * Tras un PIN correcto: deriva la clave (solo si hace falta) y migra el token
 * antiguo en claro. Nunca lanza: un fallo deja todo como estaba.
 * @param {string} pin
 * @param {{force?: boolean}} [opts] - force: derivarla aunque aún no haya token (al guardar uno nuevo)
 */
export async function unlockVault(pin, { force = false } = {}) {
  try {
    if (!force && !(await hasAdminRecord())) return;
    sessionKey = await deriveVaultKey(pin, await salt());
    await migrateStoredToken();
  } catch (err) {
    console.warn('No se pudo preparar la clave del token:', err);
  }
}

/** Cifra el token antiguo en claro, si lo hay y hay clave. Devuelve true si lo migró. */
export async function migrateStoredToken() {
  const raw = (await config.get(KEY_PUBLISH))?.value;
  const migrated = await migrateGhPublish(raw, sessionKey);
  if (!migrated) return false;
  await config.put({ key: KEY_PUBLISH, value: migrated });
  return true;
}

/**
 * PIN nuevo: sal y clave nuevas, y el token (si lo hay) se vuelve a cifrar con
 * ellas. Hay que llamarla con la app desbloqueada (para poder leer el token).
 * @param {string} newPin
 */
export async function rekeyVault(newPin) {
  const raw = (await config.get(KEY_PUBLISH))?.value || null;
  const current = raw ? await openPublish(raw, sessionKey) : null;
  if (!current?.token && raw && (raw.tokenEnc || raw.token) && !current?.needsPin) {
    // hay token cifrado pero no se puede leer: no se toca para no perderlo
    console.warn('El token está cifrado con otro PIN y no se puede volver a cifrar');
    return;
  }
  const key = await deriveVaultKey(newPin, await salt({ fresh: true }));
  sessionKey = key;
  if (current?.token) {
    await config.put({ key: KEY_PUBLISH, value: await sealPublish(current, key, null) });
  } else if (raw?.token) {
    await migrateStoredToken();
  }
}

/** Sin PIN no hay modo administrador: se quitan el token y la clave. */
export async function clearVault() {
  sessionKey = null;
  await config.remove(KEY_PUBLISH);
  await config.remove(KEY_SALT);
}
