import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyTarget, stepDate, stepMonth, periodTitle, rangeDates, shortDate } from '../js/ui/calendar/grid.js';
import { dayCodeTypes, LEGEND_TYPES, DAY_TYPES } from '../js/ui/labels.js';

test('flechas: un día a los lados y una semana arriba y abajo', () => {
  assert.equal(keyTarget('2026-11-13', 'ArrowRight'), '2026-11-14');
  assert.equal(keyTarget('2026-11-13', 'ArrowLeft'), '2026-11-12');
  assert.equal(keyTarget('2026-11-13', 'ArrowDown'), '2026-11-20');
  assert.equal(keyTarget('2026-11-13', 'ArrowUp'), '2026-11-06');
  assert.equal(keyTarget('2026-11-30', 'ArrowRight'), '2026-12-01', 'cruza de mes');
  assert.equal(keyTarget('2026-12-31', 'ArrowRight'), '2027-01-01', 'cruza de año');
});

test('en la vista semana, arriba y abajo mueven un día', () => {
  assert.equal(keyTarget('2026-11-13', 'ArrowDown', 'week'), '2026-11-14');
  assert.equal(keyTarget('2026-11-13', 'ArrowUp', 'week'), '2026-11-12');
});

test('Inicio y Fin van al lunes y al domingo; RePág y AvPág, un mes', () => {
  assert.equal(keyTarget('2026-11-13', 'Home'), '2026-11-09');
  assert.equal(keyTarget('2026-11-13', 'End'), '2026-11-15');
  assert.equal(keyTarget('2026-11-13', 'PageDown'), '2026-12-13');
  assert.equal(keyTarget('2026-03-31', 'PageUp'), '2026-02-28', 'si no existe el día, el último del mes');
  assert.equal(keyTarget('2026-11-13', 'Enter'), null);
});

test('saltos de días y meses', () => {
  assert.equal(stepDate('2026-03-01', -1), '2026-02-28');
  assert.equal(stepMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(stepMonth('2026-12-15', 1), '2027-01-15');
});

test('títulos del periodo', () => {
  assert.equal(periodTitle('month', 2026, 10), 'Noviembre 2026');
  assert.equal(periodTitle('year', 2026, 10), '2026');
  assert.equal(periodTitle('week', 2026, 10, ['2026-11-09', '', '', '', '', '', '2026-11-15']), '9–15 nov 2026');
  assert.equal(periodTitle('week', 2026, 10, ['2026-11-30', '', '', '', '', '', '2026-12-06']), '30 nov – 6 dic 2026');
});

test('rangos en cualquier orden', () => {
  assert.deepEqual(rangeDates('2026-11-25', '2026-11-23'), ['2026-11-23', '2026-11-24', '2026-11-25']);
  assert.deepEqual(rangeDates('2026-11-23', '2026-11-23'), ['2026-11-23']);
  assert.equal(shortDate('2026-11-23'), '23 nov');
});

test('las letras de un día van en orden fijo: ausencia o guardia, luego turno, luego lo demás', () => {
  const t = (...types) => types.map(type => ({ type }));
  assert.deepEqual(dayCodeTypes(t('TURNO_M')), { shown: ['TURNO_M'], more: 0 });
  assert.deepEqual(dayCodeTypes(t('JUICIO', 'TURNO_T')), { shown: ['TURNO_T', 'JUICIO'], more: 0 });
  assert.deepEqual(dayCodeTypes(t('FORMACION', 'TURNO_M', 'LIBRE')), { shown: ['LIBRE', 'TURNO_M'], more: 1 });
  assert.deepEqual(dayCodeTypes(t('TURNO_M', 'TURNO_M')), { shown: ['TURNO_M'], more: 0 }, 'sin repetidos');
  assert.deepEqual(dayCodeTypes([]), { shown: [], more: 0 });
});

test('la leyenda trae todos los tipos de día', () => {
  for (const type of Object.keys(DAY_TYPES)) assert.ok(LEGEND_TYPES.includes(type), type);
});

import { keepCompatible } from '../js/ui/calendar/grid.js';

test('al coger libre, asunto propio, vacaciones o baja se quita el turno de ese día', () => {
  const t = (...types) => types.map(type => ({ type }));
  for (const abs of ['LIBRE', 'AP', 'VACACIONES', 'BAJA']) {
    assert.deepEqual(keepCompatible(t('TURNO_M', 'JUICIO'), abs).map(x => x.type), ['JUICIO'], abs);
    assert.deepEqual(keepCompatible(t('TURNO_T', 'TURNO_N'), abs), [], abs);
  }
});

test('un turno, un juicio o una formación no quitan nada más', () => {
  const t = (...types) => types.map(type => ({ type }));
  assert.deepEqual(keepCompatible(t('TURNO_M', 'LIBRE'), 'JUICIO').map(x => x.type), ['TURNO_M', 'LIBRE']);
  assert.deepEqual(keepCompatible(t('TURNO_M'), 'TURNO_T').map(x => x.type), ['TURNO_M']);
  assert.deepEqual(keepCompatible(t('TURNO_M', 'FORMACION'), 'FORMACION').map(x => x.type), ['TURNO_M'], 'el mismo tipo se sustituye');
});
