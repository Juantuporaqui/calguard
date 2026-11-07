/**
 * @module domain/compensations
 * Días de compensación que NO vienen de una guardia: juicios (medio día cada
 * uno fuera de turno), elecciones, servicios extraordinarios (UDYCO…),
 * eventos (ExpoJove…), el Día del Patrón o cualquier otro motivo.
 *
 *  - Cada uno puede apuntar las suyas en su móvil.
 *  - El administrador (o la jefa, si publica) las apunta para el grupo o para
 *    algunos, y viajan cifradas con el cuadrante.
 *  - Un CH cuya nota dice el motivo («CH elecciones») gasta esa compensación;
 *    si no hay ninguna apuntada, ese CH simplemente no gasta guardias.
 *
 * Puro, sin I/O.
 */

import { normalizeNote } from './notes.js';

/** Motives offered when adding a compensation (key = the concept the notes use). */
export const COMP_KINDS = [
  { key: 'juicio', label: 'Juicio', dias: 0.5, hint: 'medio día por juicio fuera de tu turno' },
  { key: 'elecciones', label: 'Elecciones', dias: 1 },
  { key: 'servicio', label: 'Servicio extraordinario', dias: 1, hint: 'dispositivo, operación UDYCO…' },
  { key: 'evento', label: 'Evento', dias: 1, hint: 'ExpoJove, feria…' },
  { key: 'patron', label: 'Día del Patrón', dias: 1 },
  { key: 'otro', label: 'Otro motivo', dias: 1 }
];

const STOP = new Set(['guardia', 'guardias', 'incidencia', 'incidencias', 'compensacion', 'dias', 'dia', 'para', 'por', 'del', 'los', 'las', 'una']);

function slug(text) {
  return normalizeNote(text).replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean).join('-');
}

/** The concept a compensation counts under (the one CH notes are matched against). */
export function conceptOf(c) {
  if (!c) return '';
  if (c.concepto === 'otro') return c.etiqueta ? `c:${slug(c.etiqueta)}` : 'otro';
  return c.concepto || 'otro';
}

/** Human label of a compensation. */
export function compLabel(c) {
  if (c?.concepto === 'otro' && c.etiqueta) return c.etiqueta;
  return COMP_KINDS.find(k => k.key === c?.concepto)?.label || c?.etiqueta || 'Compensación';
}

/**
 * Custom motives ("otro" with a name) as concepts the notes can name: the CH
 * note must contain one of the name's significant words.
 * @param {Array} comps
 * @returns {Array<{key: string, label: string, words: string[]}>}
 */
export function customConcepts(comps = []) {
  const out = new Map();
  for (const c of comps) {
    if (c?.concepto !== 'otro' || !c.etiqueta) continue;
    const words = normalizeNote(c.etiqueta).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
    if (words.length) out.set(conceptOf(c), { key: conceptOf(c), label: c.etiqueta, words });
  }
  return [...out.values()];
}

/** Group compensations that apply to a person (canonical name). */
export function compsForPerson(groupComps = [], person) {
  const who = String(person || '').toUpperCase();
  return groupComps.filter(c => !c.personas?.length || c.personas.includes('*') || c.personas.map(p => String(p).toUpperCase()).includes(who));
}

/**
 * The person's compensations: the group's ones first; a personal one with the
 * same motive and date is the same compensation (the group's wins).
 */
export function mergeComps(group = [], personal = []) {
  const seen = new Set(group.map(c => `${conceptOf(c)}|${c.fecha}`));
  return [
    ...group.map(c => ({ ...c, origen: 'grupo' })),
    ...personal.filter(c => !seen.has(`${conceptOf(c)}|${c.fecha}`)).map(c => ({ ...c, origen: 'propia' }))
  ].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

const shift = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Per motive, for one year: days received (date arrived), still to come,
 * taken (CH whose note names the motive) and pending. What was granted last
 * year and not taken yet still counts (e.g. elections at the end of November).
 * @param {Array} comps - the person's compensations
 * @param {Map<string, string[]>} taken - concept → dates of the CH taken for it
 * @param {number} year
 * @param {string} today
 */
export function summarizeComps(comps = [], taken = new Map(), year, today) {
  const years = new Set([String(year), String(year - 1)]);
  const byKey = new Map();
  for (const c of comps) {
    if (!c?.fecha || !years.has(String(c.fecha).slice(0, 4))) continue;
    const key = conceptOf(c);
    if (!byKey.has(key)) byKey.set(key, { concepto: key, label: compLabel(c), recibidos: 0, previstos: 0, items: [] });
    const g = byKey.get(key);
    const dias = Math.max(0, Number(c.dias) || 0);
    if (c.fecha <= today) g.recibidos += dias; else g.previstos += dias;
    g.items.push(c);
  }
  const out = [];
  for (const g of byKey.values()) {
    // only days off taken after the compensation (or a few weeks before, in advance)
    const first = g.items.map(c => c.fecha).sort()[0];
    const fechas = (taken.get(g.concepto) || []).filter(d => d >= shift(first, -45) && d >= `${year - 1}-01-01`);
    const disfrutados = fechas.length;
    out.push({ ...g, disfrutados, fechas, pendientes: Math.max(0, g.recibidos - disfrutados) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** 13.5 → "13½", 0.5 → "½". */
export function fmtDias(n) {
  const v = Number(n) || 0;
  const whole = Math.trunc(v);
  const half = Math.abs(v - whole) >= 0.5;
  if (!half) return String(whole);
  if (whole === 0) return v < 0 ? '−½' : '½';
  return `${whole < 0 ? '−' : ''}${Math.abs(whole)}½`;
}
