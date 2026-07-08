import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLedgerFromDays, summariseLibres, SALDO_INICIAL_REF } from '../js/domain/reconcile.js';

const cfg = { diasPorGuardia: 5, saldoInicialLibres: 0 };

function day(dateISO, ...types) {
  return { dateISO, tags: types.map(type => ({ type })) };
}

test('una semana con guardia genera un único crédito de 5', () => {
  // 2026-07-06 (lun) y 2026-07-08 (mié) son la misma semana ISO
  const days = [day('2026-07-06', 'GUARDIA_REAL'), day('2026-07-08', 'GUARDIA_REAL')];
  const plan = planLedgerFromDays(days, [], cfg);
  assert.equal(plan.creditsToAdd.length, 1);
  assert.equal(plan.creditsToAdd[0].amount, 5);
  assert.equal(plan.creditsToAdd[0].sourceRef, 'G.06/07');
});

test('dos semanas con guardia generan dos créditos', () => {
  const days = [day('2026-07-07', 'GUARDIA_REAL'), day('2026-07-15', 'GUARDIA_REAL')];
  const plan = planLedgerFromDays(days, [], cfg);
  assert.equal(plan.creditsToAdd.length, 2);
});

test('es idempotente: no re-acredita una guardia ya existente', () => {
  const days = [day('2026-07-06', 'GUARDIA_REAL')];
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.06/07', dateISO: '2026-07-06', amount: 5 }
  ];
  const plan = planLedgerFromDays(days, ledger, cfg);
  assert.equal(plan.creditsToAdd.length, 0);
});

test('los libres (CH) se cargan a la guardia más antigua con saldo', () => {
  const days = [
    day('2026-07-06', 'GUARDIA_REAL'),
    day('2026-07-09', 'LIBRE'),
    day('2026-07-10', 'LIBRE')
  ];
  const plan = planLedgerFromDays(days, [], cfg);
  assert.equal(plan.debitsToAdd.length, 2);
  assert.equal(plan.debitsToAdd[0].sourceRef, 'G.06/07');
  assert.equal(plan.debitsToAdd[0].ordinal, 'D.1 G.06/07');
  assert.equal(plan.debitsToAdd[1].ordinal, 'D.2 G.06/07');
});

test('los libres se reparten entre guardias en orden y respetan el tope de 5', () => {
  const days = [
    day('2026-06-01', 'GUARDIA_REAL'), // semana A
    day('2026-07-06', 'GUARDIA_REAL'), // semana B
    // 6 libres: 5 a la semana A, 1 a la semana B
    day('2026-07-20', 'LIBRE'), day('2026-07-21', 'LIBRE'), day('2026-07-22', 'LIBRE'),
    day('2026-07-23', 'LIBRE'), day('2026-07-24', 'LIBRE'), day('2026-07-27', 'LIBRE')
  ];
  const plan = planLedgerFromDays(days, [], cfg);
  const refs = plan.debitsToAdd.map(d => d.sourceRef);
  assert.equal(refs.filter(r => r === 'G.01/06').length, 5);
  assert.equal(refs.filter(r => r === 'G.06/07').length, 1);
});

test('idempotente en libres: no duplica un débito para una fecha ya registrada', () => {
  const days = [day('2026-07-06', 'GUARDIA_REAL'), day('2026-07-09', 'LIBRE')];
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.06/07', dateISO: '2026-07-06', amount: 5 },
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.06/07', dateISO: '2026-07-09', amount: -1 }
  ];
  const plan = planLedgerFromDays(days, ledger, cfg);
  assert.equal(plan.debitsToAdd.length, 0);
});

test('el saldo inicial absorbe libres antes que las guardias y se materializa como ADJUST', () => {
  const days = [day('2026-07-09', 'LIBRE'), day('2026-07-10', 'LIBRE')];
  const plan = planLedgerFromDays(days, [], { diasPorGuardia: 5, saldoInicialLibres: 3 });
  assert.deepEqual(plan.saldoInicial, { amount: 3 });
  assert.equal(plan.debitsToAdd[0].sourceRef, SALDO_INICIAL_REF);
  assert.ok(plan.debitsToAdd[0].ordinal.includes('saldo previo'));
});

test('no vuelve a crear el ADJUST si el saldo inicial no cambió', () => {
  const ledger = [{ kind: 'ADJUST', category: 'ADJUST', sourceRef: SALDO_INICIAL_REF, amount: 3, dateISO: '2026-01-01' }];
  const plan = planLedgerFromDays([], ledger, { diasPorGuardia: 5, saldoInicialLibres: 3 });
  assert.equal(plan.saldoInicial, null);
});

test('libres sin guardia disponible quedan sin ref pero se registran (saldo negativo controlado aguas arriba)', () => {
  const days = [day('2026-07-09', 'LIBRE')];
  const plan = planLedgerFromDays(days, [], cfg);
  assert.equal(plan.debitsToAdd.length, 1);
  assert.equal(plan.debitsToAdd[0].sourceRef, '');
});

test('summariseLibres cuadra generados, disfrutados y restantes', () => {
  const ledger = [
    { kind: 'ADJUST', category: 'ADJUST', sourceRef: SALDO_INICIAL_REF, amount: 3 },
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.06/07', amount: 5 },
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.06/07', amount: -1 },
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.06/07', amount: -1 }
  ];
  const s = summariseLibres(ledger);
  assert.equal(s.generados, 8);      // 3 saldo + 5 guardia
  assert.equal(s.disfrutados, 2);
  assert.equal(s.restantes, 6);      // 8 - 2
});
