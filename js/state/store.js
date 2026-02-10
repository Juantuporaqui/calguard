/**
 * @module state/store
 * Central state management using a simple reducer pattern.
 * Single source of truth for the application.
 */

/** @typedef {'dashboard'|'calendar'|'registry'|'stats'|'settings'|'diagnostics'} Screen */

/**
 * @typedef {Object} AppState
 * @property {string|null} activeProfileId
 * @property {Object|null} activeProfile
 * @property {Screen} currentScreen
 * @property {number} calendarYear
 * @property {number} calendarMonth - 0-11, -1 means full year
 * @property {Object} counters
 * @property {Array} days
 * @property {Array} ledger
 * @property {Array} services
 * @property {Object} config
 * @property {boolean} locked
 * @property {boolean} darkMode
 * @property {Object|null} contextMenu
 * @property {string|null} toast
 * @property {boolean} loading
 */

const now = new Date();

/** @type {AppState} */
const initialState = {
  activeProfileId: null,
  activeProfile: null,
  currentScreen: 'dashboard',
  calendarYear: now.getFullYear(),
  calendarMonth: now.getMonth(),
  counters: {
    libresAcumulados: 0,
    asuntosPropios: 8,
    vacaciones: 25,
    libresGastados: 0,
    guardiasRealizadas: 0,
    guardiasPlanificadas: 0
  },
  days: [],         // Array of Day records from DB
  ledger: [],       // Array of LedgerMovement records
  services: [],     // Array of ServiceLog records
  config: {
    diasPorGuardia: 5,
    asuntosAnuales: 8,
    vacacionesAnuales: 25,
    cicloGuardia: 'semanal',
    excludeWeekendsVacation: true,
    autoLockMinutes: 5,
    pinHash: null,
    secureMode: false,
    serviceTypes: [
      'Inspección Ocular', 'Levantamiento', 'Laboratorio', 'Incendio',
      'Homicidio', 'Robo', 'Explosivos', 'Inspección Vehículo',
      'Reseña', 'Documentoscopia', 'Balística', 'Informática Forense', 'Otro'
    ],
    serviceTags: [
      'urgente', 'incendio', 'violencia', 'explosivos', 'drogas',
      'armas', 'accidente', 'judicial', 'formación'
    ]
  },
  locked: false,
  darkMode: false,
  contextMenu: null,
  toast: null,
  loading: true,
  updateAvailable: false,
  // Range selection state
  rangeSelection: null, // { type, startDate, endDate }
  // Multi-select state for requesting days off
  multiSelect: null // { active, selectedDates: [] }
};

/** @type {AppState} */
let state = { ...initialState };

/** @type {Set<Function>} */
const listeners = new Set();

/**
 * Get current state (read-only copy)
 * @returns {AppState}
 */
export function getState() {
  return state;
}

/**
 * Dispatch an action to modify state
 * @param {string} type
 * @param {*} payload
 */
export function dispatch(type, payload) {
  const prev = state;
  state = reducer(state, type, payload);
  if (state !== prev) {
    notifyListeners();
  }
}

/**
 * Subscribe to state changes
 * @param {Function} fn
 * @returns {Function} unsubscribe
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  for (const fn of listeners) {
    try { fn(state); } catch (e) { console.error('Store listener error:', e); }
  }
}

/**
 * Pure reducer
 */
