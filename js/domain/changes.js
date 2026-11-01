/**
 * @module domain/changes
 * Atomic changes to the active profile's days and ledger, with undo.
 * Every change is written in ONE IndexedDB transaction, applied to the
 * state in ONE dispatch, and returns a function that reverts it exactly.
 */

import { applyBatch, STORES } from '../persistence/db.js';
import { getState, Actions } from '../state/store.js';

/**
 * @param {Object} c
 * @param {Array} [c.dayPuts] - full day records to write (empty tags ⇒ delete)
 * @param {string[]} [c.dayDeleteDates] - ISO dates whose record is removed
 * @param {Array} [c.movPuts] - ledger movements to write
 * @param {string[]} [c.movDeleteIds] - ledger movement ids to remove
 * @param {{action: string, detail: string}} [c.audit]
 * @returns {Promise<Function>} undo
 */
export async function commitDayChanges({ dayPuts = [], dayDeleteDates = [], movPuts = [], movDeleteIds = [], audit = null }) {
  const s = getState();
  const profileId = s.activeProfileId;
  const byDate = new Map(s.days.map(d => [d.dateISO, d]));
  const byId = new Map(s.ledger.map(m => [m.id, m]));

  const puts = [];
  const deletes = new Set(dayDeleteDates);
  for (const d of dayPuts) {
    if (!d.tags || d.tags.length === 0) deletes.add(d.dateISO);
    else puts.push({ ...d, profileId, updatedAt: new Date().toISOString() });
  }

  // Exact inverse, captured before writing
  const undo = { dayPuts: [], dayDeleteDates: [], movPuts: [], movDeleteIds: [] };
  for (const d of puts) {
    const prev = byDate.get(d.dateISO);
    if (prev) undo.dayPuts.push(prev); else undo.dayDeleteDates.push(d.dateISO);
  }
  for (const iso of deletes) {
    const prev = byDate.get(iso);
    if (prev) undo.dayPuts.push(prev);
  }
  for (const m of movPuts) {
    const prev = byId.get(m.id);
    if (prev) undo.movPuts.push(prev); else undo.movDeleteIds.push(m.id);
  }
  for (const id of movDeleteIds) {
    const prev = byId.get(id);
    if (prev) undo.movPuts.push(prev);
  }

  await applyBatch({
    [STORES.DAYS]: { puts, deletes: [...deletes].map(iso => [profileId, iso]) },
    [STORES.LEDGER]: { puts: movPuts, deletes: movDeleteIds },
    [STORES.AUDIT]: {
      puts: audit ? [{ id: crypto.randomUUID(), profileId, timestamp: new Date().toISOString(), ...audit }] : []
    }
  });

  for (const d of puts) byDate.set(d.dateISO, d);
  for (const iso of deletes) byDate.delete(iso);
  for (const id of movDeleteIds) byId.delete(id);
  for (const m of movPuts) byId.set(m.id, m);
  Actions.setData({ days: [...byDate.values()], ledger: [...byId.values()] });

  // Single-use: a second call (toast + sheet, double tap) is a no-op
  let used = false;
  return async () => {
    if (used) return null;
    if (getState().activeProfileId !== profileId) {
      Actions.showToast('No se puede deshacer: has cambiado de perfil');
      return null;
    }
    used = true;
    return commitDayChanges(undo);
  };
}

/**
 * Build a ledger movement for the active profile.
 * @param {Object} m - {dateISO, kind, category, amount, sourceRef, note, origin}
 */
export function newMovement(m) {
  return {
    id: crypto.randomUUID(),
    profileId: getState().activeProfileId,
    sourceRef: '',
    note: '',
    origin: 'manual',
    createdAt: new Date().toISOString(),
    ...m
  };
}
