import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  VISUAL_THEMES,
  ALLOWED_VISUAL_THEMES,
  DEFAULT_VISUAL_THEME,
  VISUAL_THEME_STORAGE_KEY,
  isValidVisualTheme,
  resolveVisualTheme,
  getSavedVisualTheme,
  applyVisualTheme,
  saveVisualTheme,
  initVisualTheme
} from '../js/ui/visualTheme.js';

function createMockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

function createMockRoot(initialClasses = []) {
  const attrs = new Map();
  const classes = new Set(initialClasses);
  return {
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => attrs.get(k) ?? null,
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c)
    }
  };
}

describe('Sistema de temas visuales — Fase 1.5 + Fase 2 (visualTheme + visualThemeBoot)', () => {
  it('define exactamente los cinco identificadores de tema autorizados', () => {
    assert.deepEqual(ALLOWED_VISUAL_THEMES, [
      'original',
      'f1',
      'avion',
      'cientifica',
      'naturaleza'
    ]);
    assert.equal(DEFAULT_VISUAL_THEME, 'original');
    for (const id of ALLOWED_VISUAL_THEMES) {
      assert.equal(VISUAL_THEMES[id].id, id);
      assert.equal(typeof VISUAL_THEMES[id].label, 'string');
      assert.ok(VISUAL_THEMES[id].label.length > 0);
    }
  });

  it('valida estrictamente los identificadores y rechaza valores desconocidos o maliciosos', () => {
    for (const id of ALLOWED_VISUAL_THEMES) {
      assert.equal(isValidVisualTheme(id), true);
      assert.equal(resolveVisualTheme(id), id);
    }
    for (const invalid of [
      '',
      null,
      undefined,
      123,
      {},
      'dark',
      'light',
      '__proto__',
      'constructor',
      'toString',
      '<script>alert(1)</script>',
      'f1" onload="alert(1)'
    ]) {
      assert.equal(isValidVisualTheme(invalid), false, `debe rechazar: ${String(invalid)}`);
      assert.equal(resolveVisualTheme(invalid), 'original');
    }
  });

  it('persiste y restaura el tema en localStorage manteniendo intactas las clases dark y text-*', () => {
    const storage = createMockStorage();
    const root = createMockRoot(['dark', 'text-lg']);

    assert.equal(initVisualTheme({ storage, root }), 'original');
    assert.equal(root.getAttribute('data-theme'), 'original');
    assert.equal(root.classList.contains('dark'), true);
    assert.equal(root.classList.contains('text-lg'), true);

    for (const id of ALLOWED_VISUAL_THEMES) {
      const saved = saveVisualTheme(id, { storage, root });
      assert.equal(saved, id);
      assert.equal(storage.getItem(VISUAL_THEME_STORAGE_KEY), id);
      assert.equal(root.getAttribute('data-theme'), id);
      assert.equal(root.classList.contains('dark'), true);
      assert.equal(root.classList.contains('text-lg'), true);
    }

    // Valor inválido al guardar cae de forma segura a 'original'
    const fallback = saveVisualTheme('invalido', { storage, root });
    assert.equal(fallback, 'original');
    assert.equal(storage.getItem(VISUAL_THEME_STORAGE_KEY), 'original');
    assert.equal(root.getAttribute('data-theme'), 'original');
  });

  it('tolera errores de acceso a localStorage (modo privado / bloqueo)', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); }
    };
    const root = createMockRoot();
    assert.equal(getSavedVisualTheme(brokenStorage), 'original');
    assert.equal(saveVisualTheme('avion', { storage: brokenStorage, root }), 'avion');
    assert.equal(root.getAttribute('data-theme'), 'avion');
    assert.equal(applyVisualTheme('cientifica', root), 'cientifica');
    assert.equal(root.getAttribute('data-theme'), 'cientifica');
  });

  it('aplica data-theme síncronamente en <head> mediante visualThemeBoot.js antes de cargar css/styles.css', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const bootIdx = html.indexOf('<script src="js/ui/visualThemeBoot.js"></script>');
    const cssIdx = html.indexOf('<link rel="stylesheet" href="css/styles.css">');
    assert.ok(bootIdx !== -1, 'index.html debe cargar js/ui/visualThemeBoot.js como script síncrono');
    assert.ok(bootIdx < cssIdx, 'visualThemeBoot.js debe ejecutarse antes de css/styles.css');

    const bootCode = fs.readFileSync('js/ui/visualThemeBoot.js', 'utf8');
    for (const id of ALLOWED_VISUAL_THEMES) {
      const root = createMockRoot(['dark']);
      const storage = createMockStorage({ [VISUAL_THEME_STORAGE_KEY]: id });
      vm.runInNewContext(bootCode, {
        window: { localStorage: storage },
        document: { documentElement: root }
      });
      assert.equal(root.getAttribute('data-theme'), id);
      assert.equal(root.classList.contains('dark'), true);
    }

    // Valor malicioso o desconocido en localStorage
    const rootFallback = createMockRoot();
    const badStorage = createMockStorage({ [VISUAL_THEME_STORAGE_KEY]: '__proto__' });
    vm.runInNewContext(bootCode, {
      window: { localStorage: badStorage },
      document: { documentElement: rootFallback }
    });
    assert.equal(rootFallback.getAttribute('data-theme'), 'original');
  });

  it('declara los bloques CSS completos para los 5 temas incluyendo cientifica y naturaleza (Fase 3)', () => {
    const css = fs.readFileSync('css/styles.css', 'utf8');
    for (const id of ALLOWED_VISUAL_THEMES) {
      assert.match(css, new RegExp(`html\\[data-theme="${id}"\\]`));
      assert.match(css, new RegExp(`html:not\\(\\.dark\\)\\[data-theme="${id}"\\]`));
      assert.match(css, new RegExp(`html\\.dark\\[data-theme="${id}"\\]`));
    }
    for (const id of ['cientifica', 'naturaleza']) {
      assert.match(css, new RegExp(`html:not\\(\\.dark\\)\\[data-theme="${id}"\\]\\s*:is\\(\\.cq-month,\\s*\\.cq-list\\)`));
      assert.match(css, new RegExp(`html\\.dark\\[data-theme="${id}"\\]\\s*:is\\(\\.cq-month,\\s*\\.cq-list\\)`));
    }
    assert.doesNotMatch(css, /html\[data-theme="cientifica"\]\s*\{\}/);
    assert.doesNotMatch(css, /html\[data-theme="naturaleza"\]\s*\{\}/);
  });
});
