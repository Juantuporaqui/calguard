/**
 * @module domain/reconcile
 * Pure accounting reconciliation: derive the ledger movements that SHOULD
 * exist from the day tags on the calendar, without any I/O.
 *
 * Rules (confirmed for Policía Científica group):
 *  - A GUARDIA_REAL tag marks a guard day. Guards are weekly: every ISO week
 *    (Mon–Sun) that contains at least one guard day generates a fixed number
 *    of free days (config.diasPorGuardia, default 5), credited once per week.
 *  - A LIBRE tag is a free day enjoyed; it debits one day, auto-charged to the
 *    oldest guard (or the carried-over starting balance) that still has room.
 *  - The carry-over from previous years is NOT a ledger movement; it is a
 *    manual per-year value applied when computing the annual balance
 *    (see calculateCounters). The ledger holds only real guardias/libres.
 *
 * The plan is ADDITIVE and idempotent: movements that already exist are not
 * duplicated, so re-importing the same cuadrante does not double-count.
 */

import { getWeekDates, formatDM, todayISO, detectConflict, isWeekend } from './rules.js';

/**
 * @typedef {Object} LedgerPlan
 * @property {Array<{dateISO:string, sourceRef:string, amount:number}>} creditsToAdd
 * @property {Array<{dateISO:string, sourceRef:string, ordinal:string}>} debitsToAdd
 */

/**
 * Build the reconciliation plan from day tags and the existing ledger.
 * @param {Array} days - Day records (each {dateISO, tags:[{type}]})
 * @param {Array} ledger - existing LedgerMovement records
 * @param {Object} config - {diasPorGuardia}
 * @returns {LedgerPlan}
 */
