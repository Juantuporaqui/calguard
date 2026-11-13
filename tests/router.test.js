import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCREENS, HOME, isScreenId, getScreen, titleOf, navLabelOf, tabOf, navScreens, isSubScreen,
  hashOf, screenFromHash, makeEntry, isEntry, createNavigator, bindStore
} from '../js/ui/router.js';

// ─── Tabla de pantallas ───

test('la tabla no repite ids y cada pestaña madre existe y está en la barra', () => {
  const ids = SCREENS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SCREENS) {
    assert.ok(isScreenId(s.tab), `${s.id}: la pestaña madre ${s.tab} no existe`);
    assert.equal(getScreen(s.tab).inNav, true, `${s.id}: su pestaña madre debe estar en la barra`);
    assert.ok(s.title && !/^\s|\s$/.test(s.title));
    if (s.inNav) assert.equal(s.tab, s.id, `${s.id}: una pestaña es su propia madre`);
  }
});

test('la barra tiene cinco pestañas: Inicio, Calendario, Cuadrante, Biblioteca y Más', () => {
  assert.deepEqual(navScreens().map(s => s.id), ['dashboard', 'calendar', 'cuadrante', 'biblioteca', 'more']);
  assert.deepEqual(navScreens().map(s => navLabelOf(s.id)), ['Inicio', 'Calendario', 'Cuadrante', 'Biblioteca', 'Más']);
});

test('las pantallas fuera de la barra cuelgan de Más', () => {
  for (const id of ['stats', 'registry', 'settings', 'diagnostics']) {
    assert.equal(isSubScreen(id), true, id);
    assert.equal(tabOf(id), 'more', id);
  }
  for (const id of ['dashboard', 'calendar', 'cuadrante', 'biblioteca', 'more']) assert.equal(isSubScreen(id), false, id);
});

test('títulos y pestaña de una pantalla desconocida caen en Inicio', () => {
  assert.equal(titleOf('cuadrante'), 'Cuadrante del grupo');
  assert.equal(navLabelOf('cuadrante'), 'Cuadrante');
  assert.equal(titleOf('nada'), 'Inicio');
  assert.equal(tabOf('nada'), 'dashboard');
});

test('la URL refleja la pantalla y se entiende de vuelta', () => {
  for (const s of SCREENS) assert.equal(screenFromHash(hashOf(s.id)), s.id);
  assert.equal(hashOf('calendar'), '#calendar');
  assert.equal(screenFromHash('#calendar/2026-11'), 'calendar');
  assert.equal(screenFromHash('settings'), 'settings');
  assert.equal(screenFromHash('#nada'), null);
  assert.equal(screenFromHash(''), null);
  assert.equal(screenFromHash(undefined), null);
});

test('#shared-import sigue llevando al cuadrante', () => {
  assert.equal(screenFromHash('#shared-import'), 'cuadrante');
});

test('el renderizador sabe pintar todas las pantallas de la tabla', () => {
  const src = readFileSync(new URL('../js/ui/renderer.js', import.meta.url), 'utf8');
  for (const s of SCREENS) assert.match(src, new RegExp(`\\b${s.id}\\s*:\\s*render`), `renderer.js no pinta «${s.id}»`);
});

test('las entradas del historial se reconocen', () => {
  assert.equal(isEntry(makeEntry('calendar', 1)), true);
  assert.equal(isEntry(makeEntry('calendar', 1, true)), true);
  assert.equal(isEntry({ cg: 1, screen: 'nada', idx: 0 }), false);
  assert.equal(isEntry(null), false);
  assert.equal(isEntry({ screen: 'calendar', idx: 0 }), false);
});

// ─── Historial falso y arnés ───

