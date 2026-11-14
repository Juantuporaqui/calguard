import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  useConfigStoreForTests, unlockVault, lockVault, getVaultKey, rekeyVault, clearVault, hasAdminRecord
} from '../js/persistence/vaultSession.js';
import { openPublish, sealPublish } from '../js/persistence/tokenVault.js';

// La migración real del token, con un almacén en memoria en vez de IndexedDB.
const TOKEN = 'github_pat_11ABCDEFG0123456789_secretoSecretoSecreto';
const PUB = { owner: 'grupo', repo: 'calguard', branch: 'main', lastPublishedAt: '2026-11-12T09:00:00Z' };

function memoryStore(initial = {}, { failPutOf = null } = {}) {
  const rows = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  return {
    rows,
    get: async (key) => (rows.has(key) ? { key, value: structuredClone(rows.get(key)) } : undefined),
    put: async ({ key, value }) => {
      if (key === failPutOf) throw new Error('disco lleno');
      rows.set(key, structuredClone(value));
    },
    remove: async (key) => { rows.delete(key); }
  };
}
const raw = (store) => JSON.stringify([...store.rows.values()]);

test('primer desbloqueo tras actualizar: el token en claro pasa a cifrado y se sigue pudiendo publicar', async () => {
  const store = memoryStore({ ghPublish: { ...PUB, token: TOKEN } });
  useConfigStoreForTests(store);
  await unlockVault('1234'); // PIN antiguo de 4 cifras: sigue valiendo
  const saved = store.rows.get('ghPublish');
  assert.equal(saved.token, undefined, 'ya no está en claro');
  assert.ok(saved.tokenEnc?.data);
  assert.ok(!raw(store).includes(TOKEN), 'en ningún sitio del almacén');
  assert.equal(saved.lastPublishedAt, PUB.lastPublishedAt);
  assert.equal((await openPublish(saved, getVaultKey())).token, TOKEN, 'con la app desbloqueada se lee');
  lockVault();
  assert.equal(getVaultKey(), null);
  const locked = await openPublish(saved, getVaultKey());
  assert.equal(locked.locked, true);
  await unlockVault('1234');
  assert.equal((await openPublish(store.rows.get('ghPublish'), getVaultKey())).token, TOKEN, 'tras volver a desbloquear');
});

test('si la migración falla, el token antiguo no se pierde y se puede usar igual', async () => {
  const store = memoryStore({ ghPublish: { ...PUB, token: TOKEN } }, { failPutOf: 'ghPublish' });
  useConfigStoreForTests(store);
  await unlockVault('123456'); // no lanza
  assert.equal(store.rows.get('ghPublish').token, TOKEN, 'sigue ahí para reintentarlo');
  assert.equal((await openPublish(store.rows.get('ghPublish'), getVaultKey())).token, TOKEN);
});

test('sin modo administrador no se deriva ninguna clave (no hace falta)', async () => {
  const store = memoryStore({});
  useConfigStoreForTests(store);
  assert.equal(await hasAdminRecord(), false);
  await unlockVault('123456');
  assert.equal(getVaultKey(), null);
  assert.equal(store.rows.has('secretSalt'), false);
  await unlockVault('123456', { force: true });
  assert.ok(getVaultKey(), 'al guardar un token nuevo sí');
});

test('cambiar el PIN vuelve a cifrar el token con el nuevo; el viejo ya no lo abre', async () => {
  const store = memoryStore({ ghPublish: { ...PUB, token: TOKEN } });
  useConfigStoreForTests(store);
  await unlockVault('111111');
  const saltBefore = store.rows.get('secretSalt');
  await rekeyVault('222222');
  assert.notEqual(store.rows.get('secretSalt'), saltBefore, 'sal nueva');
  assert.ok(!raw(store).includes(TOKEN));
  assert.equal((await openPublish(store.rows.get('ghPublish'), getVaultKey())).token, TOKEN);
  lockVault();
  await unlockVault('111111');
  assert.equal((await openPublish(store.rows.get('ghPublish'), getVaultKey())).locked, true, 'con el PIN viejo, bloqueado');
  await unlockVault('222222');
  assert.equal((await openPublish(store.rows.get('ghPublish'), getVaultKey())).token, TOKEN);
});

test('cambiar el PIN sin poder leer el token no lo estropea', async () => {
  const store = memoryStore({ ghPublish: { ...PUB, token: TOKEN } });
  useConfigStoreForTests(store);
  await unlockVault('111111');
  const before = structuredClone(store.rows.get('ghPublish'));
  lockVault(); // sin clave en memoria
  await rekeyVault('333333');
  assert.deepEqual(store.rows.get('ghPublish'), before, 'el token cifrado se deja como estaba');
});

test('administrador antiguo sin PIN: al poner PIN se cifra su token', async () => {
  const store = memoryStore({ ghPublish: { ...PUB, token: TOKEN } });
  useConfigStoreForTests(store);
  await rekeyVault('444444'); // savePin → rekeyVault
  assert.ok(!raw(store).includes(TOKEN));
  assert.equal((await openPublish(store.rows.get('ghPublish'), getVaultKey())).token, TOKEN);
});

test('guardar otro ajuste con la app bloqueada conserva el token cifrado', async () => {
  const store = memoryStore({ ghPublish: { ...PUB, token: TOKEN } });
  useConfigStoreForTests(store);
  await unlockVault('555555');
  const stored = store.rows.get('ghPublish');
  lockVault();
  const next = await sealPublish({ ...PUB, repo: 'otro' }, getVaultKey(), stored);
  assert.deepEqual(next.tokenEnc, stored.tokenEnc);
  assert.equal(next.repo, 'otro');
});

test('quitar el PIN quita también el token y su sal', async () => {
  const store = memoryStore({ ghPublish: { ...PUB, token: TOKEN } });
  useConfigStoreForTests(store);
  await unlockVault('666666');
  await clearVault();
  assert.equal(store.rows.has('ghPublish'), false);
  assert.equal(store.rows.has('secretSalt'), false);
  assert.equal(getVaultKey(), null);
});