export function planLedgerFromDays(days, ledger, config = {}, hints = {}) {
  const daysPerGuard = config.diasPorGuardia ?? 5;
  // Libres concedidos que no computan (p. ej. un día que regala la jefa)
  const exentos = new Set(config.libresExentos || []);
  const excluded = hints.excludeWeeks || new Set();

  // ── 1. Guardia weeks from GUARDIA_REAL tags (one per week; holidays don't add) ──
  // With a rate for isolated holidays (e.g. the chief: 2 days each), those
  // weeks are not guards: each holiday worked gets its own credit.
  // A week swapped away (one weekend day each, the other person holds the
  // notes) is not this person's guard.
  const separate = hasFestivoRate(config);
  const { guard, isolated } = classifyIncWeeks(days);
  const guardWeeks = new Set([...(separate ? guard : new Set([...guard, ...isolated.keys()]))].filter(m => !excluded.has(m)));

  // Dedupe by the real Monday date, not by the "G.dd/mm" ref: the ref has no
  // year, so the same dd/mm in another imported year must not hide a guardia.
  const credits = ledger.filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA');
  const existingCreditDates = new Set(credits.map(m => m.dateISO));

  const creditsToAdd = [];
  for (const monday of [...guardWeeks].sort()) {
    if (!existingCreditDates.has(monday)) {
      creditsToAdd.push({ dateISO: monday, sourceRef: `G.${formatDM(monday)}`, amount: daysPerGuard });
    }
  }
  if (separate) {
    const perHoliday = Number(config.diasPorFestivo);
    for (const dates of isolated.values()) {
      for (const d of dates) {
        if (!existingCreditDates.has(d)) creditsToAdd.push({ dateISO: d, sourceRef: `F.${formatDM(d)}`, amount: perHoliday, festivo: true });
      }
    }
  }
  // Guards of the year before the synced range whose days are still owed
  for (const c of hints.carryCredits || []) {
    if (!existingCreditDates.has(c.dateISO)) creditsToAdd.push({ ...c, carry: true });
  }
  creditsToAdd.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  // ── 2. LIBRE debits ──
  // In this order: a free day whose note gives another reason (juicio,
  // elecciones…) uses no guard; one whose note names a guard goes to that
  // guard; the rest go to the oldest guard already done with days left
  // (a free day compensates a guardia worked BEFORE it).
  const debits = ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && !exentos.has(m.dateISO) && !m.concepto);
  const capacity = [
    ...credits.map(m => ({ ref: m.sourceRef, sort: m.dateISO, amount: m.carry ? m.carried : m.amount })),
    ...creditsToAdd.map(c => ({ ref: c.sourceRef, sort: c.dateISO, amount: c.carry ? c.carried : c.amount }))
  ].map(({ ref, sort, amount }) => {
    const used = debits.filter(d => d.sourceRef === ref && (d.sourceDate ? d.sourceDate === sort : isWithinYearAfter(sort, d.dateISO))).length;
    return { ref, sort, remaining: Math.max(0, (amount ?? daysPerGuard) - used), assigned: used };
  }).sort((a, b) => a.sort.localeCompare(b.sort));

  const existingDebitDates = new Set(ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE').map(m => m.dateISO));
  const libreDates = days
    .filter(d => (d.tags || []).some(t => t.type === 'LIBRE'))
    .map(d => d.dateISO)
    .filter(dateISO => !existingDebitDates.has(dateISO) && !exentos.has(dateISO))
    .sort();

  const take = (slot, extra = {}) => {
    slot.remaining--;
    slot.assigned++;
    return { sourceRef: slot.ref, sourceDate: slot.sort, ordinal: `D.${slot.assigned} ${slot.ref}`, ...extra };
  };
  const debitsToAdd = [];
  const fifo = [];
  const concepts = hints.libreConcept || new Map();
  const noted = hints.libreRefs || new Map();
  for (const dateISO of libreDates) {
    if (concepts.has(dateISO)) {
      const shared = hints.shared?.get(dateISO);
      debitsToAdd.push({ dateISO, sourceRef: '', ordinal: '', concepto: concepts.get(dateISO), ...(shared ? { compartida: shared } : {}) });
      continue;
    }
    const hint = noted.get(dateISO);
    if (!hint) { fifo.push({ dateISO }); continue; }
    // the guard the note names (a ref has no year: the one around this date;
    // days are taken after the guard, or a few weeks before it in advance)
    const lo = addDaysISO(dateISO, -400), hi = addDaysISO(dateISO, 45);
    const near = hint.refs
      .map(ref => capacity.find(c => c.ref === ref && c.sort >= lo && c.sort <= hi))
      .filter(Boolean);
    const slot = near.find(c => c.remaining > 0) || near[0];
    if (!slot) { fifo.push({ dateISO, notaSinGuardia: true }); continue; }
    const over = slot.remaining <= 0; // the guard had all its days already: shown as 6/5
    debitsToAdd.push({ dateISO, ...take(slot, { porNota: true, ...(over ? { excede: true } : {}) }) });
  }
  for (const { dateISO, ...flags } of fifo) {
    const slot = capacity.find(c => c.remaining > 0 && c.sort <= dateISO);
    debitsToAdd.push(slot ? { dateISO, ...take(slot, flags) } : { dateISO, sourceRef: '', ordinal: '', ...flags });
  }
  debitsToAdd.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  return { creditsToAdd, debitsToAdd };
}

