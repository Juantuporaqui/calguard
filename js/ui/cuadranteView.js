/**
 * @module ui/cuadranteView
 * Piezas del cuadrante del grupo que no tocan la pantalla (se prueban en
 * tests/cuadranteView.test.js): abreviaturas de las casillas, qué vista sale
 * por defecto, el orden y el filtro de personas, la lista «Hoy / esta semana»
 * (también la usa Jefatura) y el texto de estado.
 */

import { classifyIncWeeks } from '../domain/reconcile.js';
import { getWeekDates } from '../domain/rules.js';
import { displayName } from '../domain/profiles.js';
import { canonicalPerson } from '../domain/groupCuadrante.js';
import { esc } from './utils.js';

/**
 * Abreviatura de cada casilla del cuadrante. Guardia es siempre «GU» (hecha o
 * prevista), asunto propio «AP» y formación «CUR» (curso). Si la columna es
 * estrecha se usa `one`, una sola letra con su color.
 */
export const CQ_CODES = Object.freeze({
  GUARDIA_REAL: { code: 'GU', one: 'G', name: 'Guardia' },
  GUARDIA_PLAN: { code: 'GU', one: 'G', name: 'Guardia' },
  LIBRE: { code: 'L', one: 'L', name: 'Libre' },
  VACACIONES: { code: 'V', one: 'V', name: 'Vacaciones' },
  AP: { code: 'AP', one: 'A', name: 'Asunto propio' },
  TURNO_M: { code: 'M', one: 'M', name: 'Mañana' },
  TURNO_T: { code: 'T', one: 'T', name: 'Tarde' },
  TURNO_N: { code: 'N', one: 'N', name: 'Noche' },
  FORMACION: { code: 'CUR', one: 'C', name: 'Curso' },
  JUICIO: { code: 'J', one: 'J', name: 'Juicio' },
  BAJA: { code: 'B', one: 'B', name: 'Baja' },
  OTRO: { code: '+', one: '+', name: 'Otro' }
});

export function cqCode(type) {
  return CQ_CODES[type] || { code: '?', one: '?', name: String(type ?? '') };
}

export const VIEWS = ['list', 'month', 'week'];

/**
 * Vista con la que se abre: la que eligió (si la guardó) o, si no, la lista en
 * pantallas de menos de 700 px y la tabla del mes en las grandes.
 */
export function defaultView(saved, width) {
  if (VIEWS.includes(saved)) return saved;
  return width < 700 ? 'list' : 'month';
}

