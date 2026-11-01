/**
 * @module state/store
 * Central state management using a simple reducer pattern.
 * Single source of truth for the application.
 *
 * Derived state: `balances` (saldos completos del año) and `counters` (vista
 * plana) are recomputed automatically after every action that changes days,
 * ledger, config or the active profile. No caller has to remember to recalc.
 */

import { computeBalances, countersFromBalances } from '../domain/balances.js';

/** @typedef {'dashboard'|'calendar'|'cuadrante'|'registry'|'stats'|'settings'|'diagnostics'} Screen */

/**
 * Per-person settings live in profile.settings and override the global
 * config: each funcionario has their own quotas and carry-over.
 */
export const PERSONAL_KEYS = ['asuntosAnuales', 'vacacionesAnuales', 'carryovers'];

const now = new Date();

const DEFAULT_CONFIG = {
  diasPorGuardia: 5,
  asuntosAnuales: 8,
  vacacionesAnuales: 25,
  // Manual carry-over from the previous year, keyed by accounting year:
  // { '2026': { libres, ap, vacaciones, primerLibre, primerAP, primerVac } }
  carryovers: {},
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
  ],
  // Escalafón actual de la brigada: ordena el cuadrante grupal y filtra para
  // ocultar a quien ya no trabaja en la brigada.
  escalafonOrder: ['TESA', 'RAFAEL', 'CARMEN', 'MARIO', 'JUAN', 'REINOSO', 'NURIA']
};

const initialState = {
  activeProfileId: null,
  activeProfile: null,
  profiles: [],
  currentScreen: 'dashboard',
  calendarYear: now.getFullYear(),
  calendarMonth: now.getMonth(),
  calendarView: 'month', // 'week' | 'month' | 'year'
  calendarWeekAnchor: null, // ISO date inside the visible week (null = today)
  days: [],
  ledger: [],
  services: [],
  config: DEFAULT_CONFIG,
  balances: null,
  counters: null,
  locked: false,
  themePreference: 'auto', // 'auto' | 'light' | 'dark'
  darkMode: false,         // resolved value (kept for compatibility)
  contextMenu: null,
  toast: null,             // { text, actionLabel? }
  loading: true,
  updateAvailable: false,
  rangeSelection: null,    // { type, startDate, endDate }
  multiSelect: null,       // { active, selectedDates: [] }
  busy: null               // text of a long-running operation, or null
};

let state = withDerived(initialState);

/** @type {Set<Function>} */
const listeners = new Set();

/**
 * Effective configuration: global config overridden by the active
 * profile's personal settings (quotas, carry-over).
 * @param {Object} [s]
 */
export function effectiveConfig(s = state) {
  const personal = s.activeProfile?.settings || {};
  const merged = { ...s.config };
  for (const k of PERSONAL_KEYS) {
    if (personal[k] !== undefined && personal[k] !== null) merged[k] = personal[k];
  }
  return merged;
}

function withDerived(s) {
  const balances = computeBalances(s.days, s.ledger, effectiveConfig(s));
  return { ...s, balances, counters: countersFromBalances(balances) };
}

const DERIVED_TRIGGERS = new Set([
  'SET_PROFILE', 'SET_DATA', 'SET_DAYS', 'UPDATE_DAY', 'REMOVE_DAY_TAG',
  'SET_LEDGER', 'ADD_LEDGER', 'REMOVE_LEDGER', 'SET_CONFIG', 'REFRESH_DERIVED'
]);

/**
 * Get current state (treat as read-only)
 * @returns {Readonly<typeof initialState>}
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
  let next = reducer(state, type, payload);
  if (next !== prev && DERIVED_TRIGGERS.has(type)) next = withDerived(next);
  state = next;
  if (state !== prev) notifyListeners();
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

function upsertDay(days, day) {
  const idx = days.findIndex(d => d.dateISO === day.dateISO && d.profileId === day.profileId);
  const next = [...days];
  const empty = !day.tags || day.tags.length === 0;
  if (idx >= 0) {
    if (empty) next.splice(idx, 1); else next[idx] = day;
  } else if (!empty) {
    next.push(day);
  }
  return next;
}

/**
 * Pure reducer
 */
