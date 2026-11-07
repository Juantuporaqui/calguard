import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeComps, mergeComps, compsForPerson, customConcepts, conceptOf, fmtDias } from '../js/domain/compensations.js';
import { computeBalances } from '../js/domain/balances.js';

const cfg = { diasPorGuardia: 5, asuntosAnuales: 8, vacacionesAnuales: 25, carryovers: {} };
const credit = (dateISO, extra = {}) => ({ kind: 'CREDIT', category: 'GUARDIA', amount: 5, dateISO, sourceRef: `G.${dateISO.slice(8)}/${dateISO.slice(5, 7)}`, origin: 'cuadrante', ...extra });
const ch = (dateISO, extra = {}) => ({ kind: 'DEBIT', category: 'LIBRE', amount: -1, dateISO, sourceRef: '', origin: 'cuadrante', ...extra });

test('juicio: medio día cada uno; los CH «por juicio» los gastan y no tocan las guardias', () => {
  const comps = [
    { id: 'a', fecha: '2026-04-22', concepto: 'juicio', dias: 0.5 },
    { id: 'b', fecha: '2026-04-28', concepto: 'juicio', dias: 0.5 },
    { id: 'c', fecha: '2026-04-28', concepto: 'juicio', dias: 0.5 }
  ];
  const ledger = [credit('2026-01-26'), ch('2026-02-10', { sourceRef: 'G.26/01' }), ch('2026-05-12', { concepto: 'juicio' })];
  const b = computeBalances([], ledger, { ...cfg, compensaciones: comps }, { today: '2026-11-07' });
  const j = b.libres.compensaciones.find(c => c.concepto === 'juicio');
  assert.equal(j.recibidos, 1.5);
  assert.equal(j.disfrutados, 1);
  assert.equal(j.pendientes, 0.5);
  assert.equal(b.libres.disponibles, 4.5);           // 5 − 1 de la guardia + ½ de juicios
  assert.equal(fmtDias(b.libres.disponibles), '4½');
});

test('elecciones para todo el grupo: suman cuando llega la fecha', () => {
  const group = [{ id: 'e', fecha: '2026-11-29', concepto: 'elecciones', dias: 1, personas: ['*'] }];
  const mine = compsForPerson(group, 'REINOSO');
  const before = computeBalances([], [], { ...cfg, compensaciones: mine }, { today: '2026-11-07' });
  assert.equal(before.libres.disponibles, 0);
  assert.equal(before.libres.compPrevistos, 1);
  const after = computeBalances([], [], { ...cfg, compensaciones: mine }, { today: '2026-11-30' });
  assert.equal(after.libres.disponibles, 1);
});

test('lo concedido a final de año y no disfrutado sigue al año siguiente', () => {
  const comps = [{ id: 'e', fecha: '2026-11-29', concepto: 'elecciones', dias: 1 }];
  const b27 = computeBalances([], [], { ...cfg, compensaciones: comps }, { today: '2027-01-15' });
  assert.equal(b27.libres.disponibles, 1);
  const taken = computeBalances([], [ch('2027-01-20', { concepto: 'elecciones' })], { ...cfg, compensaciones: comps }, { today: '2027-02-01' });
  assert.equal(taken.libres.disponibles, 0);
});

test('un CH por juicio de antes de apuntar los juicios no gasta los nuevos', () => {
  const comps = [{ id: 'a', fecha: '2026-10-01', concepto: 'juicio', dias: 1 }];
  const b = computeBalances([], [ch('2026-05-12', { concepto: 'juicio' })], { ...cfg, compensaciones: comps }, { today: '2026-11-07' });
  assert.equal(b.libres.compensaciones[0].pendientes, 1);
});

test('compensaciones del grupo y propias: la del grupo manda si es la misma', () => {
  const g = compsForPerson([
    { id: '1', fecha: '2026-11-29', concepto: 'elecciones', dias: 1, personas: ['*'] },
    { id: '2', fecha: '2026-06-01', concepto: 'servicio', dias: 2, personas: ['MARIO'] }
  ], 'JUAN');
  assert.equal(g.length, 1);
  const merged = mergeComps(g, [{ id: '3', fecha: '2026-11-29', concepto: 'elecciones', dias: 1 }, { id: '4', fecha: '2026-04-22', concepto: 'juicio', dias: 0.5 }]);
  assert.deepEqual(merged.map(c => `${c.concepto}:${c.origen}`), ['juicio:propia', 'elecciones:grupo']);
});

test('motivo propio («otro»): su nombre es lo que buscan las notas', () => {
  const c = { concepto: 'otro', etiqueta: 'Incendio Paiporta' };
  assert.equal(conceptOf(c), 'c:incendio-paiporta');
  assert.deepEqual(customConcepts([c])[0].words, ['incendio', 'paiporta']);
});

test('el cuadrante publicado lleva las notas y las compensaciones del grupo (cifradas)', async () => {
  const { packCuadrante, unpackCuadrante } = await import('../js/domain/sharedCuadrante.js');
  const data = {
    entries: [{ date: '2026-05-12', person: 'REINOSO', code: 'CH', tagType: 'LIBRE', note: 'CH juicio PA191/19' }],
    fichas: {},
    compensaciones: [{ id: 'e', fecha: '2026-11-29', concepto: 'elecciones', dias: 1, personas: ['*'] }]
  };
  const file = await packCuadrante(data, 'contraseña-larga');
  assert.ok(!JSON.stringify(file).includes('juicio'));
  const back = await unpackCuadrante(file, 'contraseña-larga');
  assert.equal(back.entries[0].note, 'CH juicio PA191/19');
  assert.equal(back.compensaciones[0].concepto, 'elecciones');
  // an older file without compensations does not wipe the ones on the device
  const old = await packCuadrante({ entries: data.entries }, 'contraseña-larga');
  assert.deepEqual((await unpackCuadrante(old, 'contraseña-larga')).compensaciones, []);
});
