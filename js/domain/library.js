/**
 * @module domain/library
 * Biblioteca del grupo: manuales operativos, instrucciones, órdenes… que el
 * administrador cuelga para consulta.
 *
 * El repositorio es PÚBLICO: cada documento se sube CIFRADO con la contraseña
 * del grupo (AES-GCM + PBKDF2, como el cuadrante) y el índice también. Sin la
 * contraseña nadie puede leer ni los títulos. Cada móvil guarda una copia
 * cifrada de lo que abre para poder consultarlo sin conexión.
 */

import { encryptBytes, decryptBytes, bytesToBase64 } from '../persistence/crypto.js';
import { getGroupPassword, getPublishSettings, ghPutContent, ghDeleteContent } from './sharedCuadrante.js';

export const INDEX_PATH = 'data/biblioteca.enc.json';
const DOC_DIR = 'data/biblioteca';
const FORMAT = 'calguard-biblioteca';
const OFFLINE_CACHE = 'calguard-shared';   // kept across app updates
const OFFLINE_PREFIX = './__biblioteca/';
export const MAX_BYTES = 15 * 1024 * 1024;

export const CATEGORIES = [
  { key: 'manual', label: 'Manuales operativos' },
  { key: 'instruccion', label: 'Instrucciones' },
  { key: 'orden', label: 'Órdenes' },
  { key: 'formulario', label: 'Formularios y modelos' },
  { key: 'otro', label: 'Otros' }
];

export function categoryLabel(key) {
  return CATEGORIES.find(c => c.key === key)?.label || 'Otros';
}

// ─── Índice (puro) ───

/** Encrypt the list of documents (and the topics they are grouped in). */
export async function packIndex(docs, password, updatedAt = new Date().toISOString(), temas = []) {
  const bytes = new TextEncoder().encode(JSON.stringify({ docs, temas }));
  return { format: FORMAT, v: 1, updatedAt, payload: await encryptBytes(bytes, password) };
}

/** Decrypt the list of documents. @throws {Error} code BAD_PASSWORD */
export async function unpackIndex(file, password) {
  if (!file || file.format !== FORMAT || !file.payload) throw new Error('El índice de la biblioteca no es válido');
  let bytes;
  try {
    bytes = await decryptBytes(file.payload, password);
  } catch {
    const err = new Error('La contraseña del grupo no abre la biblioteca');
    err.code = 'BAD_PASSWORD';
    throw err;
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  return { docs: Array.isArray(parsed.docs) ? parsed.docs : [], temas: Array.isArray(parsed.temas) ? parsed.temas : [], updatedAt: file.updatedAt };
}

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Sort and filter for the list. Search looks in the title, note, category,
 * topic and the text of the fichas. Within a topic: fichas first, in their
 * order; then the rest, newest first.
 */
export function filterDocs(docs = [], { query = '', category = '', tema = null, temas = [] } = {}) {
  const q = fold(query).trim();
  const temaName = key => temas.find(t => t.key === key)?.nombre || '';
  return docs
    .filter(d => !category || d.categoria === category)
    .filter(d => tema === null || (tema === '' ? !d.tema || !temas.some(t => t.key === d.tema) : d.tema === tema))
    .filter(d => !q || fold(`${d.titulo} ${d.nota || ''} ${categoryLabel(d.categoria)} ${d.nombre || ''} ${temaName(d.tema)} ${d.md || ''}`).includes(q))
    .sort((a, b) => (a.tipo === 'ficha' ? 0 : 1) - (b.tipo === 'ficha' ? 0 : 1)
      || (a.tipo === 'ficha' && b.tipo === 'ficha' ? (Number(a.orden) || 0) - (Number(b.orden) || 0) : 0)
      || String(b.fecha).localeCompare(String(a.fecha)));
}

/**
 * Topics to show as buttons: those with something in them, in their order,
 * plus «Otros» for what has no topic.
 * @returns {Array<{key: string, nombre: string, icono: string, n: number}>}
 */
export function topicButtons(docs = [], temas = []) {
  const known = new Set(temas.map(t => t.key));
  const out = [...temas]
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))
    .map(t => ({ key: t.key, nombre: t.nombre, icono: t.icono || '📁', n: docs.filter(d => d.tema === t.key).length }))
    .filter(t => t.n > 0);
  const rest = docs.filter(d => !d.tema || !known.has(d.tema)).length;
  if (rest && out.length) out.push({ key: '', nombre: 'Otros', icono: '🗂️', n: rest });
  return out;
}

