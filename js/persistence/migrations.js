/**
 * @module persistence/migrations
 * Cambios de esquema de los datos guardados:
 *  - calendarioDB (v1) → calguardDB (v2): una vez, al primer arranque.
 *  - ghPublish (v3.16.0): el token de GitHub pasa de `token` en claro a `tokenEnc` cifrado.
 */

import { put, get, STORES } from './db.js';
import { migrateLegacyToken } from './tokenVault.js';

/**
 * Esquema de `config → ghPublish` desde v3.16.0:
 *   antes:  { token: 'github_pat_…', owner, repo, branch, lastPublishedAt }
 *   ahora:  { tokenEnc: { v: 1, data: base64(iv + cifrado) }, owner, repo, branch, lastPublishedAt }
 * No puede hacerse al arrancar porque necesita la clave que sale del PIN: se llama
 * tras cada desbloqueo (js/persistence/vaultSession.js). Comprueba que el cifrado
 * se descifra bien; si algo falla devuelve null y el registro se deja como estaba.
 * @param {Object|null} record - lo guardado en ghPublish
 * @param {CryptoKey|null} key - clave de la sesión
 * @returns {Promise<Object|null>} el registro nuevo, o null si no hay nada que migrar o falló
 */
export function migrateGhPublish(record, key) {
  return migrateLegacyToken(record, key);
}

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
 * ¿Hay datos de la versión antigua (calendarioDB) por migrar? Sirve para no
 * enseñar el asistente de primer uso a quien ya usaba la app.
 * @returns {Promise<boolean>}
 */
export async function hasLegacyData() {
  const db = await openOldDB();
  if (!db) return false;
  try {
    const names = [...db.objectStoreNames];
    for (const name of names) {
      const n = await new Promise(resolve => {
        try {
          const req = db.transaction(name, 'readonly').objectStore(name).count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(0);
        } catch { resolve(0); }
      });
      if (n > 0) return true;
    }
    return false;
  } finally {
    db.close();
  }
}

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
