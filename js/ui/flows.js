/**
 * @module ui/flows
 * User flows that combine several domain operations with feedback
 * (busy indicator, toasts): switching profiles, opening a colleague's
 * accounting from the cuadrante, syncing with the group cuadrante.
 */

import { diffDays, changedDaysText, guardChangeTexts } from './syncReport.js';
import { saveLastChanges } from './alertPrefs.js';
import { getState, Actions, effectiveConfig, subscribe } from '../state/store.js';
import { get, put, STORES } from '../persistence/db.js';
import { exportBackup, downloadFile } from '../persistence/backup.js';
import { pullPublished, publishCuadrante, getPublishSettings, setPublishSettings, getGroupPassword, getGroupComps, getGroupOrden } from '../domain/sharedCuadrante.js';
import { buildFichas } from '../domain/fichas.js';
import {
  switchProfile, createProfile, ensureProfileForPerson, findProfileForPerson,
  updateActiveProfile, initials, displayName
} from '../domain/profiles.js';
import { syncActiveProfile, autoSyncIfStale, defaultSyncStart } from '../domain/cuadranteSync.js';
import { loadGroupCuadrante, currentRoster, canonicalPerson, notesCount, importGroupCuadranteFile, rereadIfOutdated } from '../domain/groupCuadrante.js';
import { openSheet, confirmDialog } from './sheet.js';
import { esc } from './utils.js';

