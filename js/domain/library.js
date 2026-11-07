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

/** Encrypt the list of documents. */
export async function packIndex(docs, password, updatedAt = new Date().toISOString()) {
  const bytes = new TextEncoder().encode(JSON.stringify({ docs }));
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
  return { docs: Array.isArray(parsed.docs) ? parsed.docs : [], updatedAt: file.updatedAt };
}

/** Sort and filter for the list: newest first; search in title, note and category. */
export function filterDocs(docs = [], { query = '', category = '' } = {}) {
  const q = String(query).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return docs
    .filter(d => !category || d.categoria === category)
    .filter(d => !q || `${d.titulo} ${d.nota || ''} ${categoryLabel(d.categoria)} ${d.nombre || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
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
    return { offline: true, docs: (await cachedIndex(password))?.docs || [] };
  }
  if (res.status === 404) return { docs: [] };
  if (!res.ok) return { offline: true, docs: (await cachedIndex(password))?.docs || [] };
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
  if (!cfg?.token || !password) throw new Error('Configura antes la contraseña del grupo y el modo administrador (Ajustes → Cuadrante compartido)');
  return { cfg, password };
}

async function writeIndex(docs, { cfg, password }, message) {
  const file = await packIndex(docs, password);
  await ghPutContent({ ...cfg, path: INDEX_PATH, contentBase64: bytesToBase64(new TextEncoder().encode(JSON.stringify(file))), message });
}

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Encrypt and upload a document, then add it to the index.
 * @param {{file: File, titulo: string, categoria: string, nota?: string, docs: Array}} p
 */
export async function uploadDoc({ file, titulo, categoria, nota = '', docs }) {
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
    fecha: new Date().toISOString(), path
  };
  const next = [...docs.filter(d => d.id !== id), doc];
  await writeIndex(next, ctx, 'Biblioteca actualizada (cifrada)');
  return next;
}

/** Add a link (intranet, BOE…) to the index. */
export async function addLink({ titulo, url, categoria, nota = '', docs }) {
  if (!/^https?:\/\/\S+$/i.test(String(url).trim())) throw new Error('El enlace debe empezar por https://');
  const ctx = await adminContext();
  const doc = { id: newId(), tipo: 'enlace', titulo: titulo.trim() || url, categoria, nota: nota.trim(), url: url.trim(), fecha: new Date().toISOString() };
  const next = [...docs, doc];
  await writeIndex(next, ctx, 'Biblioteca actualizada (cifrada)');
  return next;
}

/** Remove a document (and its encrypted file) or a link. */
export async function removeDoc({ doc, docs }) {
  const ctx = await adminContext();
  const next = docs.filter(d => d.id !== doc.id);
  await writeIndex(next, ctx, 'Biblioteca actualizada (cifrada)');
  if (doc.tipo === 'archivo' && doc.path) {
    try { await ghDeleteContent({ ...ctx.cfg, path: doc.path, message: 'Biblioteca: documento retirado' }); } catch { /* the index no longer lists it */ }
  }
  return next;
}

/** "1,2 MB" */
export function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;
}
