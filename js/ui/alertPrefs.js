/**
 * @module ui/alertPrefs
 * Preferencias de avisos de cada perfil, guardadas en el propio perfil
 * (profile.alertPrefs, campo opcional: si no existe, no hay nada descartado):
 *  - dismissed: avisos marcados «No volver a mostrar» (últimos 200);
 *  - lastChanges: cambios de guardia de la última actualización con el cuadrante.
 */

import { getState } from '../state/store.js';
import { updateActiveProfile } from '../domain/profiles.js';

const MAX_DISMISSED = 200;

const prefs = () => getState().activeProfile?.alertPrefs || {};

export const dismissedAlerts = () => prefs().dismissed || [];
export const lastChanges = () => prefs().lastChanges || null;

/** «No volver a mostrar» para este perfil. */
export async function dismissAlert(id) {
  if (!getState().activeProfile) return;
  const dismissed = [...dismissedAlerts().filter(x => x !== id), id].slice(-MAX_DISMISSED);
  await updateActiveProfile({ alertPrefs: { ...prefs(), dismissed } });
}

/** Guarda los cambios de guardia de una actualización (o los borra si no hay). */
export async function saveLastChanges(texts) {
  if (!getState().activeProfile) return;
  if (!texts.length && !prefs().lastChanges) return;
  await updateActiveProfile({ alertPrefs: { ...prefs(), lastChanges: texts.length ? { at: new Date().toISOString(), texts } : null } });
}