/** Stable hue per name so each person keeps the same avatar colour. */
export function avatarHue(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function avatarHTML(name, size = '') {
  // el color va por clase (hue-0…hue-23): la CSP no admite estilos en línea
  return `<span class="avatar ${size} hue-${Math.round(avatarHue(name) / 15) % 24}" aria-hidden="true">${esc(initials(name))}</span>`;
}

async function withBusy(text, fn) {
  Actions.setBusy(text);
  try {
    return await fn();
  } finally {
    Actions.setBusy(null);
  }
}

function summaryText(s) {
  const parts = [];
  if (s.guardias) parts.push(`${s.guardias} guardia${s.guardias === 1 ? '' : 's'}`);
  if (s.byType.LIBRE) parts.push(`${s.byType.LIBRE} libres`);
  if (s.vacaciones) parts.push(`${s.vacaciones} días de vacaciones`);
  if (s.byType.AP) parts.push(`${s.byType.AP} AP`);
  return parts.length ? parts.join(' · ') : `${s.added} turnos`;
}

/** Switch profile, then catch up with the group cuadrante if needed. */
export async function switchToProfile(profileId) {
  if (profileId === getState().activeProfileId) return;
  await withBusy('Cambiando de perfil…', async () => {
    const p = await switchProfile(profileId);
    const summary = await autoSyncIfStale();
    Actions.showToast(summary ? `${p.name}: sincronizado con el cuadrante` : `Perfil: ${p.name}`);
  });
}

/** Current roster of the stored group cuadrante (canonical names). */
async function loadRoster() {
  const data = await loadGroupCuadrante();
  if (!data) return { data: null, roster: [] };
  return { data, roster: currentRoster(data.names, effectiveConfig(getState()).escalafonOrder || []) };
}

/** <option> list of the roster; people who already have a profile are greyed out. */
function rosterOptions(roster, placeholder) {
  return `<option value="">${esc(placeholder)}</option>` + roster.map(n => {
    const taken = !!findProfileForPerson(n);
    return `<option value="${esc(n)}" ${taken ? 'disabled' : ''}>${esc(displayName(n))}${taken ? ' · ya tiene perfil' : ''}</option>`;
  }).join('');
}

/**
 * New profile: pick the person from the cuadrante's roster (no typos, linked
 * and filled in automatically). Typing a name is only for people who are not
 * in the cuadrante.
 */
export async function createAndSwitchProfile() {
  const { roster } = await loadRoster();
  const missing = roster.filter(n => !findProfileForPerson(n));
  openSheet({
    title: 'Nuevo perfil',
    body: roster.length ? `
      <label class="field"><span>Funcionario</span>
        <select id="np-person">
          ${rosterOptions(roster, '— Elige de la plantilla —')}
          <option value="__other">Otra persona (no está en el cuadrante)…</option>
        </select>
      </label>
      <p class="sheet-hint">Elegido de la lista, el perfil queda vinculado al cuadrante y su contabilidad se rellena sola.</p>
      <label class="field" id="np-other" hidden><span>Nombre</span>
        <input type="text" id="np-name" maxlength="40" placeholder="Nombre y apellido" autocomplete="off"></label>`
      : `
      <p class="sheet-hint">Aún no hay cuadrante del grupo. Si lo cargas (pantalla Cuadrante), podrás elegir el nombre de una lista y la contabilidad se rellenará sola.</p>
      <label class="field" id="np-other"><span>Nombre</span>
        <input type="text" id="np-name" maxlength="40" placeholder="Nombre y apellido" autocomplete="off"></label>`,
    footer: `
      ${missing.length > 1 ? `<button type="button" class="btn" data-act="all">Crear los ${missing.length} que faltan</button>` : ''}
      <button type="button" class="btn btn-primary" data-act="ok">Crear</button>`,
    onMount(root, close) {
      const sel = root.querySelector('#np-person');
      const other = root.querySelector('#np-other');
      const input = root.querySelector('#np-name');
      sel?.addEventListener('change', () => {
        other.hidden = sel.value !== '__other';
        if (!other.hidden) input.focus();
      });
      const accept = async () => {
        const choice = sel ? sel.value : '__other';
        if (!choice) { Actions.showToast('Elige a alguien de la lista'); sel.focus(); return; }
        if (choice !== '__other') { close(); await openPersonAccounting(choice); return; }

        const name = input.value.trim().replace(/\s+/g, ' ');
        if (!name) { Actions.showToast('Escribe el nombre'); input.focus(); return; }
        // A typed name that is really someone on the roster → use the roster entry
        const canonical = canonicalPerson(name, roster);
        if (roster.includes(canonical)) { close(); await openPersonAccounting(canonical); return; }
        const dup = getState().profiles.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (dup) { Actions.showToast(`Ya existe el perfil «${dup.name}»`); input.select(); return; }
        close();
        const p = await createProfile(name);
        await switchToProfile(p.id);
      };
      root.querySelector('[data-act="ok"]').addEventListener('click', accept);
      input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); accept(); } });
      root.querySelector('[data-act="all"]')?.addEventListener('click', async () => {
        close();
        await withBusy('Creando perfiles…', async () => {
          for (const n of missing) await ensureProfileForPerson(n);
        });
        Actions.showToast(`${missing.length} perfiles creados · cada uno se pone al día al abrirlo`);
      });
    }
  });
}

/**
 * "Soy yo": link the active profile to a cuadrante person and sync it. A
 * placeholder name ("Mi perfil") takes the person's name. If that person
 * already has a profile here, offer to open it instead of duplicating.
 * @param {string} person - canonical name
 */
export async function linkActiveProfileTo(person) {
  const s = getState();
  const other = findProfileForPerson(person);
  if (other && other.id !== s.activeProfileId) {
    const ok = await confirmDialog({
      title: `${displayName(person)} ya tiene perfil`,
      message: `En este dispositivo ya existe el perfil «${other.name}» vinculado a ${displayName(person)}. ¿Quieres abrirlo?`,
      confirmLabel: 'Abrir su perfil'
    });
    if (ok) await switchToProfile(other.id);
    return;
  }
  const patch = { cuadranteName: person, syncDesde: s.activeProfile?.syncDesde || defaultSyncStart() };
  if (!s.activeProfile?.name || s.activeProfile.name === 'Mi perfil') patch.name = displayName(person);
  await updateActiveProfile(patch);
  await syncNow({ person });
}

// ─── «¿Quién eres?» ───
// The app remembers which profile is yours (config key 'meProfileId'), marks
// it as «tú» and keeps it in sync. It asks once when a cuadrante is available;
// it can always be changed from the profile sheet or Ajustes → Mi perfil.

