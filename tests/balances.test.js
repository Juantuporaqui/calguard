import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalances, upcomingEvents, guardsOfYear, countersFromBalances } from '../js/domain/balances.js';

const cfg = { asuntosAnuales: 8, vacacionesAnuales: 25, excludeWeekendsVacation: true, diasPorGuardia: 5 };
const tag = (dateISO, ...types) => ({ dateISO, tags: types.map(type => ({ type })) });
const credit = (dateISO, amount = 5) => ({ kind: 'CREDIT', category: 'GUARDIA', amount, dateISO, sourceRef: `G.${dateISO.slice(8)}/${dateISO.slice(5, 7)}` });
const debit = (dateISO, sourceRef = '') => ({ kind: 'DEBIT', category: 'LIBRE', amount: -1, dateISO, sourceRef });

// ─── Libres: ganar difiere, gastar reserva ───

test('libres: guardias futuras quedan "por generar"; libres futuros quedan "reservados"', () => {
  const ledger = [
    credit('2026-06-01'), credit('2026-06-29'),     // trabajadas
    credit('2026-11-09'), credit('2026-12-21'),     // futuras
    debit('2026-06-10'), debit('2026-07-01'),       // disfrutados
    debit('2026-11-20')                             // pedido a futuro
  ];
  const b = computeBalances([], ledger, cfg, { today: '2026-11-01' });
  assert.equal(b.libres.generados, 10);
  assert.equal(b.libres.porGenerar, 10);
  assert.equal(b.libres.disfrutados, 2);
  assert.equal(b.libres.reservados, 1);
  assert.equal(b.libres.disponibles, 7); // 10 − 2 − 1
  assert.equal(b.guardias.realizadas, 2);
  assert.equal(b.guardias.planificadas, 2);
  assert.deepEqual(b.guardias.proximas, ['2026-11-09', '2026-12-21']);
});

test('libres: el lunes de la guardia ya cuenta como generada ese mismo día', () => {
  const b = computeBalances([], [credit('2026-11-09')], cfg, { today: '2026-11-09' });
  assert.equal(b.libres.generados, 5);
  assert.equal(b.guardias.realizadas, 1);
  assert.equal(b.guardias.planificadas, 0);
});

test('libres: el arrastre manual se suma y lo anterior al corte se descuenta de él', () => {
  const config = { ...cfg, carryovers: { 2026: { libres: 4, primerLibre: '2026-03-01' } } };
  const ledger = [credit('2026-03-02'), debit('2026-01-15'), debit('2026-02-10'), debit('2026-03-10')];
  const b = computeBalances([], ledger, config, { today: '2026-11-01' });
  assert.equal(b.libres.delArrastre, 2);
  assert.equal(b.libres.arrastreRestante, 2);
  assert.equal(b.libres.disfrutados, 1);
  assert.equal(b.libres.disponibles, 6); // 2 restantes del arrastre + 5 − 1
});

test('libres: el saldo real puede ser negativo (pedido de más) y el contador lo muestra como 0', () => {
  const b = computeBalances([], [debit('2026-05-01'), debit('2026-05-02')], cfg, { today: '2026-11-01' });
  assert.equal(b.libres.disponibles, -2);
  assert.equal(countersFromBalances(b).libresAcumulados, 0);
});

test('libres: solo cuenta el año pedido', () => {
  const b = computeBalances([], [credit('2025-12-01'), debit('2025-12-20')], cfg, { today: '2026-11-01' });
  assert.equal(b.libres.generados, 0);
  assert.equal(b.libres.disfrutados, 0);
});

// ─── AP y vacaciones: disfrutados + planificados contra el cupo ───

