/**
 * @module ui/header
 * App header: brand + current section + profile switcher chip.
 */

import { getState } from '../state/store.js';
import { esc } from './utils.js';
import { avatarHTML, openProfileSheet, refreshEverything } from './flows.js';
import { openHelp } from './help.js';
import { titleOf, isSubScreen, goBack } from './router.js';

const SHIELD = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M16 2.5 4.5 6.8v8.3c0 7.2 4.8 12.6 11.5 14.4 6.7-1.8 11.5-7.2 11.5-14.4V6.8L16 2.5Z" fill="currentColor" opacity=".18"/>
  <path d="M16 2.5 4.5 6.8v8.3c0 7.2 4.8 12.6 11.5 14.4 6.7-1.8 11.5-7.2 11.5-14.4V6.8L16 2.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="m10.5 16 3.6 3.6 7.4-7.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * @param {HTMLElement} el
 */
export function renderHeader(el) {
  if (!el) return;
  const s = getState();
  const p = s.activeProfile;
  const sub = isSubScreen(s.currentScreen);
  el.innerHTML = `
    <div class="app-header-inner">
      ${sub ? `
      <div class="brand brand-back">
        <button type="button" class="back-btn" aria-label="Volver a la pantalla anterior"><span aria-hidden="true">‹</span> Volver</button>
        <span class="brand-screen brand-screen-title">${esc(titleOf(s.currentScreen))}</span>
      </div>` : `
      <div class="brand">
        ${SHIELD}
        <div class="brand-text">
          <span class="brand-name">CalGuard</span>
          <span class="brand-screen">${esc(titleOf(s.currentScreen))}</span>
        </div>
      </div>`}
      <div class="header-actions">
      ${s.currentScreen === 'dashboard' ? `
      <button type="button" class="refresh-btn" aria-label="Actualizar cuadrante y calendario">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>` : ''}
      <button type="button" class="help-btn" aria-label="Ayuda">?</button>
      ${p ? `
        <button type="button" class="profile-chip" aria-haspopup="dialog" aria-label="Perfil activo: ${esc(p.name)}. Cambiar de perfil">
          ${avatarHTML(p.name, 'avatar-sm')}
          <span class="profile-chip-name">${esc(p.name)}</span>
          <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>` : ''}
      </div>
    </div>`;
  el.querySelector('.profile-chip')?.addEventListener('click', openProfileSheet);
  el.querySelector('.help-btn')?.addEventListener('click', openHelp);
  el.querySelector('.back-btn')?.addEventListener('click', goBack);
  el.querySelector('.refresh-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spinning');
    try { await refreshEverything(); } finally { btn.classList.remove('spinning'); }
  });
}