export function addDaysISO(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Guard weeks (their Monday) from GUARDIA_REAL tags. A guard is always a
 * whole week with the same compensation, bank holidays or not: a week whose
 * only INC days are weekdays (a holiday such as Mon 12 Oct or Tue 6 Jan) right
 * before or after a guard week of the same person is part of that guard, not
 * a new one.
 * @param {Array} days
 * @returns {Set<string>}
 */
export function guardWeeksFromDays(days, { separateIsolated = false } = {}) {
  const { guard, isolated } = classifyIncWeeks(days);
  const result = new Set(guard);
  if (!separateIsolated) for (const monday of isolated.keys()) result.add(monday);
  return result;
}

/**
 * INC weeks of a person:
 *  - guard: weeks with INC on the weekend (a whole guard);
 *  - isolated: weeks whose only INC days are weekdays (holidays) with no
 *    guard week next to them — e.g. the chief working a single holiday;
 *  - weekday-only weeks right before/after a guard are part of that guard.
 * @returns {{guard: Set<string>, isolated: Map<string, string[]>, attached: Map<string, {dates: string[], to: string}>}}
 */
export function classifyIncWeeks(days) {
  const weeks = new Map(); // monday -> {weekend: boolean, dates: []}
  for (const d of days) {
    if (!d?.dateISO || !(d.tags || []).some(t => t.type === 'GUARDIA_REAL')) continue;
    const monday = getWeekDates(d.dateISO)[0];
    const w = weeks.get(monday) || { weekend: false, dates: [] };
    if (isWeekend(d.dateISO)) w.weekend = true;
    w.dates.push(d.dateISO);
    weeks.set(monday, w);
  }
  const guard = new Set();
  const isolated = new Map();
  const attached = new Map(); // holiday weeks that belong to the guard next to them
  for (const [monday, w] of weeks) {
    if (w.weekend) { guard.add(monday); continue; }
    const dates = [...new Set(w.dates)].sort();
    const prev = addDaysISO(monday, -7), next = addDaysISO(monday, 7);
    if (weeks.get(prev)?.weekend) { attached.set(monday, { dates, to: prev }); continue; }
    if (weeks.get(next)?.weekend) { attached.set(monday, { dates, to: next }); continue; }
    isolated.set(monday, dates);
  }
  return { guard, isolated, attached };
}

/** Does this profile compensate isolated holidays on their own (diasPorFestivo)? */
export function hasFestivoRate(config = {}) {
  const v = config.diasPorFestivo;
  return v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));
}

/**
 * Accounting year of a guard week, from its Monday: a guard that crosses into
 * the new year (e.g. Mon 29/12/2025 – Sun 04/01/2026) counts in the year in
 * which it ENDS (its Sunday), as agreed with the brigade.
 * @param {string} mondayISO
 * @returns {number}
 */
export function guardYear(mondayISO) {
  const sunday = new Date(mondayISO + 'T12:00:00');
  sunday.setDate(sunday.getDate() + 6);
  return sunday.getFullYear();
}

/** Accounting year of any ledger movement (guard credits by guardYear). */
export function movementYear(m) {
  if (!m?.dateISO) return null;
  return m.kind === 'CREDIT' && m.category === 'GUARDIA' && !m.festivo ? guardYear(m.dateISO) : Number(m.dateISO.slice(0, 4));
}

/**
 * True if `dateISO` falls within the year that starts at `startISO`
 * (a guardia's free days are enjoyed after it, within the following year).
 * @param {string} startISO
 * @param {string} dateISO
 */
export function isWithinYearAfter(startISO, dateISO) {
  if (!dateISO || dateISO < startISO) return false;
  const limit = new Date(startISO + 'T12:00:00');
  limit.setFullYear(limit.getFullYear() + 1);
  return new Date(dateISO + 'T12:00:00') < limit;
}

/**
 * Summarise generated / enjoyed / remaining free days for one accounting year,
 * with the manual carry-over as the starting balance. Only movements dated in
 * the year are counted (annual accounting).
 * Asymmetric "al día" rule: earning (guard credits) counts only once its date
 * has arrived; spending (libre debits) counts always, even if the day off is
 * still in the future (a requested day is reserved so you don't over-request).
 * @param {Array} ledger
 * @param {number} year
 * @param {number} [carryLibres] - manual carry-over from the previous year
 * @param {string} [today] - ISO date for the earning cut-off
 * @returns {{arrastre:number, generados:number, disfrutados:number, restantes:number}}
 */
