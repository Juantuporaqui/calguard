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

import { getWeekDates, formatDM, todayISO } from './rules.js';

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
  const daysPerGuard = config.diasPorGuardia || 5;

  // ── 1. Guardia weeks from GUARDIA_REAL tags ──
  // weekMondayISO -> true (dedupe multiple guard days in the same week)
  const guardWeeks = new Set();
  for (const d of days) {
    if ((d.tags || []).some(t => t.type === 'GUARDIA_REAL')) {
      guardWeeks.add(getWeekDates(d.dateISO)[0]);
    }
  }

  const existingCreditRefs = new Set(
    ledger.filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA').map(m => m.sourceRef)
  );

  const creditsToAdd = [];
  for (const monday of [...guardWeeks].sort()) {
    const ref = `G.${formatDM(monday)}`;
    if (!existingCreditRefs.has(ref)) {
      creditsToAdd.push({ dateISO: monday, sourceRef: ref, amount: daysPerGuard });
    }
  }

  // ── 2. LIBRE debits, auto-assigned to the oldest guard with room ──
  const capacity = [];
  const allCreditRefs = [
    ...ledger
      .filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA')
      .map(m => ({ ref: m.sourceRef, sort: m.dateISO })),
    ...creditsToAdd.map(c => ({ ref: c.sourceRef, sort: c.dateISO }))
  ];
  // Existing debits already consume capacity and define the ordinal offset per ref
  const existingDebitsByRef = new Map();
  for (const m of ledger.filter(d => d.kind === 'DEBIT' && d.category === 'LIBRE')) {
    existingDebitsByRef.set(m.sourceRef, (existingDebitsByRef.get(m.sourceRef) || 0) + 1);
  }
  for (const { ref, sort } of allCreditRefs) {
    const used = existingDebitsByRef.get(ref) || 0;
    capacity.push({ ref, sort, remaining: Math.max(0, daysPerGuard - used), assigned: used });
  }
  capacity.sort((a, b) => a.sort.localeCompare(b.sort));

  const existingDebitDates = new Set(
    ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE').map(m => m.dateISO)
  );
  const libreDates = days
    .filter(d => (d.tags || []).some(t => t.type === 'LIBRE'))
    .map(d => d.dateISO)
    .filter(dateISO => !existingDebitDates.has(dateISO))
    .sort();

  const debitsToAdd = [];
  for (const dateISO of libreDates) {
    const slot = capacity.find(c => c.remaining > 0);
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
 * Summarise generated / enjoyed / remaining free days for one accounting year,
 * with the manual carry-over as the starting balance. Only movements dated in
 * the year are counted (annual accounting).
 * Only movements up to `today` count ("al día"): a future guard week credits
 * its free days only once its Monday has arrived.
 * @param {Array} ledger
 * @param {number} year
 * @param {number} [carryLibres] - manual carry-over from the previous year
 * @param {string} [today] - ISO date; movements after it don't count yet
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
    if (m.dateISO > today) continue; // future guardia/libre not yet effective
    if (m.kind === 'CREDIT' && m.category === 'GUARDIA') generados += m.amount;
    else if (m.kind === 'DEBIT' && m.category === 'LIBRE') disfrutados += Math.abs(m.amount);
    else if (m.kind === 'ADJUST') adjust += m.amount;
    else if (m.category === 'OTROS' && m.kind === 'CREDIT') adjust += m.amount;
    else if (m.category === 'OTROS' && m.kind === 'DEBIT') adjust -= Math.abs(m.amount);
  }
  return {
    arrastre,
    generados: generados + Math.max(0, adjust),
    disfrutados: disfrutados + Math.max(0, -adjust),
    restantes: arrastre + generados + adjust - disfrutados
  };
}
