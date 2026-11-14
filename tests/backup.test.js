import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareBackup, restoreBackup } from '../js/persistence/backup.js';
import { encrypt } from '../js/persistence/crypto.js';

const sample = () => ({
  version: 3,
  profiles: [{ id: 'ana', name: 'Ana' }],
  days: [{ profileId: 'ana', dateISO: '2026-11-14', tags: [{ type: 'AP' }] }],
  ledger: [], services: [], config: [], audit: [],
  cuadrante: [{ key: 'grupal', data: {
    names: ['ANA'], entries: [{ date: '2026-11-14', person: 'ANA', tagType: 'AP' }]
  } }]
});

test('prepara una copia actual y admite una antigua sin cuadrante ni historial', async () => {
  const data = sample();
  const stores = await prepareBackup(data);
  assert.deepEqual(stores.cuadrante, data.cuadrante);
  assert.deepEqual(stores.days, data.days);

  delete data.cuadrante;
  delete data.audit;
  data.version = 2;
  const legacy = await prepareBackup(data);
  assert.deepEqual(legacy.cuadrante, []);
  assert.deepEqual(legacy.audit, []);
});

test('rechaza una copia incompleta, un registro sin clave y una fecha imposible', async () => {
  const data = sample();
  await assert.rejects(prepareBackup({ ...data, days: null }), /días del calendario/);
  await assert.rejects(prepareBackup({ ...data, services: [{ profileId: 'ana' }] }), /servicios/);
  await assert.rejects(prepareBackup({ ...data, days: [{ ...data.days[0], dateISO: '2026-02-30' }] }), /días del calendario/);
  await assert.rejects(prepareBackup({ ...data, cuadrante: undefined }), /cuadrante/);
  await assert.rejects(prepareBackup({ ...data, version: 99 }), /compatible/);
  await assert.rejects(prepareBackup({ ...data, days: [...data.days, ...data.days] }), /repetidos/);
});

test('la copia cifrada se valida al abrirla y no admite una contraseña errónea', async () => {
  const password = 'contraseña de prueba';
  const copy = { encrypted: true, data: await encrypt(JSON.stringify(sample()), password) };
  await assert.rejects(prepareBackup(copy, 'otra'), /contraseña es incorrecta/);
  assert.deepEqual((await prepareBackup(copy, password)).profiles, sample().profiles);
});

test('reemplazar con una copia sin perfiles se rechaza antes de escribir', async () => {
  const stores = await prepareBackup({ ...sample(), profiles: [] });
  await assert.rejects(restoreBackup(stores, 'replace'), /ningún perfil/);
  stores.profiles = [{ id: 'otra', name: 'Otra' }];
  await assert.rejects(restoreBackup(stores, 'replace'), /perfil que falta/);
});
