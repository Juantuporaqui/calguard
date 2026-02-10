/**
 * @module persistence/crypto
 * WebCrypto-based encryption for Secure Mode
 * Uses PBKDF2 for key derivation + AES-GCM for encryption
 */

const PBKDF2_ITERATIONS = 600000; // Strong per OWASP 2024
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * Derive an AES-GCM key from a passphrase
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string with AES-GCM
 * @param {string} plaintext
 * @param {string} passphrase
 * @returns {Promise<string>} base64-encoded salt+iv+ciphertext
 */
export async function encrypt(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  // Concat: salt(16) + iv(12) + ciphertext
  const buf = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  buf.set(salt, 0);
  buf.set(iv, salt.length);
  buf.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...buf));
}

/**
 * Decrypt a base64-encoded encrypted string
 * @param {string} encoded
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
export async function decrypt(encoded, passphrase) {
  const buf = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const salt = buf.slice(0, SALT_LENGTH);
  const iv = buf.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = buf.slice(SALT_LENGTH + IV_LENGTH);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Hash a PIN for comparison (not reversible)
 * @param {string} pin
 * @returns {Promise<string>}
 */
export async function hashPIN(pin) {
  const enc = new TextEncoder();
  const salt = 'calguard-pin-salt-v2'; // Fixed salt for PIN - deterministic
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against a stored hash
 * @param {string} pin
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPIN(pin, storedHash) {
  const hash = await hashPIN(pin);
  return hash === storedHash;
}
