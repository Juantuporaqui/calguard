/**
 * WebAuthn para el bloqueo de pantalla. La clave privada y la biometría
 * quedan en el autenticador. La comprobación de la firma se hace aquí.
 */

import { base64ToBytes, bytesToBase64 } from './crypto.js';
import { get, put, remove, STORES } from './db.js';
import { DEVICE_UNLOCK_KEY, readDeviceUnlock } from './migrations.js';

const ES256 = -7;
const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const verified = 0x05; // UP (presencia) + UV (verificación de la persona)
const browserContext = () => ({ origin: location.origin, rpId: location.hostname });
const toBase64Url = bytes => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const digest = bytes => crypto.subtle.digest('SHA-256', bytes);
const importKey = bytes => crypto.subtle.importKey('spki', bytes, KEY_ALGORITHM, false, ['verify']);

export async function canUseDeviceUnlock() {
  try {
    return Boolean(globalThis.isSecureContext
      && typeof navigator.credentials?.get === 'function'
      && typeof navigator.credentials?.create === 'function'
      && typeof globalThis.AuthenticatorAttestationResponse?.prototype.getPublicKey === 'function'
      && typeof globalThis.AuthenticatorAttestationResponse?.prototype.getAuthenticatorData === 'function'
      && await globalThis.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function getDeviceUnlock() {
  return readDeviceUnlock((await get(STORES.CONFIG, DEVICE_UNLOCK_KEY))?.value);
}

export function removeDeviceUnlock() {
  return remove(STORES.CONFIG, DEVICE_UNLOCK_KEY);
}

function matchesClient(data, type, challenge, origin) {
  const client = JSON.parse(decoder.decode(data));
  return client.type === type && client.challenge === toBase64Url(challenge)
    && client.origin === origin && !client.crossOrigin
    && (!client.topOrigin || client.topOrigin === origin);
}

async function matchesAuthenticator(data, rpId) {
  const bytes = new Uint8Array(data);
  if (bytes.length < 37 || (bytes[32] & verified) !== verified) return false;
  const expected = new Uint8Array(await digest(encoder.encode(rpId)));
  return expected.every((byte, index) => byte === bytes[index]);
}

/** WebAuthn entrega ES256 en DER. Web Crypto pide r y s de 32 bytes cada uno. */
function readSignature(signature) {
  const bytes = new Uint8Array(signature);
  if (bytes.length < 8 || bytes.length > 72 || bytes[0] !== 0x30 || bytes[1] !== bytes.length - 2) return null;
  const result = new Uint8Array(64);
  let pos = 2;
  for (const end of [32, 64]) {
    if (bytes[pos++] !== 0x02) return null;
    const length = bytes[pos++];
    const first = bytes[pos];
    const next = pos + length;
    if (!length || length > 33 || next > bytes.length || first >= 128) return null;
    if (first === 0 && length > 1 && bytes[pos + 1] < 128) return null;
    const start = first === 0 && length > 1 ? pos + 1 : pos;
    if (next - start > 32) return null;
    result.set(bytes.subarray(start, next), end - (next - start));
    pos = next;
  }
  return pos === bytes.length ? result : null;
}

/** Verifica una respuesta antes de desbloquear, sin confiar solo en el aviso del sistema. */
export async function verifyDeviceAssertion(credential, saved, challenge, { origin, rpId }) {
  try {
    if (credential?.type !== 'public-key' || bytesToBase64(new Uint8Array(credential.rawId)) !== saved.id) return false;
    const { authenticatorData, clientDataJSON, signature } = credential.response;
    if (!matchesClient(clientDataJSON, 'webauthn.get', challenge, origin)
        || !await matchesAuthenticator(authenticatorData, rpId)) return false;
    const rawSignature = readSignature(signature);
    if (!rawSignature) return false;
    const auth = new Uint8Array(authenticatorData);
    const signed = new Uint8Array(auth.length + 32);
    signed.set(auth);
    signed.set(new Uint8Array(await digest(clientDataJSON)), auth.length);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' },
      await importKey(base64ToBytes(saved.publicKey)), rawSignature, signed);
  } catch {
    return false;
  }
}

export async function enrollDeviceUnlock(expectedPin, signal) {
  const { origin, rpId } = browserContext();
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({ signal, publicKey: {
    challenge,
    rp: { id: rpId, name: 'CalGuard' },
    user: { id: crypto.getRandomValues(new Uint8Array(32)), name: 'CalGuard', displayName: 'CalGuard' },
    pubKeyCredParams: [{ type: 'public-key', alg: ES256 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    attestation: 'none',
    timeout: 60000
  } });
  const response = credential?.response;
  const publicKey = response?.getPublicKey?.();
  if (credential?.type !== 'public-key' || !credential.rawId?.byteLength || !publicKey
      || response.getPublicKeyAlgorithm() !== ES256
      || !matchesClient(response.clientDataJSON, 'webauthn.create', challenge, origin)
      || !await matchesAuthenticator(response.getAuthenticatorData(), rpId)) {
    throw new Error('El móvil no pudo preparar el desbloqueo.');
  }
  await importKey(publicKey);
  const pin = (await get(STORES.CONFIG, 'pinHash'))?.value;
  if (!pin || JSON.stringify(pin) !== JSON.stringify(expectedPin)) {
    throw new Error('El PIN ha cambiado. Activa de nuevo el desbloqueo.');
  }
  const binding = await digest(encoder.encode(JSON.stringify(pin)));
  signal?.throwIfAborted();
  await put(STORES.CONFIG, { key: DEVICE_UNLOCK_KEY, value: {
    v: 1,
    id: bytesToBase64(new Uint8Array(credential.rawId)),
    publicKey: bytesToBase64(new Uint8Array(publicKey)),
    pinBinding: bytesToBase64(new Uint8Array(binding))
  } });
}

export async function unlockWithDevice(saved) {
  const context = browserContext();
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.get({ publicKey: {
    challenge,
    rpId: context.rpId,
    allowCredentials: [{ type: 'public-key', id: base64ToBytes(saved.id), transports: ['internal'] }],
    userVerification: 'required',
    timeout: 60000
  } });
  if (!await verifyDeviceAssertion(credential, saved, challenge, context)) return false;
  const [current, pin] = await Promise.all([getDeviceUnlock(), get(STORES.CONFIG, 'pinHash')]);
  if (!pin?.value || current?.id !== saved.id || current.publicKey !== saved.publicKey) return false;
  const binding = await digest(encoder.encode(JSON.stringify(pin.value)));
  return current.pinBinding === bytesToBase64(new Uint8Array(binding));
}
