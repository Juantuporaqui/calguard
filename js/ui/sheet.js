/**
 * @module ui/sheet
 * Accessible bottom-sheet / dialog helper: Escape and backdrop close it,
 * focus moves inside and returns to the opener on close.
 */

import { esc } from './utils.js';
import { pushLayer } from './router.js';

/**
 * Open a sheet.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.body - HTML (escape any untrusted data before!)
 * @param {string} [opts.footer] - HTML for the action row
 * @param {(root: HTMLElement, close: Function) => void} [opts.onMount]
 * @param {Function} [opts.onClose]
 * @param {'sheet'|'dialog'} [opts.variant]
 * @returns {Function} close
 */
export function openSheet({ title, body, footer = '', onMount, onClose, variant = 'sheet' }) {
  const opener = document.activeElement;
  const root = document.createElement('div');
  root.className = `sheet-backdrop sheet-${variant}`;
  root.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
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

  let closed = false;
  let releaseLayer = () => {};
  const close = () => {
    if (closed) return;
    closed = true;
    releaseLayer();
    document.removeEventListener('keydown', onKey, true);
    root.classList.add('closing');
    setTimeout(() => {
      root.remove();
      if (!document.querySelector('.sheet-backdrop')) document.body.classList.remove('sheet-open');
    }, 160);
    if (opener && typeof opener.focus === 'function') opener.focus();
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
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
