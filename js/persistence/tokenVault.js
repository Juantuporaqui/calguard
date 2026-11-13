/**
 * @module persistence/tokenVault
 * Cifrado del token de GitHub del administrador (clave ghPublish).
 *
 * El token se guarda cifrado con AES-GCM. La clave se deriva del PIN con
 * PBKDF2 (600.000 iteraciones, SHA-256) y una sal aleatoria del dispositivo;
 * la clave no se puede exportar y solo vive en memoria mientras la app está
 * desbloqueada. Sin PIN no hay modo administrador.
 *
 * Funciones puras (sin IndexedDB): se prueban en tests/tokenVault.test.js.
 */

import { bytesToBase64, base64ToBytes } from './crypto.js';

const ITERATIONS = 600000;
const IV_LENGTH = 12;
const FORMAT = 1;

/** Sal nueva para derivar la clave (base64 de 16 bytes). */
export function newVaultSalt() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/** PIN nuevo: de 6 a 8 cifras. Los PIN de 4 o 5 que ya existían siguen valiendo para desbloquear. */
export function isValidNewPin(pin) {
  return /^\d{6,8}$/.test(String(pin ?? ''));
}

/**
 * Clave AES-GCM (no exportable) derivada del PIN.
 * @param {string} pin
 * @param {string} saltB64
 * @param {number} [iterations]
 * @returns {Promise<CryptoKey>}
 */
export async function deriveVaultKey(pin, saltB64, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra un texto con la clave.
 * @returns {Promise<{v: number, data: string}>} data = base64(iv + texto cifrado)
 */
export async function sealSecret(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(text))));
  const buf = new Uint8Array(iv.length + ct.length);
  buf.set(iv, 0);
  buf.set(ct, iv.length);
  return { v: FORMAT, data: bytesToBase64(buf) };
}

/** Descifra lo de sealSecret. Lanza un error si la clave no es la buena. */
export async function openSecret(sealed, key) {
  if (!sealed?.data) throw new Error('No hay nada cifrado');
  const buf = base64ToBytes(sealed.data);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, IV_LENGTH) }, key, buf.slice(IV_LENGTH));
  return new TextDecoder().decode(plain);
}

/**
 * Lo que se guarda en IndexedDB: los ajustes de publicar sin el token en claro.
 * Si `value` trae token, se cifra; si no, se conserva el token cifrado de antes.
 * @param {Object} value - {token?, owner, repo, branch, lastPublishedAt…}
 * @param {CryptoKey|null} key
 * @param {Object|null} [prevStored] - lo guardado antes
 */
export async function sealPublish(value, key, prevStored = null) {
  const { token, tokenEnc: _drop, needsPin: _n, locked: _l, legacy: _g, ...rest } = value || {};
  let tokenEnc = prevStored?.tokenEnc || null;
  if (token) {
    if (!key) {
      const err = new Error('Para guardar el token hace falta un PIN');
      err.code = 'NEEDS_PIN';
      throw err;
    }
    tokenEnc = await sealSecret(token, key);
  }
  if (tokenEnc) return { ...rest, tokenEnc };
  // un token antiguo en claro (sin migrar aún) no se pierde al guardar otro ajuste
  if (prevStored?.token) return { ...rest, token: prevStored.token };
  return rest;
}

/**
 * Lo guardado, listo para usar: con el token descifrado si se puede.
 *  - locked: hay token cifrado pero la app no tiene la clave (bloqueada o PIN distinto);
 *  - needsPin: hay un token antiguo en claro y aún no hay clave para cifrarlo.
 * @param {Object|null} stored
 * @param {CryptoKey|null} key
 */
export async function openPublish(stored, key) {
  if (!stored) return null;
  const { tokenEnc, token: legacyToken, ...rest } = stored;
  if (tokenEnc) {
    if (!key) return { ...rest, locked: true };
    try {
      return { ...rest, token: await openSecret(tokenEnc, key) };
    } catch {
      return { ...rest, locked: true };
    }
  }
  if (legacyToken) {
    // token de una versión anterior, en claro: solo se usa con la app desbloqueada con PIN
    // (si su cifrado falló, no se pierde; se reintenta en el próximo desbloqueo)
    return key ? { ...rest, token: legacyToken, legacy: true } : { ...rest, needsPin: true };
  }
  return rest;
}

/**
 * Migra un token antiguo en claro a cifrado. Comprueba que se descifra bien
 * antes de dar el resultado; si algo falla devuelve null y lo guardado no se toca.
 * @returns {Promise<Object|null>} el registro nuevo, o null si no hay nada que migrar o si falló
 */
export async function migrateLegacyToken(stored, key) {
  if (!stored?.token || !key) return null;
  try {
    const sealed = await sealPublish(stored, key, null);
    if (await openSecret(sealed.tokenEnc, key) !== stored.token) return null;
    return sealed;
  } catch {
    return null;
  }
}
