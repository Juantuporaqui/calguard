import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlerts, activeAlerts, shortDates, MAX_ALERT_CHARS } from '../js/ui/alerts.js';

const quota = (o = {}) => ({ disponibles: 5, disfrutados: 0, arrastreEstimado: 0, estimadoFechas: [], ...o });
const balances = (o = {}) => ({
  libres: { disponibles: 5, disfrutados: 0, sinCubrir: [], arrastreEstimado: 0, sinGuardia: [], arrastreAuto: false, ...(o.libres || {}) },
  ap: quota(o.ap), vacaciones: quota(o.vacaciones)
});
const many = (n, month = '01') => Array.from({ length: n }, (_, i) => `2026-${month}-${String(i + 1).padStart(2, '0')}`);

test('sin nada raro no hay avisos', () => {
  assert.deepEqual(buildAlerts(balances(), { year: 2026, carry: { libres: 0 } }), []);
});

test('libres del año pasado: frase del ejemplo y acciones Sí / No, corregir', () => {
  const [a] = buildAlerts(balances({ libres: { arrastreEstimado: 2, sinGuardia: ['2026-01-03', '2026-01-04'] } }), { year: 2026 });
  assert.equal(a.text, '2 de tus libres (3 y 4 ene) parecen de 2025. ¿Es correcto?');
  assert.equal(a.primary.label, 'No, corregir');
  assert.deepEqual(a.primary.act, { type: 'goto', screen: 'settings' });
  assert.equal(a.secondary.label, 'Sí');
  assert.deepEqual(a.secondary.act, { type: 'dismiss' });
});

test('libre sin guardia: se resuelve desde el aviso marcándolo como concedido', () => {
  const [a] = buildAlerts(balances({ libres: { sinCubrir: ['2026-03-05'] } }), { year: 2026, carry: {} });
  assert.equal(a.text, 'El libre del 5 mar no corresponde a ninguna guardia. ¿Te lo concedieron?');
  assert.deepEqual(a.primary, { label: 'Sí, no descontar', act: { type: 'exento', dates: ['2026-03-05'] } });
  assert.deepEqual(a.secondary.act, { type: 'calendar', date: '2026-03-05' });
});

test('saldo negativo va primero', () => {
  const list = buildAlerts(balances({ libres: { disponibles: -2, sinCubrir: ['2026-03-05'] } }), { year: 2026, carry: {} });
  assert.equal(list[0].level, 'danger');
  assert.match(list[0].text, /2 libres más/);
});

test('cambio de guardia del cuadrante como aviso', () => {
  const list = buildAlerts(balances(), { year: 2026, carry: {}, lastChanges: { at: 'x', texts: ['Tu guardia del 8 dic pasa al 15 dic'] } });
  assert.equal(list[0].text, 'Tu guardia del 8 dic pasa al 15 dic.');
});

test('ningún aviso pasa de 120 caracteres ni con muchas fechas', () => {
  const b = balances({
    libres: { disponibles: -12, sinCubrir: many(20, '03'), arrastreEstimado: 15, sinGuardia: many(15), disfrutados: 9 },
    ap: { disponibles: 1, arrastreEstimado: 12, estimadoFechas: many(12, '02') },
    vacaciones: { arrastreEstimado: 22, estimadoFechas: many(22, '04') }
  });
  const over = many(9, '06').map(dateISO => ({ dateISO, used: 7, total: 5 }));
  const list = buildAlerts(b, { year: 2026, overGuards: over, lastChanges: { at: 'x', texts: ['Tu guardia del 28 dic pasa al 4 ene', 'Ya no tienes la guardia del 30 nov'] } });
  assert.ok(list.length >= 7);
  for (const a of list) {
    assert.ok(a.text.length <= MAX_ALERT_CHARS, `${a.text.length}: ${a.text}`);
    assert.ok(a.id, 'cada aviso tiene id');
    assert.ok(!/\b(INC|CH|ledger|arrastre)\b/i.test(a.text), `sin jerga: ${a.text}`);
    if (a.primary) assert.ok(a.primary.label && a.primary.act?.type);
  }
});

test('un aviso descartado no sale; si cambian los datos, vuelve', () => {
  const a1 = buildAlerts(balances({ libres: { sinCubrir: ['2026-03-05'] } }), { year: 2026, carry: {} });
  assert.deepEqual(activeAlerts(a1, [a1[0].id]), []);
  const a2 = buildAlerts(balances({ libres: { sinCubrir: ['2026-03-05', '2026-03-06'] } }), { year: 2026, carry: {} });
  assert.equal(activeAlerts(a2, [a1[0].id]).length, 1);
});

test('fechas cortas', () => {
  assert.equal(shortDates(['2026-01-04', '2026-01-03']), '3 y 4 ene');
  assert.equal(shortDates(['2025-12-30', '2026-01-02']), '30 dic y 2 ene');
  assert.equal(shortDates(many(5)), '1, 2 y 3 ene…');
});
