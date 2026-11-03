import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenSettings, unflattenSettings, stampChanges, buildFichas, mergeFicha, EPOCH } from '../js/domain/fichas.js';

const defaults = { asuntosAnuales: 8, vacacionesAnuales: 25, diasPorGuardia: 5, apPlazo: '03-25' };
const T1 = '2026-11-03T09:00:00.000Z';   // el administrador rellena las fichas
const T2 = '2026-11-10T09:00:00.000Z';   // el usuario cambia algo después
const T3 = '2026-11-20T09:00:00.000Z';   // el administrador lo vuelve a cambiar

test('aplanar y reconstruir los ajustes de una ficha', () => {
  const s = { asuntosAnuales: 10, diasPorGuardia: 7, carryovers: { 2026: { libres: 2, ap: 3, caducaAP: '2026-03-25' } } };
  const flat = flattenSettings(s);
  assert.deepEqual(flat, { asuntosAnuales: 10, diasPorGuardia: 7, 'carry.2026.libres': 2, 'carry.2026.ap': 3, 'carry.2026.caducaAP': '2026-03-25' });
  assert.deepEqual(unflattenSettings({}, flat), { asuntosAnuales: 10, diasPorGuardia: 7, carryovers: { 2026: { libres: 2, ap: 3, caducaAP: '2026-03-25' } } });
});

test('guardar un formulario con los valores por defecto sin tocar no cuenta como cambio', () => {
  const meta = stampChanges({}, { asuntosAnuales: 8, vacacionesAnuales: 25, diasPorGuardia: null,
    carryovers: { 2026: { libres: 0, ap: 0, vacaciones: 0, primerLibre: null, caducaAP: '2026-03-25' } } }, {}, T2, defaults);
  assert.deepEqual(meta, {});
  const meta2 = stampChanges({}, { asuntosAnuales: 10, carryovers: { 2026: { ap: 2 } } }, {}, T2, defaults);
  assert.deepEqual(meta2, { asuntosAnuales: T2, 'carry.2026.ap': T2 });
});

test('un perfil nuevo recibe la ficha que puso el administrador (ya funcional al instalar)', () => {
  const admin = { cuadranteName: 'TESA', settings: { diasPorGuardia: 7, asuntosAnuales: 11, carryovers: { 2026: { ap: 2 } } },
    settingsMeta: { diasPorGuardia: T1, asuntosAnuales: T1, 'carry.2026.ap': T1 } };
  const fichas = buildFichas([admin, { name: 'sin vincular', settings: { asuntosAnuales: 3 } }]);
  assert.deepEqual(Object.keys(fichas), ['TESA']);
  const r = mergeFicha({}, {}, fichas.TESA, defaults);
  assert.deepEqual(r.settings, { diasPorGuardia: 7, asuntosAnuales: 11, carryovers: { 2026: { ap: 2 } } });
  assert.equal(r.latest, T1);
  assert.equal(r.meta.diasPorGuardia, T1);
});

test('si el usuario cambia su ficha después, manda lo suyo; si el administrador la cambia más tarde, manda la del administrador', () => {
  const fichaT1 = { values: { asuntosAnuales: 11, 'carry.2026.ap': 2 }, meta: { asuntosAnuales: T1, 'carry.2026.ap': T1 } };
  // el usuario recibió T1 y luego cambió sus AP pendientes (T2)
  let { settings, meta } = mergeFicha({}, {}, fichaT1, defaults);
  const mine = { ...settings, carryovers: { 2026: { ap: 4 } } };
  meta = stampChanges(settings, mine, meta, T2, defaults);
  // vuelve a publicarse la misma ficha (T1): no pisa su cambio
  const again = mergeFicha(mine, meta, fichaT1, defaults);
  assert.equal(again.changed.length, 0);
  assert.equal(again.settings.carryovers[2026].ap, 4);
  // el administrador corrige ese dato en T3: ahora manda el administrador
  const fichaT3 = { values: { asuntosAnuales: 11, 'carry.2026.ap': 1 }, meta: { asuntosAnuales: T1, 'carry.2026.ap': T3 } };
  const later = mergeFicha(mine, meta, fichaT3, defaults);
  assert.deepEqual(later.changed, ['carry.2026.ap']);
  assert.equal(later.settings.carryovers[2026].ap, 1);
});

test('un valor que nadie fechó (EPOCH) solo rellena huecos, no pisa lo que ya tiene el usuario', () => {
  const ficha = { values: { vacacionesAnuales: 23, asuntosAnuales: 9 }, meta: { vacacionesAnuales: EPOCH, asuntosAnuales: EPOCH } };
  const r = mergeFicha({ vacacionesAnuales: 26 }, {}, ficha, defaults);
  assert.equal(r.settings.vacacionesAnuales, 26);
  assert.equal(r.settings.asuntosAnuales, 9);
  assert.deepEqual(r.changed, ['asuntosAnuales']);
});
