/**
 * @module ui/settings/profile
 * «Mi perfil»: nombre, vínculo con el cuadrante y los perfiles de este móvil.
 */

import { Actions } from '../../state/store.js';
import { updateActiveProfile, displayName } from '../../domain/profiles.js';
import { defaultSyncStart } from '../../domain/cuadranteSync.js';
import { createAndSwitchProfile, switchToProfile, avatarHTML, askWhoAmI } from '../flows.js';
import { esc } from '../utils.js';
import { section, autosave } from './common.js';

const fmt = (iso) => iso ? iso.split('-').reverse().join('/') : '';

export function profileHTML(state) {
  const profile = state.activeProfile;
  return section('profile', 'Mi perfil', `${esc(profile.name)}${profile.cuadranteName ? ` · ${esc(displayName(profile.cuadranteName))} en el cuadrante` : ''}`, `
    <label class="field"><span>Nombre de este perfil</span><input type="text" id="cfg-name" maxlength="40" value="${esc(profile.name)}" autocomplete="off"></label>
    <div class="field-row">
      <div><span class="field-label">Vínculo con el cuadrante</span>
        <p class="set-help">${profile.cuadranteName ? `Vinculado a <strong>${esc(displayName(profile.cuadranteName))}</strong> desde el ${fmt(profile.syncDesde || defaultSyncStart())}. Al cargar un cuadrante nuevo se actualiza solo.` : 'Sin vincular. Vincúlalo con «¿Quién soy yo?» o desde la pantalla Cuadrante.'}</p>
      </div>
      ${profile.cuadranteName ? '<button type="button" class="btn btn-sm" id="unlink-profile">Desvincular</button>' : ''}
    </div>
    <span class="field-label">Perfiles de este móvil</span>
    <ul class="profile-mini-list">
      ${state.profiles.map(p => `
        <li class="${p.id === profile.id ? 'active' : ''}">
          ${avatarHTML(p.name, 'avatar-sm')}<span>${esc(p.name)}${p.id === state.config.meProfileId ? ' <span class="me-badge">tú</span>' : ''}</span>
          ${p.id === profile.id ? '<em>activo</em>' : `<button type="button" class="link-btn" data-switch="${esc(p.id)}">Abrir</button>`}
        </li>`).join('')}
    </ul>
    <div class="btn-row">
      <button type="button" class="btn" id="new-profile">＋ Nuevo perfil</button>
      <button type="button" class="btn" id="who-am-i">¿Quién soy yo?</button>
    </div>`);
}

export function bindProfile(root) {
  autosave(root.querySelector('#cfg-name'), {
    validate: (v) => (v.trim() ? null : 'El perfil necesita un nombre'),
    save: async (v) => { await updateActiveProfile({ name: v.trim() }); return 'Nombre guardado'; }
  });
  root.querySelector('#new-profile')?.addEventListener('click', createAndSwitchProfile);
  root.querySelector('#who-am-i')?.addEventListener('click', () => askWhoAmI({ manual: true }));
  root.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => switchToProfile(b.dataset.switch)));
  root.querySelector('#unlink-profile')?.addEventListener('click', async () => {
    await updateActiveProfile({ cuadranteName: null, lastSyncAt: null });
    Actions.showToast('Perfil desvinculado del cuadrante (sus datos se conservan)');
  });
}
