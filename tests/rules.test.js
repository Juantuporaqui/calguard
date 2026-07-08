import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getWeekDates, formatISO, formatDMY, formatDM, getDateRange,
  countWorkingDays, isWeekend, detectConflict, calculateCounters,
  getLibreOrdinal, daysInMonth, firstDayOffset, parseISO
} from '../js/domain/rules.js';

// ─── Date helpers ───

test('getWeekDates devuelve lunes-domingo para un miércoles', () => {
  const week = getWeekDates('2026-07-08'); // miércoles
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-07-06'); // lunes
  assert.equal(week[6], '2026-07-12'); // domingo
});

test('getWeekDates trata el domingo como fin de semana (semana empieza lunes)', () => {
  const week = getWeekDates('2026-07-12'); // domingo
  assert.equal(week[0], '2026-07-06');
  assert.equal(week[6], '2026-07-12');
});

test('getWeekDates cruza el cambio de año correctamente', () => {
  const week = getWeekDates('2026-01-01'); // jueves
  assert.equal(week[0], '2025-12-29');
  assert.equal(week[6], '2026-01-04');
});

test('formatISO / formatDMY / formatDM', () => {
  assert.equal(formatISO(new Date(2026, 2, 5)), '2026-03-05');
  assert.equal(formatDMY('2026-03-05'), '05/03/2026');
  assert.equal(formatDM('2026-03-05'), '05/03');
});

test('getDateRange es inclusivo en ambos extremos', () => {
  const range = getDateRange('2026-02-27', '2026-03-02');
  assert.deepEqual(range, ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
});

test('getDateRange de un solo día devuelve un elemento', () => {
  assert.deepEqual(getDateRange('2026-05-10', '2026-05-10'), ['2026-05-10']);
});

test('countWorkingDays excluye sábados y domingos', () => {
  // 2026-07-06 (lun) a 2026-07-12 (dom) → 5 laborables
  const dates = getDateRange('2026-07-06', '2026-07-12');
  assert.equal(countWorkingDays(dates), 5);
});

test('isWeekend', () => {
  assert.equal(isWeekend('2026-07-11'), true);  // sábado
  assert.equal(isWeekend('2026-07-12'), true);  // domingo
  assert.equal(isWeekend('2026-07-13'), false); // lunes
});

test('daysInMonth con año bisiesto', () => {
  assert.equal(daysInMonth(2024, 1), 29); // feb 2024
  assert.equal(daysInMonth(2026, 1), 28); // feb 2026
  assert.equal(daysInMonth(2026, 0), 31);
});

test('firstDayOffset devuelve 0 para mes que empieza en lunes', () => {
  // junio 2026 empieza en lunes
  assert.equal(firstDayOffset(2026, 5), 0);
  // enero 2026 empieza en jueves → offset 3
  assert.equal(firstDayOffset(2026, 0), 3);
});

test('parseISO devuelve la fecha correcta a mediodía (sin desfases de zona)', () => {
  const d = parseISO('2026-03-29'); // día de cambio horario en España
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 29);
});

// ─── Conflict matrix ───

test('detectConflict: vacaciones sobre guardia → conflicto', () => {
  assert.ok(detectConflict([{ type: 'GUARDIA_REAL' }], 'VACACIONES'));
  assert.ok(detectConflict([{ type: 'GUARDIA_PLAN' }], 'VACACIONES'));
});

test('detectConflict: guardia sobre vacaciones → conflicto', () => {
  assert.ok(detectConflict([{ type: 'VACACIONES' }], 'GUARDIA_REAL'));
  assert.ok(detectConflict([{ type: 'VACACIONES' }], 'GUARDIA_PLAN'));
});

test('detectConflict: libre sobre vacaciones → conflicto', () => {
  assert.ok(detectConflict([{ type: 'VACACIONES' }], 'LIBRE'));
});

test('detectConflict: libre durante semana de guardia → permitido', () => {
  assert.equal(detectConflict([{ type: 'GUARDIA_REAL' }], 'LIBRE'), null);
});

test('detectConflict: combinaciones inocuas → null', () => {
  assert.equal(detectConflict([], 'VACACIONES'), null);
  assert.equal(detectConflict([{ type: 'TURNO_M' }], 'TURNO_T'), null);
  assert.equal(detectConflict([{ type: 'AP' }], 'JUICIO'), null);
});

// ─── Counters ───

const YEAR = new Date().getFullYear();
const cfg = { asuntosAnuales: 8, vacacionesAnuales: 25, excludeWeekendsVacation: true };

