/**
 * @module ui/router
 * Navegación de CalGuard: tabla única de pantallas y botón Atrás del móvil.
 *
 * Este módulo no toca el DOM al importarse ni usa el store directamente (todo
 * lo que necesita se le pasa), así que se puede probar con un historial falso.
 *
 * Cómo se reparte el historial del navegador:
 *  - Cada pantalla es una entrada: {cg, screen, idx}. `idx` cuenta las pantallas
 *    visitadas desde que se abrió la app; la primera (idx 0) es siempre Inicio.
 *  - Todo lo que se puede cerrar (hoja, menú del día, modo de selección del
 *    calendario, diálogo) es una «capa». Mientras haya alguna abierta existe una
 *    única entrada extra encima de la pantalla (el «centinela»). Atrás gasta el
 *    centinela y cierra la capa de arriba; si quedan más, se vuelve a poner.
 *  - La app solo se cierra con Atrás desde Inicio y sin ninguna capa abierta.
 */

// ─── Tabla única de pantallas ───

/**
 * id: identificador (y trozo de la URL tras la #).
 * title: título de la cabecera.
 * navLabel: nombre en la barra inferior si es distinto del título.
 * tab: pestaña madre; la que se resalta en la barra cuando se está en esta pantalla.
 * inNav: ¿tiene pestaña propia en la barra inferior?
 */
export const SCREENS = Object.freeze([
  { id: 'dashboard', title: 'Inicio', tab: 'dashboard', inNav: true },
  { id: 'calendar', title: 'Calendario', tab: 'calendar', inNav: true },
  { id: 'cuadrante', title: 'Cuadrante del grupo', navLabel: 'Cuadrante', tab: 'cuadrante', inNav: true },
  { id: 'biblioteca', title: 'Biblioteca', tab: 'biblioteca', inNav: true },
  { id: 'more', title: 'Más', tab: 'more', inNav: true },
  { id: 'stats', title: 'Estadísticas', tab: 'more', inNav: false },
  { id: 'registry', title: 'Bitácora de servicios', tab: 'more', inNav: false },
  { id: 'settings', title: 'Ajustes', tab: 'more', inNav: false },
  { id: 'diagnostics', title: 'Diagnóstico', tab: 'more', inNav: false }
]);

export const HOME = 'dashboard';

const BY_ID = new Map(SCREENS.map(s => [s.id, s]));

export const isScreenId = (id) => BY_ID.has(id);
export const getScreen = (id) => BY_ID.get(id) || BY_ID.get(HOME);
export const titleOf = (id) => getScreen(id).title;
export const navLabelOf = (id) => getScreen(id).navLabel || getScreen(id).title;
/** Pestaña que se resalta para esta pantalla. */
export const tabOf = (id) => getScreen(id).tab;
/** Pantallas con pestaña propia, en el orden de la barra. */
export const navScreens = () => SCREENS.filter(s => s.inNav);
/** ¿Es una pantalla de segundo nivel (sin pestaña propia)? Lleva «‹ Volver». */
export const isSubScreen = (id) => !getScreen(id).inNav;

/** Trozo de URL de una pantalla: «#calendar». */
export const hashOf = (id) => '#' + getScreen(id).id;

/**
 * Pantalla que pide una URL (#calendar, #calendar/lo-que-sea, #shared-import).
 * @param {string} [hash]
 * @returns {string|null} null si no corresponde a ninguna
 */
