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
 *  - config.saldoInicialLibres is a starting balance carried from before the
 *    imported period; it behaves like a virtual guard available first.
 *
 * The plan is ADDITIVE and idempotent: movements that already exist are not
 * duplicated, so re-importing the same cuadrante does not double-count.
 */

import { getWeekDates, formatDM } from './rules.js';

const SALDO_INICIAL_REF = 'SALDO_INICIAL';

/**
 * @typedef {Object} LedgerPlan
 * @property {Array<{dateISO:string, sourceRef:string, amount:number}>} creditsToAdd
 * @property {Array<{dateISO:string, sourceRef:string, ordinal:string}>} debitsToAdd
 * @property {{amount:number}|null} saldoInicial - ADJUST to materialise, or null if unchanged
 */

/**
 * Build the reconciliation plan from day tags and the existing ledger.
 * @param {Array} days - Day records (each {dateISO, tags:[{type}]})
 * @param {Array} ledger - existing LedgerMovement records
 * @param {Object} config - {diasPorGuardia, saldoInicialLibres}
 * @returns {LedgerPlan}
 */
export function planLedgerFromDays(days, ledger, config = {}) {
  const daysPerGuard = config.diasPorGuardia || 5;
  const saldoInicial = Number(config.saldoInicialLibres) || 0;

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

  // ── 2. Starting balance (materialised as a single ADJUST) ──
  const existingSaldo = ledger.find(m => m.kind === 'ADJUST' && m.sourceRef === SALDO_INICIAL_REF);
  const currentSaldoAmount = existingSaldo ? existingSaldo.amount : 0;
  const saldoInicialPlan = saldoInicial !== currentSaldoAmount ? { amount: saldoInicial } : null;

  // ── 3. LIBRE debits, auto-assigned to the oldest guard with room ──
  // Capacity pool: starting balance first (oldest), then guards by week.
  const capacity = [];
  if (saldoInicial > 0) {
    capacity.push({ ref: SALDO_INICIAL_REF, sort: '0000-00-00', remaining: saldoInicial, assigned: 0 });
  }
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
      ordinal = slot.ref === SALDO_INICIAL_REF
        ? `D.${slot.assigned} (saldo previo)`
        : `D.${slot.assigned} ${slot.ref}`;
    }
    debitsToAdd.push({ dateISO, sourceRef, ordinal });
  }

  return { creditsToAdd, debitsToAdd, saldoInicial: saldoInicialPlan };
}

/**
 * Summarise generated / enjoyed / remaining free days from a ledger.
 * @param {Array} ledger
 * @returns {{generados:number, disfrutados:number, restantes:number}}
 */
export function summariseLibres(ledger) {
  let generados = 0;
  let disfrutados = 0;
  let saldo = 0;
  for (const m of ledger) {
    if (m.kind === 'CREDIT' && m.category === 'GUARDIA') { generados += m.amount; saldo += m.amount; }
    else if (m.kind === 'DEBIT' && m.category === 'LIBRE') { disfrutados += Math.abs(m.amount); saldo -= Math.abs(m.amount); }
    else if (m.kind === 'ADJUST') { saldo += m.amount; if (m.amount > 0) generados += m.amount; }
    else if (m.category === 'OTROS' && m.kind === 'CREDIT') { saldo += m.amount; generados += m.amount; }
    else if (m.category === 'OTROS' && m.kind === 'DEBIT') { saldo -= Math.abs(m.amount); disfrutados += Math.abs(m.amount); }
  }
  return { generados, disfrutados, restantes: saldo };
}

export { SALDO_INICIAL_REF };
