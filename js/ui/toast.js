/**
 * @module ui/toast
 * Toast notification renderer
 */

import { getState } from '../state/store.js';

/**
 * @param {HTMLElement} container
 */
export function renderToast(container) {
  if (!container) return;
  const state = getState();

  if (state.toast) {
    container.innerHTML = `<div class="toast" role="alert" aria-live="polite">${state.toast}</div>`;
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}
