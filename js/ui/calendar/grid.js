/**
 * @module ui/calendar/grid
 * Cuentas del calendario sin DOM: a qué día lleva cada tecla, títulos del
 * periodo y rangos. Se prueban en tests/calendarGrid.test.js.
 */

import { getWeekDates } from '../../domain/rules.js';

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (iso) => new Date(iso + 'T12:00:00');

/** El día `n` días después (o antes, si es negativo). */
export function stepDate(iso, n) {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** El mismo día `n` meses después; si no existe (31 → febrero), el último del mes. */
export function stepMonth(iso, n) {
  const d = parse(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

/**
 * Día al que lleva una tecla en la rejilla del calendario.
 * Flechas: un día a los lados; arriba/abajo, una semana (en la vista semana, un día).
 * Inicio/Fin: lunes/domingo de esa semana. RePág/AvPág: un mes.
 * @returns {string|null} null si la tecla no mueve
 */
export function keyTarget(iso, key, view = 'month') {
  const vertical = view === 'week' ? 1 : 7;
  switch (key) {
    case 'ArrowLeft': return stepDate(iso, -1);
    case 'ArrowRight': return stepDate(iso, 1);
    case 'ArrowUp': return stepDate(iso, -vertical);
    case 'ArrowDown': return stepDate(iso, vertical);
    case 'Home': return getWeekDates(iso)[0];
    case 'End': return getWeekDates(iso)[6];
    case 'PageUp': return stepMonth(iso, -1);
    case 'PageDown': return stepMonth(iso, 1);
    default: return null;
  }
}

/** Título del periodo: «Noviembre 2026», «9–15 nov 2026», «2026». */
export function periodTitle(view, year, month, weekDates = []) {
  if (view === 'year') return String(year);
  if (view === 'week' && weekDates.length) {
    const a = parse(weekDates[0]), b = parse(weekDates[6]);
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
      : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${MONTHS[month]} ${year}`;
}

/** Fecha corta: «23 nov». */
export const shortDate = (iso) => `${parse(iso).getDate()} ${MONTHS_SHORT[parse(iso).getMonth()]}`;

/** Todos los días de un rango, ordenando los extremos si vienen al revés. */
export function rangeDates(a, b) {
  const [start, end] = a <= b ? [a, b] : [b, a];
  const out = [];
  for (let d = start; d <= end; d = stepDate(d, 1)) out.push(d);
  return out;
}

/** Si no trabajas ese día (libre, asunto propio, vacaciones o baja), no tienes turno. */
const AUSENCIAS = ['LIBRE', 'AP', 'VACACIONES', 'BAJA'];
const TURNOS = ['TURNO_M', 'TURNO_T', 'TURNO_N'];
/** Etiquetas que se quedan al añadir `type`: fuera la del mismo tipo y, si es una ausencia, los turnos. */
export function keepCompatible(tags, type) {
  return tags.filter(t => t.type !== type && !(AUSENCIAS.includes(type) && TURNOS.includes(t.type)));
}