function reducer(s, type, payload) {
  switch (type) {
    case 'SET_PROFILE':
      return { ...s, activeProfileId: payload.id, activeProfile: payload };

    case 'SET_SCREEN':
      return { ...s, currentScreen: payload, contextMenu: null };

    case 'SET_YEAR':
      return { ...s, calendarYear: payload };

    case 'SET_MONTH':
      return { ...s, calendarMonth: payload };

    case 'SET_DAYS':
      return { ...s, days: payload };

    case 'UPDATE_DAY': {
      const idx = s.days.findIndex(d => d.dateISO === payload.dateISO && d.profileId === payload.profileId);
      const newDays = [...s.days];
      if (idx >= 0) {
        newDays[idx] = payload;
      } else {
        newDays.push(payload);
      }
      return { ...s, days: newDays };
    }

    case 'REMOVE_DAY_TAG': {
      const { dateISO, profileId, tagType } = payload;
      const dayIdx = s.days.findIndex(d => d.dateISO === dateISO && d.profileId === profileId);
      if (dayIdx < 0) return s;
      const day = { ...s.days[dayIdx] };
      day.tags = day.tags.filter(t => t.type !== tagType);
      const newDays = [...s.days];
      if (day.tags.length === 0) {
        newDays.splice(dayIdx, 1);
      } else {
        newDays[dayIdx] = day;
      }
      return { ...s, days: newDays };
    }

    case 'SET_LEDGER':
      return { ...s, ledger: payload };

    case 'ADD_LEDGER': {
      return { ...s, ledger: [...s.ledger, payload] };
    }

    case 'REMOVE_LEDGER': {
      return { ...s, ledger: s.ledger.filter(m => m.id !== payload) };
    }

    case 'SET_SERVICES':
      return { ...s, services: payload };

    case 'ADD_SERVICE':
      return { ...s, services: [...s.services, payload] };

    case 'REMOVE_SERVICE':
      return { ...s, services: s.services.filter(sv => sv.id !== payload) };

    case 'SET_COUNTERS':
      return { ...s, counters: { ...s.counters, ...payload } };

    case 'SET_CONFIG':
      return { ...s, config: { ...s.config, ...payload } };

    case 'SET_LOCKED':
      return { ...s, locked: payload };

    case 'SET_DARK_MODE':
      return { ...s, darkMode: payload };

    case 'SHOW_CONTEXT_MENU':
      return { ...s, contextMenu: payload };

    case 'HIDE_CONTEXT_MENU':
      return { ...s, contextMenu: null };

    case 'SHOW_TOAST':
      return { ...s, toast: payload };

    case 'HIDE_TOAST':
      return { ...s, toast: null };

    case 'SET_LOADING':
      return { ...s, loading: payload };

    case 'SET_UPDATE_AVAILABLE':
      return { ...s, updateAvailable: payload };

    case 'SET_RANGE_SELECTION':
      return { ...s, rangeSelection: payload };

    case 'SET_MULTI_SELECT':
      return { ...s, multiSelect: payload };

    default:
      return s;
  }
}

// Actions namespace
export const Actions = {
  setProfile: (p) => dispatch('SET_PROFILE', p),
  setScreen: (s) => dispatch('SET_SCREEN', s),
  setYear: (y) => dispatch('SET_YEAR', y),
  setMonth: (m) => dispatch('SET_MONTH', m),
  setDays: (d) => dispatch('SET_DAYS', d),
  updateDay: (d) => dispatch('UPDATE_DAY', d),
  removeDayTag: (dateISO, profileId, tagType) => dispatch('REMOVE_DAY_TAG', { dateISO, profileId, tagType }),
  setLedger: (l) => dispatch('SET_LEDGER', l),
  addLedger: (m) => dispatch('ADD_LEDGER', m),
  removeLedger: (id) => dispatch('REMOVE_LEDGER', id),
  setServices: (s) => dispatch('SET_SERVICES', s),
  addService: (s) => dispatch('ADD_SERVICE', s),
  removeService: (id) => dispatch('REMOVE_SERVICE', id),
  setCounters: (c) => dispatch('SET_COUNTERS', c),
  setConfig: (c) => dispatch('SET_CONFIG', c),
  setLocked: (l) => dispatch('SET_LOCKED', l),
  setDarkMode: (d) => dispatch('SET_DARK_MODE', d),
  showContextMenu: (m) => dispatch('SHOW_CONTEXT_MENU', m),
  hideContextMenu: () => dispatch('HIDE_CONTEXT_MENU'),
  showToast: (msg) => {
    dispatch('SHOW_TOAST', msg);
    setTimeout(() => dispatch('HIDE_TOAST'), 3000);
  },
  setLoading: (l) => dispatch('SET_LOADING', l),
  setUpdateAvailable: (v) => dispatch('SET_UPDATE_AVAILABLE', v),
  setRangeSelection: (r) => dispatch('SET_RANGE_SELECTION', r),
  setMultiSelect: (m) => dispatch('SET_MULTI_SELECT', m)
};
