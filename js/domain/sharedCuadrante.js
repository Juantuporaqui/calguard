/**
 * @module domain/sharedCuadrante
 * Cuadrante del grupo publicado y CIFRADO junto a la app (GitHub Pages).
 *
 *  - El administrador carga el Excel y pulsa «Publicar»: la app lo comprime,
 *    lo cifra con la contraseña del grupo (AES-GCM + PBKDF2) y lo sube al
 *    repositorio con la API de GitHub (token suyo, guardado solo en su móvil).
 *  - Cada compañero guarda una vez la contraseña del grupo. Al abrir la app
 *    (y al volver a ella) se descarga el archivo publicado; si es más nuevo que
 *    el suyo, lo descifra, lo guarda y su contabilidad se pone al día sola.
 *
 * El repositorio es público: sin la contraseña el archivo es ilegible.
 */

import { get, put, remove, STORES } from '../persistence/db.js';
import { encryptBytes, decryptBytes, bytesToBase64 } from '../persistence/crypto.js';
import { loadGroupCuadrante, saveGroupCuadrante } from './groupCuadrante.js';
import { getPersonNames } from '../imports/cuadranteParser.js';

export const PUBLISHED_PATH = 'data/cuadrante.enc.json';
const FORMAT = 'calguard-cuadrante-grupo';
const KEY_GROUP = 'groupKey';          // contraseña del grupo (cada dispositivo)
const KEY_PUBLISH = 'ghPublish';       // {token, owner, repo, branch, lastPublishedAt} (solo admin)
const KEY_SEEN = 'sharedSeen';         // {publishedAt, failedAt} último publicado visto

// ─── Empaquetado (puro, probado en node) ───

async function gzip(bytes) {
  if (typeof CompressionStream === 'undefined') return { bytes, gz: false };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), gz: true };
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Build the publishable (encrypted) file for a group cuadrante.
 * @param {{entries: Array, fileName?: string}} data
 * @param {string} password
 * @param {string} [publishedAt]
 */
export async function packCuadrante(data, password, publishedAt = new Date().toISOString()) {
  if (!password || password.length < 8) throw new Error('La contraseña del grupo debe tener al menos 8 caracteres');
  const json = JSON.stringify({ entries: data.entries, fileName: data.fileName || 'cuadrante', fichas: data.fichas || {} });
  const { bytes, gz } = await gzip(new TextEncoder().encode(json));
  return {
    format: FORMAT,
    v: 1,
    publishedAt,
    gz,
    payload: await encryptBytes(bytes, password)
  };
}

/**
 * Decrypt a published file into group-cuadrante data.
 * @throws {Error} with code 'BAD_PASSWORD' when the password is wrong
 */
export async function unpackCuadrante(file, password) {
  if (!file || file.format !== FORMAT || !file.payload) throw new Error('El archivo publicado no es un cuadrante de CalGuard');
  let bytes;
  try {
    bytes = await decryptBytes(file.payload, password);
  } catch {
    const err = new Error('La contraseña del grupo no es correcta');
    err.code = 'BAD_PASSWORD';
    throw err;
  }
  if (file.gz) bytes = await gunzip(bytes);
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  const entries = (parsed.entries || []).filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.person && e.tagType);
  if (!entries.length) throw new Error('El cuadrante publicado está vacío');
  return { entries, names: getPersonNames(entries), fileName: parsed.fileName, publishedAt: file.publishedAt, fichas: parsed.fichas || {} };
}

// ─── Ajustes guardados en el dispositivo ───

export async function getGroupPassword() {
  return (await get(STORES.CONFIG, KEY_GROUP))?.value || null;
}

export async function setGroupPassword(password) {
  if (!password) { await remove(STORES.CONFIG, KEY_GROUP); return; }
  if (password.length < 8) throw new Error('La contraseña del grupo debe tener al menos 8 caracteres');
  await put(STORES.CONFIG, { key: KEY_GROUP, value: password });
  await remove(STORES.CONFIG, KEY_SEEN); // vuelve a intentar con la nueva
}

export async function getPublishSettings() {
  return (await get(STORES.CONFIG, KEY_PUBLISH))?.value || null;
}

export async function setPublishSettings(value) {
  if (!value) { await remove(STORES.CONFIG, KEY_PUBLISH); return; }
  await put(STORES.CONFIG, { key: KEY_PUBLISH, value });
}

export async function getSharedStatus() {
  return (await get(STORES.CONFIG, KEY_SEEN))?.value || {};
}

