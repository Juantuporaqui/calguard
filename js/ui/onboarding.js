/**
 * @module ui/onboarding
 * Asistente de primer uso: tres pasos que se pueden saltar.
 *  1. Contraseña del grupo (se comprueba al momento descargando el cuadrante).
 *  2. «¿Quién eres?» con los nombres del cuadrante.
 *  3. Instalar la app (botón en Android, pasos en iPhone; se omite si ya lo está).
 * Solo sale en una instalación limpia (ver shouldOnboard).
 *
 * También da la hoja «Contraseña del grupo» de los estados vacíos (askGroupPassword).
 */

import { getState, Actions } from '../state/store.js';
import { put, getAll, STORES } from '../persistence/db.js';
import { hasLegacyData } from '../persistence/migrations.js';
import { getGroupPassword, setGroupPassword, pullPublished } from '../domain/sharedCuadrante.js';
import { loadGroupCuadrante, currentRoster } from '../domain/groupCuadrante.js';
import { displayName } from '../domain/profiles.js';
import { shouldOnboard, passwordOutcome, isStandalone, installMode } from './onboardingCheck.js';
import { openSheet } from './sheet.js';
import { icon } from './icons.js';
import { esc } from './utils.js';

// ─── Instalar: el aviso de Android llega pronto y hay que guardarlo ───
let deferredPrompt = null;
let installed = false;

/** Llamar al cargar la app: guarda el aviso de instalación de Android para usarlo luego. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => { installed = true; deferredPrompt = null; });
}

function currentInstallMode() {
  return installMode({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone: installed || isStandalone(window),
    canPrompt: Boolean(deferredPrompt)
  });
}

// ─── ¿Toca enseñarlo? ───
export async function needsOnboarding() {
  const [profiles, config, legacyData] = await Promise.all([
    getAll(STORES.PROFILES), getAll(STORES.CONFIG), hasLegacyData().catch(() => false)
  ]);
  return shouldOnboard({ profiles: profiles.length, configKeys: config.length, legacyData });
}

// ─── Contraseña del grupo, comprobada al momento ───

/**
 * Guarda la contraseña y descarga el cuadrante con ella. Si no lo abre, se
 * deja la contraseña que hubiera antes.
 * @returns {Promise<{ok: boolean, keep: boolean, message: string}>}
 */
export async function checkGroupPassword(pass) {
  const value = String(pass || '').trim();
  if (value.length < 8) return { ok: false, keep: false, message: 'La contraseña del grupo tiene al menos 8 caracteres.' };
  const before = await getGroupPassword();
  await setGroupPassword(value);
  const result = await pullPublished({ force: true }).catch(err => ({ updated: false, error: err.message, code: 'ERROR' }));
  const out = passwordOutcome(result, { online: navigator.onLine !== false });
  if (!out.keep) await setGroupPassword(before || null);
  if (result?.updated) {
    const flows = await import('./flows.js');
    flows.notifyCuadranteChanged();
    await flows.loadGroupComps();
  }
  return out;
}

function passwordFieldHTML(id) {
  return `
    <label class="field"><span>Contraseña del grupo</span>
      <span class="pass-row">
        <input type="password" id="${id}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Te la da el administrador" enterkeyhint="go">
        <button type="button" class="btn pass-toggle" data-toggle="${id}" aria-pressed="false">Ver</button>
      </span>
    </label>
    <p class="ob-msg" id="${id}-msg" role="alert" hidden></p>`;
}

function bindPasswordToggle(root) {
  root.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const input = root.querySelector('#' + b.dataset.toggle);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.textContent = show ? 'Ocultar' : 'Ver';
    b.setAttribute('aria-pressed', String(show));
  }));
}

function showMsg(el, text, kind) {
  el.hidden = !text;
  el.textContent = text || '';
  el.classList.toggle('ok', kind === 'ok');
  el.classList.toggle('bad', kind === 'bad');
}