/** Load the group's compensations (published with the cuadrante) into the state. */
export async function loadGroupComps() {
  try { Actions.setConfig({ groupComps: await getGroupComps(), groupOrden: await getGroupOrden() }); } catch { /* none yet */ }
}

/** Load the remembered «me» profile into the state (boot). */
export async function loadMe() {
  const rec = await get(STORES.CONFIG, 'meProfileId');
  if (rec?.value) Actions.setConfig({ meProfileId: rec.value });
}

async function setMe(id) {
  await put(STORES.CONFIG, { key: 'meProfileId', value: id });
  Actions.setConfig({ meProfileId: id });
}

/** The profile marked as the user's own, if it still exists. */
export function myProfile() {
  const s = getState();
  return s.profiles.find(p => p.id === s.config.meProfileId) || null;
}

/**
 * «Soy yo»: make `person` the user's own profile.
 *  - if that person already has a profile here, it is opened (and linked);
 *  - an empty, unlinked starter profile («Mi perfil») takes the name;
 *  - otherwise a new profile is created: existing ones are never altered.
 * @param {string} person - canonical name
 */
export async function becomeMe(person) {
  const s = getState();
  const before = s.activeProfile;
  const existing = findProfileForPerson(person);
  if (existing) {
    if (existing.id !== s.activeProfileId) await switchToProfile(existing.id);
    if (!existing.cuadranteName) await linkActiveProfileTo(person);
    await setMe(existing.id);
    Actions.showToast(`Hola, ${existing.name}: este es tu perfil`);
  } else if (!before?.cuadranteName && !s.days.length && !s.ledger.length) {
    await linkActiveProfileTo(person);
    await setMe(getState().activeProfileId);
  } else {
    await openPersonAccounting(person);
    await setMe(getState().activeProfileId);
    Actions.showToast(`Tu perfil, ${displayName(person)}, está listo. «${before?.name}» se conserva tal cual.`);
  }
  Actions.setScreen('dashboard');
}

/**
 * Ask who the user is, once, when there is a cuadrante to choose from and no
 * profile is marked as theirs yet («Ahora no» stops asking automatically).
 */
export async function askWhoAmIIfNeeded() {
  if (myProfile()) return;
  if ((await get(STORES.CONFIG, 'whoAmIDismissed'))?.value) return;
  await askWhoAmI();
}

/**
 * «¿Quién eres?» picker.
 * @param {{manual?: boolean}} [opts] - manual: opened by the user (no auto-dismiss flag)
 */
let whoOpen = false;
export async function askWhoAmI({ manual = false } = {}) {
  if (whoOpen) return;
  whoOpen = true;
  try {
    await showWhoAmI(manual);
  } catch (err) {
    whoOpen = false;
    throw err;
  }
}

async function showWhoAmI(manual) {
  if (getState().locked) {
    await new Promise(resolve => {
      const off = subscribe(st => { if (!st.locked) { off(); resolve(); } });
    });
  }
  const { roster } = await loadRoster();
  if (!roster.length) {
    whoOpen = false;
    if (manual) Actions.showToast('Carga primero el cuadrante del grupo para elegir tu nombre');
    return;
  }
  const mine = myProfile()?.cuadranteName || '';
  openSheet({
    title: '¿Quién eres?',
    body: `
      <p class="sheet-hint">Elige tu nombre: tu calendario y tu contabilidad se rellenan con el cuadrante y se mantienen al día. Los perfiles que ya tengas no se tocan.</p>
      <label class="field"><span>Tu nombre en el cuadrante</span>
        <select id="who-person">
          <option value="">— Elige —</option>
          ${roster.map(n => `<option value="${esc(n)}" ${n === mine ? 'selected' : ''}>${esc(displayName(n))}</option>`).join('')}
        </select></label>`,
    footer: `
      <button type="button" class="btn" data-act="skip">Ahora no</button>
      <button type="button" class="btn btn-primary" data-act="ok">Soy yo</button>`,
    onMount(root, close) {
      const sel = root.querySelector('#who-person');
      root.querySelector('[data-act="skip"]').addEventListener('click', async () => {
        close();
        if (!manual) {
          await put(STORES.CONFIG, { key: 'whoAmIDismissed', value: true });
          Actions.showToast('Puedes elegirlo cuando quieras tocando tu perfil, arriba a la derecha');
        }
      });
      root.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        if (!sel.value) { Actions.showToast('Elige tu nombre'); sel.focus(); return; }
        close();
        await becomeMe(sel.value);
      });
    },
    onClose: () => { whoOpen = false; }
  });
}

