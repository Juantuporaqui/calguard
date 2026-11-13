/**
 * @module ui/settings/backup
 * «Copia de seguridad»: un solo botón, con la casilla «Proteger con contraseña».
 */

import { getState, Actions } from '../../state/store.js';
import { importBackup } from '../../persistence/backup.js';
import { loadProfiles, switchProfile } from '../../domain/profiles.js';
import { quickBackup, daysSinceBackup } from '../flows.js';
import { invalidateCuadranteCache } from '../cuadrante.js';
import { openSheet, promptDialog } from '../sheet.js';
import { section } from './common.js';

function backupStatusText() {
  const n = daysSinceBackup();
  if (n === Infinity) return 'Todavía no has guardado ninguna copia.';
  if (n === 0) return 'Última copia: hoy.';
  return `Última copia: hace ${n === 1 ? '1 día' : `${n} días`}.`;
}

export function backupHTML() {
  return section('backup', 'Copia de seguridad', 'Todos los perfiles y el cuadrante', `
    <p class="set-help">Tus datos solo están en este móvil (en modo incógnito se borran al cerrar). Guarda una copia fuera del móvil de vez en cuando y siempre antes de cambiar de móvil o borrar datos del navegador. Ninguna copia incluye la contraseña del grupo ni el token de GitHub.</p>
    <p class="backup-status ${daysSinceBackup() >= 30 ? 'stale' : ''}">${backupStatusText()}</p>
    <label class="field checkbox"><input type="checkbox" id="backup-protect"><span>Proteger con contraseña (solo se podrá abrir con ella)</span></label>
    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="backup-export">Guardar copia</button>
      <label class="btn">Restaurar copia<input type="file" id="backup-import" accept=".json" hidden></label>
    </div>`);
}

function chooseRestoreMode() {
  return new Promise(resolve => {
    let mode = null;
    openSheet({
      title: 'Restaurar copia',
      variant: 'dialog',
      body: '<p class="dialog-message"><strong>Fusionar</strong> añade lo de la copia a lo que ya tienes. <strong>Reemplazar</strong> borra lo actual y deja solo la copia.</p>',
      footer: `
        <button type="button" class="btn" data-m="merge">Fusionar</button>
        <button type="button" class="btn btn-danger" data-m="replace">Reemplazar</button>`,
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
    if (!file) return;
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch (err) { Actions.showToast('El archivo no es una copia válida.', { level: 'error', detail: err.message }); return; }
    let pass = null;
    if (parsed.encrypted) {
      pass = await promptDialog({ title: 'Copia protegida', label: 'Contraseña de la copia', type: 'password' });
      if (pass === null) return;
    }
    const mode = await chooseRestoreMode();
    if (!mode) return;
    Actions.setBusy('Restaurando copia…');
    try {
      const result = await importBackup(text, pass, mode);
      if (!result.success) {
        Actions.showToast('No se pudo restaurar la copia.', { level: 'error', detail: result.errors[0] || 'error desconocido' });
        return;
      }
      const profiles = await loadProfiles();
      const keep = profiles.find(p => p.id === getState().activeProfileId) || profiles[0];
      if (keep) await switchProfile(keep.id);
      invalidateCuadranteCache();
      Actions.showToast(`Copia restaurada${result.errors.length ? ` con ${result.errors.length} aviso(s)` : ''}`);
    } finally {
      Actions.setBusy(null);
    }
  });
}
