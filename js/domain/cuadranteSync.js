/**
 * @module domain/cuadranteSync
 * Importar el cuadrante de una persona como SINCRONIZACIÓN:
 *  - desde la fecha elegida, lo importado antes (etiquetas con
 *    meta.source='cuadrante' y movimientos origin='cuadrante') se sustituye
 *    por lo que dice el cuadrante actual: si un libre cambió de día, el viejo
 *    desaparece y no descuenta dos veces;
 *  - lo introducido a mano se conserva siempre;
 *  - todo se escribe en una única transacción (o todo o nada) y se pinta una vez.
 */

import { applyBatch, put, STORES } from '../persistence/db.js';
import { getState, Actions, effectiveConfig } from '../state/store.js';
import { planLedgerFromDays } from './reconcile.js';
import { detectConflict, formatDM, getWeekDates, isWeekend } from './rules.js';
import { canonicalPerson, entriesForPerson, loadGroupCuadrante } from './groupCuadrante.js';

export const IMPORT_SOURCE = 'cuadrante';

export function isImportedTag(tag) {
  return tag?.meta?.source === IMPORT_SOURCE;
}

/** Movements created by an import (new field, or the legacy "(importado)" note). */
export function isImportedMovement(m) {
  return m.origin === IMPORT_SOURCE || /\(importado\)/.test(m.note || '');
}

/** Does a movement fall in the synced range? A guard credit counts by its whole week. */
function movementInRange(m, desde, hasta) {
  let start = m.dateISO;
  let end = m.dateISO;
  if (m.kind === 'CREDIT' && m.category === 'GUARDIA') end = getWeekDates(m.dateISO)[6];
  return end >= desde && (!hasta || start <= hasta);
}

/**
 * Pure plan of a sync (no I/O): what changes in days and ledger.
 * @param {Object} p
 * @param {Array} p.days - current days of the profile
 * @param {Array} p.ledger - current ledger of the profile
 * @param {Array} p.entries - cuadrante entries of THIS person
 * @param {string} p.profileId
 * @param {string} p.desde - ISO start date (inclusive)
 * @param {string} [p.hasta] - ISO end date (inclusive), optional
 * @param {Object} p.config - effective config (diasPorGuardia)
 */