test('vacaciones: separa disfrutadas y planificadas (caso CARMEN en julio)', () => {
  const days = [
    tag('2026-01-02', 'VACACIONES'), tag('2026-03-30', 'VACACIONES'), tag('2026-03-31', 'VACACIONES'),
    tag('2026-04-01', 'VACACIONES'),
    tag('2026-08-03', 'VACACIONES'), tag('2026-08-04', 'VACACIONES'), tag('2026-08-08', 'VACACIONES') // sábado: no cuenta
  ];
  const b = computeBalances(days, [], cfg, { today: '2026-07-09' });
  assert.equal(b.vacaciones.disfrutados, 4);
  assert.equal(b.vacaciones.planificados, 2);
  assert.equal(b.vacaciones.disponibles, 19); // 25 − 4 − 2
});

test('AP: los anteriores a la fecha de corte son del año anterior y no tocan el cupo', () => {
  const days = ['01-20', '01-21', '02-05', '02-16', '03-04', '06-15', '06-16'].map(md => tag(`2026-${md}`, 'AP'));
  const config = { ...cfg, carryovers: { 2026: { ap: 5, primerAP: '2026-06-15' } } };
  const b = computeBalances(days, [], config, { today: '2026-11-01' });
  assert.equal(b.ap.delArrastre, 5);
  assert.equal(b.ap.arrastreRestante, 0);
  assert.equal(b.ap.disfrutados, 2);
  assert.equal(b.ap.disponibles, 6); // 8 − 2
});

test('AP: un cupo de 0 se respeta (no cae al valor por defecto)', () => {
  const b = computeBalances([tag('2026-02-02', 'AP')], [], { ...cfg, asuntosAnuales: 0 }, { today: '2026-11-01' });
  assert.equal(b.ap.cupo, 0);
  assert.equal(b.ap.disponibles, -1);
});

// ─── Guardias desde etiquetas (sin crédito en el ledger) ───

test('guardias: una semana con GUARDIA_REAL futura cuenta como planificada aunque no haya crédito', () => {
  const days = [tag('2026-12-22', 'GUARDIA_REAL'), tag('2026-12-23', 'GUARDIA_REAL'), tag('2026-02-17', 'GUARDIA_REAL')];
  const b = computeBalances(days, [], cfg, { today: '2026-11-01' });
  assert.equal(b.guardias.realizadas, 1);
  assert.equal(b.guardias.planificadas, 1);
  assert.deepEqual(b.guardias.proximas, ['2026-12-21']);
});

// ─── Próximos eventos ───

test('upcomingEvents agrupa tramos saltando fines de semana y ordena por fecha', () => {
  const days = [
    tag('2026-11-02', 'TURNO_M'),                       // turnos: no son eventos
    tag('2026-11-09', 'GUARDIA_REAL'), tag('2026-11-10', 'GUARDIA_REAL'),
    tag('2026-11-20', 'LIBRE'),
    tag('2026-12-04', 'VACACIONES'), tag('2026-12-07', 'VACACIONES'), tag('2026-12-08', 'VACACIONES'), // vie→lun→mar
    tag('2026-10-01', 'VACACIONES')                     // pasado: fuera
  ];
  const ev = upcomingEvents(days, '2026-11-01');
  assert.deepEqual(ev.map(e => [e.type, e.start, e.end, e.count]), [
    ['GUARDIA_REAL', '2026-11-09', '2026-11-10', 2],
    ['LIBRE', '2026-11-20', '2026-11-20', 1],
    ['VACACIONES', '2026-12-04', '2026-12-08', 3]
  ]);
  assert.equal(ev[0].inDays, 8);
});

test('guardsOfYear devuelve las guardias del año en orden con su consumo', () => {
  const ledger = [credit('2026-12-21'), credit('2026-02-16'), debit('2026-02-20', 'G.16/02'), credit('2025-12-01')];
  const g = guardsOfYear(ledger, 2026, 5, '2026-11-01');
  assert.deepEqual(g.map(x => [x.dateISO, x.used, x.worked]), [
    ['2026-02-16', 1, true],
    ['2026-12-21', 0, false]
  ]);
});