/**
 * Open (or create) the profile of a cuadrante person and sync their
 * accounting from 1 January — one tap from the group cuadrante.
 * @param {string} canonical - e.g. "CARMEN"
 */
export async function openPersonAccounting(canonical) {
  const data = await loadGroupCuadrante();
  if (!data) { Actions.showToast('Primero carga el cuadrante del grupo'); return; }
  await withBusy(`Preparando la contabilidad de ${displayName(canonical)}…`, async () => {
    const profile = await ensureProfileForPerson(canonical);
    await switchProfile(profile.id);
    const summary = await syncActiveProfile({
      entries: data.entries,
      person: canonical,
      desde: getState().activeProfile.syncDesde || defaultSyncStart()
    });
    Actions.setScreen('dashboard');
    Actions.showToast(`${profile.name}: ${summaryText(summary)}`);
  });
}

/**
 * Sync the active profile with the stored group cuadrante (explicit action).
 * @param {{person?: string, desde?: string}} [opts]
 */
export async function syncNow(opts = {}) {
  const data = await loadGroupCuadrante();
  const p = getState().activeProfile;
  const person = opts.person || p?.cuadranteName;
  if (!data) { Actions.showToast('No hay cuadrante del grupo cargado'); return null; }
  if (!person) { Actions.showToast('Este perfil no está vinculado a nadie del cuadrante'); return null; }
  return withBusy('Sincronizando con el cuadrante…', async () => {
    const summary = await syncActiveProfile({
      entries: data.entries, person, desde: opts.desde || p.syncDesde || defaultSyncStart()
    });
    if (!opts.quiet) Actions.showToast(`Sincronizado: ${summaryText(summary)}`);
    return summary;
  });
}

/** Profile picker sheet (opened from the header chip). */
export function openProfileSheet() {
  const { profiles, activeProfileId } = getState();
  const me = myProfile();
  openSheet({
    title: 'Perfiles',
    body: `
      <p class="sheet-hint">Cada funcionario tiene su propio calendario, cupos y contabilidad.
        <button type="button" class="link-btn" data-act="who">${me ? 'Cambiar quién soy' : '¿Quién eres? Elige tu nombre'}</button></p>
      <ul class="profile-list">
        ${profiles.map(p => `
          <li>
            <button type="button" class="profile-item ${p.id === activeProfileId ? 'active' : ''}" data-id="${esc(p.id)}">
              ${avatarHTML(p.name)}
              <span class="profile-item-text">
                <strong>${esc(p.name)}${me?.id === p.id ? ' <span class="me-badge">tú</span>' : ''}</strong>
                <small>${p.cuadranteName ? `Vinculado al cuadrante · ${esc(displayName(p.cuadranteName))}` : 'Sin vincular al cuadrante'}</small>
              </span>
              ${p.id === activeProfileId ? '<span class="profile-item-check" aria-label="Activo">✓</span>' : ''}
            </button>
          </li>`).join('')}
      </ul>`,
    footer: `
      <button type="button" class="btn" data-act="manage">Gestionar</button>
      <button type="button" class="btn btn-primary" data-act="new">＋ Nuevo perfil</button>`,
    onMount(root, close) {
      root.querySelectorAll('.profile-item').forEach(btn => btn.addEventListener('click', async () => {
        close();
        await switchToProfile(btn.dataset.id);
      }));
      root.querySelector('[data-act="new"]').addEventListener('click', async () => {
        close();
        await createAndSwitchProfile();
      });
      root.querySelector('[data-act="who"]').addEventListener('click', () => {
        close();
        askWhoAmI({ manual: true });
      });
      root.querySelector('[data-act="manage"]').addEventListener('click', () => {
        close();
        Actions.setScreen('settings');
      });
    }
  });
}

