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

import { getWeekDates, formatDM, todayISO, detectConflict } from './rules.js';

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
export function planLedgerFromDays(days, ledger, config = {}) {
  const daysPerGuard = config.diasPorGuardia ?? 5;
  // Libres concedidos que no computan (p. ej. un día que regala la jefa)
  const exentos = new Set(config.libresExentos || []);

  // ── 1. Guardia weeks from GUARDIA_REAL tags ──
  // weekMondayISO -> true (dedupe multiple guard days in the same week)
  const guardWeeks = new Set();
  for (const d of days) {
    if ((d.tags || []).some(t => t.type === 'GUARDIA_REAL')) {
      guardWeeks.add(getWeekDates(d.dateISO)[0]);
    }
  }

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

  // ── 2. LIBRE debits, auto-assigned to the oldest guard already done ──
  // A free day compensates a guardia worked BEFORE it, so a slot is only
  // eligible when its Monday is on or before the free day.
  const debits = ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && !exentos.has(m.dateISO));
  const capacity = [
    ...credits.map(m => ({ ref: m.sourceRef, sort: m.dateISO })),
    ...creditsToAdd.map(c => ({ ref: c.sourceRef, sort: c.dateISO }))
  ].map(({ ref, sort }) => {
    const used = debits.filter(d => d.sourceRef === ref && isWithinYearAfter(sort, d.dateISO)).length;
    return { ref, sort, remaining: Math.max(0, daysPerGuard - used), assigned: used };
  }).sort((a, b) => a.sort.localeCompare(b.sort));

  const existingDebitDates = new Set(debits.map(m => m.dateISO));
  const libreDates = days
    .filter(d => (d.tags || []).some(t => t.type === 'LIBRE'))
    .map(d => d.dateISO)
    .filter(dateISO => !existingDebitDates.has(dateISO) && !exentos.has(dateISO))
    .sort();

  const debitsToAdd = [];
  for (const dateISO of libreDates) {
    const slot = capacity.find(c => c.remaining > 0 && c.sort <= dateISO);
    let sourceRef = '';
    let ordinal = '';
    if (slot) {
      slot.remaining--;
      slot.assigned++;
      sourceRef = slot.ref;
      ordinal = `D.${slot.assigned} ${slot.ref}`;
    }
    debitsToAdd.push({ dateISO, sourceRef, ordinal });
  }

  return { creditsToAdd, debitsToAdd };
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
    if (!m.dateISO || !m.dateISO.startsWith(yearStr)) continue;
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
export function planFreeDayRequest({ dates, days, ledger, available, carryFree = 0, today = todayISO(), daysPerGuard = 5 }) {
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
  const guardSlots = ledger
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
      return { date, guardRef: slot.ref, ordinal: `D.${slot.assigned}` };
    }
    // Covered by the balance (e.g. adjustments) but not by a specific guardia
    return { date, guardRef: 'ARRASTRE', ordinal: 'Saldo' };
  });

  return { ok: true, available, requested: toRequest.length, assignments, already, conflicts };
}