class FakeHistory {
  constructor() { this.entries = [{ state: null, url: '' }]; this.i = 0; this.queue = []; this.exited = false; this.onpop = null; }
  get state() { return this.entries[this.i].state; }
  pushState(s, _t, url) { this.entries.splice(this.i + 1); this.entries.push({ state: s, url }); this.i++; }
  replaceState(s, _t, url) { this.entries[this.i] = { state: s, url }; }
  back() { this.queue.push(-1); }
  go(n) { this.queue.push(n); }
  /** Entrega los popstate pendientes; ir antes de la primera entrada = la app se cierra. */
  flush() {
    while (this.queue.length) {
      const t = this.i + this.queue.shift();
      if (t < 0) { this.exited = true; continue; }
      this.i = t;
      this.onpop?.(this.entries[t].state);
    }
  }
  get urls() { return this.entries.map(e => e.url); }
}

function setup({ hash = '', busy = false, preset, store } = {}) {
  const history = new FakeHistory();
  if (preset) preset(history);
  const timers = [];
  const shown = [];
  let isBusy = busy;
  let location = hash;
  const nav = createNavigator({
    history,
    readHash: () => location,
    showScreen: (id) => { shown.push(id); store?.Actions.setScreen(id); },
    isBusy: () => isBusy,
    schedule: (fn) => timers.push(fn)
  });
  history.onpop = (st) => nav.handlePop(st);
  const runTimers = () => { while (timers.length) timers.shift()(); history.flush(); };
  /** Atrás del móvil. */
  const press = () => { history.back(); history.flush(); runTimers(); };
  const start = nav.boot(screenFromHash(hash));
  if (store) bindStore(nav, store);
  return { history, nav, shown, runTimers, press, start, setBusy: (b) => { isBusy = b; }, setHash: (h) => { location = h; } };
}

// ─── Arranque ───

test('abrir en Inicio deja una sola entrada', () => {
  const { history, start, nav } = setup();
  assert.equal(start, 'dashboard');
  assert.equal(history.entries.length, 1);
  assert.deepEqual(history.state, makeEntry('dashboard', 0));
  assert.equal(history.urls[0], '#dashboard');
  assert.equal(nav.snapshot().idx, 0);
});

test('abrir un acceso directo deja Inicio debajo: Atrás va a Inicio y luego cierra la app', () => {
  const { history, start, press, shown } = setup({ hash: '#calendar' });
  assert.equal(start, 'calendar');
  assert.deepEqual(history.urls, ['#dashboard', '#calendar']);
  press();
  assert.deepEqual(shown, ['dashboard']);
  assert.equal(history.exited, false);
  press();
  assert.equal(history.exited, true);
});

test('#shared-import abre el cuadrante con Inicio debajo y la URL normalizada', () => {
  const { history, start } = setup({ hash: '#shared-import' });
  assert.equal(start, 'cuadrante');
  assert.deepEqual(history.urls, ['#dashboard', '#cuadrante']);
});

test('recargar conserva la pantalla y el historial', () => {
  const first = setup();
  first.nav.screenChanged('settings');
  const saved = first.history;
  const again = setup({ preset: (h) => { h.entries = saved.entries.map(e => ({ ...e })); h.i = saved.i; } });
  assert.equal(again.start, 'settings');
  assert.equal(again.history.entries.length, 2);
});

test('recargar con una capa abierta quita su entrada y no deja duplicados', () => {
  const first = setup();
  first.nav.screenChanged('calendar');
  first.nav.pushLayer(() => {});
  const saved = first.history;
  assert.equal(saved.entries.length, 3);
  const again = setup({ preset: (h) => { h.entries = saved.entries.map(e => ({ ...e })); h.i = saved.i; } });
  again.history.flush();
  assert.equal(again.history.i, 1);
  assert.deepEqual(again.history.state, makeEntry('calendar', 1));
  again.press();
  assert.deepEqual(again.shown, ['dashboard']);
});

// ─── Pantallas ───

