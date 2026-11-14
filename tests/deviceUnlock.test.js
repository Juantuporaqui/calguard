import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, generateKeyPairSync, sign, createHash } from 'node:crypto';
import { backupableConfig } from '../js/persistence/backup.js';
import { canUseDeviceUnlock, verifyDeviceAssertion } from '../js/persistence/deviceUnlock.js';
import { DEVICE_UNLOCK_KEY, readDeviceUnlock } from '../js/persistence/migrations.js';

const context = { origin: 'https://calguard.example', rpId: 'calguard.example' };
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const challenge = randomBytes(32);
const id = randomBytes(24);
const saved = {
  v: 1,
  id: id.toString('base64'),
  publicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  pinBinding: randomBytes(32).toString('base64')
};

function signedAssertion({ flags = 0x05, rpId = context.rpId, rawId = id, client = {} } = {}) {
  const clientDataJSON = Buffer.from(JSON.stringify({
    type: 'webauthn.get', origin: context.origin, challenge: challenge.toString('base64url'),
    crossOrigin: false, ...client
  }));
  const authenticatorData = Buffer.concat([
    createHash('sha256').update(rpId).digest(), Buffer.of(flags), Buffer.alloc(4)
  ]);
  const data = Buffer.concat([authenticatorData, createHash('sha256').update(clientDataJSON).digest()]);
  return { type: 'public-key', rawId, response: {
    authenticatorData, clientDataJSON, signature: sign('sha256', data, keys.privateKey)
  } };
}

const verify = (assertion, nonce = challenge) => verifyDeviceAssertion(assertion, saved, nonce, context);

test('valida localmente la firma ES256 con presencia y verificación de la persona', async () => {
  assert.equal(await verify(signedAssertion()), true);
});

test('rechaza respuestas repetidas y respuestas de otra credencial u origen', async () => {
  assert.equal(await verify(signedAssertion(), randomBytes(32)), false);
  assert.equal(await verify(signedAssertion({ rawId: randomBytes(24) })), false);
  assert.equal(await verify(signedAssertion({ rpId: 'otro.example' })), false);
  assert.equal(await verify(signedAssertion({ client: { origin: 'https://otro.example' } })), false);
  assert.equal(await verify(signedAssertion({ client: { crossOrigin: true } })), false);
  assert.equal(await verify(signedAssertion({ client: { type: 'webauthn.create' } })), false);
});

test('exige la verificación de la persona y rechaza firmas dañadas o ausentes', async () => {
  for (const flags of [0, 0x01, 0x04]) {
    assert.equal(await verify(signedAssertion({ flags })), false);
  }
  const answer = signedAssertion();
  answer.response.signature[answer.response.signature.length - 1] ^= 1;
  assert.equal(await verify(answer), false);
  answer.response.signature = Buffer.of(0x30, 0x81, 0x01);
  assert.equal(await verify(answer), false);
  assert.equal(await verify(null), false);
});

test('la asociación es opcional y no viaja en las copias', async () => {
  assert.equal(await canUseDeviceUnlock(), false);
  assert.equal(readDeviceUnlock(undefined), null);
  assert.equal(readDeviceUnlock({ ...saved, v: 9 }), null);
  assert.equal(readDeviceUnlock(saved), saved);
  assert.deepEqual(backupableConfig([{ key: DEVICE_UNLOCK_KEY, value: saved },
    { key: 'appConfig', value: { [DEVICE_UNLOCK_KEY]: saved, autoLockMinutes: 5 } }
  ]), [{ key: 'appConfig', value: { autoLockMinutes: 5 } }]);
});
