/**
 * @module domain/groupCuadrante
 * Cuadrante grupal: almacenamiento, importación de archivos y nombres
 * canónicos de la plantilla (agrupa variantes como "CARMEN" / "Mª CARMEN").
 */

import { get, put, remove, STORES } from '../persistence/db.js';
import { parseCuadrante, getPersonNames, PARSER_VERSION } from '../imports/cuadranteParser.js';

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

/**
 * How many Excel notes (cell comments) a stored cuadrante carries. A cuadrante
 * loaded with an app older than v27 has none, so publishing it would hide every
 * note (which guard each CH pays, juicios, swaps…) from the whole group.
 * @param {{entries?: Array}} data
 * @returns {number}
 */
export function notesCount(data) {
  let n = 0;
  for (const e of data?.entries || []) if (e?.note) n++;
  return n;
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
  const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
  if (isJson) {
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
  // the fichas come with the publication, not with the Excel: a new Excel keeps
  // the last ones received (quotas, days per guard, «Jefatura»…)
  const prevFichas = (await loadGroupCuadrante().catch(() => null))?.fichas;
  const data = {
    entries, names, importedAt: new Date().toISOString(), fileName: file.name,
    ...(isJson ? {} : { parser: PARSER_VERSION }),
    ...(prevFichas && Object.keys(prevFichas).length ? { fichas: prevFichas } : {})
  };
  await saveGroupCuadrante(data);
  // keep the original file: a later version of the app reads it again by itself
  if (isJson) await forgetOriginal(); else await keepOriginal(file, data.importedAt);
  return { data, entries: entries.length, names: names.length };
}

// ─── Excel original (para releerlo con versiones nuevas) ───
// Kept in Cache Storage, which survives app updates and is not part of backups.

const ORIGINAL_CACHE = 'calguard-shared';
const ORIGINAL_KEY = './__cuadrante/original';

async function keepOriginal(file, importedAt) {
  try {
    const cache = await caches.open(ORIGINAL_CACHE);
    await cache.put(ORIGINAL_KEY, new Response(await file.arrayBuffer(), {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'cuadrante.xlsx'),
        'X-Imported-At': importedAt
      }
    }));
  } catch { /* no Cache Storage: the reading just won't be refreshed by itself */ }
}

async function forgetOriginal() {
  try { await (await caches.open(ORIGINAL_CACHE)).delete(ORIGINAL_KEY); } catch { /* nothing kept */ }
}

/** The original file of the stored cuadrante, if this device keeps it. */
async function loadOriginal() {
  try {
    const res = await (await caches.open(ORIGINAL_CACHE)).match(ORIGINAL_KEY);
    if (!res) return null;
    const name = decodeURIComponent(res.headers.get('X-File-Name') || 'cuadrante.xlsx');
    const blob = await res.blob();
    return { file: new File([blob], name, { type: blob.type }), importedAt: res.headers.get('X-Imported-At') || '' };
  } catch {
    return null;
  }
}

/**
 * Was the stored cuadrante read on this device by an older version of the
 * reader? Then read its original file again with this one (same file, same
 * date: only the reading improves).
 * @returns {Promise<{data: Object, notas: number}|null>} null when nothing changed
 */
export async function rereadIfOutdated() {
  const data = await loadGroupCuadrante();
  if (!data?.entries?.length || data.source === 'publicado') return null;
  if ((Number(data.parser) || 0) >= PARSER_VERSION) return null;
  const original = await loadOriginal();
  if (!original || original.importedAt !== data.importedAt) return null;
  let entries;
  try {
    entries = await parseCuadrante(original.file);
  } catch {
    return null;
  }
  if (!entries?.length) return null;
  const next = { ...data, entries, names: getPersonNames(entries), parser: PARSER_VERSION };
  await saveGroupCuadrante(next);
  return { data: next, notas: notesCount(next) };
}

/**
 * Should a published cuadrante replace the one on this device? Not when this
 * device loaded its own file after that publication (it is newer: e.g. the
 * administrator has just loaded the Excel and not published it yet), even if
 * the download is forced.
 * @param {Object|null} local - stored cuadrante
 * @param {{publishedAt: string}} file - published file
 * @returns {boolean}
 */
export function localIsNewer(local, file) {
  return Boolean(local?.entries?.length && local.source !== 'publicado' && !local.publishedAt
    && local.importedAt && file?.publishedAt && file.publishedAt <= local.importedAt);
}
