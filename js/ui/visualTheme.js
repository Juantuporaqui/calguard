import { applyDashboard } from './dashboardMode.js';

/**
 * @module ui/visualTheme
 * Sistema de temas visuales mediante el atributo `data-theme` en `<html>`.
 * Independiente del modo claro/oscuro (`html.dark`) y del tamaño de texto (`text-lg` / `text-xl`).
 */

export const VISUAL_THEME_STORAGE_KEY = 'calguard-visual-theme';
export const DEFAULT_VISUAL_THEME = 'original';

export const VISUAL_THEMES = Object.freeze({
  original: Object.freeze({ id: 'original', label: 'Original (CalGuard)' }),
  f1: Object.freeze({ id: 'f1', label: 'Fórmula 1 / Telemetría' }),
  avion: Object.freeze({ id: 'avion', label: 'Cabina de avión / Aviónica' }),
  cientifica: Object.freeze({ id: 'cientifica', label: 'Policía Científica' }),
  naturaleza: Object.freeze({ id: 'naturaleza', label: 'Naturaleza / Orgánico' }),
  gatitos: Object.freeze({ id: 'gatitos', label: 'Gatitos', description: 'Calidez felina, tonos crema, terracota suave y detalles de huellas' })
});

export const ALLOWED_VISUAL_THEMES = Object.freeze(Object.keys(VISUAL_THEMES));

/**
 * Comprueba de forma estricta si un identificador de tema visual está permitido.
 * @param {unknown} theme
 * @returns {boolean}
 */
export function isValidVisualTheme(theme) {
  return typeof theme === 'string' && Object.prototype.hasOwnProperty.call(VISUAL_THEMES, theme);
}

/**
 * Devuelve un identificador de tema válido o el tema por defecto (`original`).
 * @param {unknown} theme
 * @returns {string}
 */
export function resolveVisualTheme(theme) {
  return isValidVisualTheme(theme) ? theme : DEFAULT_VISUAL_THEME;
}

/**
 * Lee el tema visual persistido en `localStorage`, validándolo estrictamente.
 * @param {Storage|null} [storage]
 * @returns {string}
 */
export function getSavedVisualTheme(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    const raw = storage?.getItem?.(VISUAL_THEME_STORAGE_KEY);
    return resolveVisualTheme(raw);
  } catch {
    return DEFAULT_VISUAL_THEME;
  }
}

/**
 * Aplica el atributo `data-theme` sobre `<html>` sin alterar `classList` (`dark`, `text-lg`, `text-xl`).
 * @param {unknown} [theme]
 * @param {Element|null} [root]
 * @returns {string} El identificador validado aplicado.
 */
export function applyVisualTheme(
  theme = DEFAULT_VISUAL_THEME,
  root = typeof document !== 'undefined' ? document.documentElement : null
) {
  const resolved = resolveVisualTheme(theme);
  root?.setAttribute?.('data-theme', resolved);
  applyDashboard(resolved, root);
  return resolved;
}

/**
 * Persiste el tema visual en `localStorage` y lo aplica inmediatamente en el DOM.
 * @param {unknown} theme
 * @param {{ storage?: Storage|null, root?: Element|null }} [options]
 * @returns {string} El identificador validado guardado.
 */
export function saveVisualTheme(
  theme,
  {
    storage = typeof localStorage !== 'undefined' ? localStorage : null,
    root = typeof document !== 'undefined' ? document.documentElement : null
  } = {}
) {
  const resolved = applyVisualTheme(theme, root);
  try {
    storage?.setItem?.(VISUAL_THEME_STORAGE_KEY, resolved);
  } catch {
    /* modo privado o almacenamiento bloqueado */
  }
  return resolved;
}

/**
 * Restaura el tema visual guardado al iniciar la aplicación.
 * @param {{ storage?: Storage|null, root?: Element|null }} [options]
 * @returns {string}
 */
export function initVisualTheme(options = {}) {
  const saved = getSavedVisualTheme(options.storage);
  return applyVisualTheme(saved, options.root);
}
