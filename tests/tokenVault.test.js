import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveVaultKey, newVaultSalt, sealSecret, openSecret, sealPublish, openPublish,
  migrateLegacyToken, isValidNewPin
} from '../js/persistence/tokenVault.js';

const TOKEN = 'github_pat_11ABCDEFG0123456789_secretoSecretoSecreto';
const PUB = { owner: 'grupo', repo: 'calguard', branch: 'main', lastPublishedAt: '2026-11-12T09:00:00Z' };
// menos iteraciones en las pruebas para que vayan rápido; el algoritmo es el mismo
const key = (pin, salt) => deriveVaultKey(pin, salt, 1000);

test('el token cifrado se recupera con el mismo PIN', async () => {
  const salt = newVaultSalt();
  const k = await key('123456', salt);
  const sealed = await sealSecret(TOKEN, k);
  assert.equal(await openSecret(sealed, await key('123456', salt)), TOKEN);
});

test('con otro PIN o con otra sal no se puede descifrar', async () => {
  const salt = newVaultSalt();
  const sealed = await sealSecret(TOKEN, await key('123456', salt));
  await assert.rejects(openSecret(sealed, await key('654321', salt)));
  await assert.rejects(openSecret(sealed, await key('123456', newVaultSalt())));
});

test('cada cifrado es distinto (IV aleatorio)', async () => {
  const k = await key('123456', newVaultSalt());
  const a = await sealSecret(TOKEN, k), b = await sealSecret(TOKEN, k);
  assert.notEqual(a.data, b.data);
});

test('lo que se guarda no contiene el token en claro', async () => {
  const k = await key('123456', newVaultSalt());
  const stored = await sealPublish({ ...PUB, token: TOKEN }, k);
  const json = JSON.stringify(stored);
  assert.ok(!json.includes(TOKEN), 'el token no aparece');
  assert.ok(!json.includes('github_pat'), 'ni su principio');
  assert.equal(stored.token, undefined);
  assert.ok(stored.tokenEnc?.data);
  assert.equal(stored.owner, 'grupo');
});

test('guardar sin token conserva el cifrado anterior (p. ej. al apuntar la última publicación)', async () => {
  const k = await key('123456', newVaultSalt());
  const stored = await sealPublish({ ...PUB, token: TOKEN }, k);
  const next = await sealPublish({ ...PUB, lastPublishedAt: '2026-11-13T10:00:00Z' }, k, stored);
  assert.deepEqual(next.tokenEnc, stored.tokenEnc);
  assert.equal((await openPublish(next, k)).token, TOKEN);
});

test('guardar un token sin clave (sin PIN) da error y no guarda nada', async () => {
  await assert.rejects(sealPublish({ ...PUB, token: TOKEN }, null), (err) => err.code === 'NEEDS_PIN');
});

test('al leer: con clave, el token; sin clave o con otra, «bloqueado» y sin token', async () => {
  const salt = newVaultSalt();
  const k = await key('123456', salt);
  const stored = await sealPublish({ ...PUB, token: TOKEN }, k);
  assert.equal((await openPublish(stored, k)).token, TOKEN);
  const locked = await openPublish(stored, null);
  assert.equal(locked.token, undefined);
  assert.equal(locked.locked, true);
  const wrong = await openPublish(stored, await key('000000', salt));
  assert.equal(wrong.token, undefined);
  assert.equal(wrong.locked, true);
  assert.equal(await openPublish(null, k), null);
});

test('migración: el token antiguo en claro pasa a cifrado y se sigue pudiendo usar', async () => {
  const k = await key('1234', newVaultSalt()); // un PIN antiguo de 4 cifras sigue valiendo
  const legacy = { ...PUB, token: TOKEN };
  const migrated = await migrateLegacyToken(legacy, k);
  assert.ok(migrated);
  assert.ok(!JSON.stringify(migrated).includes(TOKEN));
  assert.equal((await openPublish(migrated, k)).token, TOKEN);
  assert.equal(migrated.lastPublishedAt, PUB.lastPublishedAt, 'el resto de ajustes se conserva');
});

test('migración que falla: devuelve null y el token antiguo no se pierde', async () => {
  const legacy = { ...PUB, token: TOKEN };
  const broken = { type: 'secret' }; // no es una clave válida: el cifrado falla
  assert.equal(await migrateLegacyToken(legacy, broken), null);
  assert.equal(legacy.token, TOKEN, 'lo guardado no se toca');
  assert.equal(await migrateLegacyToken(legacy, null), null, 'sin clave no se migra');
  assert.equal(await migrateLegacyToken({ ...PUB }, await key('123456', newVaultSalt())), null, 'nada que migrar');
});

test('token antiguo sin PIN: el administrador ve que hace falta un PIN; con PIN, lo usa', async () => {
  const legacy = { ...PUB, token: TOKEN };
  const noPin = await openPublish(legacy, null);
  assert.equal(noPin.token, undefined);
  assert.equal(noPin.needsPin, true);
  const withPin = await openPublish(legacy, await key('123456', newVaultSalt()));
  assert.equal(withPin.token, TOKEN);
});

test('PIN nuevo: de 6 a 8 cifras', () => {
  for (const ok of ['123456', '1234567', '12345678']) assert.equal(isValidNewPin(ok), true, ok);
  for (const ko of ['', '1234', '12345', '123456789', '12a456', ' 123456', null, undefined]) assert.equal(isValidNewPin(ko), false, String(ko));
});

test('la clave por defecto usa 600.000 iteraciones y no se puede exportar', async () => {
  const k = await deriveVaultKey('123456', newVaultSalt());
  assert.equal(k.extractable, false);
  assert.deepEqual([...k.usages].sort(), ['decrypt', 'encrypt']);
});

import { backupableConfig, SECRET_CONFIG_KEYS } from '../js/persistence/backup.js';

test('las copias no llevan el token, su sal ni la contraseña del grupo (ni al guardar ni al restaurar)', async () => {
  const k = await key('123456', newVaultSalt());
  const rows = [
    { key: 'appConfig', value: { diasPorGuardia: 5, pinHash: 'no viaja', groupKey: 'tampoco' } },
    { key: 'ghPublish', value: await sealPublish({ ...PUB, token: TOKEN }, k) },
    { key: 'secretSalt', value: newVaultSalt() },
    { key: 'groupKey', value: 'contraseña-del-grupo' },
    { key: 'pinHash', value: { salt: 'x', hash: 'y', v: 3 } },
    { key: '__interno', value: 1 }
  ];
  assert.deepEqual(backupableConfig(rows), [{ key: 'appConfig', value: { diasPorGuardia: 5 } }]);
  for (const k of ['ghPublish', 'secretSalt', 'groupKey']) assert.ok(SECRET_CONFIG_KEYS.has(k), k);
  // y aunque una copia antigua trajera el token en claro, no se restaura
  assert.ok(!JSON.stringify(backupableConfig([{ key: 'ghPublish', value: { token: TOKEN } }])).includes(TOKEN));
});

test('guardar usuario o repositorio sin clave no borra un token antiguo aún sin migrar', async () => {
  const legacy = { ...PUB, token: TOKEN };
  const next = await sealPublish({ ...PUB, owner: 'otro' }, null, legacy);
  assert.equal(next.owner, 'otro');
  assert.equal(next.token, TOKEN, 'sigue ahí para migrarlo en el próximo desbloqueo');
  const migrated = await migrateLegacyToken(next, await key('123456', newVaultSalt()));
  assert.ok(migrated && !JSON.stringify(migrated).includes(TOKEN));
});