export function planCuadranteSync({ days, ledger, entries, profileId, desde, hasta = null, config }) {
  const inRange = iso => iso >= desde && (!hasta || iso <= hasta);
  const personEntries = entries.filter(e => inRange(e.date)).sort((a, b) => a.date.localeCompare(b.date));

  // 1. Remove previously imported tags in range (manual tags stay)
  const dayMap = new Map(days.map(d => [d.dateISO, { ...d, tags: [...(d.tags || [])] }]));
  let removed = 0;
  for (const d of dayMap.values()) {
    if (!inRange(d.dateISO)) continue;
    const before = d.tags.length;
    d.tags = d.tags.filter(t => !isImportedTag(t));
    removed += before - d.tags.length;
  }

  // 2. Add the cuadrante's tags
  const byType = {};
  const skipped = [];
  const seen = new Set();
  let added = 0;
  for (const e of personEntries) {
    const key = `${e.date}|${e.tagType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let day = dayMap.get(e.date);
    if (!day) { day = { profileId, dateISO: e.date, tags: [] }; dayMap.set(e.date, day); }
    if (day.tags.some(t => t.type === e.tagType)) continue; // already there (manual)
    const conflict = detectConflict(day.tags, e.tagType);
    if (conflict) { skipped.push({ date: e.date, type: e.tagType, reason: conflict }); continue; }
    day.tags.push({ type: e.tagType, meta: { source: IMPORT_SOURCE, code: e.code } });
    byType[e.tagType] = (byType[e.tagType] || 0) + 1;
    added++;
  }

  // 3. Changed records
  const original = new Map(days.map(d => [d.dateISO, d]));
  const stamp = new Date().toISOString();
  const puts = [];
  const deletes = [];
  const newDays = [];
  for (const [iso, d] of dayMap) {
    const orig = original.get(iso);
    if (d.tags.length === 0) {
      if (orig) deletes.push([profileId, iso]);
      continue;
    }
    const changed = !orig || JSON.stringify(orig.tags) !== JSON.stringify(d.tags);
    const rec = changed ? { ...d, profileId, updatedAt: stamp } : orig;
    if (changed) puts.push(rec);
    newDays.push(rec);
  }

  // 4. Ledger: drop imported movements in range and plan them again
  const ledgerDeletes = ledger.filter(m => isImportedMovement(m) && movementInRange(m, desde, hasta));
  const deleteIds = new Set(ledgerDeletes.map(m => m.id));
  const keepLedger = ledger.filter(m => !deleteIds.has(m.id));
  const plan = planLedgerFromDays(newDays, keepLedger, config);

  const dates = personEntries.map(e => e.date);
  return {
    newDays, puts, deletes, ledgerDeletes, keepLedger, plan,
    summary: {
      desde,
      hasta: hasta || dates[dates.length - 1] || desde,
      entries: personEntries.length,
      added, removed, skipped, byType,
      guardias: new Set(personEntries.filter(e => e.tagType === 'GUARDIA_REAL').map(e => getWeekDates(e.date)[0])).size,
      // Vacation days as the accounting counts them (weekends excluded if so configured)
      vacaciones: new Set(personEntries
        .filter(e => e.tagType === 'VACACIONES' && !(config?.excludeWeekendsVacation && isWeekend(e.date)))
        .map(e => e.date)).size,
      credits: plan.creditsToAdd.length,
      debits: plan.debitsToAdd.length
    }
  };
}

/**
 * Preview a sync for the active profile without writing anything.
 * @param {{entries: Array, person: string, desde: string, hasta?: string}} p
 */
export function previewSync({ entries, person, desde, hasta = null }) {
  const s = getState();
  const config = effectiveConfig(s);
  const canonical = canonicalPerson(person, config.escalafonOrder);
  const personEntries = entriesForPerson(entries, canonical, config.escalafonOrder);
  return planCuadranteSync({
    days: s.days, ledger: s.ledger, entries: personEntries,
    profileId: s.activeProfileId, desde, hasta, config
  });
}

/**
 * Sync the active profile with a person's cuadrante (atomic, one render).
 * @param {{entries: Array, person: string, desde: string, hasta?: string}} p
 * @returns {Promise<Object>} summary
 */
export async function syncActiveProfile({ entries, person, desde, hasta = null }) {
  const s = getState();
  const profileId = s.activeProfileId;
  const r = previewSync({ entries, person, desde, hasta });
  if (r.summary.entries === 0) {
    throw new Error(`No hay turnos de ${person} desde ${desde.split('-').reverse().join('/')}`);
  }

  const createdAt = new Date().toISOString();
  const movements = [
    ...r.plan.creditsToAdd.map(c => ({
      id: crypto.randomUUID(), profileId, dateISO: c.dateISO, kind: 'CREDIT', category: 'GUARDIA',
      amount: c.amount, sourceRef: c.sourceRef, origin: IMPORT_SOURCE, createdAt,
      note: `Guardia semana del ${formatDM(c.dateISO)}: +${c.amount} días libres`
    })),
    ...r.plan.debitsToAdd.map(d => ({
      id: crypto.randomUUID(), profileId, dateISO: d.dateISO, kind: 'DEBIT', category: 'LIBRE',
      amount: -1, sourceRef: d.sourceRef, origin: IMPORT_SOURCE, createdAt,
      note: `Libre ${formatDM(d.dateISO)}${d.ordinal ? ' · ' + d.ordinal : ''}`
    }))
  ];

  await applyBatch({
    [STORES.DAYS]: { puts: r.puts, deletes: r.deletes },
    [STORES.LEDGER]: { puts: movements, deletes: r.ledgerDeletes.map(m => m.id) },
    [STORES.AUDIT]: {
      puts: [{
        id: crypto.randomUUID(), profileId, action: 'CUADRANTE_SYNC', timestamp: createdAt,
        detail: `${person} desde ${desde}: +${r.summary.added} / −${r.summary.removed} etiquetas, ${movements.length} movimientos`
      }]
    }
  });

  Actions.setData({ days: r.newDays, ledger: [...r.keepLedger, ...movements] });

  // Remember the link and the sync moment on the profile
  const profile = { ...getState().activeProfile, cuadranteName: canonicalPerson(person, effectiveConfig().escalafonOrder), syncDesde: desde, lastSyncAt: createdAt };
  await put(STORES.PROFILES, profile);
  Actions.setProfile(profile);
  Actions.setProfiles(getState().profiles.map(p => (p.id === profile.id ? profile : p)));

  return r.summary;
}

/** Default start of a sync: 1 January of the current year. */
export function defaultSyncStart() {
  return `${new Date().getFullYear()}-01-01`;
}

/**
 * If the active profile is linked to a cuadrante person and the stored group
 * cuadrante is newer than its last sync, sync it now. Silent no-op otherwise.
 * @returns {Promise<Object|null>} summary, or null if nothing was done
 */
export async function autoSyncIfStale() {
  const p = getState().activeProfile;
  if (!p?.cuadranteName) return null;
  const data = await loadGroupCuadrante();
  if (!data?.entries?.length) return null;
  if (p.lastSyncAt && data.importedAt && data.importedAt <= p.lastSyncAt) return null;
  return syncActiveProfile({
    entries: data.entries,
    person: p.cuadranteName,
    desde: p.syncDesde || defaultSyncStart()
  });
}