// ─── Lectura (cada compañero) ───

/** The published index, or null (none yet / offline). */
export async function fetchIndex() {
  const password = await getGroupPassword();
  if (!password) return { error: 'NO_PASSWORD', docs: [] };
  let res;
  try {
    res = await fetch(`./${INDEX_PATH}?t=${Date.now()}`, { cache: 'no-store' });
  } catch {
    const c = await cachedIndex(password);
    return { offline: true, docs: c?.docs || [], temas: c?.temas || [] };
  }
  if (res.status === 404) return { docs: [], temas: [] };
  if (!res.ok) {
    const c = await cachedIndex(password);
    return { offline: true, docs: c?.docs || [], temas: c?.temas || [] };
  }
  const file = await res.json();
  const out = await unpackIndex(file, password);
  try { (await caches.open(OFFLINE_CACHE)).put(`${OFFLINE_PREFIX}index`, new Response(JSON.stringify(file))); } catch { /* no cache */ }
  return out;
}

async function cachedIndex(password) {
  try {
    const r = await (await caches.open(OFFLINE_CACHE)).match(`${OFFLINE_PREFIX}index`);
    return r ? unpackIndex(await r.json(), password) : null;
  } catch {
    return null;
  }
}

/** Is a copy of this document kept on the device? */
export async function isOffline(doc) {
  try { return Boolean(await (await caches.open(OFFLINE_CACHE)).match(`${OFFLINE_PREFIX}${doc.id}`)); } catch { return false; }
}

/**
 * Download (or take from the device) and decrypt one document.
 * @returns {Promise<Blob>}
 */