test('calculateCounters: crédito de guardia suma libres y cuenta guardia', () => {
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', amount: 5 },
    { kind: 'CREDIT', category: 'GUARDIA', amount: 5 }
  ];
  const c = calculateCounters([], ledger, cfg);
  assert.equal(c.libresAcumulados, 10);
  assert.equal(c.guardiasRealizadas, 2);
});

test('calculateCounters: débito de libre resta saldo y suma gastados', () => {
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', amount: 5 },
    { kind: 'DEBIT', category: 'LIBRE', amount: -1 },
    { kind: 'DEBIT', category: 'LIBRE', amount: -1 }
  ];
  const c = calculateCounters([], ledger, cfg);
  assert.equal(c.libresAcumulados, 3);
  assert.equal(c.libresGastados, 2);
});

test('calculateCounters: ADJUST aplica signo directo', () => {
  const ledger = [
    { kind: 'CREDIT', category: 'GUARDIA', amount: 5 },
    { kind: 'ADJUST', category: 'ADJUST', amount: -2 }
  ];
  const c = calculateCounters([], ledger, cfg);
  assert.equal(c.libresAcumulados, 3);
});

test('calculateCounters: OTROS credit/debit', () => {
  const ledger = [
    { kind: 'CREDIT', category: 'OTROS', amount: 2 },
    { kind: 'DEBIT', category: 'OTROS', amount: -1 }
  ];
  const c = calculateCounters([], ledger, cfg);
  assert.equal(c.libresAcumulados, 1);
});

test('calculateCounters: el saldo nunca baja de cero en el contador', () => {
  const ledger = [{ kind: 'DEBIT', category: 'LIBRE', amount: -3 }];
  const c = calculateCounters([], ledger, cfg);
  assert.equal(c.libresAcumulados, 0);
  assert.equal(c.libresGastados, 3);
});

test('calculateCounters: AP usados descuentan del cupo anual', () => {
  const days = [
    { dateISO: `${YEAR}-02-10`, tags: [{ type: 'AP' }] },
    { dateISO: `${YEAR}-03-11`, tags: [{ type: 'AP' }] },
    { dateISO: `${YEAR - 1}-03-11`, tags: [{ type: 'AP' }] } // otro año: no cuenta
  ];
  const c = calculateCounters(days, [], cfg);
  assert.equal(c.asuntosPropios, 6);
});

test('calculateCounters: vacaciones excluyen findes si la config lo pide', () => {
  const days = [
    { dateISO: `${YEAR}-07-11`, tags: [{ type: 'VACACIONES' }] }, // sábado
    { dateISO: `${YEAR}-07-13`, tags: [{ type: 'VACACIONES' }] }  // lunes
  ];
  const withExclusion = calculateCounters(days, [], { ...cfg, excludeWeekendsVacation: true });
  assert.equal(withExclusion.vacaciones, 24);
  const withoutExclusion = calculateCounters(days, [], { ...cfg, excludeWeekendsVacation: false });
  assert.equal(withoutExclusion.vacaciones, 23);
});

test('calculateCounters: guardias planificadas se cuentan por semana única', () => {
  const days = [
    { dateISO: `${YEAR}-07-06`, tags: [{ type: 'GUARDIA_PLAN' }] },
    { dateISO: `${YEAR}-07-07`, tags: [{ type: 'GUARDIA_PLAN' }] }, // misma semana
    { dateISO: `${YEAR}-07-14`, tags: [{ type: 'GUARDIA_PLAN' }] }  // otra semana
  ];
  const c = calculateCounters(days, [], cfg);
  assert.equal(c.guardiasPlanificadas, 2);
});

// ─── Libre ordinal ───

test('getLibreOrdinal calcula la posición dentro de la misma guardia', () => {
  const ledger = [
    { kind: 'DEBIT', category: 'LIBRE', dateISO: '2026-02-10', sourceRef: 'G.03/02' },
    { kind: 'DEBIT', category: 'LIBRE', dateISO: '2026-02-12', sourceRef: 'G.03/02' },
    { kind: 'DEBIT', category: 'LIBRE', dateISO: '2026-02-14', sourceRef: 'G.03/02' }
  ];
  assert.equal(getLibreOrdinal('2026-02-10', ledger), 'D.1 G.03/02');
  assert.equal(getLibreOrdinal('2026-02-12', ledger), 'D.2 G.03/02');
  assert.equal(getLibreOrdinal('2026-02-14', ledger), 'D.3 G.03/02');
});

test('getLibreOrdinal devuelve null si no hay débito para esa fecha', () => {
  assert.equal(getLibreOrdinal('2026-02-10', []), null);
});
