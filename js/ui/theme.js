/**
 * @module ui/theme
 * Light/dark theme: 'auto' follows the device; 'light'/'dark' force it.
 */

import { getState, Actions } from '../state/store.js';
import { put, STORES } from '../persistence/db.js';

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveDark(preference) {
  return preference === 'dark' || (preference === 'auto' && !!media?.matches);
}

export function applyTheme(preference = 'auto') {
  Actions.setTheme(preference, resolveDark(preference));
}

export async function saveTheme(preference) {
  applyTheme(preference);
  await put(STORES.CONFIG, { key: 'themePreference', value: preference });
}

/** Re-apply when the device switches theme while on 'auto'. */
export function watchSystemTheme() {
  media?.addEventListener?.('change', () => {
    if (getState().themePreference === 'auto') applyTheme('auto');
  });
}
