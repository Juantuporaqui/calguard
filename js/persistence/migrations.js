/**
 * @module persistence/migrations
 * Migrate data from the legacy calendarioDB (v1) to the new calguardDB (v2).
 * This runs once on first launch of the new version.
 */

import { put, get, STORES } from './db.js';

const MIGRATION_KEY = '__migration_completed__';

/**
 * Tag type mapping from old CSS classes to new tag types
 */
const TYPE_MAP = {
  'guardia': 'GUARDIA_REAL',
  'proxima-guardia': 'GUARDIA_PLAN',
  'libre': 'LIBRE',
  'vacaciones': 'VACACIONES',
  'asunto': 'AP',
  'tarde': 'TURNO_T',
  'mañana': 'TURNO_M',
  'otros': 'OTRO'
};

/**
 * Check if migration already done
 * @returns {Promise<boolean>}
 */
export async function isMigrationDone() {
  const flag = await get(STORES.CONFIG, MIGRATION_KEY);
  return !!flag;
}

/**
 * Attempt to migrate from old calendarioDB
 * @param {string} defaultProfileId
 * @returns {Promise<{migrated: boolean, count: number, errors: string[]}>}
 */
export async function migrateFromLegacy(defaultProfileId) {
  const result = { migrated: false, count: 0, errors: [] };

  try {
    // Check if old DB exists
    const dbs = await indexedDB.databases();
    const oldDbInfo = dbs.find(d => d.name === 'calendarioDB');
    if (!oldDbInfo) {
      await markMigrationDone();
      return result;
    }

    const oldDb = await openOldDB();
    if (!oldDb) {
      await markMigrationDone();
      return result;
    }

    // Migrate days
    const oldDays = await getAllFromOldStore(oldDb, 'dias');
    const dayMap = new Map(); // dateISO -> tags[]

    for (const d of oldDays) {
      if (!d.fecha) continue;
      const dateISO = d.fecha;
      const newType = TYPE_MAP[d.tipo] || 'OTRO';

      if (!dayMap.has(dateISO)) {
        dayMap.set(dateISO, []);
      }

      const tag = { type: newType };
      if (d.detalle) {
        tag.meta = d.detalle;
      }
      if (newType === 'OTRO' && d.detalle && d.detalle.concepto) {
        tag.meta = { label: d.detalle.concepto, diasAfectados: d.detalle.diasAfectados || 0 };
      }
      dayMap.get(dateISO).push(tag);
    }

    for (const [dateISO, tags] of dayMap) {
      try {
        await put(STORES.DAYS, {
          profileId: defaultProfileId,
          dateISO,
          tags,
          updatedAt: new Date().toISOString()
        });
        result.count++;
      } catch (err) {
        result.errors.push(`Day ${dateISO}: ${err.message}`);
      }
    }

    // Migrate config
    const oldConfig = await getAllFromOldStore(oldDb, 'configuracion');
    for (const c of oldConfig) {
      if (c.clave === 'guardiasRealizadas' && Array.isArray(c.valor)) {
        // Convert old guardia records to ledger entries
        for (const g of c.valor) {
          const ledgerEntry = {
            id: crypto.randomUUID(),
            profileId: defaultProfileId,
            dateISO: parseDDMMYYYY(g.fecha) || new Date().toISOString().split('T')[0],
            kind: 'CREDIT',
            category: 'GUARDIA',
            amount: 5 - (g.diasLibresUsados ? g.diasLibresUsados.length : 0),
            sourceRef: `Migrado: Guardia ${g.fecha}`,
            note: 'Migración automática desde versión anterior',
            createdAt: new Date().toISOString()
          };
          await put(STORES.LEDGER, ledgerEntry);
        }
      }
    }

    // Migrate registro
    const oldRegistro = await getAllFromOldStore(oldDb, 'registro');
    for (const r of oldRegistro) {
      const auditEntry = {
        id: crypto.randomUUID(),
        profileId: defaultProfileId,
        action: 'LEGACY_RECORD',
        detail: r.texto || JSON.stringify(r),
        timestamp: new Date().toISOString()
      };
      await put(STORES.AUDIT, auditEntry);
    }

    oldDb.close();
    result.migrated = true;
    await markMigrationDone();

  } catch (err) {
    result.errors.push('Migration error: ' + err.message);
  }

  return result;
}

function parseDDMMYYYY(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function openOldDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('calendarioDB', 1);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = (e) => {
        // Don't create stores, just open
        e.target.transaction.abort();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

function getAllFromOldStore(db, storeName) {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function markMigrationDone() {
  await put(STORES.CONFIG, {
    key: MIGRATION_KEY,
    value: { completedAt: new Date().toISOString(), version: 2 }
  });
}
