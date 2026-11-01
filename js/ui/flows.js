/**
 * @module ui/flows
 * User flows that combine several domain operations with feedback
 * (busy indicator, toasts): switching profiles, opening a colleague's
 * accounting from the cuadrante, syncing with the group cuadrante.
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import {
  switchProfile, createProfile, ensureProfileForPerson, findProfileForPerson,
  updateActiveProfile, initials, displayName
} from '../domain/profiles.js';
import { syncActiveProfile, autoSyncIfStale, defaultSyncStart } from '../domain/cuadranteSync.js';
import { loadGroupCuadrante, currentRoster, canonicalPerson } from '../domain/groupCuadrante.js';
import { openSheet, confirmDialog } from './sheet.js';
import { esc } from './utils.js';

/** Stable hue per name so each person keeps the same avatar colour. */
export function avatarHue(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function avatarHTML(name, size = '') {
  return `<span class="avatar ${size}" style="--hue:${avatarHue(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
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

/**
 * First cuadrante load on a fresh install: ask who the user is (from the
 * roster), so the starting profile gets the right name and fills itself in.
 * Only when the active profile is unlinked and still empty.
 */
export async function askWhoAmIIfNeeded() {
  const s = getState();
  if (s.activeProfile?.cuadranteName || s.days.length || s.ledger.length) return;
  const { roster } = await loadRoster();
  const free = roster.filter(n => !findProfileForPerson(n));
  if (!free.length) return;
  openSheet({
    title: '¿Quién eres?',
    body: `
      <p class="sheet-hint">Elige tu nombre y la app rellenará tu calendario y tu contabilidad con el cuadrante.</p>
      <label class="field"><span>Tu nombre en el cuadrante</span>
        <select id="who-person">${rosterOptions(roster, '— Elige —')}</select></label>`,
    footer: `
      <button type="button" class="btn" data-act="skip">Ahora no</button>
      <button type="button" class="btn btn-primary" data-act="ok">Soy yo</button>`,
    onMount(root, close) {
      const sel = root.querySelector('#who-person');
      root.querySelector('[data-act="skip"]').addEventListener('click', close);
      root.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        if (!sel.value) { Actions.showToast('Elige tu nombre'); sel.focus(); return; }
        close();
        await linkActiveProfileTo(sel.value);
        Actions.setScreen('dashboard');
      });
    }
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
    Actions.showToast(`Sincronizado: ${summaryText(summary)}`);
    return summary;
  });
}

/** Profile picker sheet (opened from the header chip). */
export function openProfileSheet() {
  const { profiles, activeProfileId } = getState();
  openSheet({
    title: 'Perfiles',
    body: `
      <p class="sheet-hint">Cada funcionario tiene su propio calendario, cupos y contabilidad.</p>
      <ul class="profile-list">
        ${profiles.map(p => `
          <li>
            <button type="button" class="profile-item ${p.id === activeProfileId ? 'active' : ''}" data-id="${esc(p.id)}">
              ${avatarHTML(p.name)}
              <span class="profile-item-text">
                <strong>${esc(p.name)}</strong>
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
      root.querySelector('[data-act="manage"]').addEventListener('click', () => {
        close();
        Actions.setScreen('settings');
      });
    }
  });
}
