/**
 * @module domain/profiles
 * Perfiles por funcionario. Cada perfil tiene sus propios días, movimientos,
 * servicios y ajustes personales (cupos de AP/vacaciones y arrastre anual).
 * Un perfil puede estar vinculado a una persona del cuadrante grupal
 * (profile.cuadranteName) para sincronizar su contabilidad con un toque.
 */

import { get, put, getAll, getAllByIndex, remove, removeByIndex, STORES } from '../persistence/db.js';
import { getState, Actions, PERSONAL_KEYS } from '../state/store.js';

/** "REINOSO" → "Reinoso", "Mª CARMEN" → "Mª Carmen" */
export function displayName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/(^|\s|-)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

/** Initials for the avatar chip: "Mª Carmen" → "MC" */
export function initials(name) {
  const parts = String(name || '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export async function loadProfiles() {
  const list = (await getAll(STORES.PROFILES)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  Actions.setProfiles(list);
  return list;
}

/** Load all data of a profile (days, ledger, services). */
export async function loadProfileData(profileId) {
  const [days, ledger, services] = await Promise.all([
    getAllByIndex(STORES.DAYS, 'profileId', profileId),
    getAllByIndex(STORES.LEDGER, 'profileId', profileId),
    getAllByIndex(STORES.SERVICES, 'profileId', profileId)
  ]);
  ledger.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  services.sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || ''));
  return { days, ledger, services };
}

/** Switch the active profile and swap its data in a single render. */
export async function switchProfile(profileId) {
  const profile = await get(STORES.PROFILES, profileId);
  if (!profile) throw new Error('Perfil no encontrado');
  const data = await loadProfileData(profileId);
  Actions.setProfile(profile);
  Actions.setData(data);
  await put(STORES.CONFIG, { key: 'lastProfileId', value: profileId });
  return profile;
}

export async function createProfile(name, extra = {}) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('El perfil necesita un nombre');
  const profile = {
    id: crypto.randomUUID(),
    name: clean,
    role: 'usuario',
    createdAt: new Date().toISOString(),
    settings: {},
    ...extra
  };
  await put(STORES.PROFILES, profile);
  await loadProfiles();
  return profile;
}

/** Update the active profile (shallow; `settings` is merged). */
export async function updateActiveProfile(patch) {
  const current = getState().activeProfile;
  const profile = {
    ...current,
    ...patch,
    settings: { ...(current.settings || {}), ...(patch.settings || {}) }
  };
  await put(STORES.PROFILES, profile);
  Actions.setProfile(profile);
  await loadProfiles();
  return profile;
}

/** Delete a profile and ALL its data. Switches away if it was active. */
export async function deleteProfile(profileId) {
  const { profiles, activeProfileId } = getState();
  if (profiles.length <= 1) throw new Error('No se puede borrar el único perfil');
  for (const store of [STORES.DAYS, STORES.LEDGER, STORES.SERVICES, STORES.AUDIT]) {
    await removeByIndex(store, 'profileId', profileId);
  }
  await remove(STORES.PROFILES, profileId);
  const list = await loadProfiles();
  if (activeProfileId === profileId) await switchProfile(list[0].id);
}

/**
 * Find the profile linked to a cuadrante person (by link or by name).
 * @param {string} canonical - canonical person name (e.g. "CARMEN")
 */
export function findProfileForPerson(canonical) {
  const key = String(canonical || '').toUpperCase();
  return getState().profiles.find(p =>
    (p.cuadranteName || '').toUpperCase() === key || p.name.toUpperCase() === key
  ) || null;
}

/** Get or create the profile of a cuadrante person, linked to it. */
export async function ensureProfileForPerson(canonical) {
  let p = findProfileForPerson(canonical);
  if (!p) {
    p = await createProfile(displayName(canonical), { cuadranteName: canonical.toUpperCase() });
  } else if (!p.cuadranteName) {
    p = { ...p, cuadranteName: canonical.toUpperCase() };
    await put(STORES.PROFILES, p);
    await loadProfiles();
  }
  return p;
}

/**
 * One-time migration: before profiles had personal settings, quotas and
 * carry-over lived in the global config. Copy them into the active profile.
 */
export async function migratePersonalSettings() {
  const flag = await get(STORES.CONFIG, 'personalSettingsMigrated');
  if (flag?.value) return;
  const s = getState();
  const profile = s.activeProfile;
  if (!profile) return;
  const settings = { ...(profile.settings || {}) };
  let changed = false;
  for (const k of PERSONAL_KEYS) {
    if (settings[k] === undefined && s.config[k] !== undefined) {
      settings[k] = s.config[k];
      changed = true;
    }
  }
  if (changed) {
    const updated = { ...profile, settings };
    await put(STORES.PROFILES, updated);
    Actions.setProfile(updated);
  }
  await put(STORES.CONFIG, { key: 'personalSettingsMigrated', value: true });
}