// ─── Copias de seguridad ───

const BACKUP_REMIND_DAYS = 30;

/** Load when the last backup was made (boot). El almacenamiento persistente se pide en app.js. */
export async function loadBackupInfo() {
  const rec = await get(STORES.CONFIG, 'lastBackupAt');
  Actions.setConfig({ lastBackupAt: rec?.value || null });
}

export async function markBackupDone() {
  const at = new Date().toISOString();
  await put(STORES.CONFIG, { key: 'lastBackupAt', value: at });
  Actions.setConfig({ lastBackupAt: at });
}

/** Days since the last backup (Infinity if never). */
export function daysSinceBackup() {
  const at = getState().config.lastBackupAt;
  return at ? Math.floor((Date.now() - new Date(at).getTime()) / 86400000) : Infinity;
}

/** Should the dashboard remind about backups? Only once there is data worth keeping. */
export function backupReminderDue() {
  const s = getState();
  return (s.days.length > 0 || s.ledger.length > 0) && daysSinceBackup() >= BACKUP_REMIND_DAYS;
}

/**
 * One-tap backup of everything (all profiles + group cuadrante). On phones it
 * opens the share sheet (send it to yourself by email, Drive, WhatsApp…);
 * elsewhere it downloads the file.
 * @param {{passphrase?: string}} [opts]
 */
export async function quickBackup({ passphrase } = {}) {
  const json = await exportBackup(passphrase);
  const name = `calguard-copia${passphrase ? '-cifrada' : ''}-${new Date().toISOString().slice(0, 10)}.json`;
  let shared = false;
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Copia de CalGuard' });
      shared = true;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return false; // the user closed the share sheet
  }
  if (!shared) downloadFile(json, name);
  await markBackupDone();
  Actions.showToast(shared ? 'Copia enviada' : 'Copia descargada: guárdala fuera del móvil (correo, Drive…)');
  return true;
}

// ─── Cuadrante del grupo publicado (cifrado) ───

/** Tell the cuadrante screen that the group cuadrante changed. */
export function notifyCuadranteChanged() {
  window.dispatchEvent(new CustomEvent('calguard:cuadrante-changed'));
}

const fmtStamp = iso => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

let lastPull = 0;
/**
 * Download the group cuadrante published by the administrator if it is newer,
 * and bring the active profile up to date with it.
 * @param {{force?: boolean, throttleMs?: number}} [opts]
 */
export async function pullSharedCuadrante({ force = false, throttleMs = 0, replaceLocal = false } = {}) {
  if (!force && throttleMs && Date.now() - lastPull < throttleMs) return null;
  lastPull = Date.now();
  const r = await pullPublished({ force, replaceLocal });
  if (!r) {
    if (force) Actions.showToast('Primero guarda la contraseña del grupo');
    return null;
  }
  if (r.updated) {
    notifyCuadranteChanged();
    await loadGroupComps();
    const { result: summary, changed } = await withChangeReport(() => autoSyncIfStale());
    Actions.showToast(`Cuadrante del grupo actualizado (publicado el ${fmtStamp(r.publishedAt)})${summary ? ` · ${changedDaysText(changed).toLowerCase()}` : ''}`);
    await askWhoAmIIfNeeded();
  } else if (r.code === 'BAD_PASSWORD' && (r.error || force)) {
    Actions.showToast('La contraseña del grupo no abre el cuadrante publicado. Revísala en Ajustes.', { level: 'error' });
  } else if (force && r.localNewer) {
    // the Excel loaded on this device is newer than the publication: never swapped for it
    const admin = await canPublish();
    Actions.showToast(`El cuadrante cargado aquí (${fmtStamp(r.importedAt)}) es más reciente que el publicado (${fmtStamp(r.publishedAt)}) y se conserva.${admin ? ' Publícalo para que les llegue a todos.' : ''}`,
      admin
        ? { actionLabel: 'Publicar', onAction: () => publishSharedCuadrante(), duration: 10000 }
        : { actionLabel: 'Usar el publicado', onAction: () => pullSharedCuadrante({ force: true, replaceLocal: true }), duration: 10000 });
  } else if (force) {
    if (r.error && 'code' in r) Actions.showToast('No se pudo traer el cuadrante publicado.', { level: 'error', detail: r.error });
    else Actions.showToast(r.error || (r.publishedAt ? `Ya tienes el último cuadrante (publicado el ${fmtStamp(r.publishedAt)})` : 'Todavía no hay ningún cuadrante publicado'));
  }
  return r;
}

