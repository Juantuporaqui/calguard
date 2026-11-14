/**
 * @module ui/settings/backup
 * «Copia de seguridad»: un solo botón, con la casilla «Proteger con contraseña».
 */

import { getState, Actions } from '../../state/store.js';
import { prepareBackup, restoreBackup } from '../../persistence/backup.js';
import { quickBackup, daysSinceBackup } from '../flows.js';
import { openSheet, promptDialog, confirmDialog } from '../sheet.js';
import { esc } from '../utils.js';
import { section } from './common.js';

const RESTORED_FLAG = 'calguard-just-restored';
let restoreInProgress = false;

export function announceRestore() {
  try {
    if (sessionStorage.getItem(RESTORED_FLAG)) {
      sessionStorage.removeItem(RESTORED_FLAG);
      Actions.showToast('Copia restaurada');
    }
  } catch { /* el navegador puede bloquear el almacenamiento de sesión */ }
}

function backupStatusText() {
  const n = daysSinceBackup();
  if (n === Infinity) return 'Todavía no has guardado ninguna copia.';
  if (n === 0) return 'Última copia: hoy.';
  return `Última copia: hace ${n === 1 ? '1 día' : `${n} días`}.`;
}

export function backupHTML() {
  return section('backup', 'Copia de seguridad', 'Todos los perfiles y el cuadrante', `
    <p class="set-help">Tus datos solo están en este móvil (en modo incógnito se borran al cerrar). Guarda una copia fuera del móvil de vez en cuando y siempre antes de cambiar de móvil o borrar datos del navegador. El PIN, la contraseña del grupo y el token de GitHub se quedan en este móvil.</p>
    <p class="backup-status ${daysSinceBackup() >= 30 ? 'stale' : ''}">${backupStatusText()}</p>
    <label class="field checkbox"><input type="checkbox" id="backup-protect"><span>Proteger con contraseña (solo se podrá abrir con ella)</span></label>
    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="backup-export">Guardar copia</button>
      <label class="btn">Restaurar copia<input type="file" id="backup-import" accept=".json" hidden></label>
    </div>`);
}

function chooseRestoreMode(stores) {
  const format = new Intl.NumberFormat('es-ES');
  const counts = [
    ['perfil', 'perfiles', stores.profiles.length],
    ['día de calendario', 'días de calendario', stores.days.length],
    ['servicio', 'servicios', stores.services.length],
    ['cuadrante', 'cuadrantes', stores.cuadrante.length]
  ].map(([singular, plural, count]) => format.format(count) + ' ' + (count === 1 ? singular : plural)).join(' · ');

  return new Promise(resolve => {
    let mode = null;
    openSheet({
      title: 'Restaurar copia',
      variant: 'dialog',
      body: `
        <p class="dialog-message">${esc(counts)}.</p>
        <p class="dialog-message"><strong>Fusionar</strong> añade los datos de la copia y actualiza los que coincidan. <strong>Reemplazar</strong> sustituye tus perfiles, días, servicios y el cuadrante.</p>
        <p class="dialog-message">Para poder volver atrás, guarda antes una copia de los datos de este móvil.</p>`,
      footer: `
        <button type="button" class="btn" data-m="merge">Fusionar</button>
        <button type="button" class="btn btn-danger" data-m="replace" ${stores.profiles.length ? '' : 'disabled'}>Reemplazar</button>`,
      onMount(root, close) {
        root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; close(); }));
      },
      onClose: () => resolve(mode)
    });
  });
}

export function bindBackup(root) {
  root.querySelector('#backup-export')?.addEventListener('click', async () => {
    if (!root.querySelector('#backup-protect')?.checked) { await quickBackup(); return; }
    const pass = await promptDialog({ title: 'Copia protegida', label: 'Contraseña (mínimo 8 caracteres)', type: 'password', confirmLabel: 'Cifrar y guardar' });
    if (pass === null) return;
    if (pass.length < 8) { Actions.showToast('La contraseña debe tener al menos 8 caracteres', { level: 'error' }); return; }
    Actions.setBusy('Cifrando…');
    try { await quickBackup({ passphrase: pass }); } finally { Actions.setBusy(null); }
  });
  root.querySelector('#backup-import')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || restoreInProgress) return;
    restoreInProgress = true;

    try {
      let data;
      try { data = JSON.parse(await file.text()); } catch {
        throw new Error('El archivo no es una copia válida.');
      }
      if (getState().locked) return;
      let pass;
      if (data?.encrypted === true) {
        pass = await promptDialog({ title: 'Copia protegida', label: 'Contraseña de la copia', type: 'password' });
        if (pass === null) return;
      }
      const stores = await prepareBackup(data, pass);
      if (getState().locked) return;
      const mode = await chooseRestoreMode(stores);
      if (!mode) return;
      if (mode === 'replace' && !(await confirmDialog({
        title: '¿Reemplazar tus datos?',
        message: 'Se sustituirán los perfiles, el calendario, la bitácora y el cuadrante de este móvil. Si quieres poder volver atrás, cancela y guarda antes una copia de lo que tienes.',
        confirmLabel: 'Reemplazar',
        danger: true
      }))) return;
      if (getState().locked) return;

      Actions.setBusy('Restaurando copia…');
      try {
        await restoreBackup(stores, mode);
      } finally {
        Actions.setBusy(null);
      }
    } catch (err) {
      Actions.showToast('No se pudo restaurar la copia. Tus datos siguen igual.', { level: 'error', detail: err.message });
      return;
    } finally {
      restoreInProgress = false;
    }

    // Volver a cargar también los ajustes, el perfil y el cuadrante restaurados.
    try { sessionStorage.setItem(RESTORED_FLAG, '1'); } catch { /* almacenamiento no disponible */ }
    location.reload();
  });
}