/** Hoja «Contraseña del grupo» (estados vacíos de Inicio, Cuadrante y Biblioteca). */
export function askGroupPassword() {
  return new Promise(resolve => {
    let ok = false;
    openSheet({
      title: 'Contraseña del grupo',
      variant: 'dialog',
      body: `<p class="dialog-message">Te la da el administrador. Con ella recibes el cuadrante del grupo y tu calendario se rellena solo.</p>${passwordFieldHTML('sheet-pass')}`,
      footer: `
        <button type="button" class="btn" data-act="cancel">Cancelar</button>
        <button type="button" class="btn btn-primary" data-act="ok">Comprobar</button>`,
      onMount(root, close) {
        bindPasswordToggle(root);
        const input = root.querySelector('#sheet-pass');
        const msg = root.querySelector('#sheet-pass-msg');
        const btn = root.querySelector('[data-act="ok"]');
        const go = async () => {
          btn.disabled = true;
          btn.textContent = 'Comprobando…';
          const out = await checkGroupPassword(input.value);
          btn.disabled = false;
          btn.textContent = 'Comprobar';
          if (!out.ok) { showMsg(msg, out.message, 'bad'); input.focus(); return; }
          ok = true;
          close();
          Actions.showToast(out.message);
        };
        btn.addEventListener('click', go);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      },
      onClose: async () => {
        if (ok) {
          const flows = await import('./flows.js');
          await flows.afterNewCuadrante();
        }
        resolve(ok);
      }
    });
  });
}

// ─── El asistente ───

async function rosterNow() {
  const data = await loadGroupCuadrante().catch(() => null);
  if (!data?.names?.length) return [];
  return currentRoster(data.names, getState().config.escalafonOrder || []);
}

function frame(step, total, title, body, actions) {
  return `
    <div class="onboarding" role="region" aria-label="Primeros pasos">
      <div class="ob-card">
        <p class="ob-step">Paso ${step} de ${total}</p>
        <div class="ob-progress" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>
        <h1 class="ob-title" tabindex="-1">${title}</h1>
        ${body}
        <div class="ob-actions">${actions}</div>
      </div>
    </div>`;
}

function iosStepsHTML() {
  return `
    <ol class="ob-ios">
      <li><span class="ob-ios-ico">${icon('share')}</span><span>Abajo en Safari, toca <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba).</span></li>
      <li><span class="ob-ios-ico">${icon('addSquare')}</span><span>Baja y elige <strong>Añadir a pantalla de inicio</strong>.</span></li>
      <li><span class="ob-ios-ico">${icon('phone')}</span><span>Toca <strong>Añadir</strong>. A partir de ahora, abre CalGuard desde su icono.</span></li>
    </ol>
    <p class="ob-note">Si no ves «Compartir», abre esta página en Safari.</p>`;
}

/**
 * Enseña el asistente en `app` y espera a que termine.
 * @param {HTMLElement} app
 * @returns {Promise<{person: string|null}>}
 */