function reducer(s, type, payload) {
  switch (type) {
    case 'SET_PROFILE':
      return { ...s, activeProfileId: payload.id, activeProfile: payload };

    case 'SET_PROFILES':
      return { ...s, profiles: payload };

    case 'SET_DATA': // one-shot swap of the active profile's data (no flicker)
      return {
        ...s,
        days: payload.days ?? s.days,
        ledger: payload.ledger ?? s.ledger,
        services: payload.services ?? s.services
      };

    case 'SET_SCREEN':
      return { ...s, currentScreen: payload, contextMenu: null };

    case 'SET_YEAR':
      return { ...s, calendarYear: payload };

    case 'SET_MONTH':
      return { ...s, calendarMonth: payload };

    case 'SET_CALENDAR_VIEW':
      return { ...s, calendarView: payload };

    case 'SET_WEEK_ANCHOR':
      return { ...s, calendarWeekAnchor: payload };

    case 'SET_DAYS':
      return { ...s, days: payload };

    case 'UPDATE_DAY':
      return { ...s, days: upsertDay(s.days, payload) };

    case 'REMOVE_DAY_TAG': {
      const { dateISO, profileId, tagType } = payload;
      const day = s.days.find(d => d.dateISO === dateISO && d.profileId === profileId);
      if (!day) return s;
      return { ...s, days: upsertDay(s.days, { ...day, tags: day.tags.filter(t => t.type !== tagType) }) };
    }

    case 'SET_LEDGER':
      return { ...s, ledger: payload };

    case 'ADD_LEDGER':
      return { ...s, ledger: [...s.ledger, payload] };

    case 'REMOVE_LEDGER':
      return { ...s, ledger: s.ledger.filter(m => m.id !== payload) };

    case 'SET_SERVICES':
      return { ...s, services: payload };

    case 'ADD_SERVICE':
      return { ...s, services: [...s.services, payload] };

    case 'REMOVE_SERVICE':
      return { ...s, services: s.services.filter(sv => sv.id !== payload) };

    case 'SET_CONFIG':
      return { ...s, config: { ...s.config, ...payload } };

    case 'REFRESH_DERIVED':
      return { ...s };

    case 'SET_LOCKED':
      return { ...s, locked: payload };

    case 'SET_THEME':
      return { ...s, themePreference: payload.preference, darkMode: payload.dark };

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

    case 'SET_BUSY':
      return { ...s, busy: payload };

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

// ─── Toast with optional action (e.g. "Deshacer") ───
let toastTimer = null;
let toastAction = null;

/** Handler of the visible toast's action button, if any. */
export function runToastAction() {
  const fn = toastAction;
  toastAction = null;
  clearTimeout(toastTimer);
  dispatch('HIDE_TOAST');
  if (fn) Promise.resolve().then(fn).catch(err => console.error('Toast action failed:', err));
}

// Actions namespace
export const Actions = {
  setProfile: (p) => dispatch('SET_PROFILE', p),
  setProfiles: (list) => dispatch('SET_PROFILES', list),
  setData: (data) => dispatch('SET_DATA', data),
  setScreen: (s) => dispatch('SET_SCREEN', s),
  setYear: (y) => dispatch('SET_YEAR', y),
  setMonth: (m) => dispatch('SET_MONTH', m),
  setCalendarView: (v) => dispatch('SET_CALENDAR_VIEW', v),
  setWeekAnchor: (d) => dispatch('SET_WEEK_ANCHOR', d),
  setDays: (d) => dispatch('SET_DAYS', d),
  updateDay: (d) => dispatch('UPDATE_DAY', d),
  removeDayTag: (dateISO, profileId, tagType) => dispatch('REMOVE_DAY_TAG', { dateISO, profileId, tagType }),
  setLedger: (l) => dispatch('SET_LEDGER', l),
  addLedger: (m) => dispatch('ADD_LEDGER', m),
  removeLedger: (id) => dispatch('REMOVE_LEDGER', id),
  setServices: (s) => dispatch('SET_SERVICES', s),
  addService: (s) => dispatch('ADD_SERVICE', s),
  removeService: (id) => dispatch('REMOVE_SERVICE', id),
  /** @deprecated counters are derived automatically; kept as a refresh hook */
  setCounters: () => dispatch('REFRESH_DERIVED'),
  refreshDerived: () => dispatch('REFRESH_DERIVED'),
  setConfig: (c) => dispatch('SET_CONFIG', c),
  setLocked: (l) => dispatch('SET_LOCKED', l),
  setTheme: (preference, dark) => dispatch('SET_THEME', { preference, dark }),
  setDarkMode: (d) => dispatch('SET_DARK_MODE', d),
  showContextMenu: (m) => dispatch('SHOW_CONTEXT_MENU', m),
  hideContextMenu: () => dispatch('HIDE_CONTEXT_MENU'),
  /**
   * @param {string} text
   * @param {{actionLabel?: string, onAction?: Function, duration?: number}} [opts]
   */
  showToast: (text, opts = {}) => {
    clearTimeout(toastTimer);
    toastAction = opts.onAction || null;
    dispatch('SHOW_TOAST', { text: String(text), actionLabel: opts.onAction ? (opts.actionLabel || 'Deshacer') : null });
    const duration = opts.duration || (opts.onAction ? 6000 : 3200);
    toastTimer = setTimeout(() => { toastAction = null; dispatch('HIDE_TOAST'); }, duration);
  },
  setLoading: (l) => dispatch('SET_LOADING', l),
  setBusy: (text) => dispatch('SET_BUSY', text),
  setUpdateAvailable: (v) => dispatch('SET_UPDATE_AVAILABLE', v),
  setRangeSelection: (r) => dispatch('SET_RANGE_SELECTION', r),
  setMultiSelect: (m) => dispatch('SET_MULTI_SELECT', m)
};