export async function openDoc(doc) {
  const password = await getGroupPassword();
  if (!password) throw new Error('Falta la contraseña del grupo');
  let raw = null;
  let cache = null;
  try { cache = await caches.open(OFFLINE_CACHE); } catch { /* no cache */ }
  const key = `${OFFLINE_PREFIX}${doc.id}`;
  const hit = cache ? await cache.match(key) : null;
  if (hit) raw = new Uint8Array(await hit.arrayBuffer());
  if (!raw) {
    const res = await fetch(`./${doc.path}?t=${doc.fecha || ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status === 404 ? 'El documento aún no está disponible (se publicó hace un momento: prueba en 1–2 minutos)' : `No se pudo descargar (${res.status})`);
    raw = new Uint8Array(await res.arrayBuffer());
    try { await cache?.put(key, new Response(raw)); } catch { /* full */ }
  }
  let bytes;
  try {
    bytes = await decryptBytes(bytesToBase64(raw), password);
  } catch {
    throw new Error('La contraseña del grupo no abre este documento');
  }
  return new Blob([bytes], { type: doc.mime || 'application/octet-stream' });
}

/** Forget the copies kept on the device (they download again when opened). */
export async function clearOfflineDocs() {
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    for (const req of await cache.keys()) if (req.url.includes('/__biblioteca/')) await cache.delete(req);
  } catch { /* nothing */ }
}

// ─── Publicación (administrador) ───

async function adminContext() {
  const cfg = await getPublishSettings();
  const password = await getGroupPassword();
  if (!cfg?.token || !password) throw new Error('Antes pon la contraseña del grupo y el token de GitHub (Ajustes → Contraseña del grupo y Administración)');
  return { cfg, password };
}

async function writeIndex(docs, { cfg, password }, message, temas = []) {
  const file = await packIndex(docs, password, undefined, temas);
  await ghPutContent({ ...cfg, path: INDEX_PATH, contentBase64: bytesToBase64(new TextEncoder().encode(JSON.stringify(file))), message });
}

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Encrypt and upload a document, then add it to the index.
 * @param {{file: File, titulo: string, categoria: string, nota?: string, docs: Array}} p
 */
export async function uploadDoc({ file, titulo, categoria, nota = '', tema = '', docs, temas = [] }) {
  if (!file) throw new Error('Elige un archivo');
  if (file.size > MAX_BYTES) throw new Error(`El archivo pasa de ${Math.round(MAX_BYTES / 1048576)} MB: redúcelo o divídelo`);
  const ctx = await adminContext();
  const id = newId();
  const path = `${DOC_DIR}/${id}.bin`;
  const encrypted = await encryptBytes(new Uint8Array(await file.arrayBuffer()), ctx.password); // base64 of the raw ciphertext
  await ghPutContent({ ...ctx.cfg, path, contentBase64: encrypted, message: 'Biblioteca: documento añadido (cifrado)' });
  const doc = {
    id, tipo: 'archivo', titulo: titulo.trim() || file.name, categoria, nota: nota.trim(),
    nombre: file.name, mime: file.type || 'application/octet-stream', tamano: file.size,
    fecha: new Date().toISOString(), path, ...(tema ? { tema } : {})
  };
  const next = [...docs.filter(d => d.id !== id), doc];
  await writeIndex(next, ctx, 'Biblioteca actualizada (cifrada)', temas);
  return next;
}

/** Add a link (intranet, BOE…) to the index. */
export async function addLink({ titulo, url, categoria, nota = '', tema = '', docs, temas = [] }) {
  if (!/^https?:\/\/\S+$/i.test(String(url).trim())) throw new Error('El enlace debe empezar por https://');
  const ctx = await adminContext();
  const doc = { id: newId(), tipo: 'enlace', titulo: titulo.trim() || url, categoria, nota: nota.trim(), url: url.trim(), fecha: new Date().toISOString(), ...(tema ? { tema } : {}) };
  const next = [...docs, doc];
  await writeIndex(next, ctx, 'Biblioteca actualizada (cifrada)', temas);
  return next;
}

/** Remove a document (and its encrypted file) or a link. */
export async function removeDoc({ doc, docs, temas = [] }) {
  const ctx = await adminContext();
  const next = docs.filter(d => d.id !== doc.id);
  await writeIndex(next, ctx, 'Biblioteca actualizada (cifrada)', temas);
  if (doc.tipo === 'archivo' && doc.path) {
    try { await ghDeleteContent({ ...ctx.cfg, path: doc.path, message: 'Biblioteca: documento retirado' }); } catch { /* the index no longer lists it */ }
  }
  return next;
}

// ─── Paquete de biblioteca (administrador) ───
// A JSON file with topics, fichas (text) and documents (base64), prepared
// outside the app: everything is encrypted here before being uploaded. An item
// with the same «clave» as one already in the library replaces it.

const PACK_FORMAT = 'calguard-biblioteca-paquete';

/** Check a package and summarise it. @throws {Error} if it is not one */
export function readBundle(json) {
  let b;
  try { b = typeof json === 'string' ? JSON.parse(json) : json; } catch { throw new Error('El archivo no es un paquete de biblioteca'); }
  if (!b || b.format !== PACK_FORMAT || !Array.isArray(b.docs)) throw new Error('El archivo no es un paquete de biblioteca de CalGuard');
  const temas = (Array.isArray(b.temas) ? b.temas : []).filter(t => t && t.key && t.nombre)
    .map(t => ({ key: String(t.key), nombre: String(t.nombre), icono: String(t.icono || '📁'), orden: Number(t.orden) || 0 }));
  const docs = b.docs.filter(d => d && d.titulo && ['ficha', 'archivo', 'enlace'].includes(d.tipo)).map(d => ({
    clave: String(d.clave || ''), tipo: d.tipo, titulo: String(d.titulo), tema: d.tema ? String(d.tema) : '',
    categoria: CATEGORIES.some(c => c.key === d.categoria) ? d.categoria : (d.tipo === 'ficha' ? 'instruccion' : 'otro'),
    nota: String(d.nota || ''), orden: Number(d.orden) || 0,
    ...(d.tipo === 'ficha' ? { md: String(d.md || '') } : {}),
    ...(d.tipo === 'enlace' ? { url: String(d.url || '') } : {}),
    ...(d.tipo === 'archivo' ? { nombre: String(d.nombre || `${d.titulo}.pdf`), mime: String(d.mime || 'application/pdf'), base64: String(d.base64 || '') } : {})
  }));
  const bytes = docs.filter(d => d.tipo === 'archivo').reduce((n, d) => n + Math.floor(d.base64.length * 3 / 4), 0);
  if (docs.some(d => d.tipo === 'archivo' && (!d.base64 || d.base64.length * 3 / 4 > MAX_BYTES))) throw new Error(`Algún documento del paquete está vacío o pasa de ${Math.round(MAX_BYTES / 1048576)} MB`);
  if (docs.some(d => d.tipo === 'enlace' && !/^https?:\/\/\S+$/i.test(d.url))) throw new Error('Algún enlace del paquete no es válido');
  return {
    temas, docs, bytes,
    fichas: docs.filter(d => d.tipo === 'ficha').length,
    archivos: docs.filter(d => d.tipo === 'archivo').length,
    enlaces: docs.filter(d => d.tipo === 'enlace').length
  };
}

/** Merge topics: the package's replace those with the same key. */
export function mergeTemas(current = [], incoming = []) {
  const map = new Map(current.map(t => [t.key, t]));
  for (const t of incoming) map.set(t.key, t);
  return [...map.values()];
}

/**
 * Encrypt and upload a package (administrator).
 * @param {{bundle: ReturnType<typeof readBundle>, docs: Array, temas: Array, onProgress?: Function}} p
 * @returns {Promise<{docs: Array, temas: Array, added: number, replaced: number}>}
 */
export async function importBundle({ bundle, docs = [], temas = [], onProgress }) {
  const ctx = await adminContext();
  const stamp = new Date().toISOString();
  let next = [...docs];
  let added = 0, replaced = 0;
  const files = bundle.docs.filter(d => d.tipo === 'archivo');
  let done = 0;
  for (const d of bundle.docs) {
    const old = d.clave ? next.find(x => x.clave === d.clave) : null;
    const base = { tipo: d.tipo, titulo: d.titulo, categoria: d.categoria, nota: d.nota, fecha: stamp, ...(d.tema ? { tema: d.tema } : {}), ...(d.clave ? { clave: d.clave } : {}), ...(d.orden ? { orden: d.orden } : {}) };
    let doc;
    if (d.tipo === 'ficha') {
      doc = { id: old?.id || newId(), ...base, md: d.md };
    } else if (d.tipo === 'enlace') {
      doc = { id: old?.id || newId(), ...base, url: d.url };
    } else {
      onProgress?.(++done, files.length, d.titulo);
      const id = newId();
      const path = `${DOC_DIR}/${id}.bin`;
      const bytes = Uint8Array.from(atob(d.base64), c => c.charCodeAt(0));
      const encrypted = await encryptBytes(bytes, ctx.password);
      await ghPutContent({ ...ctx.cfg, path, contentBase64: encrypted, message: 'Biblioteca: documento añadido (cifrado)' });
      doc = { id, ...base, nombre: d.nombre, mime: d.mime, tamano: bytes.length, path };
      if (old?.path && old.path !== path) {
        try { await ghDeleteContent({ ...ctx.cfg, path: old.path, message: 'Biblioteca: documento sustituido' }); } catch { /* the index no longer lists it */ }
      }
    }
    if (old) { next = next.map(x => (x === old ? doc : x)); replaced++; } else { next.push(doc); added++; }
  }
  const allTemas = mergeTemas(temas, bundle.temas);
  await writeIndex(next, ctx, 'Biblioteca actualizada (cifrada)', allTemas);
  return { docs: next, temas: allTemas, added, replaced };
}

/** "1,2 MB" */
export function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;
}
