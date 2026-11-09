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

// ─── v34: temas, fichas y paquetes ───
import { renderMarkdown } from '../js/ui/markdown.js';
import { topicButtons, readBundle, mergeTemas } from '../js/domain/library.js';

test('ficha: Markdown seguro para el móvil (sin HTML del contenido, solo enlaces permitidos)', () => {
  const html = renderMarkdown([
    '# Título', 'Texto con **negrita** y <script>alert(1)</script>.',
    '- uno', '  - sub', '- dos', '', '1. primero', '2. segundo', '',
    '> Ojo: plazo **72 h**', '', '| Caso | Quién |', '|---|---|', '| A | ODAC |', '',
    '[llamar](tel:963351282) · [web](javascript:alert(1)) · correo cgpc.facial@policia.es'
  ].join('\n'));
  assert.ok(html.includes('<h3>Título</h3>'));
  assert.ok(html.includes('<strong>negrita</strong>'));
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<ul><li>uno<ul><li>sub</li></ul></li><li>dos</li></ul>'));
  assert.ok(html.includes('<ol><li>primero</li><li>segundo</li></ol>'));
  assert.ok(html.includes('<div class="md-note">Ojo: plazo <strong>72 h</strong></div>'));
  assert.ok(html.includes('<th>Caso</th>') && html.includes('<td>ODAC</td>') && !html.includes('---'));
  assert.ok(html.includes('<a href="tel:963351282">llamar</a>'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('<a href="mailto:cgpc.facial@policia.es">cgpc.facial@policia.es</a>'));
});

test('biblioteca por temas: botones con lo que tienen dentro, y «Otros»', () => {
  const temas = [{ key: 'b', nombre: 'B', icono: '🅱️', orden: 2 }, { key: 'a', nombre: 'A', icono: '🅰️', orden: 1 }, { key: 'vacio', nombre: 'Vacío', orden: 3 }];
  const docs = [{ id: 1, tema: 'a' }, { id: 2, tema: 'b' }, { id: 3, tema: 'b' }, { id: 4 }];
  assert.deepEqual(topicButtons(docs, temas).map(t => [t.key, t.n]), [['a', 1], ['b', 2], ['', 1]]);
  const fichas = filterDocs([
    { id: 'x', tipo: 'archivo', tema: 'a', titulo: 'PDF', fecha: '2026-11-09' },
    { id: 'y', tipo: 'ficha', tema: 'a', titulo: 'Paso 2', orden: 2, md: 'texto con la palabra clave' },
    { id: 'z', tipo: 'ficha', tema: 'a', titulo: 'Paso 1', orden: 1, md: '' }
  ], { tema: 'a', temas });
  assert.deepEqual(fichas.map(d => d.id), ['z', 'y', 'x']);           // fichas first, in order
  assert.deepEqual(filterDocs(fichas, { query: 'palabra clave', temas }).map(d => d.id), ['y']); // search inside the text
});

test('paquete de biblioteca: se valida y se resume; los temas se fusionan', () => {
  const b = readBundle(JSON.stringify({
    format: 'calguard-biblioteca-paquete', v: 1,
    temas: [{ key: 'adn', nombre: 'ADN', icono: '🧬', orden: 2 }],
    docs: [
      { tipo: 'ficha', clave: 'adn-1', tema: 'adn', titulo: 'Reseña genética', md: '# ADN' },
      { tipo: 'archivo', clave: 'adn-pdf', tema: 'adn', titulo: 'Original', nombre: 'a.pdf', mime: 'application/pdf', base64: 'JVBERi0x' },
      { tipo: 'raro', titulo: 'no' }
    ]
  }));
  assert.equal(b.fichas, 1);
  assert.equal(b.archivos, 1);
  assert.equal(b.docs.length, 2);
  assert.equal(b.bytes, 6);
  assert.throws(() => readBundle('{"format":"otra"}'));
  assert.throws(() => readBundle('no es json'));
  assert.deepEqual(mergeTemas([{ key: 'adn', nombre: 'Viejo' }, { key: 'x', nombre: 'X' }], b.temas).map(t => t.nombre), ['ADN', 'X']);
});