export function screenFromHash(hash) {
  const h = String(hash || '').replace(/^#/, '').split(/[/?]/)[0];
  if (h === 'shared-import') return 'cuadrante'; // destino del «Compartir → CalGuard»
  return isScreenId(h) ? h : null;
}

// ─── Entradas del historial ───

export const makeEntry = (screen, idx, layer = false) => (layer ? { cg: 1, screen, idx, layer: true } : { cg: 1, screen, idx });
export const isEntry = (st) => Boolean(st && st.cg === 1 && isScreenId(st.screen) && Number.isInteger(st.idx));

// ─── Controlador del historial ───

/**
 * @param {Object} deps
 * @param {{state: any, pushState: Function, replaceState: Function, back: Function, go: Function}} deps.history
 * @param {() => string} [deps.readHash] - location.hash actual
 * @param {(id: string) => void} deps.showScreen - cambia de pantalla SIN tocar el historial
 * @param {() => boolean} [deps.isBusy] - ¿hay una tarea que no se puede interrumpir?
 * @param {(fn: Function) => void} [deps.schedule] - ejecuta fn un poco después (por defecto setTimeout 0)
 */
export function createNavigator({ history, readHash = () => '', showScreen, isBusy = () => false, schedule = (fn) => setTimeout(fn, 0) }) {
  let cur = { screen: HOME, idx: 0 };
  let sentinelOn = false;      // ¿hay entrada extra de capas encima de la pantalla?
  let pendingBack = 0;         // history.back() lanzados cuyo popstate aún no ha llegado
  let deferred = [];           // cosas que esperan a que termine un back pendiente
  const layers = [];

  const sync = (st) => { if (isEntry(st)) cur = { screen: st.screen, idx: st.idx }; };

  function flush() {
    const q = deferred; deferred = [];
    q.forEach(fn => fn());
    reconcile();
  }

  /** Deja el historial coherente con las capas abiertas. */
  function reconcile() {
    if (pendingBack > 0) return;
    if (layers.length > 0 && !sentinelOn) {
      history.pushState(makeEntry(cur.screen, cur.idx, true), '', hashOf(cur.screen));
      sentinelOn = true;
    } else if (layers.length === 0 && sentinelOn) {
      // Un poco después: si justo se abre otra capa o se cambia de pantalla, no hace falta quitarla
      schedule(removeSentinelIfIdle);
    }
  }

  function removeSentinelIfIdle() {
    if (layers.length === 0 && sentinelOn && pendingBack === 0) {
      sentinelOn = false;
      pendingBack++;
      history.back();
    }
  }

  /**
   * Arranque: deja el historial listo y devuelve la pantalla que hay que mostrar.
   * Si se abre directamente una pantalla que no es Inicio (un acceso directo),
   * Inicio queda debajo para que Atrás vaya a Inicio y no cierre la app.
   * @param {string|null} urlScreen - pantalla pedida por la URL, si la hay
   * @returns {string}
   */
  function boot(urlScreen) {
    const st = history.state;
    if (isEntry(st)) {
      cur = { screen: st.screen, idx: st.idx };
      if (st.layer) {
        // Recarga con una capa abierta: la capa ya no existe, se quita su entrada
        pendingBack++;
        history.back();
        return cur.screen;
      }
      if (urlScreen && urlScreen !== cur.screen) {
        cur = { screen: urlScreen, idx: st.idx };
        history.replaceState(makeEntry(cur.screen, cur.idx), '', hashOf(cur.screen));
      }
      return cur.screen;
    }
    const screen = urlScreen || HOME;
    history.replaceState(makeEntry(HOME, 0), '', hashOf(HOME));
    cur = { screen: HOME, idx: 0 };
    if (screen !== HOME) {
      history.pushState(makeEntry(screen, 1), '', hashOf(screen));
      cur = { screen, idx: 1 };
    }
    return screen;
  }

  /** La app ha cambiado de pantalla por su cuenta (toque en la barra, un botón…). */
  function screenChanged(id) {
    if (id === cur.screen) return;
    if (pendingBack > 0) { deferred.push(() => screenChanged(id)); return; }
    const next = makeEntry(id, cur.idx + 1);
    if (sentinelOn) {
      // La entrada extra pasa a ser la de la nueva pantalla (p. ej. una hoja que se cierra y navega)
      history.replaceState(next, '', hashOf(id));
      sentinelOn = false;
    } else {
      history.pushState(next, '', hashOf(id));
    }
    cur = { screen: id, idx: next.idx };
    reconcile();
  }

  /**
   * Registra algo cerrable (hoja, menú, modo de selección, diálogo).
   * @param {() => void} close - lo que cierra esa capa
   * @returns {() => void} release - avisar de que la capa ya se cerró por otro camino
   */
  function pushLayer(close) {
    const layer = { close };
    layers.push(layer);
    reconcile();
    return () => {
      const i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
      reconcile();
    };
  }

  /** popstate: el usuario ha pulsado Atrás (o Adelante) o ha cambiado la URL. */
  function handlePop(state) {
    if (pendingBack > 0) { // es el back que lanzamos nosotros
      pendingBack--;
      sync(state);
      flush();
      return;
    }
    if (isBusy()) { // algo en marcha que no se puede interrumpir: se queda donde estaba
      history.pushState(makeEntry(cur.screen, cur.idx, sentinelOn), '', hashOf(cur.screen));
      return;
    }
    if (layers.length > 0) { // 1) cerrar lo que esté abierto
      const top = layers.pop();
      sentinelOn = false; // el navegador ya se ha comido la entrada extra
      sync(state);
      try { top.close(); } catch (err) { console.error('No se pudo cerrar la capa:', err); }
      reconcile();
      return;
    }
    if (isEntry(state)) {
      if (state.layer) { // Adelante hasta una entrada de capas sin capas: se salta
        pendingBack++;
        history.back();
        return;
      }
      // 2) volver a la pantalla anterior
      sync(state);
      showScreen(state.screen);
      return;
    }
    // 3) una entrada que no es nuestra (URL escrita a mano…): a la pantalla de la URL o a Inicio
    const target = screenFromHash(readHash()) || HOME;
    history.replaceState(makeEntry(target, 0), '', hashOf(target));
    cur = { screen: target, idx: 0 };
    showScreen(target);
  }

  /**
   * «‹ Volver» de la cabecera: igual que Atrás. Si no hay pantalla anterior,
   * sube a la pestaña madre (o a Inicio).
   */
  function back() {
    if (cur.idx > 0 || layers.length > 0) { history.back(); return; }
    const up = tabOf(cur.screen);
    const target = up !== cur.screen ? up : HOME;
    history.replaceState(makeEntry(target, 0), '', hashOf(target));
    cur = { screen: target, idx: 0 };
    showScreen(target);
  }

  const snapshot = () => ({ screen: cur.screen, idx: cur.idx, layers: layers.length, sentinel: sentinelOn, pendingBack });

  return { boot, screenChanged, pushLayer, handlePop, back, snapshot };
}

// ─── Unión con el store ───

/**
 * Conecta el navegador con el store: los cambios de pantalla, el menú del día y
 * los modos de selección del calendario pasan a ser historial y capas.
 * Al salir del calendario se cancelan sus modos de selección.
 * @param {ReturnType<typeof createNavigator>} nav
 * @param {{getState: Function, subscribe: Function, Actions: Object}} store
 * @returns {Function} desuscribir
 */
export function bindStore(nav, { getState, subscribe, Actions }) {
  let lastScreen = getState().currentScreen;
  const releases = { menu: null, range: null, multi: null };

  const track = (key, active, close) => {
    if (active && !releases[key]) {
      releases[key] = nav.pushLayer(close);
    } else if (!active && releases[key]) {
      const release = releases[key];
      releases[key] = null;
      release();
    }
  };

  const apply = (s) => {
    if (s.currentScreen !== lastScreen) {
      const left = lastScreen;
      lastScreen = s.currentScreen;
      nav.screenChanged(s.currentScreen);
      if (left === 'calendar') {
        queueMicrotask(() => {
          const now = getState();
          if (now.currentScreen === 'calendar') return;
          if (now.multiSelect) Actions.setMultiSelect(null);
          if (now.rangeSelection) Actions.setRangeSelection(null);
        });
      }
    }
    track('menu', Boolean(s.contextMenu), () => Actions.hideContextMenu());
    track('range', Boolean(s.rangeSelection), () => Actions.setRangeSelection(null));
    track('multi', Boolean(s.multiSelect && s.multiSelect.active), () => Actions.setMultiSelect(null));
  };

  apply(getState());
  return subscribe(apply);
}

// ─── Instancia de la app ───

let active = null;

/** Registra el navegador que usan las hojas y la cabecera (lo llama app.js). */
export function setNavigator(nav) { active = nav; }

/** Registra una capa cerrable con Atrás. Sin navegador activo no hace nada. */
export function pushLayer(close) {
  return active ? active.pushLayer(close) : () => {};
}

/** Volver a la pantalla anterior (el «‹ Volver» de la cabecera). */
export function goBack() { active?.back(); }