test('cada cambio de pantalla es una entrada y Atrás las recorre al revés', () => {
  const { history, nav, press, shown } = setup();
  nav.screenChanged('calendar');
  nav.screenChanged('more');
  nav.screenChanged('settings');
  assert.deepEqual(history.urls, ['#dashboard', '#calendar', '#more', '#settings']);
  press(); press(); press();
  assert.deepEqual(shown, ['more', 'calendar', 'dashboard']);
  assert.equal(history.exited, false);
  press();
  assert.equal(history.exited, true);
});

test('pasar a la misma pantalla no añade entrada', () => {
  const { history, nav } = setup();
  nav.screenChanged('calendar');
  nav.screenChanged('calendar');
  assert.equal(history.entries.length, 2);
});

test('si se vuelve atrás y se navega a otro sitio, se descarta lo de delante', () => {
  const { history, nav, press } = setup();
  nav.screenChanged('calendar');
  nav.screenChanged('more');
  press();
  nav.screenChanged('biblioteca');
  assert.deepEqual(history.urls, ['#dashboard', '#calendar', '#biblioteca']);
});

test('Atrás entre pantallas no genera entradas nuevas', () => {
  const { history, nav, press } = setup();
  nav.screenChanged('stats');
  press();
  assert.equal(history.entries.length, 2);
  assert.equal(history.i, 0);
  assert.equal(nav.snapshot().screen, 'dashboard');
});

// ─── Capas: hojas, menú, modos de selección ───

test('con una capa abierta Atrás la cierra y se queda en la misma pantalla', () => {
  const { history, nav, press, shown } = setup();
  nav.screenChanged('calendar');
  let closed = 0;
  nav.pushLayer(() => { closed++; });
  assert.equal(history.entries.length, 3);
  press();
  assert.equal(closed, 1);
  assert.deepEqual(shown, []);
  assert.equal(nav.snapshot().screen, 'calendar');
  assert.equal(nav.snapshot().layers, 0);
  assert.equal(history.exited, false);
});

test('Atrás con una capa abierta en Inicio no cierra la app; el siguiente Atrás sí', () => {
  const { history, nav, press } = setup();
  let closed = 0;
  nav.pushLayer(() => { closed++; });
  press();
  assert.equal(closed, 1);
  assert.equal(history.exited, false);
  press();
  assert.equal(history.exited, true);
});

test('varias capas: Atrás cierra primero la de arriba, y la pantalla anterior solo al final', () => {
  const { history, nav, press, shown } = setup();
  nav.screenChanged('calendar');
  const order = [];
  nav.pushLayer(() => order.push('selección'));
  nav.pushLayer(() => order.push('menú'));
  nav.pushLayer(() => order.push('hoja'));
  assert.equal(history.entries.length, 3, 'una sola entrada extra, no una por capa');
  press();
  assert.deepEqual(order, ['hoja']);
  assert.equal(nav.snapshot().layers, 2);
  assert.equal(nav.snapshot().sentinel, true);
  press();
  press();
  assert.deepEqual(order, ['hoja', 'menú', 'selección']);
  assert.deepEqual(shown, []);
  assert.equal(nav.snapshot().screen, 'calendar');
  press();
  assert.deepEqual(shown, ['dashboard']);
});

test('cerrar una capa por sus propios botones no deja entradas sobrantes', () => {
  const { history, nav, press, runTimers } = setup();
  nav.screenChanged('calendar');
  const release = nav.pushLayer(() => {});
  release();
  runTimers();
  assert.equal(history.i, 1);
  assert.equal(nav.snapshot().sentinel, false);
  press();
  assert.equal(nav.snapshot().screen, 'dashboard');
});

test('cerrar una capa y abrir otra en seguida reutiliza la misma entrada', () => {
  const { history, nav, runTimers } = setup();
  const r1 = nav.pushLayer(() => {});
  const before = history.entries.length;
  r1();
  nav.pushLayer(() => {});
  runTimers();
  assert.equal(history.entries.length, before);
  assert.equal(nav.snapshot().sentinel, true);
  assert.equal(nav.snapshot().layers, 1);
});

