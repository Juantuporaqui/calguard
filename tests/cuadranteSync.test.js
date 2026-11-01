import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCuadranteSync, isImportedMovement } from '../js/domain/cuadranteSync.js';
import { canonicalPerson, currentRoster, entriesForPerson } from '../js/domain/groupCuadrante.js';

const cfg = { diasPorGuardia: 5 };
const P = 'perfil-1';
const entry = (date, tagType, code = tagType[0]) => ({ date, person: 'Mª CARMEN', code, tagType });
const imported = (dateISO, type) => ({ profileId: P, dateISO, tags: [{ type, meta: { source: 'cuadrante' } }] });

test('primera importación: crea etiquetas, guardia y libre', () => {
  const entries = [entry('2026-06-01', 'GUARDIA_REAL', 'INC'), entry('2026-06-10', 'LIBRE', 'CH'), entry('2026-06-11', 'TURNO_M', 'M')];
  const r = planCuadranteSync({ days: [], ledger: [], entries, profileId: P, desde: '2026-01-01', config: cfg });
  assert.equal(r.summary.added, 3);
  assert.equal(r.puts.length, 3);
  assert.equal(r.plan.creditsToAdd.length, 1);
  assert.equal(r.plan.debitsToAdd.length, 1);
  assert.equal(r.plan.debitsToAdd[0].sourceRef, 'G.01/06');
});

test('reimportar cuando un libre cambió de día: el viejo desaparece (no descuenta dos veces)', () => {
  const days = [imported('2026-06-01', 'GUARDIA_REAL'), imported('2026-06-10', 'LIBRE')];
  const ledger = [
    { id: 'c1', kind: 'CREDIT', category: 'GUARDIA', dateISO: '2026-06-01', amount: 5, sourceRef: 'G.01/06', origin: 'cuadrante' },
    { id: 'd1', kind: 'DEBIT', category: 'LIBRE', dateISO: '2026-06-10', amount: -1, sourceRef: 'G.01/06', origin: 'cuadrante' }
  ];
  // El cuadrante nuevo mueve el libre del 10 al 12
  const entries = [entry('2026-06-01', 'GUARDIA_REAL', 'INC'), entry('2026-06-12', 'LIBRE', 'CH')];
  const r = planCuadranteSync({ days, ledger, entries, profileId: P, desde: '2026-01-01', config: cfg });

  assert.deepEqual(r.deletes, [[P, '2026-06-10']]);
  assert.ok(r.newDays.some(d => d.dateISO === '2026-06-12'));
  assert.ok(!r.newDays.some(d => d.dateISO === '2026-06-10'));
  // Movimientos importados sustituidos: 1 crédito + 1 débito (el del día 12)
  assert.deepEqual(r.ledgerDeletes.map(m => m.id).sort(), ['c1', 'd1']);
  assert.equal(r.plan.creditsToAdd.length, 1);
  assert.deepEqual(r.plan.debitsToAdd.map(d => d.dateISO), ['2026-06-12']);
});

test('lo introducido a mano se conserva (etiquetas y movimientos)', () => {
  const days = [
    { profileId: P, dateISO: '2026-06-15', tags: [{ type: 'JUICIO', meta: { hora: '10:00' } }] },
    { profileId: P, dateISO: '2026-06-20', tags: [{ type: 'LIBRE', meta: { guardRef: 'G.01/06' } }] }
  ];
  const ledger = [{ id: 'm1', kind: 'DEBIT', category: 'LIBRE', dateISO: '2026-06-20', amount: -1, sourceRef: 'G.01/06' }];
  const r = planCuadranteSync({ days, ledger, entries: [entry('2026-06-01', 'GUARDIA_REAL', 'INC')], profileId: P, desde: '2026-01-01', config: cfg });
  assert.ok(r.newDays.find(d => d.dateISO === '2026-06-15').tags.some(t => t.type === 'JUICIO'));
  assert.deepEqual(r.ledgerDeletes, []);
  assert.equal(r.plan.debitsToAdd.length, 0); // el libre manual ya tenía su débito
});

test('reimportar el mismo cuadrante no cambia ningún día', () => {
  const entries = [entry('2026-06-01', 'GUARDIA_REAL', 'INC'), entry('2026-06-10', 'LIBRE', 'CH')];
  const first = planCuadranteSync({ days: [], ledger: [], entries, profileId: P, desde: '2026-01-01', config: cfg });
  const again = planCuadranteSync({ days: first.newDays, ledger: [], entries, profileId: P, desde: '2026-01-01', config: cfg });
  assert.equal(again.puts.length, 0);
  assert.equal(again.deletes.length, 0);
});

test('respeta la fecha "desde": lo anterior no se toca', () => {
  const days = [imported('2025-12-10', 'LIBRE')];
  const r = planCuadranteSync({ days, ledger: [], entries: [entry('2026-02-02', 'AP', 'AP')], profileId: P, desde: '2026-01-01', config: cfg });
  assert.ok(r.newDays.some(d => d.dateISO === '2025-12-10'));
  assert.equal(r.deletes.length, 0);
});

test('un conflicto (vacaciones manuales) se omite y se informa', () => {
  const days = [{ profileId: P, dateISO: '2026-08-03', tags: [{ type: 'VACACIONES' }] }];
  const r = planCuadranteSync({ days, ledger: [], entries: [entry('2026-08-03', 'GUARDIA_REAL', 'INC')], profileId: P, desde: '2026-01-01', config: cfg });
  assert.equal(r.summary.skipped.length, 1);
  assert.equal(r.summary.added, 0);
});

test('isImportedMovement reconoce el formato nuevo y el antiguo', () => {
  assert.equal(isImportedMovement({ origin: 'cuadrante' }), true);
  assert.equal(isImportedMovement({ note: 'Libre 03/02 (importado)' }), true);
  assert.equal(isImportedMovement({ note: 'Libre: 03/02' }), false);
});

test('nombres canónicos: CARMEN y Mª CARMEN son la misma persona; ex-miembros fuera', () => {
  const esc = ['TESA', 'RAFAEL', 'CARMEN', 'MARIO', 'JUAN', 'REINOSO', 'NURIA'];
  assert.equal(canonicalPerson('Mª CARMEN', esc), 'CARMEN');
  assert.equal(canonicalPerson('carmen', esc), 'CARMEN');
  assert.deepEqual(currentRoster(['PACO', 'Mª CARMEN', 'CARMEN', 'RAFAEL', 'VERONICA'], esc), ['RAFAEL', 'CARMEN']);
  const entries = [{ person: 'Mª CARMEN', date: '2026-01-02' }, { person: 'CARMEN', date: '2026-01-03' }, { person: 'PACO', date: '2026-01-02' }];
  assert.equal(entriesForPerson(entries, 'CARMEN', esc).length, 2);
});

test('el resumen cuenta las vacaciones como la contabilidad (sin fines de semana)', () => {
  // 2026-08-03 (lunes) … 2026-08-09 (domingo): 5 laborables
  const entries = ['03', '04', '05', '06', '07', '08', '09'].map(d => entry(`2026-08-${d}`, 'VACACIONES', 'V'));
  const r = planCuadranteSync({ days: [], ledger: [], entries, profileId: P, desde: '2026-01-01', config: { ...cfg, excludeWeekendsVacation: true } });
  assert.equal(r.summary.vacaciones, 5);
  const all = planCuadranteSync({ days: [], ledger: [], entries, profileId: P, desde: '2026-01-01', config: { ...cfg, excludeWeekendsVacation: false } });
  assert.equal(all.summary.vacaciones, 7);
});
