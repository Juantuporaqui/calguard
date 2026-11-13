import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffDays, changedDaysText, guardChangeTexts } from '../js/ui/syncReport.js';

const day = (dateISO, ...types) => ({ dateISO, tags: types.map(type => ({ type })) });

test('sin cambios: nada cambiado ni guardias movidas', () => {
  const days = [day('2026-11-09', 'TURNO_M'), day('2026-12-08', 'GUARDIA_REAL')];
  const r = diffDays(days, days.map(d => ({ ...d, tags: [...d.tags] })));
  assert.deepEqual(r, { changed: [], moves: [], added: [], removed: [] });
  assert.equal(changedDaysText(r.changed.length), 'Sin cambios');
});

test('cuenta los días cambiados, añadidos y quitados', () => {
  const before = [day('2026-11-09', 'TURNO_M'), day('2026-11-10', 'TURNO_T'), day('2026-11-11', 'LIBRE')];
  const after = [day('2026-11-09', 'TURNO_M'), day('2026-11-10', 'TURNO_M'), day('2026-11-12', 'TURNO_T')];
  const r = diffDays(before, after);
  assert.deepEqual(r.changed, ['2026-11-10', '2026-11-11', '2026-11-12']);
  assert.equal(changedDaysText(r.changed.length), '3 días actualizados');
  assert.equal(changedDaysText(1), '1 día actualizado');
});

test('el orden de las etiquetas dentro del día no cuenta como cambio', () => {
  const r = diffDays([day('2026-11-09', 'TURNO_M', 'JUICIO')], [day('2026-11-09', 'JUICIO', 'TURNO_M')]);
  assert.deepEqual(r.changed, []);
});

test('una guardia que cambia de semana: «Tu guardia del 8 dic pasa al 15 dic»', () => {
  const before = [day('2026-12-07', 'GUARDIA_REAL'), day('2026-12-08', 'GUARDIA_REAL')];
  const after = [day('2026-12-14', 'GUARDIA_REAL'), day('2026-12-15', 'GUARDIA_REAL')];
  const r = diffDays(before, after);
  assert.deepEqual(r.moves, [{ from: '2026-12-07', to: '2026-12-14' }]);
  assert.deepEqual(guardChangeTexts(r), ['Tu guardia del 7 dic pasa al 14 dic']);
});

test('guardias nuevas o quitadas sin pareja', () => {
  const nueva = diffDays([], [day('2026-12-15', 'GUARDIA_REAL')]);
  assert.deepEqual(guardChangeTexts(nueva), ['Nueva guardia: semana del 14 dic']);
  const quitada = diffDays([day('2026-12-08', 'GUARDIA_REAL')], []);
  assert.deepEqual(guardChangeTexts(quitada), ['Ya no tienes la guardia del 7 dic']);
});

test('una guardia que sigue en la misma semana no es un cambio de guardia', () => {
  const r = diffDays([day('2026-12-08', 'GUARDIA_REAL')], [day('2026-12-09', 'GUARDIA_REAL')]);
  assert.deepEqual(guardChangeTexts(r), []);
  assert.equal(r.changed.length, 2);
});