/** Owner/repo guessed from the GitHub Pages address (owner.github.io/repo/). */
export function guessRepo(loc = globalThis.location) {
  const host = loc?.hostname || '';
  const m = host.match(/^([^.]+)\.github\.io$/i);
  const repo = (loc?.pathname || '').split('/').filter(Boolean)[0] || '';
  return { owner: m ? m[1] : '', repo: m ? repo : '' };
}

// ─── Descarga (cada compañero) ───

/** The published file, or null if there is none (404) or we are offline. */
export async function fetchPublished() {
  let res;
  try {
    res = await fetch(`./${PUBLISHED_PATH}?t=${Date.now()}`, { cache: 'no-store' });
  } catch {
    return null; // offline
  }
  if (res.status === 404 || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

/**
 * Download the published cuadrante if it is newer than the one on this device.
 * @param {{force?: boolean}} [opts] - force: also retry a password that failed
 * @returns {Promise<null | {updated: boolean, publishedAt?: string, error?: string, code?: string}>}
 */
export async function pullPublished({ force = false } = {}) {
  const password = await getGroupPassword();
  if (!password) return null;
  const file = await fetchPublished();
  if (!file?.publishedAt) return { updated: false, error: force ? 'Todavía no hay ningún cuadrante publicado' : undefined };

  const local = await loadGroupCuadrante();
  const localStamp = local?.publishedAt || local?.importedAt || '';
  if (!force && localStamp && file.publishedAt <= localStamp) return { updated: false, publishedAt: file.publishedAt };

  const seen = await getSharedStatus();
  if (!force && seen.failedAt === file.publishedAt) return { updated: false, code: 'BAD_PASSWORD' };

  try {
    const data = await unpackCuadrante(file, password);
    await saveGroupCuadrante({
      entries: data.entries,
      names: data.names,
      fileName: data.fileName,
      fichas: data.fichas,
      publishedAt: data.publishedAt,
      importedAt: new Date().toISOString(),
      source: 'publicado'
    });
    await put(STORES.CONFIG, { key: KEY_SEEN, value: { publishedAt: file.publishedAt } });
    return { updated: true, publishedAt: file.publishedAt };
  } catch (err) {
    if (err.code === 'BAD_PASSWORD') {
      await put(STORES.CONFIG, { key: KEY_SEEN, value: { ...seen, failedAt: file.publishedAt } });
    }
    return { updated: false, error: err.message, code: err.code };
  }
}

// ─── Publicación (administrador) ───

async function gh(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

function ghError(status, json) {
  if (status === 401) return 'El token de GitHub no es válido o ha caducado';
  if (status === 403 || status === 404) return 'El token no tiene permiso de escritura en el repositorio (Contents: Read and write)';
  if (status === 409 || status === 422) return 'GitHub rechazó el cambio; vuelve a intentarlo';
  return json?.message ? `GitHub: ${json.message}` : `GitHub respondió ${status}`;
}

/**
 * Encrypt and publish the group cuadrante currently on this device.
 * @param {{token: string, owner: string, repo: string, branch?: string, password: string, data?: Object}} p
 * @returns {Promise<{publishedAt: string, commitUrl?: string}>}
 */
export async function publishCuadrante({ token, owner, repo, branch = 'main', password, data, fichas }) {
  if (!token) throw new Error('Falta el token de GitHub del administrador');
  if (!owner || !repo) throw new Error('Indica el usuario y el repositorio de GitHub');
  const stored = data || await loadGroupCuadrante();
  if (!stored?.entries?.length) throw new Error('Primero carga el cuadrante del grupo en este dispositivo');
  const cuadrante = fichas ? { ...stored, fichas } : stored;

  const file = await packCuadrante(cuadrante, password);
  const content = bytesToBase64(new TextEncoder().encode(JSON.stringify(file)));
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${PUBLISHED_PATH}`;
  const message = `Cuadrante del grupo publicado el ${file.publishedAt.slice(0, 16).replace('T', ' ')} (cifrado)`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await gh(`${path}?ref=${encodeURIComponent(branch)}`, { token });
    if (!current.ok && current.status !== 404) throw new Error(ghError(current.status, current.json));
    const res = await gh(path, {
      token,
      method: 'PUT',
      body: { message, content, branch, ...(current.ok && current.json?.sha ? { sha: current.json.sha } : {}) }
    });
    if (res.ok) {
      // this device already has it: don't download it back as "new"
      await saveGroupCuadrante({ ...cuadrante, publishedAt: file.publishedAt });
      await put(STORES.CONFIG, { key: KEY_SEEN, value: { publishedAt: file.publishedAt } });
      return { publishedAt: file.publishedAt, commitUrl: res.json?.commit?.html_url };
    }
    if (res.status !== 409 || attempt === 1) throw new Error(ghError(res.status, res.json));
  }
  throw new Error('No se pudo publicar');
}
