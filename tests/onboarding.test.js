import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldOnboard, passwordOutcome, installMode, isStandalone } from '../js/ui/onboardingCheck.js';
import { emptyStateFor, emptyHTML } from '../js/ui/emptyStates.js';
import { GLOSSARY, infoBtn } from '../js/ui/glossary.js';
import { matchHelp, normalizeText } from '../js/ui/help.js';
import { icon, eventKindIcon } from '../js/ui/icons.js';
import { DAY_TYPES } from '../js/ui/labels.js';

// ─── Asistente de primer uso ───
test('el asistente solo sale en una instalación limpia', () => {
  assert.equal(shouldOnboard({ profiles: 0, configKeys: 0, legacyData: false }), true);
  assert.equal(shouldOnboard({ profiles: 1, configKeys: 0 }), false, 'ya tiene un perfil');
  assert.equal(shouldOnboard({ profiles: 0, configKeys: 3 }), false, 'ya tiene ajustes (p. ej. una copia restaurada)');
  assert.equal(shouldOnboard({ profiles: 0, configKeys: 0, legacyData: true }), false, 'trae datos de la versión antigua');
});

test('contraseña buena: se sigue y se guarda', () => {
  const r = passwordOutcome({ updated: true, publishedAt: '2026-11-10T08:00:00Z' });
  assert.deepEqual([r.ok, r.keep], [true, true]);
  assert.match(r.message, /correcta/i);
});

test('contraseña mala: mensaje claro, no se sigue y no se guarda', () => {
  const r = passwordOutcome({ updated: false, code: 'BAD_PASSWORD', error: 'x' });
  assert.deepEqual([r.ok, r.keep], [false, false]);
  assert.match(r.message, /no abre/i);
  assert.match(r.message, /administrador/i);
});

test('sin conexión o sin cuadrante publicado: se guarda y se sigue, diciendo por qué', () => {
  const off = passwordOutcome({ updated: false, error: 'Todavía no hay ningún cuadrante publicado' }, { online: false });
  assert.deepEqual([off.ok, off.keep], [true, true]);
  assert.match(off.message, /sin conexión|no hay conexión/i);
  const none = passwordOutcome({ updated: false, error: 'Todavía no hay ningún cuadrante publicado' }, { online: true });
  assert.deepEqual([none.ok, none.keep], [true, true]);
  assert.match(none.message, /publicado/i);
  const same = passwordOutcome({ updated: false, publishedAt: '2026-11-10T08:00:00Z' });
  assert.equal(same.ok, true);
});

test('instalar: Android con aviso, iPhone con pasos, nada si ya está instalada', () => {
  assert.equal(installMode({ standalone: true, canPrompt: true }), 'installed');
  assert.equal(installMode({ canPrompt: true, userAgent: 'Android' }), 'prompt');
  assert.equal(installMode({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }), 'ios');
  assert.equal(installMode({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), 'ios', 'iPad que se presenta como Mac');
  assert.equal(installMode({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120' }), 'manual');
  assert.equal(isStandalone({ navigator: { standalone: true } }), true);
  assert.equal(isStandalone({ navigator: {}, matchMedia: (q) => ({ matches: q.includes('standalone') }) }), true);
  assert.equal(isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) }), false);
});

// ─── Estados vacíos ───
test('cada pantalla sin datos tiene una frase y una sola acción', () => {
  const cases = [
    ['dashboard', {}, 'password'],
    ['dashboard', { hasPassword: true }, 'check'],
    ['dashboard', { hasPassword: true, hasCuadrante: true }, 'who'],
    ['cuadrante', {}, 'password'],
    ['cuadrante', { hasPassword: true }, 'file'],
    ['biblioteca', { error: 'NO_PASSWORD' }, 'password'],
    ['biblioteca', { error: 'BAD_PASSWORD' }, 'password'],
    ['biblioteca', { error: 'Sin red' }, 'retry'],
    ['biblioteca', { docs: 0 }, 'retry'],
    ['registry', { services: 0 }, 'new'],
    ['registry', { services: 4, shown: 0 }, 'clear']
  ];
  for (const [screen, ctx, action] of cases) {
    const e = emptyStateFor(screen, ctx);
    assert.ok(e, `${screen} ${JSON.stringify(ctx)}`);
    assert.equal(e.action, action);
    assert.ok(e.text.length > 10 && e.label.length > 3);
    const html = emptyHTML(e);
    assert.equal((html.match(/<button|<label class="btn/g) || []).length, 1, 'un único botón');
  }
  assert.equal(emptyStateFor('dashboard', { hasPassword: true, hasCuadrante: true, linked: true }), null, 'con datos no sale');
  assert.equal(emptyStateFor('cuadrante', { hasCuadrante: true }), null);
  assert.equal(emptyStateFor('registry', { services: 2, shown: 2 }), null);
});

// ─── Ayuda: buscador y «ⓘ» ───
test('el glosario explica los cuatro términos en dos líneas como mucho', () => {
  for (const key of ['anio-pasado', 'compensacion', 'guardia-cerrada', 'no-computa']) {
    const g = GLOSSARY[key];
    assert.ok(g, key);
    assert.ok(g.text.length <= 220, `${key}: corto`);
    const btn = infoBtn(key);
    assert.match(btn, /data-info="/);
    assert.match(btn, /aria-label="Qué significa/);
  }
  assert.equal(infoBtn('no-existe'), '');
});

test('el buscador de la ayuda ignora mayúsculas y tildes, y exige todas las palabras', () => {
  assert.equal(normalizeText('Compensación ÁÉ'), 'compensacion ae');
  const sections = [
    { title: 'Instalarla en el móvil', text: 'iPhone Safari Compartir' },
    { title: 'Cómo cuenta', text: 'guardia cerrada por orden' },
    { title: 'Copias', text: 'Guardar copia de seguridad' }
  ];
  assert.deepEqual(matchHelp(sections, 'GUARDIA'), [1]);
  assert.deepEqual(matchHelp(sections, 'como cuenta'), [1]);
  assert.deepEqual(matchHelp(sections, 'copia movil'), []);
  assert.deepEqual(matchHelp(sections, 'iphone'), [0]);
});

// ─── Iconos ───
test('los iconos son SVG decorativos, sin emojis', () => {
  for (const name of ['shield', 'gift', 'chat']) {
    const svg = icon(name);
    assert.match(svg, /^<svg class="ui-icon"/);
    assert.match(svg, /aria-hidden="true"/);
  }
  assert.match(eventKindIcon('JUICIO'), /<svg/);
  assert.match(DAY_TYPES.EVENTO.short, /<svg/);
});
