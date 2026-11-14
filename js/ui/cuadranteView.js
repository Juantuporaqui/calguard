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

// Calendario laboral valenciano, solo como referencia visual en Mes y Lista.
const FESTIVOS_CV = {
  // DOGV 100/2025: https://dogv.gva.es/datos/2025/07/07/pdf/2025_24690_es.pdf
  2026: new Set(['01-01', '01-06', '03-19', '04-03', '04-06', '05-01',
    '06-24', '08-15', '10-09', '10-12', '12-08', '12-25']),
  // DOGV 42/2026 y BOE-A-2026-21254: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-21254
  2027: new Set(['01-01', '01-06', '03-19', '03-26', '03-29', '05-01',
    '10-09', '10-12', '11-01', '12-06', '12-08', '12-25'])
};

export function isCuadranteHoliday(iso) {
  return FESTIVOS_CV[iso.slice(0, 4)]?.has(iso.slice(5)) ?? false;
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
  const guardiaDia = roster.filter(p => at(p).some(t => t === 'GUARDIA_REAL' || t === 'GUARDIA_PLAN'));
  return {
    guardia: roster.filter(p => weekly.includes(p) || guardiaDia.includes(p)),
    guardiaDia,
    guardiaSemanal: roster.filter(p => weekly.includes(p)),
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

const ABSENCE_ROWS = [
  ['libres', 'Libres', 'cq-libre'],
  ['vacaciones', 'Vacaciones', 'cq-vacaciones'],
  ['ap', 'Asuntos propios', 'cq-asunto'],
  ['baja', 'Baja', 'cq-baja']
];
const ACTIVITY_ROWS = [
  ['cursos', 'Cursos', 'cq-formacion'],
  ['juicio', 'Juicio', 'cq-juicio']
];
const ROWS = [['guardia', 'Guardia', 'cq-guardia'], ...ABSENCE_ROWS, ...ACTIVITY_ROWS];
const SHIFT_ROWS = [
  ['manana', 'Mañana', 'cq-turno-m'],
  ['tarde', 'Tarde', 'cq-turno-t'],
  ['noche', 'Noche', 'cq-turno-n']
];

function namesHTML(people, me) {
  return people.map(p => `<span class="who-name${p === me ? ' who-me' : ''}">${esc(displayName(p))}${p === me ? ' <small>(tú)</small>' : ''}</span>`).join(', ');
}

function rowHTML(label, cls, people, me) {
  return `<li class="who-line"><span class="who-label ${esc(cls)}">${esc(label)}</span><span class="who-names">${people.length ? namesHTML(people, me) : '<span class="muted">nadie</span>'}</span></li>`;
}

/** Resumen compacto de Lista y Mes. Cada turno ocupa una línea y solo se muestran las filas con nombres. */
export function compactDayHTML({ iso, idx, roster, weekGuards, me, today, expanded = false }) {
  const g = dayGroups(iso, idx, roster, weekGuards);
  const absent = new Set(ABSENCE_ROWS.flatMap(([key]) => g[key]));
  const working = people => people.filter(p => !absent.has(p));
  const dailyGuard = working(g.guardiaDia);
  const weeklyGuard = g.guardiaSemanal.filter(p => !dailyGuard.includes(p));
  const nextWeek = expanded && iso === today ? weekGuards.get(addDays(getWeekDates(iso)[0], 7)) || [] : [];
  const hasEntry = (p) => idx.get(p)?.get(iso)?.length;
  const dayOfWeek = new Date(iso + 'T12:00:00').getDay();
  const unassigned = expanded && dayOfWeek !== 0 && dayOfWeek !== 6 && roster.some(hasEntry)
    ? roster.filter(p => !hasEntry(p)) : [];
  const lines = [
    ['Guardia', 'cq-guardia', dailyGuard],
    ['Guardia semanal', 'cq-guardia', weeklyGuard],
    ['Guardia próxima semana', 'cq-guardia', nextWeek],
    ...SHIFT_ROWS.map(([key, label, cls]) => [label, cls, working(g[key])]),
    ...ABSENCE_ROWS.map(([key, label, cls]) => [label, cls, g[key]]),
    ...ACTIVITY_ROWS.map(([key, label, cls]) => [label, cls, working(g[key])]),
    ['Otros', '', working(roster.filter(p => idx.get(p)?.get(iso)?.includes('OTRO')))],
    ['Sin turno', '', unassigned]
  ].filter(([, , people]) => people.length);
  return lines.length
    ? `<ul class="who-lines cq-compact-lines">${lines.map(([label, cls, people]) => rowHTML(label, cls, people, me)).join('')}</ul>`
    : '<p class="cq-day-empty">Sin turnos anotados</p>';
}

/**
 * Lista por día, con los turnos en Cuadrante y el resumen de guardias y ausencias en Jefatura.
 * @param {{dates: string[], idx: Map, roster: string[], weekGuards?: Map, me?: string|null, today: string, compact?: boolean}} o
 */
export function whoListHTML({ dates, idx, roster, weekGuards = new Map(), me = null, today, compact = false }) {
  return `<ol class="who-list">${dates.map(iso => {
    const label = esc(dayLabel(iso, today));
    const todayClass = iso === today ? ' is-today' : '';
    if (compact) {
      const day = new Date(iso + 'T12:00:00').getDay();
      const holiday = isCuadranteHoliday(iso);
      const weekend = day === 0 || day === 6 || holiday ? ' cq-list-weekend' : '';
      return `<li class="who-day${todayClass}${weekend}" data-day="${esc(iso)}">
        <h3 class="who-date">${label}${holiday ? ' · festivo' : ''}</h3>
        ${compactDayHTML({ iso, idx, roster, weekGuards, me, today })}
      </li>`;
    }
    const g = dayGroups(iso, idx, roster, weekGuards);
    const lines = ROWS
      .filter(([key], i) => i < 3 || g[key].length)
      .map(([key, label, cls]) => rowHTML(label, cls, g[key], me))
      .join('');
    return `<li class="who-day${todayClass}" data-day="${esc(iso)}">
      <h3 class="who-date">${label}</h3>
      <ul class="who-lines">${lines}</ul>
    </li>`;
  }).join('')}</ol>`;
}

/**
 * Texto de estado del cuadrante.
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