test('una hoja que se cierra y navega en el mismo instante no se salta pantallas', () => {
  const { history, nav, press, runTimers, shown } = setup();
  nav.screenChanged('more');
  const release = nav.pushLayer(() => {});
  release();                       // la hoja se cierra…
  nav.screenChanged('settings');   // …y lleva a Ajustes
  runTimers();
  assert.deepEqual(history.urls, ['#dashboard', '#more', '#settings']);
  assert.equal(nav.snapshot().sentinel, false);
  press();
  assert.deepEqual(shown, ['more']);
  press();
  assert.deepEqual(shown, ['more', 'dashboard']);
});

test('una capa que sigue abierta al cambiar de pantalla vuelve a tener su entrada', () => {
  const { nav, press, history } = setup();
  nav.pushLayer(() => {});
  nav.screenChanged('calendar');
  assert.equal(nav.snapshot().sentinel, true);
  assert.equal(history.entries.length, 3);
  press();
  assert.equal(nav.snapshot().layers, 0);
  assert.equal(nav.snapshot().screen, 'calendar');
});

test('una capa cuyo cierre falla no rompe Atrás', () => {
  const { nav, press } = setup();
  nav.pushLayer(() => { throw new Error('fallo'); });
  const originalError = console.error;
  console.error = () => {};
  try { press(); } finally { console.error = originalError; }
  assert.equal(nav.snapshot().layers, 0);
});

test('mientras hay una tarea en marcha Atrás no hace nada', () => {
  const { history, nav, press, setBusy, shown } = setup();
  nav.screenChanged('calendar');
  setBusy(true);
  press();
  assert.equal(nav.snapshot().screen, 'calendar');
  assert.deepEqual(shown, []);
  assert.equal(history.i, history.entries.length - 1);
  setBusy(false);
  press();
  assert.deepEqual(shown, ['dashboard']);
});

// ─── Entradas ajenas, Adelante y «Volver» ───

test('una entrada que no es de la app lleva a la pantalla de la URL o a Inicio', () => {
  const a = setup();
  a.nav.screenChanged('calendar');
  a.nav.handlePop(null);
  assert.deepEqual(a.shown, ['dashboard']);

  const b = setup();
  b.nav.screenChanged('calendar');
  b.setHash('#stats');
  b.nav.handlePop(null);
  assert.deepEqual(b.shown, ['stats']);
  assert.equal(b.nav.snapshot().screen, 'stats');
});

test('Adelante hasta una entrada de capa sin capas abiertas la salta', () => {
  const { history, nav, runTimers } = setup();
  nav.screenChanged('calendar');
  nav.pushLayer(() => {});
  history.back(); history.flush();         // Atrás cierra la capa
  runTimers();
  history.go(1); history.flush();           // Adelante: cae en la entrada de capa
  runTimers();
  assert.equal(nav.snapshot().screen, 'calendar');
  assert.equal(history.state.layer, undefined);
});

test('«Volver» hace lo mismo que Atrás', () => {
  const { nav, history, shown } = setup();
  nav.screenChanged('more');
  nav.screenChanged('settings');
  nav.back();
  history.flush();
  assert.deepEqual(shown, ['more']);
});

test('«Volver» sin pantalla anterior sube a la pestaña madre y, en las pestañas, a Inicio', () => {
  const a = setup({ preset: (h) => { h.entries = [{ state: makeEntry('settings', 0), url: '#settings' }]; h.i = 0; } });
  a.nav.boot('settings');
  a.nav.back();
  assert.deepEqual(a.shown, ['more']);

  const b = setup({ preset: (h) => { h.entries = [{ state: makeEntry('more', 0), url: '#more' }]; h.i = 0; } });
  b.nav.boot('more');
  b.nav.back();
  assert.deepEqual(b.shown, ['dashboard']);
});

// ─── Unión con el store ───

