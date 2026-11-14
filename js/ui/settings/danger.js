/**
 * @module ui/settings/danger
 * Al final de Ajustes: borrar este perfil o todos los datos. Las dos cosas
 * piden escribir BORRAR.
 */

import { getState, Actions } from '../../state/store.js';
import { clearStore, STORES } from '../../persistence/db.js';
import { lockVault } from '../../persistence/vaultSession.js';
import { deleteProfile } from '../../domain/profiles.js';
import { promptDialog } from '../sheet.js';
import { esc } from '../utils.js';

export function dangerHTML(state) {
  const only = state.profiles.length <= 1;
  return `
    <div class="danger-zone" id="danger-zone">
      <strong>Borrar</strong>
      <p>Borrar <strong>${esc(state.activeProfile.name)}</strong> quita su calendario, sus días y su bitácora. Borrar todo deja este móvil como recién instalado. Ninguna de las dos cosas se puede deshacer: guarda antes una copia.</p>
      <div class="btn-row">
        <button type="button" class="btn btn-danger" id="delete-profile" ${only ? 'disabled' : ''}>Borrar este perfil</button>
        <button type="button" class="btn btn-danger" id="reset-all">Borrar todos los datos</button>
      </div>
      ${only ? '<small>Es el único perfil: para quitarlo, usa «Borrar todos los datos».</small>' : ''}
    </div>`;
}

/** Pide escribir BORRAR. Devuelve true solo si lo escribe bien. */
async function typedBorrar(title, what) {
  const typed = await promptDialog({ title, message: `${what} No se puede deshacer.`, label: 'Escribe BORRAR para confirmar', confirmLabel: 'Borrar', danger: true });
  if (typed === null) return false;
  if (typed.trim().toUpperCase() !== 'BORRAR') { Actions.showToast('No has escrito BORRAR: no se ha borrado nada'); return false; }
  return true;
}

export function bindDanger(root) {
  root.querySelector('#delete-profile')?.addEventListener('click', async () => {
    const p = getState().activeProfile;
    if (getState().profiles.length <= 1) return;
    if (!(await typedBorrar(`Borrar «${p.name}»`, 'Se borrarán su calendario, sus días y su bitácora de este móvil.'))) return;
    await deleteProfile(p.id);
    Actions.showToast(`Perfil «${p.name}» borrado`);
  });
  root.querySelector('#reset-all')?.addEventListener('click', async () => {
    if (!(await typedBorrar('Borrar todos los datos', 'Se borrará TODO lo guardado en este móvil: perfiles, calendarios, días, bitácora, cuadrante y ajustes.'))) return;
    lockVault();
    for (const store of Object.values(STORES)) await clearStore(store);
    Actions.showToast('Datos borrados. Recargando…');
    setTimeout(() => location.reload(), 900);
  });
}
