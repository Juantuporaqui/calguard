import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packIndex, unpackIndex, filterDocs, fmtSize, categoryLabel } from '../js/domain/library.js';
import { encryptBytes, decryptBytes, bytesToBase64, base64ToBytes } from '../js/persistence/crypto.js';

test('índice de la biblioteca: cifrado, y sin la contraseña no se lee ni el título', async () => {
  const docs = [{ id: '1', titulo: 'Manual de inspección ocular', categoria: 'manual', fecha: '2026-11-07T10:00:00Z' }];
  const file = await packIndex(docs, 'contraseña-del-grupo');
  assert.ok(!JSON.stringify(file).includes('inspección'));
  assert.deepEqual((await unpackIndex(file, 'contraseña-del-grupo')).docs, docs);
  await assert.rejects(() => unpackIndex(file, 'otra-contraseña'), e => e.code === 'BAD_PASSWORD');
});

test('documento: se sube como binario cifrado y se descifra igual', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.4 contenido');
  const b64 = await encryptBytes(bytes, 'contraseña-del-grupo');
  const raw = base64ToBytes(b64);                       // lo que guarda GitHub
  const back = await decryptBytes(bytesToBase64(raw), 'contraseña-del-grupo');
  assert.equal(new TextDecoder().decode(back), '%PDF-1.4 contenido');
});

test('búsqueda por título, nota y categoría; más recientes primero', () => {
  const docs = [
    { id: 'a', titulo: 'Orden de servicio 3/2026', categoria: 'orden', fecha: '2026-03-01' },
    { id: 'b', titulo: 'Manual de Lofoscopia', categoria: 'manual', nota: 'revelado de huellas', fecha: '2026-05-01' },
    { id: 'c', titulo: 'Instrucción vehículos', categoria: 'instruccion', fecha: '2026-06-01' }
  ];
  assert.deepEqual(filterDocs(docs).map(d => d.id), ['c', 'b', 'a']);
  assert.deepEqual(filterDocs(docs, { query: 'huellas' }).map(d => d.id), ['b']);
  assert.deepEqual(filterDocs(docs, { query: 'instruccion' }).map(d => d.id), ['c']);
  assert.deepEqual(filterDocs(docs, { category: 'orden' }).map(d => d.id), ['a']);
  assert.equal(fmtSize(1536000), '1,5 MB');
  assert.equal(categoryLabel('manual'), 'Manuales operativos');
});
