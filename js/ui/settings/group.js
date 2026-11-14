/**
 * @module ui/settings/group
 * «Contraseña del grupo»: con ella el móvil recibe solo el cuadrante publicado (cifrado).
 */

import { Actions } from '../../state/store.js';
import { getGroupPassword, setGroupPassword, getSharedStatus } from '../../domain/sharedCuadrante.js';
import { loadGroupCuadrante } from '../../domain/groupCuadrante.js';
import { pullSharedCuadrante } from '../flows.js';
import { shareInstructions } from '../help.js';
import { section, autosave } from './common.js';

const fmtStamp = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-ES')} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
};

export function groupHTML() {
  return section('group', 'Contraseña del grupo', 'Para recibir el cuadrante solo', `
    <p class="set-help">El administrador publica el cuadrante <strong>cifrado</strong>. Con la <strong>contraseña del grupo</strong>, tu móvil lo descarga solo cada vez que abres CalGuard y tu contabilidad se pone al día. Sin la contraseña nadie puede leerlo, aunque la web sea pública.</p>
    <p class="backup-status" id="grp-status">Comprobando…</p>
    <label class="field"><span>Contraseña del grupo</span><input type="password" id="grp-pass" autocomplete="off" minlength="8" placeholder="Te la da el administrador"></label>
    <div class="btn-row">
      <button type="button" class="btn" id="grp-check">Comprobar ahora</button>
      <button type="button" class="btn" id="grp-forget" hidden>Olvidar contraseña</button>
      <button type="button" class="btn" id="share-install">Enviar instrucciones a un compañero</button>
    </div>`);
}

export function bindGroup(root) {
  const $ = (id) => root.querySelector('#' + id);
  const refresh = async () => {
    const [pass, seen, local] = await Promise.all([getGroupPassword(), getSharedStatus(), loadGroupCuadrante()]);
    if (!root.isConnected || !$('grp-pass')) return; // se repintó mientras tanto
    $('grp-pass').placeholder = pass ? '•••••••• (guardada en este móvil)' : 'Te la da el administrador';
    $('grp-forget').hidden = !pass;
    $('grp-status').classList.toggle('stale', !pass || Boolean(seen.failedAt));
    $('grp-status').textContent = !pass
      ? 'Sin contraseña: el cuadrante solo se actualiza si lo cargas tú.'
      : seen.failedAt ? 'La contraseña no abre el cuadrante publicado: revísala.'
      : local?.publishedAt ? `Tienes el cuadrante publicado el ${fmtStamp(local.publishedAt)}. Se comprueba solo al abrir la app.`
      : 'Contraseña guardada. Aún no has recibido ningún cuadrante publicado.';
  };
  refresh();

  autosave($('grp-pass'), {
    validate: (v) => (v.length < 8 ? 'La contraseña del grupo tiene al menos 8 caracteres' : null),
    save: async (v) => {
      await setGroupPassword(v);
      $('grp-pass').value = '';
      Actions.showToast('Contraseña del grupo guardada');
      await pullSharedCuadrante({ force: true });
      refresh();
      return false;
    }
  });
  $('grp-check')?.addEventListener('click', async () => { await pullSharedCuadrante({ force: true }); refresh(); });
  $('grp-forget')?.addEventListener('click', async () => {
    await setGroupPassword(null);
    Actions.showToast('Contraseña olvidada: el cuadrante ya no se descargará solo');
    refresh();
  });
  $('share-install')?.addEventListener('click', shareInstructions);
}