export function runOnboarding(app) {
  return new Promise(resolve => {
    const result = { person: null };
    const TOTAL = 3;
    const focusTitle = () => app.querySelector('.ob-title')?.focus({ preventScroll: true });

    const finish = () => resolve(result);

    // Paso 1: contraseña del grupo
    const step1 = (note = '') => {
      app.innerHTML = frame(1, TOTAL, 'Bienvenido a CalGuard', `
        <p class="ob-lead">Tu cuadrante, tus guardias y tus días libres, en tu móvil. Empecemos: escribe la <strong>contraseña del grupo</strong> para recibir el cuadrante.</p>
        ${note ? `<p class="ob-msg">${esc(note)}</p>` : ''}
        ${passwordFieldHTML('ob-pass')}`,
        `<button type="button" class="btn btn-primary btn-block" id="ob-check">Comprobar y seguir</button>
         <button type="button" class="btn btn-block ob-skip" id="ob-skip">Ahora no, la pondré luego</button>`);
      bindPasswordToggle(app);
      const input = app.querySelector('#ob-pass');
      const msg = app.querySelector('#ob-pass-msg');
      const btn = app.querySelector('#ob-check');
      const go = async () => {
        btn.disabled = true;
        btn.textContent = 'Comprobando…';
        const out = await checkGroupPassword(input.value);
        btn.disabled = false;
        btn.textContent = 'Comprobar y seguir';
        if (!out.ok) { showMsg(msg, out.message, 'bad'); input.focus(); return; }
        step2(out.message);
      };
      btn.addEventListener('click', go);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      app.querySelector('#ob-skip').addEventListener('click', () => step2(''));
      setTimeout(() => input.focus({ preventScroll: true }), 50);
    };

    // Paso 2: ¿quién eres?
    const step2 = async (okMessage) => {
      const roster = await rosterNow();
      if (!roster.length) { step3(okMessage); return; }
      app.innerHTML = frame(2, TOTAL, '¿Quién eres?', `
        ${okMessage ? `<p class="ob-msg ok" role="status">${esc(okMessage)}</p>` : ''}
        <p class="ob-lead">Elige tu nombre: tu calendario y tus días se rellenan solos con el cuadrante.</p>
        <fieldset class="ob-names"><legend class="sr-only">Tu nombre en el cuadrante</legend>
          ${roster.map(n => `<label class="ob-name"><input type="radio" name="ob-person" value="${esc(n)}"><span>${esc(displayName(n))}</span></label>`).join('')}
        </fieldset>
        <p class="ob-msg" id="ob-who-msg" role="alert" hidden></p>`,
        `<button type="button" class="btn btn-primary btn-block" id="ob-me">Soy yo</button>
         <button type="button" class="btn btn-block ob-skip" id="ob-skip">Ahora no</button>`);
      focusTitle();
      app.querySelector('#ob-me').addEventListener('click', () => {
        const sel = app.querySelector('input[name="ob-person"]:checked');
        if (!sel) { showMsg(app.querySelector('#ob-who-msg'), 'Toca tu nombre en la lista.', 'bad'); return; }
        result.person = sel.value;
        step3('');
      });
      app.querySelector('#ob-skip').addEventListener('click', async () => {
        // ya lo ha visto: que no vuelva a salir solo (se puede elegir desde el perfil)
        await put(STORES.CONFIG, { key: 'whoAmIDismissed', value: true });
        step3('');
      });
    };

    // Paso 3: instalar
    const step3 = (note) => {
      const mode = currentInstallMode();
      if (mode === 'installed') { finish(); return; }
      const body = mode === 'prompt'
        ? '<p class="ob-lead">Instálala y tendrás CalGuard como una app más, con su icono, y funcionará sin conexión.</p>'
        : mode === 'ios'
          ? `<p class="ob-lead">Ponla en la pantalla de inicio para abrirla como una app más (y que funcione sin conexión):</p>${iosStepsHTML()}`
          : '<p class="ob-lead">En el menú del navegador (⋮ o ☰), busca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>. Así tendrás CalGuard con su icono y funcionará sin conexión.</p>';
      app.innerHTML = frame(3, TOTAL, 'Instala la app', `
        ${note ? `<p class="ob-msg ok" role="status">${esc(note)}</p>` : ''}
        ${body}
        <p class="ob-msg" id="ob-inst-msg" role="status" hidden></p>`,
        mode === 'prompt'
          ? `<button type="button" class="btn btn-primary btn-block" id="ob-install">${icon('download')} Instalar CalGuard</button>
             <button type="button" class="btn btn-block ob-skip" id="ob-skip">Ahora no</button>`
          : `<button type="button" class="btn btn-primary btn-block" id="ob-done">Entendido, empezar</button>`);
      focusTitle();
      app.querySelector('#ob-done')?.addEventListener('click', finish);
      app.querySelector('#ob-skip')?.addEventListener('click', finish);
      app.querySelector('#ob-install')?.addEventListener('click', async () => {
        const ev = deferredPrompt;
        deferredPrompt = null;
        if (!ev) { finish(); return; }
        try {
          ev.prompt();
          await ev.userChoice;
        } catch { /* lo cerró */ }
        finish();
      });
    };

    step1();
  });
}
