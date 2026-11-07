import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packCuadrante, unpackCuadrante, guessRepo } from '../js/domain/sharedCuadrante.js';
import { notesCount, localIsNewer } from '../js/domain/groupCuadrante.js';

const entries = [];
for (let d = 1; d <= 28; d++) {
  for (const person of ['TESA', 'Mª CARMEN', 'JUAN']) {
    entries.push({ date: `2026-02-${String(d).padStart(2, '0')}`, person, code: d % 7 === 0 ? 'INC' : 'M', tagType: d % 7 === 0 ? 'GUARDIA_REAL' : 'TURNO_M' });
  }
}

test('cuadrante publicado: se cifra (ilegible) y se recupera con la contraseña del grupo', async () => {
  const file = await packCuadrante({ entries, fileName: 'CUADRANTE.xlsx' }, 'contraseña-del-grupo', '2026-11-03T08:00:00.000Z');
  const text = JSON.stringify(file);
  assert.equal(file.format, 'calguard-cuadrante-grupo');
  assert.ok(!text.includes('CARMEN') && !text.includes('TESA'), 'no debe verse ningún nombre');
  const data = await unpackCuadrante(file, 'contraseña-del-grupo');
  assert.equal(data.entries.length, entries.length);
  assert.deepEqual(data.names.sort(), ['JUAN', 'Mª CARMEN', 'TESA']);
  assert.equal(data.publishedAt, '2026-11-03T08:00:00.000Z');
  assert.equal(data.fileName, 'CUADRANTE.xlsx');
});

test('cuadrante publicado: las notas del Excel llegan intactas a los compañeros', async () => {
  const withNotes = entries.map((e, i) => (e.tagType === 'GUARDIA_REAL' && i % 2 ? { ...e, note: 'Cambio con Juan' } : e));
  withNotes.push({ date: '2026-03-02', person: 'JUAN', code: 'CH', tagType: 'LIBRE', note: 'CH Incidencias 7-8 feb. Día 1º' });
  assert.equal(notesCount({ entries: withNotes }), withNotes.filter(e => e.note).length);
  assert.ok(notesCount({ entries: withNotes }) > 1);
  const data = await unpackCuadrante(await packCuadrante({ entries: withNotes }, 'contraseña-del-grupo'), 'contraseña-del-grupo');
  assert.equal(notesCount(data), notesCount({ entries: withNotes }));
  assert.equal(data.entries.find(e => e.date === '2026-03-02').note, 'CH Incidencias 7-8 feb. Día 1º');
});

test('archivo publicado: dice cuántos turnos y notas lleva (sin mostrar nombres)', async () => {
  const withNote = [...entries, { date: '2026-03-02', person: 'JUAN', code: 'CH', tagType: 'LIBRE', note: 'CH Incidencias 7-8 feb. Día 1º' }];
  const file = await packCuadrante({ entries: withNote }, 'contraseña-del-grupo');
  assert.equal(file.notas, 1);
  assert.equal(file.turnos, withNote.length);
  assert.ok(!JSON.stringify(file).includes('JUAN'));
});

test('un Excel cargado en el dispositivo después de la publicación no se sustituye por la publicada', () => {
  const published = { publishedAt: '2026-11-06T19:51:00.000Z' };
  const fresh = { entries, importedAt: '2026-11-07T16:50:00.000Z', fileName: 'C.xlsx' };
  assert.equal(localIsNewer(fresh, published), true);
  // older local file, a pulled one, or one already published from here: the publication may replace it
  assert.equal(localIsNewer({ ...fresh, importedAt: '2026-11-05T10:00:00.000Z' }, published), false);
  assert.equal(localIsNewer({ ...fresh, source: 'publicado', publishedAt: '2026-11-06T19:51:00.000Z' }, { publishedAt: '2026-11-07T18:00:00.000Z' }), false);
  assert.equal(localIsNewer({ ...fresh, publishedAt: '2026-11-07T16:56:00.000Z' }, { publishedAt: '2026-11-07T16:56:00.000Z' }), false);
  assert.equal(localIsNewer(null, published), false);
});

test('cuadrante sin notas (cargado con una versión antigua): se detecta', () => {
  assert.equal(notesCount({ entries }), 0);
  assert.equal(notesCount(null), 0);
  assert.equal(notesCount({}), 0);
});

test('cuadrante publicado: contraseña incorrecta → error BAD_PASSWORD', async () => {
  const file = await packCuadrante({ entries }, 'contraseña-del-grupo');
  await assert.rejects(() => unpackCuadrante(file, 'otra-contraseña'), e => e.code === 'BAD_PASSWORD');
});

test('cuadrante publicado: contraseña demasiado corta se rechaza', async () => {
  await assert.rejects(() => packCuadrante({ entries }, '1234'));
});

test('guessRepo deduce usuario y repositorio de la dirección de GitHub Pages', () => {
  assert.deepEqual(guessRepo({ hostname: 'juantuporaqui.github.io', pathname: '/calguard/index.html' }), { owner: 'juantuporaqui', repo: 'calguard' });
  assert.deepEqual(guessRepo({ hostname: 'localhost', pathname: '/' }), { owner: '', repo: '' });
});