/**
 * Tras recibir el cuadrante con una contraseña nueva (estados vacíos): poner al
 * día el perfil vinculado o, si aún no hay ninguno tuyo, preguntar quién eres.
 */
export async function afterNewCuadrante() {
  const { result: summary, changed } = await withChangeReport(() => autoSyncIfStale());
  if (summary) Actions.showToast(`Cuadrante nuevo · ${changedDaysText(changed).toLowerCase()}`);
  await askWhoAmIIfNeeded();
}

/**
 * The cuadrante on this device has no Excel notes (read by a version before
 * v27): ask for the Excel right there, so publishing it takes one step.
 * @returns {Promise<{file: File}|'anyway'|null>}
 */
function askForExcel() {
  return new Promise(resolve => {
    let result = null;
    openSheet({
      title: 'Falta leer las notas del Excel',
      variant: 'dialog',
      body: `<p class="dialog-message">El cuadrante guardado en este dispositivo se leyó con una versión anterior de la app, que no leía las notas del Excel (a qué guardia va cada CH, juicios, cambios…).<br><br>Elige el Excel: se lee con sus notas y se publica a continuación.</p>`,
      footer: `
        <button type="button" class="btn btn-danger" data-act="anyway">Publicar sin notas</button>
        <label class="btn btn-primary" data-act="pick">Elegir el Excel<input type="file" accept=".xlsx,.xls,.csv,.txt,.pdf" hidden></label>`,
      onMount(root, close) {
        root.querySelector('[data-act="anyway"]').addEventListener('click', () => { result = 'anyway'; close(); });
        root.querySelector('[data-act="pick"] input').addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) { result = { file }; close(); }
        });
      },
      onClose: () => resolve(result)
    });
  });
}

/** Administrator: encrypt and publish the group cuadrante loaded on this device. */
export async function publishSharedCuadrante() {
  // el token va cifrado con el PIN: si hace falta, se pide (o se pone el PIN, si aún no hay)
  const { ensureAdminToken } = await import('./pin.js');
  if (!(await ensureAdminToken()) && (await getPublishSettings())) return null;
  const cfg = await getPublishSettings();
  const password = await getGroupPassword();
  if (!cfg?.token || !password) {
    Actions.showToast('Antes pon la contraseña del grupo y el token de GitHub (Ajustes → Contraseña del grupo y Administración)');
    Actions.setScreen('settings');
    return null;
  }
  // read the Excel again if an older version of the app read it (same file)
  await rereadIfOutdated().catch(() => null);
  let stored = await loadGroupCuadrante();
  let notas = notesCount(stored);
  if (stored?.entries?.length && !notas) {
    // A cuadrante read before v27 has no notes: publishing it would give
    // everyone the counts without them. Read the Excel first.
    const choice = await askForExcel();
    if (!choice) return null;
    if (choice !== 'anyway') {
      try {
        const result = await withBusy('Leyendo el Excel…', () => importGroupCuadranteFile(choice.file));
        stored = result.data;
        notas = notesCount(stored);
        notifyCuadranteChanged();
        await autoSyncIfStale().catch(() => null);
      } catch (err) {
        Actions.showToast('No se pudo leer el archivo.', { level: 'error', detail: err.message });
        return null;
      }
      if (!notas && !(await confirmDialog({
        title: 'Este Excel no tiene notas',
        message: 'En el archivo elegido no hay ninguna nota en las casillas. ¿Publicarlo igualmente?',
        confirmLabel: 'Publicar', cancelLabel: 'Cancelar'
      }))) return null;
    }
  }
  try {
    return await withBusy('Cifrando, comprobando y publicando el cuadrante…', async () => {
      const r = await publishCuadrante({ ...cfg, password, data: stored || undefined, fichas: buildFichas(getState().profiles), compensaciones: await getGroupComps(), orden: await getGroupOrden() });
      await setPublishSettings({ ...cfg, lastPublishedAt: r.publishedAt, lastNotas: r.notas ?? null });
      notifyCuadranteChanged();
      Actions.showToast(`Publicado y comprobado${r.notas ? `: ${r.notas.toLocaleString('es-ES')} notas del Excel` : ' (sin notas del Excel)'}. Tus compañeros lo recibirán al abrir la app (en 1–2 minutos).`, { duration: 9000 });
      return r;
    });
  } catch (err) {
    Actions.showToast('No se pudo publicar el cuadrante.', { level: 'error', detail: err.message });
    return null;
  }
}