export function summariseLibresForYear(ledger, year, carryLibres = 0, today = todayISO()) {
  const yearStr = String(year);
  const arrastre = Number(carryLibres) || 0;
  let generados = 0;
  let disfrutados = 0;
  let adjust = 0;
  for (const m of ledger) {
    if (!m.dateISO || String(movementYear(m)) !== yearStr) continue;
    const future = m.dateISO > today;
    if (m.kind === 'CREDIT' && m.category === 'GUARDIA') { if (!future) generados += m.amount; }
    else if (m.kind === 'DEBIT' && m.category === 'LIBRE') disfrutados += Math.abs(m.amount);
    else if (m.kind === 'ADJUST') { if (!(m.amount >= 0 && future)) adjust += m.amount; }
    else if (m.category === 'OTROS' && m.kind === 'CREDIT') { if (!future) adjust += m.amount; }
    else if (m.category === 'OTROS' && m.kind === 'DEBIT') adjust -= Math.abs(m.amount);
  }
  return {
    arrastre,
    generados: generados + Math.max(0, adjust),
    disfrutados: disfrutados + Math.max(0, -adjust),
    restantes: arrastre + generados + adjust - disfrutados
  };
}

/**
 * Plan a manual request of free days ("Pedir días libres").
 * Rules: you can only request what is available TODAY (worked guardias +
 * carry-over − already enjoyed/requested); each day is charged first to the
 * previous year's carry-over, then to the oldest guardia already worked
 * (Monday on or before today and before the requested day) with room left.
 * Days that are already free are ignored; days with a conflict are skipped.
 * @param {Object} p
 * @param {string[]} p.dates - selected ISO dates
 * @param {Array} p.days - day records of the profile
 * @param {Array} p.ledger - ledger of the profile
 * @param {number} p.available - free days available today (balances.libres.disponibles)
 * @param {number} [p.carryFree] - carry-over days not yet charged
 * @param {string} [p.today]
 * @param {number} [p.daysPerGuard]
 */
export function planFreeDayRequest({ dates, days, ledger, available, carryFree = 0, today = todayISO(), daysPerGuard = 5, slots = null }) {
  const dayMap = new Map(days.map(d => [d.dateISO, d]));
  const already = [];
  const conflicts = [];
  const toRequest = [];
  for (const iso of [...new Set(dates)].sort()) {
    const tags = dayMap.get(iso)?.tags || [];
    if (tags.some(t => t.type === 'LIBRE')) { already.push(iso); continue; }
    const reason = detectConflict(tags, 'LIBRE');
    if (reason) { conflicts.push({ date: iso, reason }); continue; }
    toRequest.push(iso);
  }

  if (toRequest.length > available) {
    return { ok: false, available, requested: toRequest.length, assignments: [], already, conflicts };
  }

  const debits = ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE');
  // the guards still open, oldest first (given by the caller from the balances:
  // without the closed ones, carried ones with what they still owe)
  const guardSlots = slots
    ? slots.map(t => ({ ref: t.ref, sort: t.dateISO, assigned: t.used, remaining: Math.max(0, t.total - t.used) }))
      .sort((a, b) => a.sort.localeCompare(b.sort))
    : ledger
      .filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && m.dateISO <= today)
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .map(m => {
        const used = debits.filter(d => d.sourceRef === m.sourceRef && isWithinYearAfter(m.dateISO, d.dateISO)).length;
        return { ref: m.sourceRef, sort: m.dateISO, assigned: used, remaining: Math.max(0, (m.amount || daysPerGuard) - used) };
      });

  let carryLeft = Math.max(0, carryFree);
  const assignments = toRequest.map(date => {
    if (carryLeft > 0) {
      carryLeft--;
      return { date, guardRef: 'ARRASTRE', ordinal: 'Arrastre' };
    }
    const slot = guardSlots.find(g => g.remaining > 0 && g.sort <= date);
    if (slot) {
      slot.remaining--;
      slot.assigned++;
      return { date, guardRef: slot.ref, guardDate: slot.sort, ordinal: `D.${slot.assigned}` };
    }
    // Covered by the balance (e.g. adjustments) but not by a specific guardia
    return { date, guardRef: 'ARRASTRE', ordinal: 'Saldo' };
  });

  return { ok: true, available, requested: toRequest.length, assignments, already, conflicts };
}
