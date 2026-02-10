/**
 * @module ui/settings
 * Configuration view - rules, profiles, exports, security, templates
 */

import { getState, Actions } from '../state/store.js';
import { put, get, getAll, STORES } from '../persistence/db.js';
import { hashPIN } from '../persistence/crypto.js';
import { exportBackup, importBackup, downloadFile } from '../persistence/backup.js';
import { exportICS } from '../exports/ics.js';
import { exportLedgerCSV, exportServicesCSV, exportDaysCSV } from '../exports/csv.js';
import { templateResumenSemanal, templateResumenGuardias, copyToClipboard, shareText } from '../exports/templates.js';
import { loadLedger } from '../domain/ledger.js';
import { loadServices } from '../domain/services.js';
import { recalcCounters } from '../app.js';
import { parseCuadrante, filterByPerson, getPersonNames, mapCodeToTagType } from '../imports/cuadranteParser.js';
import { addDayTag } from './calendar.js';

/**
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  const state = getState();
  const config = state.config;

  container.innerHTML = `
    <div class="settings-view">
      <h2>Configuración</h2>

      <!-- Guard Rules -->
      <section class="settings-section">
        <h3>Reglas de Guardia</h3>
        <div class="form-grid">
          <label>
            Días libres por guardia:
            <input type="number" id="cfg-dias-guardia" value="${config.diasPorGuardia || 5}" min="1" max="15">
          </label>
          <label>
            Ciclo de guardia:
            <select id="cfg-ciclo">
              <option value="semanal" ${config.cicloGuardia === 'semanal' ? 'selected' : ''}>Semanal</option>
              <option value="quincenal" ${config.cicloGuardia === 'quincenal' ? 'selected' : ''}>Quincenal</option>
            </select>
          </label>
          <label>
            Asuntos propios anuales:
            <input type="number" id="cfg-ap" value="${config.asuntosAnuales || 8}" min="0" max="30">
          </label>
          <label>
            Vacaciones anuales:
            <input type="number" id="cfg-vacaciones" value="${config.vacacionesAnuales || 25}" min="0" max="60">
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="cfg-excl-weekends" ${config.excludeWeekendsVacation ? 'checked' : ''}>
            Excluir fines de semana en vacaciones
          </label>
        </div>
        <button class="btn btn-primary" id="save-rules">Guardar Reglas</button>
      </section>

      <!-- Security -->
      <section class="settings-section">
        <h3>Seguridad</h3>
        <div class="form-grid">
          <label>
            ${config.pinHash ? 'Cambiar PIN:' : 'Establecer PIN:'}
            <input type="password" id="cfg-pin" maxlength="8" inputmode="numeric" pattern="[0-9]*" placeholder="PIN (4-8 dígitos)">
          </label>
          <label>
            Auto-bloqueo (minutos):
            <input type="number" id="cfg-autolock" value="${config.autoLockMinutes || 5}" min="1" max="60">
          </label>
          ${config.pinHash ? '<button class="btn btn-sm btn-danger" id="remove-pin">Eliminar PIN</button>' : ''}
        </div>
        <button class="btn btn-primary" id="save-security">Guardar Seguridad</button>
        ${config.pinHash ? '<button class="btn btn-sm" id="lock-now">Bloquear ahora</button>' : ''}
      </section>

      <!-- Profile -->
      <section class="settings-section">
        <h3>Perfil</h3>
        <div class="form-grid">
          <label>
            Nombre:
            <input type="text" id="cfg-name" value="${state.activeProfile?.name || 'Mi Perfil'}">
          </label>
          <label>
            Rol:
            <select id="cfg-role">
              <option value="usuario" ${state.activeProfile?.role === 'usuario' ? 'selected' : ''}>Usuario</option>
              <option value="supervisor" ${state.activeProfile?.role === 'supervisor' ? 'selected' : ''}>Supervisor</option>
              <option value="admin" ${state.activeProfile?.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </label>
        </div>
        <button class="btn btn-primary" id="save-profile">Guardar Perfil</button>
      </section>

      <!-- Dark Mode -->
      <section class="settings-section">
        <h3>Apariencia</h3>
        <label class="checkbox-label">
          <input type="checkbox" id="cfg-dark" ${state.darkMode ? 'checked' : ''}>
          Modo oscuro
        </label>
      </section>

      <!-- Exports -->
      <section class="settings-section">
        <h3>Exportaciones</h3>
        <div class="export-buttons">
          <button class="btn btn-secondary" id="exp-ics">Exportar Calendario (ICS)</button>
          <button class="btn btn-secondary" id="exp-csv-ledger">Exportar Movimientos (CSV)</button>
          <button class="btn btn-secondary" id="exp-csv-services">Exportar Servicios (CSV)</button>
          <button class="btn btn-secondary" id="exp-csv-days">Exportar Días (CSV)</button>
          <button class="btn btn-secondary" id="exp-print">Vista imprimible</button>
        </div>
      </section>

      <!-- Message Templates -->
      <section class="settings-section">
        <h3>Plantillas de Mensaje</h3>
        <div class="export-buttons">
          <button class="btn btn-secondary" id="tpl-semanal">Resumen Semanal</button>
          <button class="btn btn-secondary" id="tpl-guardias">Resumen Guardias</button>
        </div>
      </section>

      <!-- Backup -->
      <section class="settings-section">
        <h3>Backup / Restaurar</h3>
        <div class="export-buttons">
          <button class="btn btn-primary" id="backup-export">Exportar Backup</button>
          <button class="btn btn-primary" id="backup-export-enc">Exportar Backup Cifrado</button>
          <label class="btn btn-secondary file-upload-label">
            Importar Backup
            <input type="file" id="backup-import" accept=".json" hidden>
          </label>
        </div>
      </section>

      <!-- Import Cuadrante -->
      <section class="settings-section">
        <h3>Importar Cuadrante Excel</h3>
        <p style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--space-sm)">
          Importa turnos desde un archivo Excel (.xlsx) con el cuadrante de tu grupo.
        </p>
        <div class="form-grid">
          <label class="btn btn-secondary file-upload-label">
            Seleccionar archivo Excel
            <input type="file" id="cuadrante-file" accept=".xlsx,.xls" hidden>
          </label>
          <div id="cuadrante-file-name" style="font-size:var(--text-xs);color:var(--text-muted)"></div>
          <label>
            Tu nombre en el cuadrante:
            <input type="text" id="cuadrante-nombre" placeholder="Ej: García López, Juan">
          </label>
          <div id="cuadrante-persons" style="display:none">
            <label>
              Personas encontradas:
              <select id="cuadrante-person-select">
                <option value="">-- Selecciona --</option>
              </select>
            </label>
          </div>
        </div>
        <button class="btn btn-primary" id="import-cuadrante" disabled>Importar Cuadrante</button>
        <div id="cuadrante-status" style="font-size:var(--text-xs);margin-top:var(--space-xs)"></div>
      </section>

      <!-- Service Types Config -->
      <section class="settings-section">
        <h3>Tipos de Servicio</h3>
        <textarea id="cfg-service-types" rows="4" placeholder="Un tipo por línea">${(config.serviceTypes || []).join('\n')}</textarea>
        <button class="btn btn-sm" id="save-service-types">Guardar tipos</button>
      </section>

      <!-- Reset -->
      <section class="settings-section settings-danger">
        <h3>Zona de peligro</h3>
        <button class="btn btn-danger" id="reset-all">Resetear todo (borrar datos)</button>
      </section>

      <!-- Links -->
      <section class="settings-section">
        <button class="btn btn-sm" id="goto-diagnostics">Diagnóstico interno</button>
      </section>
    </div>
  `;

  // ─── Event handlers ───

  // Save rules
  document.getElementById('save-rules')?.addEventListener('click', async () => {
    const newConfig = {
      ...config,
      diasPorGuardia: parseInt(document.getElementById('cfg-dias-guardia').value) || 5,
      cicloGuardia: document.getElementById('cfg-ciclo').value,
      asuntosAnuales: parseInt(document.getElementById('cfg-ap').value) || 8,
      vacacionesAnuales: parseInt(document.getElementById('cfg-vacaciones').value) || 25,
      excludeWeekendsVacation: document.getElementById('cfg-excl-weekends').checked
    };
    Actions.setConfig(newConfig);
    await put(STORES.CONFIG, { key: 'appConfig', value: newConfig });
    recalcCounters();
    Actions.showToast('Reglas guardadas');
  });

  // Save security
  document.getElementById('save-security')?.addEventListener('click', async () => {
    const pin = document.getElementById('cfg-pin').value.trim();
    const autoLock = parseInt(document.getElementById('cfg-autolock').value) || 5;

    let pinHash = config.pinHash;
    if (pin.length >= 4) {
      pinHash = await hashPIN(pin);
      await put(STORES.CONFIG, { key: 'pinHash', value: pinHash });
    }

    const newConfig = { ...config, pinHash, autoLockMinutes: autoLock };
    Actions.setConfig(newConfig);
    await put(STORES.CONFIG, { key: 'appConfig', value: newConfig });
    Actions.showToast('Seguridad guardada');
  });

  document.getElementById('remove-pin')?.addEventListener('click', async () => {
    if (!confirm('¿Eliminar el PIN de bloqueo?')) return;
    const newConfig = { ...config, pinHash: null };
    Actions.setConfig(newConfig);
    await put(STORES.CONFIG, { key: 'pinHash', value: null });
    await put(STORES.CONFIG, { key: 'appConfig', value: newConfig });
    Actions.showToast('PIN eliminado');
    renderSettings(container);
  });

  document.getElementById('lock-now')?.addEventListener('click', () => {
    Actions.setLocked(true);
  });

  // Save profile
  document.getElementById('save-profile')?.addEventListener('click', async () => {
    const name = document.getElementById('cfg-name').value.trim() || 'Mi Perfil';
    const role = document.getElementById('cfg-role').value;
    const profile = { ...state.activeProfile, name, role };
    await put(STORES.PROFILES, profile);
    Actions.setProfile(profile);
    Actions.showToast('Perfil guardado');
  });

  // Dark mode
  document.getElementById('cfg-dark')?.addEventListener('change', async (e) => {
    Actions.setDarkMode(e.target.checked);
    await put(STORES.CONFIG, { key: 'darkMode', value: e.target.checked });
  });

  // Exports
  document.getElementById('exp-ics')?.addEventListener('click', () => {
    exportICS();
    Actions.showToast('Archivo ICS descargado');
  });

  document.getElementById('exp-csv-ledger')?.addEventListener('click', () => {
    exportLedgerCSV();
    Actions.showToast('CSV de movimientos descargado');
  });

  document.getElementById('exp-csv-services')?.addEventListener('click', () => {
    exportServicesCSV();
    Actions.showToast('CSV de servicios descargado');
  });

  document.getElementById('exp-csv-days')?.addEventListener('click', () => {
    exportDaysCSV();
    Actions.showToast('CSV de calendario descargado');
  });

  document.getElementById('exp-print')?.addEventListener('click', () => {
    window.print();
  });

  // Templates
  document.getElementById('tpl-semanal')?.addEventListener('click', () => {
    const msg = templateResumenSemanal();
    showSharePopup(msg, 'Resumen Semanal');
  });

  document.getElementById('tpl-guardias')?.addEventListener('click', () => {
    const msg = templateResumenGuardias();
    showSharePopup(msg, 'Resumen Guardias');
  });

  // Backup
  document.getElementById('backup-export')?.addEventListener('click', async () => {
    const content = await exportBackup();
    const date = new Date().toISOString().split('T')[0];
    downloadFile(content, `calguard-backup-${date}.json`);
    Actions.showToast('Backup exportado');
  });

  document.getElementById('backup-export-enc')?.addEventListener('click', async () => {
    const pass = prompt('Introduce una contraseña para cifrar el backup:');
    if (!pass || pass.length < 4) {
      Actions.showToast('Contraseña demasiado corta (mínimo 4 caracteres)');
      return;
    }
    const content = await exportBackup(pass);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(content, `calguard-backup-cifrado-${date}.json`);
    Actions.showToast('Backup cifrado exportado');
  });

  document.getElementById('backup-import')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      Actions.showToast('Archivo no válido');
      return;
    }

    let pass = null;
    if (parsed.encrypted) {
      pass = prompt('Este backup está cifrado. Introduce la contraseña:');
      if (!pass) return;
    }

    const mode = confirm('¿Reemplazar todos los datos actuales?\n(Cancelar = fusionar)')
      ? 'replace' : 'merge';

    const result = await importBackup(text, pass, mode);
    if (result.success) {
      // Reload all data
      const days = await getAll(STORES.DAYS);
      Actions.setDays(days);
      await loadLedger();
      await loadServices();
      recalcCounters();
      Actions.showToast('Backup importado correctamente');
      renderSettings(container);
    } else {
      alert('Errores al importar:\n' + result.errors.join('\n'));
    }
  });

  // Service types
  document.getElementById('save-service-types')?.addEventListener('click', async () => {
    const types = document.getElementById('cfg-service-types').value
      .split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const newConfig = { ...config, serviceTypes: types };
    Actions.setConfig(newConfig);
    await put(STORES.CONFIG, { key: 'appConfig', value: newConfig });
    Actions.showToast('Tipos de servicio guardados');
  });

  // Reset
  document.getElementById('reset-all')?.addEventListener('click', async () => {
    if (!confirm('¿BORRAR TODOS LOS DATOS?\nEsta acción no se puede deshacer.')) return;
    if (!confirm('¿SEGURO? Se perderán todos los datos.')) return;

    for (const store of [STORES.PROFILES, STORES.DAYS, STORES.LEDGER, STORES.SERVICES, STORES.CONFIG, STORES.AUDIT]) {
      const { clearStore } = await import('../persistence/db.js');
      await clearStore(store);
    }
    Actions.showToast('Datos eliminados. Recargando...');
    setTimeout(() => location.reload(), 1000);
  });

  // ─── Cuadrante Import ───
  let cuadranteData = null;

  document.getElementById('cuadrante-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('cuadrante-file-name').textContent = file.name;
    const statusEl = document.getElementById('cuadrante-status');
    statusEl.textContent = 'Analizando archivo...';
    statusEl.style.color = 'var(--text-muted)';

    try {
      cuadranteData = await parseCuadrante(file);
      const names = getPersonNames(cuadranteData);

      if (cuadranteData.length === 0) {
        statusEl.textContent = 'No se encontraron datos de turnos en el archivo.';
        statusEl.style.color = 'var(--warn)';
        return;
      }

      statusEl.textContent = `${cuadranteData.length} asignaciones encontradas, ${names.length} personas.`;
      statusEl.style.color = 'var(--success)';

      // Populate person selector
      const selectEl = document.getElementById('cuadrante-person-select');
      const personsDiv = document.getElementById('cuadrante-persons');
      selectEl.innerHTML = '<option value="">-- Selecciona --</option>';
      for (const name of names) {
        selectEl.innerHTML += `<option value="${name}">${name}</option>`;
      }
      personsDiv.style.display = 'block';

      document.getElementById('import-cuadrante').disabled = false;
    } catch (err) {
      statusEl.textContent = 'Error al leer el archivo: ' + err.message;
      statusEl.style.color = 'var(--danger)';
      cuadranteData = null;
    }
  });

  document.getElementById('cuadrante-person-select')?.addEventListener('change', (e) => {
    const nameInput = document.getElementById('cuadrante-nombre');
    if (e.target.value) {
      nameInput.value = e.target.value;
    }
  });

  document.getElementById('import-cuadrante')?.addEventListener('click', async () => {
    if (!cuadranteData || cuadranteData.length === 0) {
      Actions.showToast('Primero selecciona un archivo Excel');
      return;
    }

    const nombre = document.getElementById('cuadrante-nombre').value.trim();
    if (!nombre) {
      Actions.showToast('Introduce tu nombre del cuadrante');
      return;
    }

    const personEntries = filterByPerson(cuadranteData, nombre);
    if (personEntries.length === 0) {
      Actions.showToast(`No se encontraron turnos para "${nombre}"`);
      return;
    }

    if (!confirm(`Se importarán ${personEntries.length} turnos para "${nombre}".\n¿Continuar?`)) {
      return;
    }

    const statusEl = document.getElementById('cuadrante-status');
    statusEl.textContent = 'Importando...';
    statusEl.style.color = 'var(--text-muted)';

    let imported = 0;
    let skipped = 0;

    for (const entry of personEntries) {
      const tag = { type: entry.tagType, meta: { source: 'cuadrante', code: entry.code } };
      const success = await addDayTag(entry.date, tag);
      if (success) {
        imported++;
      } else {
        skipped++;
      }
    }

    recalcCounters();
    statusEl.textContent = `Importación completada: ${imported} turnos importados${skipped > 0 ? `, ${skipped} omitidos (conflicto)` : ''}.`;
    statusEl.style.color = 'var(--success)';
    Actions.showToast(`${imported} turnos importados`);
  });

  // Diagnostics
  document.getElementById('goto-diagnostics')?.addEventListener('click', () => {
    Actions.setScreen('diagnostics');
  });
}

function showSharePopup(msg, title) {
  const existing = document.querySelector('.share-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'share-popup';
  popup.innerHTML = `
    <div class="share-popup-content">
      <h3>${title}</h3>
      <textarea readonly rows="10">${msg}</textarea>
      <div class="share-actions">
        <button class="btn btn-primary" id="sp-copy">Copiar</button>
        <button class="btn btn-secondary" id="sp-share">Compartir</button>
        <button class="btn btn-sm" id="sp-close">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById('sp-copy')?.addEventListener('click', async () => {
    await copyToClipboard(msg);
    Actions.showToast('Copiado');
  });

  document.getElementById('sp-share')?.addEventListener('click', async () => {
    await shareText(msg, title);
  });

  document.getElementById('sp-close')?.addEventListener('click', () => popup.remove());
}
