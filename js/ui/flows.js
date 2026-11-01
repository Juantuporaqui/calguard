/**
 * @module ui/flows
 * User flows that combine several domain operations with feedback
 * (busy indicator, toasts): switching profiles, opening a colleague's
 * accounting from the cuadrante, syncing with the group cuadrante.
 */

import { getState, Actions } from '../state/store.js';
import {
  switchProfile, createProfile, ensureProfileForPerson, initials, displayName
} from '../domain/profiles.js';
import { syncActiveProfile, autoSyncIfStale, defaultSyncStart } from '../domain/cuadranteSync.js';
import { loadGroupCuadrante } from '../domain/groupCuadrante.js';
import { openSheet, promptDialog } from './sheet.js';
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

export async function createAndSwitchProfile() {
  const name = await promptDialog({ title: 'Nuevo perfil', label: 'Nombre del funcionario', placeholder: 'Ej: Carmen', confirmLabel: 'Crear' });
  if (!name || !name.trim()) return;
  const p = await createProfile(name.trim());
  await switchToProfile(p.id);
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
