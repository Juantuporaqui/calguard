/**
 * @module domain/ledger
 * Ledger accounting for free days (libranzas)
 * Every change goes through movements: CREDIT, DEBIT, ADJUST
 */

import { put, remove, getAllByIndex, STORES } from '../persistence/db.js';
import { getState, Actions } from '../state/store.js';
import { formatDM } from './rules.js';

/**
 * Create a ledger movement
 * @param {Object} params
 * @param {string} params.dateISO
 * @param {'CREDIT'|'DEBIT'|'ADJUST'} params.kind
 * @param {'GUARDIA'|'LIBRE'|'OTROS'|'ADJUST'} params.category
 * @param {number} params.amount - positive for credit, can be negative for debit
 * @param {string} [params.sourceRef] - e.g. "G.03/02/2025"
 * @param {string} [params.note]
 * @returns {Promise<Object>} the created movement
 */
export async function createMovement({ dateISO, kind, category, amount, sourceRef, note }) {
  const state = getState();
  const movement = {
    id: crypto.randomUUID(),
    profileId: state.activeProfileId,
    dateISO,
    kind,
    category,
    amount,
    sourceRef: sourceRef || '',
    note: note || '',
    createdAt: new Date().toISOString()
  };

  await put(STORES.LEDGER, movement);
  Actions.addLedger(movement);

  // Audit
  await put(STORES.AUDIT, {
    id: crypto.randomUUID(),
    profileId: state.activeProfileId,
    action: `LEDGER_${kind}`,
    detail: `${category}: ${amount > 0 ? '+' : ''}${amount} (${dateISO}) ${sourceRef || ''} ${note || ''}`.trim(),
    timestamp: new Date().toISOString()
  });

  return movement;
}

/**
 * Credit free days for a completed guard duty
 * @param {string} guardDateISO - first day of guard week
 * @param {number} daysPerGuard
 * @returns {Promise<Object>}
 */
export async function creditGuardia(guardDateISO, daysPerGuard) {
  return createMovement({
    dateISO: guardDateISO,
    kind: 'CREDIT',
    category: 'GUARDIA',
    amount: daysPerGuard,
    sourceRef: `G.${formatDM(guardDateISO)}`,
    note: `Guardia semana del ${formatDM(guardDateISO)}: +${daysPerGuard} días libres`
  });
}

/**
 * Debit a free day (user takes a day off)
 * @param {string} dateISO - the day being taken off
 * @param {string} guardRef - reference to the guard duty it's charged to
 * @returns {Promise<Object>}
 */
export async function debitLibre(dateISO, guardRef) {
  return createMovement({
    dateISO,
    kind: 'DEBIT',
    category: 'LIBRE',
    amount: -1,
    sourceRef: guardRef,
    note: `Libre: ${formatDM(dateISO)}`
  });
}

/**
 * Credit/debit from "other events" (custom adjustment)
 * @param {string} dateISO
 * @param {number} amount - positive or negative
 * @param {string} concept
 * @returns {Promise<Object>}
 */
export async function adjustOtros(dateISO, amount, concept) {
  return createMovement({
    dateISO,
    kind: amount >= 0 ? 'CREDIT' : 'DEBIT',
    category: 'OTROS',
    amount,
    sourceRef: concept,
    note: `${concept}: ${amount >= 0 ? '+' : ''}${amount} días`
  });
}

/**
 * Manual admin adjustment
 * @param {string} dateISO
 * @param {number} amount
 * @param {string} reason
 * @returns {Promise<Object>}
 */
export async function manualAdjust(dateISO, amount, reason) {
  return createMovement({
    dateISO,
    kind: 'ADJUST',
    category: 'ADJUST',
    amount,
    sourceRef: 'Ajuste manual',
    note: reason
  });
}

/**
 * Remove a ledger movement (undo)
 * @param {string} movementId
 * @returns {Promise<void>}
 */
export async function removeMovement(movementId) {
  await remove(STORES.LEDGER, movementId);
  Actions.removeLedger(movementId);
}

/**
 * Load all ledger movements for the active profile
 * @returns {Promise<Array>}
 */
export async function loadLedger() {
  const state = getState();
  if (!state.activeProfileId) return [];
  const movements = await getAllByIndex(STORES.LEDGER, 'profileId', state.activeProfileId);
  movements.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  Actions.setLedger(movements);
  return movements;
}

/**
 * Find the guard duty with available free days to charge against
 * @returns {{ref: string, remaining: number}|null}
 */
export function findAvailableGuard() {
  const state = getState();
  const { ledger, config } = state;
  const daysPerGuard = config.diasPorGuardia || 5;

  // Build map of guard -> used days
  const guardCredits = ledger.filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA');
  const guardDebits = ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE');

  for (const credit of guardCredits) {
    const ref = credit.sourceRef;
    const used = guardDebits.filter(d => d.sourceRef === ref).length;
    const remaining = daysPerGuard - used;
    if (remaining > 0) {
      return { ref, remaining };
    }
  }

  return null;
}

/**
 * Get guard duty detail: how many days used and remaining
 * @returns {Array<{ref: string, dateISO: string, total: number, used: number, remaining: number, debits: Array}>}
 */
export function getGuardDetails() {
  const state = getState();
  const { ledger, config } = state;
  const daysPerGuard = config.diasPorGuardia || 5;

  const credits = ledger.filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA');
  const debits = ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE');

  return credits.map(credit => {
    const guardDebits = debits.filter(d => d.sourceRef === credit.sourceRef);
    return {
      ref: credit.sourceRef,
      dateISO: credit.dateISO,
      total: daysPerGuard,
      used: guardDebits.length,
      remaining: daysPerGuard - guardDebits.length,
      debits: guardDebits
    };
  });
}
