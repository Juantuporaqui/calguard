/**
 * @module ui/sheet
 * Accessible bottom-sheet / dialog helper: Escape and backdrop close it,
 * focus moves inside and returns to the opener on close.
 */

import { esc } from './utils.js';
import { pushLayer } from './router.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Elementos con foco posible dentro de la hoja, en orden y visibles. */
function focusables(sheet) {
  return [...sheet.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0 && !el.closest('[hidden], [inert]'));
}

/**
 * Lo que queda detrás de la hoja: el resto de la página, menos los avisos
 * (que siguen pudiéndose cerrar o deshacer). Con varias hojas abiertas, cada
 * elemento cuenta cuántas lo tapan y solo deja de ser inerte con la última.
 */
function behind(root) {
  const out = [];
  for (const el of document.body.children) {
    if (el === root || el.tagName === 'SCRIPT') continue;
    if (el.id === 'app') {
      for (const child of el.children) if (child.id !== 'toast-container') out.push(child);
    } else {
      out.push(el);
    }
  }
  return out;
}
function setInert(els, on) {
  for (const el of els) {
    const n = (Number(el.dataset.inertBy) || 0) + (on ? 1 : -1);
    if (n > 0) { el.dataset.inertBy = String(n); el.inert = true; } else { delete el.dataset.inertBy; el.inert = false; }
  }
}

/**
 * Open a sheet.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.body - HTML (escape any untrusted data before!)
 * @param {string} [opts.footer] - HTML for the action row
 * @param {(root: HTMLElement, close: Function) => void} [opts.onMount]
 * @param {Function} [opts.onClose]
 * @param {'sheet'|'dialog'} [opts.variant]
 * @param {string} [opts.className] - clase extra para la hoja (p. ej. 'sheet-day')
 * @returns {Function} close
 */
export function openSheet({ title, body, footer = '', onMount, onClose, variant = 'sheet', className = '' }) {
  const opener = document.activeElement;
  const root = document.createElement('div');
  root.className = `sheet-backdrop sheet-${variant}${className ? ' ' + className : ''}`;
  root.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head">
        <h3 id="sheet-title">${esc(title)}</h3>
        <button type="button" class="sheet-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="sheet-body">${body}</div>
      ${footer ? `<div class="sheet-foot">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('sheet-open');
  // el resto de la página no se puede tocar ni recorrer con el teclado mientras la hoja está abierta
  const inertEls = behind(root);
  setInert(inertEls, true);

  let closed = false;
  let releaseLayer = () => {};
  const close = () => {
    if (closed) return;
    closed = true;
    releaseLayer();
    setInert(inertEls, false);
    document.removeEventListener('keydown', onKey, true);
    root.classList.add('closing');
    setTimeout(() => {
      root.remove();
      if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('sheet-open');
    }, 160);
    if (opener && typeof opener.focus === 'function') opener.focus();
    onClose?.();
  };
  const sheetEl = root.querySelector('.sheet');
  const onKey = (e) => {
    // solo la hoja de arriba responde al teclado
    const top = [...document.querySelectorAll('.sheet-backdrop:not(.closing)')].pop();
    if (top !== root) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') { // trampa de foco: Tab da la vuelta dentro de la hoja
      const items = focusables(sheetEl);
      if (!items.length) { e.preventDefault(); sheetEl.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      const inside = sheetEl.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  // el botón Atrás del móvil cierra la hoja en vez de cambiar de pantalla
  releaseLayer = pushLayer(close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  root.querySelector('.sheet-close').addEventListener('click', close);

  onMount?.(root, close);
  requestAnimationFrame(() => {
    root.classList.add('open');
    const focusable = root.querySelector('[autofocus], input, select, textarea, .sheet-foot button, button:not(.sheet-close)');
    (focusable || root.querySelector('.sheet')).focus?.();
  });
  return close;
}

/**
 * Styled confirmation dialog.
 * @param {{title: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean}} o
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmLabel = 'Aceptar', cancelLabel = 'Cancelar', danger = false }) {
  return new Promise(resolve => {
    let result = false;
    openSheet({
      title,
      variant: 'dialog',
      body: `<p class="dialog-message">${esc(message).replace(/\n/g, '<br>')}</p>`,
      footer: `
        <button type="button" class="btn" data-act="cancel">${esc(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok" autofocus>${esc(confirmLabel)}</button>`,
      onMount(root, close) {
        root.querySelector('[data-act="ok"]').addEventListener('click', () => { result = true; close(); });
        root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      },
      onClose: () => resolve(result)
    });
  });
}

/**
 * Styled text prompt.
 * @param {{title: string, label: string, value?: string, placeholder?: string, type?: string, confirmLabel?: string}} o
 * @returns {Promise<string|null>}
 */
export function promptDialog({ title, label, value = '', placeholder = '', type = 'text', confirmLabel = 'Aceptar' }) {
  return new Promise(resolve => {
    let result = null;
    openSheet({
      title,
      variant: 'dialog',
      body: `<label class="field"><span>${esc(label)}</span>
        <input type="${esc(type)}" class="prompt-input" value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus></label>`,
      footer: `
        <button type="button" class="btn" data-act="cancel">Cancelar</button>
        <button type="button" class="btn btn-primary" data-act="ok">${esc(confirmLabel)}</button>`,
      onMount(root, close) {
        const input = root.querySelector('.prompt-input');
        const accept = () => { result = input.value; close(); };
        root.querySelector('[data-act="ok"]').addEventListener('click', accept);
        root.querySelector('[data-act="cancel"]').addEventListener('click', close);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); accept(); } });
      },
      onClose: () => resolve(result)
    });
  });
}
