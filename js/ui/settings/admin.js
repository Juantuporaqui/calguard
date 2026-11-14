/**
 * @module ui/settings/admin
 * «Administración»: token de GitHub (cifrado con el PIN), publicar el cuadrante
 * y las fichas de cada policía. Solo se ve en el móvil del administrador; el
 * resto ve un enlace discreto «Soy administrador».
 */

import { Actions } from '../../state/store.js';
import { getPublishSettings, setPublishSettings, guessRepo } from '../../domain/sharedCuadrante.js';
import { hasAdminRecord } from '../../persistence/vaultSession.js';
import { publishSharedCuadrante } from '../flows.js';
import { openFichasSheet } from '../fichasAdmin.js';
import { ensureVaultKey } from '../pin.js';
import { section, autosave, openSections } from './common.js';

let adminKnown = false;   // último valor conocido (para no parpadear al repintar)
let revealed = false;     // pulsó «Soy administrador» en esta sesión

const fmtStamp = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-ES')} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
};

/** ¿Se enseña el bloque? Solo si hay token guardado (o lo pidió en esta sesión). */
export function adminVisible() {
  return adminKnown || revealed;
}

export function adminHTML() {
  return section('admin', 'Publicar el cuadrante', 'Token de GitHub, publicar y fichas', `
    <p class="set-help">El token se guarda <strong>cifrado con tu PIN</strong> y solo en este móvil (nunca va en las copias). Por eso el modo administrador necesita PIN.</p>
    <details class="admin-box">
      <summary>Cómo conseguir el token</summary>
      <ol class="set-help steps">
        <li>En GitHub: <em>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</em>.</li>
        <li><em>Repository access</em>: solo este repositorio. <em>Permissions → Contents</em>: <strong>Read and write</strong>. Caducidad: la que prefieras.</li>
        <li>Pégalo abajo y pon la contraseña del grupo en «Contraseña del grupo». Después, publica con el botón de abajo o desde Cuadrante → <em>Archivo ⋯ → Publicar para el grupo</em>.</li>
      </ol>
    </details>
    <div class="form-grid two">
      <label class="field"><span>Usuario de GitHub</span><input type="text" id="gh-owner" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span>Repositorio</span><input type="text" id="gh-repo" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    </div>
    <label class="field"><span>Token de GitHub</span><input type="password" id="gh-token" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
    <p class="backup-status" id="gh-status"></p>
    <p class="set-help"><strong>Fichas de cada policía:</strong> pon los cupos, los días por guardia y lo pendiente del año anterior de cada uno; les llega al publicar y la app ya está lista al instalarla.</p>
    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="gh-publish">Publicar el cuadrante cargado</button>
      <button type="button" class="btn" id="gh-fichas">Fichas de cada policía</button>
      <button type="button" class="btn" id="gh-forget" hidden>Quitar token</button>
    </div>`);
}

/** Enlace discreto para quien no es administrador. */
export function adminLinkHTML() {
  return '<button type="button" class="link-btn admin-link" id="reveal-admin">Soy administrador</button>';
}

/** Comprueba si este móvil es de administrador; si cambia, pide repintar. */
export async function checkAdmin(onChange) {
  const now = await hasAdminRecord().catch(() => false);
  if (now !== adminKnown) { adminKnown = now; onChange?.(); }
}

/** Ajustes de publicar sin el token (el guardado conserva el cifrado que hubiera). */
async function settingsWithoutToken() {
  const { token: _t, locked: _l, needsPin: _n, legacy: _g, ...rest } = (await getPublishSettings()) || {};
  return rest;
}

export function bindAdmin(root, rerender) {
  root.querySelector('#reveal-admin')?.addEventListener('click', () => {
    revealed = true;
    openSections.add('admin');
    rerender();
    requestAnimationFrame(() => document.getElementById('gh-owner')?.focus());
  });
  const $ = (id) => root.querySelector('#' + id);
  if (!$('gh-owner')) return;

  const refresh = async () => {
    const pub = await getPublishSettings();
    if (!root.isConnected || !$('gh-owner')) return;
    const guess = guessRepo();
    if (document.activeElement !== $('gh-owner')) $('gh-owner').value = pub?.owner || guess.owner;
    if (document.activeElement !== $('gh-repo')) $('gh-repo').value = pub?.repo || guess.repo;
    const has = Boolean(pub?.token || pub?.locked || pub?.needsPin);
    $('gh-token').placeholder = has ? '•••••••• (guardado cifrado en este móvil)' : 'github_pat_…';
    $('gh-forget').hidden = !has;
    $('gh-status').classList.toggle('stale', !has || Boolean(pub?.needsPin));
    $('gh-status').textContent = [
      pub?.needsPin ? 'Tu token es de una versión anterior y aún no está cifrado: pon un PIN en «Seguridad» y se cifrará solo.' : '',
      pub?.lastPublishedAt ? `Última publicación desde aquí: ${fmtStamp(pub.lastPublishedAt)}.` : (has ? '' : 'Sin token: este móvil no publica.')
    ].filter(Boolean).join(' ');
  };
  refresh();

  const saveRepoField = (field) => async (v) => {
    const prev = await settingsWithoutToken();
    await setPublishSettings({ ...prev, [field]: v.trim(), branch: prev.branch || 'main' });
    refresh();
  };
  const required = (label) => (v) => (v.trim() ? null : `Escribe el ${label}`);
  autosave($('gh-owner'), { validate: required('usuario de GitHub'), save: saveRepoField('owner') });
  autosave($('gh-repo'), { validate: required('repositorio'), save: saveRepoField('repo') });

  autosave($('gh-token'), {
    validate: (v) => (v.trim().length < 20 || /\s/.test(v.trim()) ? 'Eso no parece un token de GitHub: pégalo entero' : null),
    save: async (v, input) => {
      if (!(await ensureVaultKey('El token de administrador se guarda cifrado con tu PIN.'))) {
        throw new Error('Sin PIN no se puede guardar el token. Pon un PIN en «Seguridad».');
      }
      const prev = await settingsWithoutToken();
      const guess = guessRepo();
      await setPublishSettings({
        ...prev,
        owner: prev.owner || $('gh-owner').value.trim() || guess.owner,
        repo: prev.repo || $('gh-repo').value.trim() || guess.repo,
        branch: prev.branch || 'main',
        token: v.trim()
      });
      input.value = '';
      adminKnown = true;
      refresh();
      return 'Token guardado cifrado en este móvil';
    }
  });

  $('gh-publish').addEventListener('click', async () => { await publishSharedCuadrante(); refresh(); });
  $('gh-fichas').addEventListener('click', () => openFichasSheet());
  $('gh-forget').addEventListener('click', async () => {
    await setPublishSettings(null);
    adminKnown = false;
    Actions.showToast('Token quitado de este móvil');
    refresh();
  });
}
