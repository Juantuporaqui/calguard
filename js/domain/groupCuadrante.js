/**
 * @module domain/groupCuadrante
 * Cuadrante grupal: almacenamiento, importación de archivos y nombres
 * canónicos de la plantilla (agrupa variantes como "CARMEN" / "Mª CARMEN").
 */

import { get, put, remove, STORES } from '../persistence/db.js';
import { parseCuadrante, getPersonNames } from '../imports/cuadranteParser.js';

const LEGACY_LOCALSTORAGE_KEY = 'calguard-cuadrante';
const RECORD_KEY = 'grupal';

/**
 * Canonical person name: the escalafón entry contained in the raw name
 * ("Mª CARMEN" → "CARMEN"), or the upper-cased name if none matches.
 * @param {string} name
 * @param {string[]} [escalafon]
 */
export function canonicalPerson(name, escalafon = []) {
  const up = String(name || '').toUpperCase().trim();
  const match = escalafon.find(o => up.includes(String(o).toUpperCase()));
  return match ? String(match).toUpperCase() : up;
}

/**
 * Current roster: escalafón entries (in order) present in the cuadrante. People
 * who are not in the escalafón (no longer in the brigade) are left out. With an
 * empty escalafón, everyone appears alphabetically.
 * @param {string[]} names - raw names from the cuadrante
 * @param {string[]} [escalafon]
 */
export function currentRoster(names, escalafon = []) {
  if (!escalafon.length) {
    return [...new Set(names.map(n => String(n).toUpperCase().trim()))].sort((a, b) => a.localeCompare(b, 'es'));
  }
  return escalafon
    .map(o => String(o).toUpperCase())
    .filter(o => names.some(n => String(n).toUpperCase().includes(o)));
}

/**
 * Entries of one canonical person.
 * @param {Array} entries
 * @param {string} canonical
 * @param {string[]} [escalafon]
 */
export function entriesForPerson(entries, canonical, escalafon = []) {
  const key = String(canonical).toUpperCase();
  return entries.filter(e => canonicalPerson(e.person, escalafon) === key);
}

/** Load the stored group cuadrante (migrating the legacy localStorage copy). */
export async function loadGroupCuadrante() {
  try {
    const record = await get(STORES.CUADRANTE, RECORD_KEY);
    if (record?.data) return record.data;
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_LOCALSTORAGE_KEY) : null;
    if (raw) {
      const data = JSON.parse(raw);
      await saveGroupCuadrante(data);
      localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
      return data;
    }
  } catch (err) {
    console.error('No se pudo cargar el cuadrante grupal:', err);
  }
  return null;
}

export function saveGroupCuadrante(data) {
  return put(STORES.CUADRANTE, { key: RECORD_KEY, data, updatedAt: new Date().toISOString() });
}

export async function clearGroupCuadrante() {
  await remove(STORES.CUADRANTE, RECORD_KEY);
  try { localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Parse a file (Excel/CSV/TXT/PDF, or JSON exported from CalGuard) and store it
 * as the group cuadrante.
 * @param {File} file
 * @returns {Promise<{data: Object, entries: number, names: number}>}
 */
export async function importGroupCuadranteFile(file) {
  let entries;
  if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
    const parsed = JSON.parse(await file.text());
    entries = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(entries)) throw new Error('El JSON no contiene turnos ("entries")');
    entries = entries.filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.person && e.tagType);
  } else {
    entries = await parseCuadrante(file);
  }
  if (!entries || entries.length === 0) {
    throw new Error('No se encontraron turnos en el archivo');
  }
  const names = getPersonNames(entries);
  const data = { entries, names, importedAt: new Date().toISOString(), fileName: file.name };
  await saveGroupCuadrante(data);
  return { data, entries: entries.length, names: names.length };
}
