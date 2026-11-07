/**
 * @module domain/notes
 * Las NOTAS de las casillas del Excel (comentarios de celda) explican la
 * contabilidad mejor que el orden de los días:
 *  - «CH incid 9-15 marzo. Día 3º» → ese CH compensa la guardia del 9-15 marzo;
 *  - «CH juicio PA 227/25», «CH Elecciones», «CH Expojove Día 2º» → ese CH es
 *    por otro motivo y no gasta días de ninguna guardia;
 *  - «AP 2025, 3º», «día 22 vac 2025» → ese día es del cupo del año anterior.
 *
 * Todo es puro (sin I/O). Si una nota no se entiende, se ignora y la cuenta
 * sigue como siempre (cada libre a la guardia más antigua con días).
 */

import { classifyIncWeeks, addDaysISO, hasFestivoRate, guardYear, planLedgerFromDays } from './reconcile.js';
import { getWeekDates, isWeekend } from './rules.js';

const MONTHS = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agos: 8, agosto: 8,
  sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12
};

/** Reasons other than a guard that the group writes on a CH. */
export const NOTE_CONCEPTS = [
  { key: 'juicio', label: 'Juicios', re: /juicio|juzgado|audiencia|\bpenal\b|deber inexcusable/ },
  { key: 'elecciones', label: 'Elecciones', re: /eleccion/ },
  { key: 'evento', label: 'Eventos', re: /expo ?jove|\bferia\b|\bevento\b/ },
  { key: 'patron', label: 'Día del Patrón', re: /\bpatron\b/ },
  { key: 'servicio', label: 'Servicios extraordinarios', re: /udyco|dispositivo|\boperacion|\bop\b|intervencion|reportaje/ }
];

export function conceptLabel(key) {
  if (key === 'guardia-compartida') return 'Guardias compartidas';
  return NOTE_CONCEPTS.find(c => c.key === key)?.label || (key ? key[0].toUpperCase() + key.slice(1) : '');
}

