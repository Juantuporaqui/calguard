import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CQ_CODES, cqCode, defaultView, orderRoster, filterRoster, listDates, dayGroups,
  whoListHTML, statusText, indexCuadrante, guardsByWeek, dayLabel
} from '../js/ui/cuadranteView.js';

test('abreviaturas: GU para toda guardia, AP, CUR para cursos (sin F), y una letra de reserva', () => {
  assert.equal(cqCode('GUARDIA_REAL').code, 'GU');
  assert.equal(cqCode('GUARDIA_PLAN').code, 'GU', 'hecha o prevista, igual');
  assert.equal(cqCode('AP').code, 'AP');
  assert.equal(cqCode('FORMACION').code, 'CUR');
  assert.equal(cqCode('FORMACION').name, 'Curso');
  assert.ok(!Object.values(CQ_CODES).some(c => c.code === 'F'), 'ya no hay «F»');
  for (const c of Object.values(CQ_CODES)) assert.equal(c.one.length, 1);
});

test('vista por defecto: lista en el móvil, mes en pantalla grande; la guardada manda', () => {
  assert.equal(defaultView(null, 360), 'list');
  assert.equal(defaultView(null, 699), 'list');
  assert.equal(defaultView(null, 700), 'month');
  assert.equal(defaultView('week', 360), 'week');
  assert.equal(defaultView('month', 360), 'month');
  assert.equal(defaultView('basura', 1200), 'month');
});

test('mi fila la primera y buscador sin mayúsculas ni tildes', () => {
  const r = ['TESA', 'RAFAEL', 'Mª CARMEN', 'MARIO'];
  assert.deepEqual(orderRoster(r, 'MARIO'), ['MARIO', 'TESA', 'RAFAEL', 'Mª CARMEN']);
  assert.deepEqual(orderRoster(r, null), r);
  assert.deepEqual(orderRoster(r, 'NADIE'), r);
  assert.deepEqual(filterRoster(r, 'car'), ['Mª CARMEN']);
  assert.deepEqual(filterRoster(r, 'RAFA'), ['RAFAEL']);
  assert.deepEqual(filterRoster(r, '  '), r);
  assert.deepEqual(filterRoster(['JOSÉ'], 'jose'), ['JOSÉ']);
});

test('la lista empieza hoy y sigue 7 días (cruza meses)', () => {
  assert.deepEqual(listDates('2026-11-28', 4), ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
  assert.match(dayLabel('2026-11-14', '2026-11-14'), /^Hoy · sábado 14 nov$/);
  assert.match(dayLabel('2026-11-15', '2026-11-14'), /^Mañana/);
});

// cuadrante de prueba: ANA de guardia la semana del 9 (INC el fin de semana), LUIS libra el 12, EVA de vacaciones
const data = {
  entries: [
    { person: 'ANA', date: '2026-11-14', tagType: 'GUARDIA_REAL' },
    { person: 'ANA', date: '2026-11-15', tagType: 'GUARDIA_REAL' },
    { person: 'LUIS', date: '2026-11-12', tagType: 'LIBRE' },
    { person: 'LUIS', date: '2026-11-13', tagType: 'TURNO_M' },
    { person: 'EVA', date: '2026-11-12', tagType: 'VACACIONES' },
    { person: 'EVA', date: '2026-11-13', tagType: 'FORMACION' }
  ],
  names: ['ANA', 'LUIS', 'EVA']
};

test('por día: quién está de guardia (toda su semana), libres, vacaciones y cursos', () => {
  const idx = indexCuadrante(data);
  const roster = ['ANA', 'LUIS', 'EVA'];
  const wg = guardsByWeek(idx, roster);
  const g12 = dayGroups('2026-11-12', idx, roster, wg);
  assert.deepEqual(g12.guardia, ['ANA'], 'el jueves ya está de guardia: es su semana');
  assert.deepEqual(g12.libres, ['LUIS']);
  assert.deepEqual(g12.vacaciones, ['EVA']);
  assert.deepEqual(dayGroups('2026-11-13', idx, roster, wg).cursos, ['EVA']);
  assert.deepEqual(dayGroups('2026-11-16', idx, roster, wg).guardia, [], 'la semana siguiente no');
});

test('la lista: hoy primero, con Guardia / Libres / Vacaciones siempre y lo demás si hay', () => {
  const idx = indexCuadrante(data);
  const roster = ['ANA', 'LUIS', 'EVA'];
  const html = whoListHTML({ dates: listDates('2026-11-12', 2), idx, roster, weekGuards: guardsByWeek(idx, roster), me: 'LUIS', today: '2026-11-12' });
  const first = html.indexOf('data-day="2026-11-12"');
  assert.ok(first >= 0 && first < html.indexOf('data-day="2026-11-13"'), 'hoy el primero');
  assert.match(html, /is-today/);
  for (const label of ['Guardia', 'Libres', 'Vacaciones']) assert.ok(html.includes(`>${label}</span>`), label);
  assert.match(html, />Cursos</, 'el 13 hay curso');
  assert.match(html, /who-me[^>]*>Luis/, 'yo resaltado');
  assert.ok(!/<script|style=/.test(html));
});

test('estado: «Actualizado hace 2 h» o «Sin conexión: datos del 12 nov»', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  assert.equal(statusText({ updatedAt: '2026-11-14T10:00:00Z', online: true, now }), 'Actualizado hace 2 h');
  assert.equal(statusText({ updatedAt: '2026-11-14T11:55:00Z', online: true, now }), 'Actualizado hace 5 min');
  assert.equal(statusText({ updatedAt: '2026-11-13T11:00:00Z', online: true, now }), 'Actualizado ayer');
  assert.equal(statusText({ updatedAt: '2026-11-12T09:00:00Z', online: false, now }), 'Sin conexión: datos del 12 nov');
});

test('al buscar a alguien, la lista dice también si trabaja de mañana o de tarde', () => {
  const idx = indexCuadrante(data);
  const html = whoListHTML({ dates: ['2026-11-13'], idx, roster: ['LUIS'], today: '2026-11-13', withShifts: true });
  assert.match(html, />Mañana<\/span><span class="who-names"><span class="who-name">Luis/);
  assert.ok(!whoListHTML({ dates: ['2026-11-13'], idx, roster: ['LUIS'], today: '2026-11-13' }).includes('>Mañana<'));
});
