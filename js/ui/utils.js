/**
 * @module ui/utils
 * Shared UI helpers
 */

/**
 * Escape text for interpolation into HTML (element content and
 * double-quoted attribute values). Use on ANY value that does not
 * come from a code constant: names parsed from imported files,
 * user notes, labels, etc.
 * @param {*} str
 * @returns {string}
 */
export function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Tamaños calculados (barras, porcentajes) sin estilos en línea, que la CSP no
 * permite: el HTML lleva data-w / data-h y aquí se aplican con style.setProperty.
 * @param {ParentNode} root
 */
export function applyDataSizes(root) {
  if (!root?.querySelectorAll) return;
  const all = [...(root.matches?.('[data-w],[data-h]') ? [root] : []), ...root.querySelectorAll('[data-w],[data-h]')];
  for (const el of all) {
    if (el.dataset.w != null) el.style.setProperty('width', el.dataset.w);
    if (el.dataset.h != null) el.style.setProperty('height', el.dataset.h);
  }
}

/** Aplica applyDataSizes a todo lo que se pinte en la página (antes de que se vea). */
export function watchDataSizes(target = document.body) {
  applyDataSizes(target);
  new MutationObserver(records => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) applyDataSizes(n);
  }).observe(target, { childList: true, subtree: true });
}
