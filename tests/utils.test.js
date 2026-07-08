import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../js/ui/utils.js';

test('esc neutraliza HTML malicioso', () => {
  assert.equal(
    esc('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;'
  );
});

test('esc escapa comillas para atributos', () => {
  assert.equal(esc('a"b\'c'), 'a&quot;b&#39;c');
});

test('esc escapa & antes que el resto (sin doble escape)', () => {
  assert.equal(esc('&lt;'), '&amp;lt;');
});

test('esc tolera null, undefined y números', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(60), '60');
});

test('esc no altera texto normal en español', () => {
  assert.equal(esc('García López, año 2026 · Ñ'), 'García López, año 2026 · Ñ');
});