/** Is this device set up to publish (administrator)? */
export async function canPublish() {
  const cfg = await getPublishSettings();
  // administrador: token guardado, aunque ahora mismo no se pueda leer (se pedirá el PIN al publicar)
  return Boolean((cfg?.token || cfg?.locked || cfg?.needsPin) && (await getGroupPassword()));
}

// ─── Botón «Actualizar» del panel ───

let refreshing = false;
/**
 * One tap to be up to date: download the cuadrante published by the
 * administrator (if newer), redo this profile's accounting with it and look
 * for a new version of the app.
 */
/**
 * Ejecuta una sincronización y cuenta lo que ha cambiado en el calendario del
 * perfil: cuántos días y los cambios de guardia (que quedan como aviso en Inicio).
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<{result: T, changed: number}>}
 */
export async function withChangeReport(fn) {
  const before = getState().days;
  const profileId = getState().activeProfileId;
  const result = await fn();
  if (getState().activeProfileId !== profileId) return { result, changed: 0 };
  const diff = diffDays(before, getState().days);
  await saveLastChanges(guardChangeTexts(diff)).catch(err => console.warn('No se pudieron guardar los cambios de guardia', err));
  return { result, changed: diff.changed.length };
}

export async function refreshEverything() {
  if (refreshing) return;
  refreshing = true;
  try {
    let pulled = null;
    let synced = false;
    let changed = 0;
    const hasKey = Boolean(await getGroupPassword());
    await withBusy('Actualizando…', async () => {
      if (hasKey) {
        pulled = await pullPublished({ force: false });
        if (pulled?.updated) { notifyCuadranteChanged(); await loadGroupComps(); }
      }
      const p = getState().activeProfile;
      const data = await loadGroupCuadrante();
      if (p?.cuadranteName && data?.entries?.length) {
        ({ changed } = await withChangeReport(() => syncActiveProfile({ entries: data.entries, person: p.cuadranteName, desde: p.syncDesde || defaultSyncStart() })));
        synced = true;
      }
      try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch { /* offline */ }
    });

    const data = await loadGroupCuadrante();
    const p = getState().activeProfile;
    if (pulled?.code === 'BAD_PASSWORD') {
      Actions.showToast('La contraseña del grupo no abre el cuadrante publicado. Revísala en Ajustes.', { level: 'error' });
    } else if (!data) {
      Actions.showToast(hasKey ? 'Todavía no hay ningún cuadrante publicado' : 'Aún no tienes cuadrante: pide la contraseña del grupo al administrador (Ajustes → Contraseña del grupo)');
    } else if (!p?.cuadranteName) {
      await askWhoAmI({ manual: true });
    } else {
      // lo que cambia en tu calendario: «Sin cambios», «1 día actualizado», «3 días actualizados»
      Actions.showToast(`${pulled?.updated ? 'Cuadrante nuevo recibido · ' : ''}${changedDaysText(changed)}`);
    }
    return { pulled, synced };
  } catch (err) {
    Actions.showToast('No se pudo actualizar.', { level: 'error', detail: err.message });
    return null;
  } finally {
    refreshing = false;
  }
}
