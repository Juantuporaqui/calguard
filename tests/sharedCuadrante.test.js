import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packCuadrante, unpackCuadrante, guessRepo } from '../js/domain/sharedCuadrante.js';

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
