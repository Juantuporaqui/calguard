/**
 * @module ui/toast
 * Avisos apilados (hasta 3). Los normales se cierran solos; los de error se
 * quedan hasta pulsar «✕», se anuncian como alerta y guardan el detalle
 * técnico tras «Ver detalle». El contenedor es aria-live.
 */

import { getState, runToastAction, closeToast } from '../state/store.js';
import { esc } from './utils.js';

let lastToasts = null;

/**
 * @param {HTMLElement} container
 */
export function renderToast(container) {
  if (!container) return;
  const { toasts } = getState();
  if (toasts === lastToasts && container.dataset.mounted) return; // nada nuevo: no se repinta (no se cierra «Ver detalle»)
  lastToasts = toasts;
  container.dataset.mounted = '1';

  if (!toasts?.length) {
    container.classList.remove('visible');
    container.innerHTML = '';
    return;
  }

  // se conservan los «Ver detalle» abiertos al repintar
  const open = new Set([...container.querySelectorAll('.toast-detail[open]')].map(d => d.closest('.toast')?.dataset.id));
  container.innerHTML = toasts.map(t => {
    const error = t.level === 'error';
    return `
    <div class="toast ${error ? 'toast-error' : ''}" role="${error ? 'alert' : 'status'}" data-id="${t.id}">
      <div class="toast-body">
        <span class="toast-text">${esc(t.text)}</span>
        ${t.detail ? `<details class="toast-detail" ${open.has(String(t.id)) ? 'open' : ''}><summary>Ver detalle</summary><p>${esc(t.detail)}</p></details>` : ''}
      </div>
      ${t.actionLabel ? `<button type="button" class="toast-action" data-act="run">${esc(t.actionLabel)}</button>` : ''}
      ${error ? '<button type="button" class="toast-close" data-act="close" aria-label="Cerrar aviso">✕</button>' : ''}
    </div>`;
  }).join('');
  container.classList.add('visible');
  container.querySelectorAll('.toast').forEach(el => {
    const id = Number(el.dataset.id);
    el.querySelector('[data-act="run"]')?.addEventListener('click', () => runToastAction(id));
    el.querySelector('[data-act="close"]')?.addEventListener('click', () => closeToast(id));
  });
}
