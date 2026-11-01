/**
 * @module ui/toast
 * Toast notification renderer (with optional action button, e.g. "Deshacer").
 * The container is permanent and aria-live, so screen readers announce it.
 */

import { getState, runToastAction } from '../state/store.js';
import { esc } from './utils.js';

/**
 * @param {HTMLElement} container
 */
export function renderToast(container) {
  if (!container) return;
  const { toast } = getState();

  if (!toast) {
    container.classList.remove('visible');
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="toast" role="status">
      <span class="toast-text">${esc(toast.text)}</span>
      ${toast.actionLabel ? `<button type="button" class="toast-action">${esc(toast.actionLabel)}</button>` : ''}
    </div>`;
  container.classList.add('visible');
  container.querySelector('.toast-action')?.addEventListener('click', runToastAction);
}
