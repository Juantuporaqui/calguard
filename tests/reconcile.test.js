import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLedgerFromDays, summariseLibresForYear } from '../js/domain/reconcile.js';

const cfg = { diasPorGuardia: 5 };

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

test('libres sin guardia disponible quedan sin ref pero se registran (saldo negativo controlado aguas arriba)', () => {
  const days = [day('2026-07-09', 'LIBRE')];
  const plan = planLedgerFromDays(days, [], cfg);
  assert.equal(plan.debitsToAdd.length, 1);
  assert.equal(plan.debitsToAdd[0].sourceRef, '');
});

test('summariseLibresForYear: arrastre + generados − disfrutados = restantes (por año)', () => {
  const ledger = [
    // año anterior: NO debe contar
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.01/12', dateISO: '2025-12-01', amount: 5 },
    // año en curso
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.06/07', dateISO: '2026-07-06', amount: 5 },
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.06/07', dateISO: '2026-07-09', amount: -1 },
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.06/07', dateISO: '2026-07-10', amount: -1 }
  ];
  const s = summariseLibresForYear(ledger, 2026, 3, '2026-12-31'); // arrastre 3, todo el año cumplido
  assert.equal(s.arrastre, 3);
  assert.equal(s.generados, 5);       // solo la guardia de 2026, no la de 2025
  assert.equal(s.disfrutados, 2);
  assert.equal(s.restantes, 6);       // 3 + 5 − 2
});

test('summariseLibresForYear ignora otros años por completo', () => {
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.01/12', dateISO: '2025-12-01', amount: 5 },
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.01/12', dateISO: '2025-12-20', amount: -1 }
  ];
  const s = summariseLibresForYear(ledger, 2026, 0);
  assert.equal(s.generados, 0);
  assert.equal(s.disfrutados, 0);
  assert.equal(s.restantes, 0);
});

test('summariseLibresForYear: una guardia futura no genera libres hasta su lunes', () => {
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.06/07', dateISO: '2026-07-06', amount: 5 }, // pasada
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.14/12', dateISO: '2026-12-14', amount: 5 }  // futura
  ];
  const hoy = '2026-07-09';
  const s = summariseLibresForYear(ledger, 2026, 0, hoy);
  assert.equal(s.generados, 5); // solo la guardia cuyo lunes ya llegó
  // El mismo lunes de la guardia cuenta ese día
  assert.equal(summariseLibresForYear(ledger, 2026, 0, '2026-12-14').generados, 10);
});
