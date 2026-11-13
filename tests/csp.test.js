import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const jsFiles = (dir) => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
});

test('la CSP no permite estilos en línea', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  const styleSrc = csp.split(';').map(s => s.trim()).find(s => s.startsWith('style-src'));
  assert.equal(styleSrc, "style-src 'self'");
  assert.ok(!/unsafe-inline/.test(csp));
});

test('ningún HTML generado lleva atributos style (ni index.html)', () => {
  const offenders = [];
  for (const f of [...jsFiles(join(root, 'js')), join(root, 'index.html')]) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/\sstyle\s*=\s*["'`$]/.test(line) || /setAttribute\(\s*['"]style['"]/.test(line)) offenders.push(`${f.replace(root, '')}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