/** Mi fila siempre la primera; el resto en el orden del escalafón. */
export function orderRoster(roster, me) {
  if (!me || !roster.includes(me)) return [...roster];
  return [me, ...roster.filter(p => p !== me)];
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Personas cuyo nombre contiene lo buscado (sin mayúsculas ni tildes). */
export function filterRoster(roster, query) {
  const q = norm(query).trim();
  if (!q) return [...roster];
  return roster.filter(p => norm(displayName(p)).includes(q) || norm(p).includes(q));
}

function pad(n) { return String(n).padStart(2, '0'); }
export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `n` días seguidos desde `startISO` (el primero, hoy). */
export function listDates(startISO, n = 7) {
  return Array.from({ length: n }, (_, i) => addDays(startISO, i));
}

/** persona (canónica) → fecha → [tipos] */
export function indexCuadrante(data, escalafon = []) {
  const idx = new Map();
  for (const e of data?.entries || []) {
    const who = canonicalPerson(e.person, escalafon);
    if (!idx.has(who)) idx.set(who, new Map());
    const byDate = idx.get(who);
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    const arr = byDate.get(e.date);
    if (!arr.includes(e.tagType)) arr.push(e.tagType);
  }
  return idx;
}

/**
 * Quién está de guardia cada semana (por su lunes): semanas con INC el fin de
 * semana, más los festivos pegados. Un festivo suelto (p. ej. la jefa) no es guardia.
 * @param {Map<string, Map<string, string[]>>} idx - persona → fecha → tipos
 * @returns {Map<string, string[]>} lunes → personas
 */
export function guardsByWeek(idx, roster) {
  const out = new Map();
  for (const person of roster) {
    const days = [...(idx.get(person) || new Map())]
      .filter(([, types]) => types.includes('GUARDIA_REAL'))
      .map(([dateISO]) => ({ dateISO, tags: [{ type: 'GUARDIA_REAL' }] }));
    for (const monday of classifyIncWeeks(days).guard) {
      if (!out.has(monday)) out.set(monday, []);
      out.get(monday).push(person);
    }
  }
  return out;
}

/**
 * Lo de un día, agrupado: quién está de guardia (los de la semana de guardia
 * y quien tenga guardia ese día), quién libra, vacaciones, etc.
 */
export function dayGroups(iso, idx, roster, weekGuards = new Map()) {
  const at = p => idx.get(p)?.get(iso) || [];
  const monday = getWeekDates(iso)[0];
  const weekly = weekGuards.get(monday) || [];
  const has = t => roster.filter(p => at(p).includes(t));
  const guardia = roster.filter(p => weekly.includes(p) || at(p).includes('GUARDIA_REAL') || at(p).includes('GUARDIA_PLAN'));
  return {
    guardia,
    libres: has('LIBRE'),
    vacaciones: has('VACACIONES'),
    ap: has('AP'),
    baja: has('BAJA'),
    cursos: has('FORMACION'),
    juicio: has('JUICIO'),
    manana: has('TURNO_M'),
    tarde: has('TURNO_T'),
    noche: has('TURNO_N')
  };
}

const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function dayLabel(iso, today) {
  const d = new Date(iso + 'T12:00:00');
  const text = `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (iso === today) return `Hoy · ${text}`;
  if (iso === addDays(today, 1)) return `Mañana · ${text}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ROWS = [
  ['guardia', 'Guardia', 'cq-guardia'],
  ['libres', 'Libres', 'cq-libre'],
  ['vacaciones', 'Vacaciones', 'cq-vacaciones'],
  ['ap', 'Asuntos propios', 'cq-asunto'],
  ['baja', 'Baja', 'cq-baja'],
  ['cursos', 'Cursos', 'cq-formacion'],
  ['juicio', 'Juicio', 'cq-juicio']
];
const SHIFT_ROWS = [
  ['manana', 'Mañana', 'cq-turno-m'],
  ['tarde', 'Tarde', 'cq-turno-t'],
  ['noche', 'Noche', 'cq-turno-n']
];

/**
 * Lista «Hoy / esta semana»: por día, «Guardia: …», «Libres: …»,
 * «Vacaciones: …» (y lo demás si lo hay), con hoy el primero.
 * @param {{dates: string[], idx: Map, roster: string[], weekGuards?: Map, me?: string|null, today: string, withShifts?: boolean}} o
 *   withShifts: también mañana, tarde y noche (al buscar a una persona)
 */
export function whoListHTML({ dates, idx, roster, weekGuards = new Map(), me = null, today, withShifts = false }) {
  const names = list => list.map(p => `<span class="who-name${p === me ? ' who-me' : ''}">${esc(displayName(p))}${p === me ? ' <small>(tú)</small>' : ''}</span>`).join(', ');
  return `<ol class="who-list">${dates.map(iso => {
    const g = dayGroups(iso, idx, roster, weekGuards);
    const lines = [...ROWS, ...(withShifts ? SHIFT_ROWS : [])]
      .filter(([key], i) => i < 3 || g[key].length)
      .map(([key, label, cls]) => `<li class="who-line"><span class="who-label ${cls}">${label}</span><span class="who-names">${g[key].length ? names(g[key]) : '<span class="muted">nadie</span>'}</span></li>`)
      .join('');
    return `<li class="who-day${iso === today ? ' is-today' : ''}" data-day="${iso}">
      <h3 class="who-date">${esc(dayLabel(iso, today))}</h3>
      <ul class="who-lines">${lines}</ul>
    </li>`;
  }).join('')}</ol>`;
}

/**
 * Estado del cuadrante, siempre a la vista.
 * @param {{updatedAt?: string|null, online?: boolean, now?: number}} o
 */
export function statusText({ updatedAt = null, online = true, now = Date.now() } = {}) {
  if (!updatedAt) return online ? 'Sin cuadrante todavía' : 'Sin conexión';
  const d = new Date(updatedAt);
  if (!online) return `Sin conexión: datos del ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  const min = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (min < 1) return 'Actualizado ahora mismo';
  if (min < 60) return `Actualizado hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Actualizado hace ${h} h`;
  const days = Math.round(h / 24);
  return days === 1 ? 'Actualizado ayer' : `Actualizado hace ${days} días`;
}