/** Lower case, no accents, letters and digits apart ("inc22" → "inc 22"). */
export function normalizeNote(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove "Día 3º", "1º día", "3er día", "CH 2"… (the day's ordinal, not a date). */
function stripOrdinals(s) {
  return s
    .replace(/\bdias?\s*\d{1,2}\s*[ºª°]?/g, ' ')
    .replace(/\b\d{1,2}\s*[ºª°]\s*(?:dias?\b)?/g, ' ')
    .replace(/\b\d{1,2}\s*er\s+dias?\b/g, ' ')
    .replace(/\b\d{1,2}\s+dias?\b/g, ' ')
    .replace(/\bch\s*-?\s*\d{1,2}\b(?!\s*[/-]\s*\d)/g, ' ');
}

/**
 * Interpret a note.
 * @param {string} text
 * @param {Array<{key: string, words: string[]}>} [extra] - motives with a name of their own (compensations "otro")
 * @returns {{concept: string|null, points: Array<{d:number,m:number,y?:number}>, days: number[], months: number[], year: number|null}}
 */
export function parseNote(text, extra = []) {
  const s = normalizeNote(text);
  const out = { concept: null, points: [], days: [], months: [], year: null };
  if (!s) return out;
  const y = /\b(20\d{2})\b/.exec(s);
  if (y) out.year = Number(y[1]);
  const own = extra.find(c => c.words?.some(w => new RegExp(`\\b${w}\\b`).test(s)));
  if (own) { out.concept = own.key; return out; }
  const concept = NOTE_CONCEPTS.find(c => c.re.test(s));
  if (concept) { out.concept = concept.key; return out; }

  const body = stripOrdinals(s.replace(/\b20\d{2}\b/g, ' '));
  const re = /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?|(\d+)|([a-z]+)/g;
  let pending = [];
  let m;
  while ((m = re.exec(body))) {
    if (m[1]) {
      const d = Number(m[1]), mo = Number(m[2]);
      // "2/3 mayo": the 2nd and 3rd of May, not 2 March
      const nextWord = /^[\s.,;-]*([a-z]+)/.exec(body.slice(re.lastIndex));
      if (!m[3] && nextWord && MONTHS[nextWord[1]] && mo <= 31) { pending.push(d, mo); continue; }
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        for (const p of pending) out.points.push({ d: p, m: mo });
        pending = [];
        const yy = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : undefined;
        out.points.push(yy ? { d, m: mo, y: yy } : { d, m: mo });
      }
    } else if (m[4]) {
      const n = Number(m[4]);
      if (m[4].length <= 2 && n >= 1 && n <= 31) pending.push(n);
    } else if (m[5]) {
      const mo = MONTHS[m[5]];
      if (mo) {
        if (pending.length) {
          // "27-2 agosto": the first day is still in the previous month
          pending.forEach((p, i) => {
            const prevMonth = i < pending.length - 1 && p > pending[pending.length - 1];
            out.points.push({ d: p, m: prevMonth ? (mo === 1 ? 12 : mo - 1) : mo });
          });
          pending = [];
        } else out.months.push(mo);
      }
    }
  }
  out.days = pending;
  return out;
}

/** Year mentioned in the note of an AP / vacation day ("AP 2025, 3º"). */
export function noteYear(text) {
  return parseNote(text).year;
}

/**
 * The person's credit sources as the ledger plans them: guard weeks (with
 * holidays stuck to them) and, with a holiday rate, each isolated holiday.
 * @param {Array} days - [{dateISO, tags:[{type}]}]
 * @param {Object} config
 * @returns {Array<{ref:string, monday:string, start:string, end:string, inc:string[], festivo?:boolean}>}
 */
export function creditSources(days, config = {}) {
  const { guard, isolated, attached } = classifyIncWeeks(days);
  const incByWeek = new Map();
  for (const d of days) {
    if (!(d.tags || []).some(t => t.type === 'GUARDIA_REAL')) continue;
    const mon = getWeekDates(d.dateISO)[0];
    if (!incByWeek.has(mon)) incByWeek.set(mon, []);
    incByWeek.get(mon).push(d.dateISO);
  }
  const separate = hasFestivoRate(config);
  const out = [];
  const week = (mon) => ({ ref: `G.${dm(mon)}`, monday: mon, start: mon, end: addDaysISO(mon, 6), inc: [...(incByWeek.get(mon) || [])].sort() });
  for (const mon of guard) out.push(week(mon));
  for (const [mon, dates] of isolated) {
    if (separate) for (const d of dates) out.push({ ref: `F.${dm(d)}`, monday: d, start: d, end: d, inc: [d], festivo: true });
    else out.push(week(mon));
  }
  for (const a of attached.values()) {
    const g = out.find(o => o.monday === a.to && !o.festivo);
    if (!g) continue;
    if (a.dates[0] < g.start) g.start = a.dates[0];
    if (a.dates[a.dates.length - 1] > g.end) g.end = a.dates[a.dates.length - 1];
    g.inc = [...new Set([...g.inc, ...a.dates])].sort();
  }
  return out.sort((a, b) => a.monday.localeCompare(b.monday));
}

function dm(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

/** A guard is worked before its days off; a few are taken in advance (weeks before). */
const ADVANCE_DAYS = 45;

/** Date of a d/m point as seen from the day off: within the year before it (or a few weeks after). */
function pointDate(p, chISO) {
  if (p.y) return iso(p.y, p.m, p.d);
  const y = Number(chISO.slice(0, 4));
  for (const yy of [y + 1, y, y - 1]) {
    const x = iso(yy, p.m, p.d);
    const ahead = dayDiff(chISO, x);
    if (ahead <= ADVANCE_DAYS && ahead > ADVANCE_DAYS - 372) return x;
  }
  return iso(y - 1, p.m, p.d);
}

/** Is the point inside the source (optionally with a margin of a couple of days)? */
function pointIn(p, s, chISO, margin = 0) {
  const x = pointDate(p, chISO);
  return x >= addDaysISO(s.start, -margin) && x <= addDaysISO(s.end, margin);
}

/**
 * Which credit source(s) a note on a free day refers to.
 * @param {ReturnType<typeof parseNote>} parsed
 * @param {string} chISO - date of the free day
 * @param {ReturnType<typeof creditSources>} sources
 * @returns {{refs: string[], how: 'fechas'|'aprox'|'dias'|'mes'|'errata'}|null}
 */
export function matchSource(parsed, chISO, sources) {
  if (!parsed || parsed.concept) return null;
  // within about a year before the day off (or a few weeks after it, in advance)
  const cands = sources.filter(s => dayDiff(s.monday, chISO) <= 400 && dayDiff(chISO, s.monday) <= ADVANCE_DAYS);
  if (!cands.length) return null;
  // prefer the most recent guard before the day off, then the nearest one after it
  const best = list => [...list].sort((a, b) => {
    const pa = a.monday <= chISO, pb = b.monday <= chISO;
    if (pa !== pb) return pa ? -1 : 1;
    return pa ? b.monday.localeCompare(a.monday) : a.monday.localeCompare(b.monday);
  })[0];

  if (parsed.points.length) {
    // exactly inside the week first; a two-day margin only if nothing fits
    for (const margin of [0, 2]) {
      const inside = cands.filter(s => parsed.points.every(p => pointIn(p, s, chISO, margin)));
      if (inside.length) return { refs: [best(inside).ref], how: 'fechas' };
    }
    // a guard split over two weeks ("Rafa de lunes a viernes, Mario el fin de
    // semana"): the note names the week next to the person's own guard
    const some = cands.filter(s => parsed.points.some(p => pointIn(p, s, chISO, 2)));
    if (some.length === 1) return { refs: [some[0].ref], how: 'aprox' };
    // a slip in the month ("4-5 dic" for 4-5 January): same days, a month or so away
    const dates = parsed.points.map(p => pointDate(p, chISO));
    const dd = parsed.points.map(p => p.d);
    const near = cands.filter(s => dd.every(d => s.inc.some(x => Number(x.slice(8, 10)) === d))
      && dates.some(x => Math.abs(dayDiff(x, s.monday)) <= 45));
    if (near.length === 1) return { refs: [near[0].ref], how: 'errata' };
    return null;
  }
  if (parsed.days.length) {
    const hit = cands.filter(s => parsed.days.every(d => s.inc.some(x => Number(x.slice(8, 10)) === d)));
    if (hit.length) return { refs: [best(hit).ref], how: 'dias' };
    return null;
  }
  if (parsed.months.length) {
    const ok = cands.filter(s => parsed.months.some(mo => s.inc.some(x => {
      if (Number(x.slice(5, 7)) !== mo) return false;
      return dayDiff(x, chISO) >= 0;
    })));
    // several guards in that month: the oldest with days left takes it
    if (ok.length) return { refs: ok.sort((a, b) => a.monday.localeCompare(b.monday)).map(s => s.ref), how: 'mes' };
  }
  return null;
}

/** Build day records from a person's cuadrante entries (one tag per type and day). */
export function daysFromEntries(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, { dateISO: e.date, tags: [] });
    const d = map.get(e.date);
    if (!d.tags.some(t => t.type === e.tagType)) d.tags.push({ type: e.tagType, meta: { code: e.code, ...(e.note ? { note: e.note } : {}) } });
  }
  return [...map.values()].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

/**
 * Hints for the free days of a person, from the notes of their CH.
 * @param {Array} days - the person's day records (tags carry meta.note)
 * @param {ReturnType<typeof creditSources>} sources
 * @returns {{libreRefs: Map<string, {refs:string[], how:string, note:string}>, libreConcept: Map<string, string>, unmatched: Array<{date:string, note:string}>}}
 */
export function libreHints(days, sources, extra = []) {
  const libreRefs = new Map();
  const libreConcept = new Map();
  const unmatched = [];
  for (const d of days) {
    const tag = (d.tags || []).find(t => t.type === 'LIBRE');
    const note = tag?.meta?.note;
    if (!note) continue;
    const parsed = parseNote(note, extra);
    if (parsed.concept) { libreConcept.set(d.dateISO, parsed.concept); continue; }
    const hit = matchSource(parsed, d.dateISO, sources);
    if (hit) libreRefs.set(d.dateISO, { ...hit, note });
    else unmatched.push({ date: d.dateISO, note });
  }
  return { libreRefs, libreConcept, unmatched };
}

/**
 * Split weekends: a guard week in which two people did one weekend day each
 * (a swap). The guard belongs to whoever has CH notes naming it; with notes
 * from nobody yet, it stays with both.
 * @param {Object<string, Array>} daysByPerson - canonical person → day records
 * @param {Object<string, Object>} [hintsByPerson] - canonical person → libreHints()
 * @returns {Map<string, Set<string>>} person → Mondays that are NOT theirs
 */
export function swappedWeeks(daysByPerson, hintsByPerson = {}) {
  const weekendInc = new Map(); // monday → person → Set(weekend dates)
  const notedRefs = {};
  for (const [person, days] of Object.entries(daysByPerson)) {
    for (const d of days) {
      if (!isWeekend(d.dateISO) || !(d.tags || []).some(t => t.type === 'GUARDIA_REAL')) continue;
      const mon = getWeekDates(d.dateISO)[0];
      if (!weekendInc.has(mon)) weekendInc.set(mon, new Map());
      const byP = weekendInc.get(mon);
      if (!byP.has(person)) byP.set(person, new Set());
      byP.get(person).add(d.dateISO);
    }
    const h = hintsByPerson[person] || libreHints(days, creditSources(days));
    notedRefs[person] = new Set([...h.libreRefs.values()].flatMap(x => x.refs));
  }
  const out = new Map(Object.keys(daysByPerson).map(p => [p, new Set()]));
  // split weekends nobody has claimed yet (no notes): both keep it for now
  out.undecided = new Map(Object.keys(daysByPerson).map(p => [p, []]));
  for (const [mon, byP] of weekendInc) {
    if (byP.size < 2) continue;
    const people = [...byP.keys()];
    // only a real split: nobody shares a weekend day with another (the chief
    // doubling a guard on the same days is not a swap)
    const split = people.every(p => people.every(q => p === q || ![...byP.get(p)].some(x => byP.get(q).has(x))));
    if (!split) continue;
    const ref = `G.${dm(mon)}`;
    const owners = people.filter(p => notedRefs[p].has(ref));
    if (!owners.length) {
      for (const p of people) out.undecided.get(p).push({ monday: mon, with: people.filter(q => q !== p) });
      continue;
    }
    for (const p of people) if (!owners.includes(p)) out.get(p).add(mon);
  }
  return out;
}

/** The accounting year a credit source belongs to. */
export function sourceYear(s) {
  return s.festivo ? Number(s.monday.slice(0, 4)) : guardYear(s.monday);
}

/**
 * What the notes of the whole group say, person by person.
 *  - hints: which guard (or reason) each CH is for;
 *  - a CH whose note names a guard week someone else holds (that person did
 *    the weekend, this one Monday to Friday) is justified by it: it is counted
 *    apart and uses none of this person's guards;
 *  - excluded: split-weekend weeks that belong to the other person.
 * @param {Array} entries - every entry of the group cuadrante
 * @param {{canonical?: (name: string) => string, configs?: Object<string, Object>, extraConcepts?: Array}} [opts]
 */
export function groupNoteContext(entries, { canonical = n => String(n).toUpperCase().trim(), configs = {}, extraConcepts = [] } = {}) {
  const byP = {};
  for (const e of entries || []) {
    if (!e?.person) continue;
    const p = canonical(e.person);
    (byP[p] ||= []).push(e);
  }
  const people = Object.keys(byP);
  const days = {}, sources = {}, hints = {};
  for (const p of people) {
    days[p] = daysFromEntries(byP[p]);
    sources[p] = creditSources(days[p], configs[p] || {});
    hints[p] = { ...libreHints(days[p], sources[p], extraConcepts), shared: new Map() };
  }
  for (const p of people) {
    const h = hints[p];
    const still = [];
    for (const u of h.unmatched) {
      const parsed = parseNote(u.note);
      let found = null;
      if (parsed.points.length) {
        for (const q of people) {
          if (q === p) continue;
          const s = sources[q].find(s => dayDiff(s.monday, u.date) <= 400 && dayDiff(u.date, s.monday) <= ADVANCE_DAYS
            && parsed.points.every(pt => pointIn(pt, s, u.date, 0)));
          if (s) { found = { person: q, start: s.start, end: s.end }; break; }
        }
      }
      if (found) { h.libreConcept.set(u.date, 'guardia-compartida'); h.shared.set(u.date, found); }
      else still.push(u);
    }
    h.unmatched = still;
  }
  return { people, days, sources, hints, excluded: swappedWeeks(days, hints) };
}

/**
 * Days still owed, at the start of the synced range, from the guards of the
 * year before it: they carry over. Simulated from the cuadrante with the same
 * rules and notes as the sync (two years back, so older guards absorb the days
 * that were theirs).
 * @param {{days: Array, hints: Object, config: Object, desde: string, plan?: Function}} p
 * @returns {Array<{dateISO:string, sourceRef:string, amount:number, carried:number, festivo?:boolean}>}
 */
export function carryCredits({ days, hints = {}, config = {}, desde, plan = planLedgerFromDays }) {
  if (!desde) return [];
  const y0 = Number(desde.slice(0, 4));
  const from = `${y0 - 2}-01-01`;
  const before = (days || []).filter(d => d.dateISO >= from && d.dateISO < desde);
  if (!before.length) return [];
  const sim = plan(before, [], config, { ...hints, carryCredits: [] });
  const out = [];
  for (const c of sim.creditsToAdd) {
    const year = c.festivo ? Number(c.dateISO.slice(0, 4)) : guardYear(c.dateISO);
    const end = c.festivo ? c.dateISO : addDaysISO(c.dateISO, 6);
    if (year !== y0 - 1 || end >= desde) continue;
    const used = sim.debitsToAdd.filter(d => d.sourceRef === c.sourceRef && d.sourceDate === c.dateISO).length;
    out.push({ dateISO: c.dateISO, sourceRef: c.sourceRef, amount: c.amount, carried: Math.max(0, c.amount - used), ...(c.festivo ? { festivo: true } : {}) });
  }
  return out;
}

/**
 * Everything the sync of one person needs from the notes.
 * @param {ReturnType<typeof groupNoteContext>} ctx
 * @param {string} person - canonical name
 * @param {{config: Object, desde: string}} p
 */
export function accountingHints(ctx, person, { config = {}, desde } = {}) {
  const h = ctx?.hints?.[person];
  if (!h) return {};
  const base = {
    libreRefs: h.libreRefs,
    libreConcept: h.libreConcept,
    shared: h.shared,
    unmatched: h.unmatched,
    excludeWeeks: ctx.excluded.get(person) || new Set(),
    undecided: ctx.excluded.undecided?.get(person) || []
  };
  // The carry-over is computed only from a cuadrante with notes (published by
  // this version); without them the count stays as it always was.
  const y0 = Number(String(desde || '').slice(0, 4));
  const noted = (ctx.days[person] || []).some(d => d.dateISO < (desde || '') && d.dateISO >= `${y0 - 1}-01-01`
    && (d.tags || []).some(t => t.type === 'LIBRE' && t.meta?.note));
  return { ...base, carryCredits: noted ? carryCredits({ days: ctx.days[person], hints: base, config, desde }) : [] };
}
