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

test('summariseLibresForYear: un libre pedido a futuro SÍ se descuenta (reservado)', () => {
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.06/07', dateISO: '2026-07-06', amount: 5 }, // trabajada
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.06/07', dateISO: '2026-07-08', amount: -1 },   // ya disfrutado
    { kind: 'DEBIT', category: 'LIBRE', sourceRef: 'G.06/07', dateISO: '2026-11-20', amount: -1 }    // pedido a futuro
  ];
  const s = summariseLibresForYear(ledger, 2026, 0, '2026-07-09');
  assert.equal(s.generados, 5);
  assert.equal(s.disfrutados, 2);   // el futuro también cuenta
  assert.equal(s.restantes, 3);     // 5 − 2, no puedes pedir de más
});

test('una guardia no se pierde aunque exista la misma fecha dd/mm en otro año', () => {
  // 06/07 es lunes en 2026 y también en 2020: la ref "G.06/07" coincide
  const days = [day('2026-07-06', 'GUARDIA_REAL')];
  const ledger = [{ kind: 'CREDIT', category: 'GUARDIA', sourceRef: 'G.06/07', dateISO: '2020-07-06', amount: 5 }];
  const plan = planLedgerFromDays(days, ledger, cfg);
  assert.equal(plan.creditsToAdd.length, 1);
  assert.equal(plan.creditsToAdd[0].dateISO, '2026-07-06');
});

test('un libre solo compensa guardias hechas antes que él', () => {
  const days = [
    day('2026-03-10', 'LIBRE'),                 // antes de cualquier guardia
    day('2026-06-01', 'GUARDIA_REAL'),
    day('2026-06-10', 'LIBRE')
  ];
  const plan = planLedgerFromDays(days, [], cfg);
  const byDate = Object.fromEntries(plan.debitsToAdd.map(d => [d.dateISO, d.sourceRef]));
  assert.equal(byDate['2026-03-10'], '');        // va al arrastre, no a la guardia de junio
  assert.equal(byDate['2026-06-10'], 'G.01/06');
});

// ─── Pedir días libres ───
import { planFreeDayRequest } from '../js/domain/reconcile.js';

const worked = (dateISO, ref) => ({ kind: 'CREDIT', category: 'GUARDIA', amount: 5, dateISO, sourceRef: ref });

test('pedir días: no deja pedir más de los disponibles hoy', () => {
  const r = planFreeDayRequest({ dates: ['2026-11-10', '2026-11-11', '2026-11-12'], days: [], ledger: [], available: 2, today: '2026-11-01' });
  assert.equal(r.ok, false);
  assert.equal(r.requested, 3);
});

test('pedir días: carga primero el arrastre y luego la guardia trabajada más antigua', () => {
  const ledger = [worked('2026-06-29', 'G.29/06'), worked('2026-02-16', 'G.16/02')];
  const r = planFreeDayRequest({ dates: ['2026-11-12', '2026-11-10', '2026-11-11'], days: [], ledger, available: 11, carryFree: 1, today: '2026-11-01' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.assignments.map(a => [a.date, a.guardRef, a.ordinal]), [
    ['2026-11-10', 'ARRASTRE', 'Arrastre'],
    ['2026-11-11', 'G.16/02', 'D.1'],
    ['2026-11-12', 'G.16/02', 'D.2']
  ]);
});

test('pedir días: nunca carga a una guardia aún no trabajada', () => {
  const ledger = [worked('2026-12-21', 'G.21/12')]; // futura
  const r = planFreeDayRequest({ dates: ['2026-12-28'], days: [], ledger, available: 1, today: '2026-11-01' });
  assert.equal(r.assignments[0].guardRef, 'ARRASTRE');
});

test('pedir días: ignora días ya libres y omite conflictos con vacaciones', () => {
  const days = [
    { dateISO: '2026-11-10', tags: [{ type: 'LIBRE' }] },
    { dateISO: '2026-11-11', tags: [{ type: 'VACACIONES' }] }
  ];
  const r = planFreeDayRequest({ dates: ['2026-11-10', '2026-11-11', '2026-11-12'], days, ledger: [worked('2026-06-01', 'G.01/06')], available: 1, today: '2026-11-01' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.already, ['2026-11-10']);
  assert.equal(r.conflicts.length, 1);
  assert.deepEqual(r.assignments.map(a => a.date), ['2026-11-12']);
});

test('planLedgerFromDays no crea débito para un libre concedido (no computa)', async () => {
  const { planLedgerFromDays } = await import('../js/domain/reconcile.js');
  const days = [
    { dateISO: '2026-06-01', tags: [{ type: 'GUARDIA_REAL' }] },
    { dateISO: '2026-06-10', tags: [{ type: 'LIBRE' }] },
    { dateISO: '2026-06-22', tags: [{ type: 'LIBRE' }] }
  ];
  const plan = planLedgerFromDays(days, [], { diasPorGuardia: 5, libresExentos: ['2026-06-22'] });
  assert.deepEqual(plan.debitsToAdd.map(d => d.dateISO), ['2026-06-10']);
});
