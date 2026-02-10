/**
 * @module persistence/db
 * IndexedDB wrapper for CalGuard - Policía Científica
 * Database: calguardDB v2
 * Stores: profiles, days, ledger, services, config, audit
 */

const DB_NAME = 'calguardDB';
const DB_VERSION = 2;

const STORES = {
  PROFILES: 'profiles',
  DAYS: 'days',
  LEDGER: 'ledger',
  SERVICES: 'services',
  CONFIG: 'config',
  AUDIT: 'audit'
};

/** @type {IDBDatabase|null} */
let _db = null;

/**
 * Open (or create) the database. Handles upgrades.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion;

      if (oldVersion < 1) {
        // Legacy stores from old app (calendarioDB) won't be here,
        // migration handled separately in migrations.js
      }

      if (oldVersion < 2) {
        // profiles
        if (!db.objectStoreNames.contains(STORES.PROFILES)) {
          const ps = db.createObjectStore(STORES.PROFILES, { keyPath: 'id' });
          ps.createIndex('name', 'name', { unique: false });
        }

        // days: composite key profileId+dateISO
        if (!db.objectStoreNames.contains(STORES.DAYS)) {
          const ds = db.createObjectStore(STORES.DAYS, { keyPath: ['profileId', 'dateISO'] });
          ds.createIndex('profileId', 'profileId', { unique: false });
          ds.createIndex('dateISO', 'dateISO', { unique: false });
        }

        // ledger movements
        if (!db.objectStoreNames.contains(STORES.LEDGER)) {
          const ls = db.createObjectStore(STORES.LEDGER, { keyPath: 'id' });
          ls.createIndex('profileId', 'profileId', { unique: false });
          ls.createIndex('dateISO', 'dateISO', { unique: false });
          ls.createIndex('kind', 'kind', { unique: false });
          ls.createIndex('category', 'category', { unique: false });
        }

        // service logs
        if (!db.objectStoreNames.contains(STORES.SERVICES)) {
          const ss = db.createObjectStore(STORES.SERVICES, { keyPath: 'id' });
          ss.createIndex('profileId', 'profileId', { unique: false });
          ss.createIndex('dateISO', 'dateISO', { unique: false });
          ss.createIndex('type', 'type', { unique: false });
        }

        // config
        if (!db.objectStoreNames.contains(STORES.CONFIG)) {
          db.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
        }

        // audit log
        if (!db.objectStoreNames.contains(STORES.AUDIT)) {
          const as = db.createObjectStore(STORES.AUDIT, { keyPath: 'id' });
          as.createIndex('profileId', 'profileId', { unique: false });
          as.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = (e) => {
      reject(new Error('IndexedDB open failed: ' + e.target.error));
    };
  });
}

/**
 * Get the active DB instance
 * @returns {IDBDatabase}
 */
export function getDB() {
  if (!_db) throw new Error('Database not initialized. Call openDB() first.');
  return _db;
}

// ─── Generic CRUD helpers ───

/**
 * @param {string} storeName
 * @param {*} record
 * @returns {Promise<void>}
 */
export function put(storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * @param {string} storeName
 * @param {*} key
 * @returns {Promise<*>}
 */
export function get(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
export function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * @param {string} storeName
 * @param {string} indexName
 * @param {*} value
 * @returns {Promise<Array>}
 */
export function getAllByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readonly');
    const idx = tx.objectStore(storeName).index(indexName);
    const req = idx.getAll(IDBKeyRange.only(value));
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * @param {string} storeName
 * @param {*} key
 * @returns {Promise<void>}
 */
export function remove(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * @param {string} storeName
 * @returns {Promise<number>}
 */
export function count(storeName) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ─── Bulk operations ───

/**
 * @param {string} storeName
 * @param {Array} records
 * @returns {Promise<void>}
 */
export function putAll(storeName, records) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const rec of records) {
      store.put(rec);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Test that IndexedDB works (read/write cycle)
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function testReadWrite() {
  try {
    const testKey = '__diag_test__';
    await put(STORES.CONFIG, { key: testKey, value: Date.now() });
    const result = await get(STORES.CONFIG, testKey);
    await remove(STORES.CONFIG, testKey);
    return { ok: !!result, error: result ? undefined : 'Read returned null' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export { STORES, DB_NAME, DB_VERSION };
