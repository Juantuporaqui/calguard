/**
 * @module ui/weekStrip
 * La tira «Esta semana» de Inicio: varias semanas seguidas (de lunes a domingo)
 * que se deslizan de lado. Funciones puras, sin DOM.
 */

import { getWeekDates } from '../domain/rules.js';

/** Semanas que lleva la tira: la actual y las siguientes. */
export const STRIP_WEEKS = 5;

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * @param {string} todayISO
 * @param {number} [count]
 * @returns {Array<{index: number, monday: string, days: string[]}>} la semana de hoy y las siguientes
 */
export function stripWeeks(todayISO, count = STRIP_WEEKS) {
  const monday = getWeekDates(todayISO)[0];
  return Array.from({ length: count }, (_, index) => {
    const m = addDays(monday, 7 * index);
    return { index, monday: m, days: getWeekDates(m) };
  });
}

/**
 * Qué semana se ve al deslizar.
 * @param {number} scrollLeft - desplazamiento actual de la tira
 * @param {number} weekStep - lo que ocupa una semana entera, en píxeles
 * @param {number} [count]
 */
export function weekIndexAt(scrollLeft, weekStep, count = STRIP_WEEKS) {
  if (!(weekStep > 0)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / weekStep)));
}

/**
 * Título de la tira según la semana que se ve.
 * @param {number} index
 * @param {string} monday - lunes de esa semana (ISO)
 * @param {(iso: string) => string} fmt - cómo se escribe una fecha corta («14 dic»)
 */
export function weekLabel(index, monday, fmt) {
  if (index === 0) return 'Esta semana';
  if (index === 1) return 'Semana que viene';
  return `Semana del ${fmt(monday)}`;
}
