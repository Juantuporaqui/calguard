import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, hashPIN, verifyPIN } from '../js/persistence/crypto.js';

// PBKDF2 con 600k iteraciones es lento a propósito; estos tests tardan unos segundos.

test('encrypt → decrypt roundtrip', async () => {
  const plaintext = 'CalGuard backup con ñ, tildes y "comillas"';
  const encoded = await encrypt(plaintext, 'contraseña-fuerte');
  assert.notEqual(encoded, plaintext);
  const decrypted = await decrypt(encoded, 'contraseña-fuerte');
  assert.equal(decrypted, plaintext);
});

test('decrypt con contraseña incorrecta falla', async () => {
  const encoded = await encrypt('secreto', 'buena');
  await assert.rejects(() => decrypt(encoded, 'mala'));
});

test('hashPIN genera formato v3 con salt aleatorio', async () => {
  const a = await hashPIN('1234');
  const b = await hashPIN('1234');
  assert.equal(a.v, 3);
  assert.ok(a.salt && a.hash);
  assert.notEqual(a.salt, b.salt); // salt aleatorio por registro
  assert.notEqual(a.hash, b.hash);
});

test('verifyPIN acepta el PIN correcto y rechaza el incorrecto (v3)', async () => {
  const record = await hashPIN('4321');
  assert.equal(await verifyPIN('4321', record), true);
  assert.equal(await verifyPIN('0000', record), false);
});

test('verifyPIN sigue aceptando el formato legado v2 (hash hex con salt fijo)', async () => {
  // Hash v2 generado con el algoritmo antiguo: PBKDF2(pin, 'calguard-pin-salt-v2')
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode('1234'), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('calguard-pin-salt-v2'), iterations: 600000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const legacyHash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');

  assert.equal(await verifyPIN('1234', legacyHash), true);
  assert.equal(await verifyPIN('9999', legacyHash), false);
});

test('verifyPIN con stored vacío devuelve false', async () => {
  assert.equal(await verifyPIN('1234', null), false);
  assert.equal(await verifyPIN('1234', undefined), false);
});
