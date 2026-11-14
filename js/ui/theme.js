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

/** Tamaño del texto: escala html{font-size} (todo está en rem). */
export const TEXT_SIZES = {
  normal: { label: 'Normal', cls: '' },
  grande: { label: 'Grande', cls: 'text-lg' },
  'muy-grande': { label: 'Muy grande', cls: 'text-xl' }
};

export function applyTextSize(size = 'normal') {
  const root = document.documentElement;
  for (const { cls } of Object.values(TEXT_SIZES)) if (cls) root.classList.remove(cls);
  const cls = TEXT_SIZES[size]?.cls;
  if (cls) root.classList.add(cls);
}

export async function saveTextSize(size) {
  applyTextSize(size);
  const { saveGlobalConfig } = await import('./settings/common.js');
  await saveGlobalConfig({ textSize: TEXT_SIZES[size] ? size : 'normal' });
}
