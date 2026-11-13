import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripWeeks, weekIndexAt, weekLabel, STRIP_WEEKS } from '../js/ui/weekStrip.js';

test('la tira lleva la semana de hoy y las siguientes, de lunes a domingo', () => {
  const weeks = stripWeeks('2026-11-13'); // viernes
  assert.equal(weeks.length, STRIP_WEEKS);
  assert.equal(weeks[0].monday, '2026-11-09');
  assert.deepEqual(weeks[0].days, ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(weeks[1].monday, '2026-11-16');
  assert.equal(weeks[4].monday, '2026-12-07');
});

test('cada semana empieza en lunes y no hay días repetidos ni saltos', () => {
  const weeks = stripWeeks('2026-12-30'); // cruza el cambio de año
  const all = weeks.flatMap(w => w.days);
  assert.equal(new Set(all).size, all.length);
  for (const w of weeks) assert.equal(new Date(w.monday + 'T12:00:00').getDay(), 1);
  for (let i = 1; i < all.length; i++) {
    const gap = (new Date(all[i] + 'T12:00:00') - new Date(all[i - 1] + 'T12:00:00')) / 86400000;
    assert.equal(gap, 1, `${all[i - 1]} → ${all[i]}`);
  }
  assert.equal(weeks[0].monday, '2026-12-28');
  assert.equal(weeks[1].monday, '2027-01-04');
});

test('si hoy es lunes o domingo, la primera semana es la suya', () => {
  assert.equal(stripWeeks('2026-11-09')[0].monday, '2026-11-09');
  assert.equal(stripWeeks('2026-11-15')[0].monday, '2026-11-09');
});

test('el número de semanas se puede cambiar', () => {
  assert.equal(stripWeeks('2026-11-13', 2).length, 2);
});

test('la semana que se ve sale del desplazamiento y no se pasa de los extremos', () => {
  assert.equal(weekIndexAt(0, 330), 0);
  assert.equal(weekIndexAt(100, 330), 0);
  assert.equal(weekIndexAt(200, 330), 1);
  assert.equal(weekIndexAt(330, 330), 1);
  assert.equal(weekIndexAt(700, 330), 2);
  assert.equal(weekIndexAt(99999, 330), STRIP_WEEKS - 1);
  assert.equal(weekIndexAt(-50, 330), 0);
  assert.equal(weekIndexAt(500, 0), 0);
});

test('el título dice «Esta semana», «Semana que viene» y luego la fecha', () => {
  const fmt = (iso) => iso.slice(8) + '/' + iso.slice(5, 7);
  assert.equal(weekLabel(0, '2026-11-09', fmt), 'Esta semana');
  assert.equal(weekLabel(1, '2026-11-16', fmt), 'Semana que viene');
  assert.equal(weekLabel(2, '2026-11-23', fmt), 'Semana del 23/11');
});