function fakeStore(initial = {}) {
  let state = { currentScreen: 'dashboard', contextMenu: null, rangeSelection: null, multiSelect: null, ...initial };
  const listeners = new Set();
  const set = (patch) => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); };
  const Actions = {
    setScreen: (s) => set({ currentScreen: s, contextMenu: null }),
    showContextMenu: (m) => set({ contextMenu: m }),
    hideContextMenu: () => set({ contextMenu: null }),
    setRangeSelection: (r) => set({ rangeSelection: r }),
    setMultiSelect: (m) => set({ multiSelect: m })
  };
  return { getState: () => state, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, Actions };
}

function setupWithStore() {
  const store = fakeStore();
  const env = setup({ store });
  return { ...env, store, run: env.runTimers };
}

test('el menú del día es una capa: Atrás lo cierra y no cambia de pantalla', () => {
  const { store, press, history } = setupWithStore();
  store.Actions.setScreen('calendar');
  store.Actions.showContextMenu({ dateISO: '2026-11-04' });
  assert.equal(history.entries.length, 3);
  press();
  assert.equal(store.getState().contextMenu, null);
  assert.equal(store.getState().currentScreen, 'calendar');
});

test('un cambio de pantalla desde el store crea entrada y Atrás vuelve a la anterior', () => {
  const { store, press, history } = setupWithStore();
  store.Actions.setScreen('stats');
  assert.deepEqual(history.urls, ['#dashboard', '#stats']);
  press();
  assert.equal(store.getState().currentScreen, 'dashboard');
  assert.equal(history.entries.length, 2);
});

test('los modos de selección del calendario son capas y Atrás los cancela', () => {
  const { store, press } = setupWithStore();
  store.Actions.setScreen('calendar');
  store.Actions.setMultiSelect({ active: true, selectedDates: [] });
  press();
  assert.equal(store.getState().multiSelect, null);
  store.Actions.setRangeSelection({ type: 'VACACIONES', startDate: '2026-11-23', endDate: null });
  press();
  assert.equal(store.getState().rangeSelection, null);
  assert.equal(store.getState().currentScreen, 'calendar');
});

test('menú encima de un modo de selección: Atrás cierra el menú y luego la selección', () => {
  const { store, press } = setupWithStore();
  store.Actions.setScreen('calendar');
  store.Actions.setRangeSelection({ type: 'VACACIONES', startDate: '2026-11-23', endDate: null });
  store.Actions.showContextMenu({ dateISO: '2026-11-24' });
  press();
  assert.equal(store.getState().contextMenu, null);
  assert.notEqual(store.getState().rangeSelection, null);
  press();
  assert.equal(store.getState().rangeSelection, null);
});

test('abrir un modo de selección y cerrar el menú a la vez no deja entradas sobrantes', () => {
  const { store, run, history } = setupWithStore();
  store.Actions.setScreen('calendar');
  store.Actions.showContextMenu({ dateISO: '2026-11-04' });
  store.Actions.setRangeSelection({ type: 'VACACIONES', startDate: '2026-11-04', endDate: null });
  store.Actions.hideContextMenu();
  run();
  assert.equal(history.entries.length, 3, 'pantalla + una entrada de capas');
});

test('al salir del calendario se cancela la selección', async () => {
  const { store } = setupWithStore();
  store.Actions.setScreen('calendar');
  store.Actions.setMultiSelect({ active: true, selectedDates: [] });
  store.Actions.setScreen('dashboard');
  await Promise.resolve();
  assert.equal(store.getState().multiSelect, null);
});

test('«Pedir días» desde Inicio (pantalla y luego selección) no se cancela', async () => {
  const { store } = setupWithStore();
  store.Actions.setScreen('calendar');
  store.Actions.setMultiSelect({ active: true, selectedDates: [] });
  await Promise.resolve();
  assert.equal(store.getState().multiSelect.active, true);
});
