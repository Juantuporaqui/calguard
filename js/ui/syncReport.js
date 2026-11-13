/**
 * @module ui/syncReport
 * Qué ha cambiado en tu calendario al actualizar con el cuadrante: cuántos
 * días y, si te han movido una guardia, de qué semana a cuál. Funciones puras:
 * comparan los días de antes y de después, sin tocar los cálculos.
 */

import { getWeekDates } from '../domain/rules.js';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmt = (iso) => { const x = new Date(iso + 'T12:00:00'); return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`; };

/** Lo que importa de un día para saber si ha cambiado: sus tipos y datos, en orden estable. */
function dayKey(day) {
  return JSON.stringify((day?.tags || []).map(t => [t.type, t.meta || null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

/** Lunes de las semanas con guardia hecha. */
function guardWeeks(days) {
  const out = new Set();
  for (const d of days || []) if ((d.tags || []).some(t => t.type === 'GUARDIA_REAL')) out.add(getWeekDates(d.dateISO)[0]);
  return out;
}

/**
 * @param {Array<{dateISO: string, tags: Array}>} before
 * @param {Array<{dateISO: string, tags: Array}>} after
 * @returns {{changed: string[], moves: Array<{from: string, to: string}>, added: string[], removed: string[]}}
 *   changed: días que han cambiado; moves: guardias que pasan de una semana a otra (lunes);
 *   added/removed: semanas de guardia nuevas o quitadas que no se emparejan.
 */
export function diffDays(before = [], after = []) {
  const a = new Map(before.map(d => [d.dateISO, d]));
  const b = new Map(after.map(d => [d.dateISO, d]));
  const changed = [];
  for (const iso of new Set([...a.keys(), ...b.keys()])) {
    if (dayKey(a.get(iso)) !== dayKey(b.get(iso))) changed.push(iso);
  }
  changed.sort();

  const wa = guardWeeks(before), wb = guardWeeks(after);
  const removed = [...wa].filter(m => !wb.has(m)).sort();
  const added = [...wb].filter(m => !wa.has(m)).sort();
  // emparejadas por orden: la primera quitada pasa a la primera nueva, etc.
  const n = Math.min(removed.length, added.length);
  const moves = Array.from({ length: n }, (_, i) => ({ from: removed[i], to: added[i] }));
  return { changed, moves, added: added.slice(n), removed: removed.slice(n) };
}

/** «Sin cambios», «1 día actualizado», «3 días actualizados». */
export function changedDaysText(n) {
  if (!n) return 'Sin cambios';
  return n === 1 ? '1 día actualizado' : `${n} días actualizados`;
}

/**
 * Frases de los cambios de guardia, una por cambio:
 * «Tu guardia del 8 dic pasa al 15 dic», «Nueva guardia: semana del 15 dic»,
 * «Ya no tienes la guardia del 8 dic».
 */
export function guardChangeTexts({ moves = [], added = [], removed = [] } = {}) {
  return [
    ...moves.map(m => `Tu guardia del ${fmt(m.from)} pasa al ${fmt(m.to)}`),
    ...added.map(m => `Nueva guardia: semana del ${fmt(m)}`),
    ...removed.map(m => `Ya no tienes la guardia del ${fmt(m)}`)
  ];
}
