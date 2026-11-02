/**
 * @module ui/settings
 * Ajustes en secciones plegables:
 *  - Mi contabilidad (por perfil): cupos, arrastre y fechas de corte
 *  - Perfiles: renombrar, vincular al cuadrante, crear, borrar
 *  - Importar cuadrante a este perfil (con vista previa, como sincronización)
 *  - Reglas del grupo, apariencia, seguridad, copias, exportaciones, avanzado
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import { put, clearStore, STORES } from '../persistence/db.js';
import { hashPIN } from '../persistence/crypto.js';
import { exportBackup, importBackup, downloadFile } from '../persistence/backup.js';
import { exportICS } from '../exports/ics.js';
import { exportLedgerCSV, exportServicesCSV, exportDaysCSV } from '../exports/csv.js';
import { templateResumenSemanal, templateResumenGuardias, copyToClipboard, shareText } from '../exports/templates.js';
import { getCarryover } from '../domain/balances.js';
import { updateActiveProfile, deleteProfile, loadProfiles, switchProfile, displayName } from '../domain/profiles.js';
import { loadGroupCuadrante, importGroupCuadranteFile, currentRoster } from '../domain/groupCuadrante.js';
import { previewSync, syncActiveProfile, defaultSyncStart } from '../domain/cuadranteSync.js';
import { createAndSwitchProfile, switchToProfile, avatarHTML, askWhoAmI } from './flows.js';
import { saveTheme } from './theme.js';
import { openSheet, confirmDialog, promptDialog } from './sheet.js';
import { invalidateCuadranteCache } from './cuadrante.js';
import { esc } from './utils.js';

/** Remember which sections are open across re-renders. */
const openSections = new Set(['conta']);

function section(id, title, subtitle, body) {
  return `
    <details class="set-section" data-section="${id}" ${openSections.has(id) ? 'open' : ''}>
      <summary><span class="set-title">${title}</span>${subtitle ? `<span class="set-sub">${subtitle}</span>` : ''}</summary>
      <div class="set-body">${body}</div>
    </details>`;
}

function num(id) {
  const v = parseInt(document.getElementById(id)?.value, 10);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

async function saveGlobalConfig(patch) {
  const newConfig = { ...getState().config, ...patch };
  Actions.setConfig(newConfig);
  await put(STORES.CONFIG, { key: 'appConfig', value: newConfig });
}

/**
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  const state = getState();
  const config = state.config;
  const eff = effectiveConfig(state);
  const profile = state.activeProfile;
  const year = state.balances.year;
  const carry = getCarryover(eff, year);
  const fmt = (iso) => iso ? iso.split('-').reverse().join('/') : '';

  container.innerHTML = `
    <div class="settings-view">
      <div class="settings-profile-head">
        ${avatarHTML(profile.name, 'avatar-lg')}
        <div><small>Ajustes de</small><strong>${esc(profile.name)}</strong></div>
      </div>

      ${section('conta', `Mi contabilidad ${year}`, 'Cupos, arrastre y fechas de corte de este perfil', `
        <p class="set-help">Cada funcionario tiene sus propios cupos. El <strong>arrastre</strong> es lo que traes pendiente de ${year - 1}; las <strong>fechas de corte</strong> indican cuándo empezaste a disfrutar lo de ${year}: lo anterior se descuenta del arrastre, nunca del cupo nuevo.</p>
        <div class="form-grid two">
          <label class="field"><span>Asuntos propios al año</span><input type="number" id="cfg-ap" min="0" max="30" value="${eff.asuntosAnuales ?? 8}"></label>
          <label class="field"><span>Vacaciones al año (días hábiles)</span><input type="number" id="cfg-vac" min="0" max="60" value="${eff.vacacionesAnuales ?? 25}"></label>
        </div>
        <div class="carry-grid">
          <div class="carry-col">
            <h4>Libres</h4>
            <label class="field"><span>Pendientes de ${year - 1}</span><input type="number" id="cfg-carry-libres" min="0" max="365" value="${carry.libres}"></label>
            <label class="field"><span>1.er libre de ${year} disfrutado el</span><input type="date" id="cfg-primer-libre" value="${carry.primerLibre || ''}"></label>
          </div>
          <div class="carry-col">
            <h4>Asuntos propios</h4>
            <label class="field"><span>Pendientes de ${year - 1}</span><input type="number" id="cfg-carry-ap" min="0" max="30" value="${carry.ap}"></label>
            <label class="field"><span>1.er AP de ${year} disfrutado el</span><input type="date" id="cfg-primer-ap" value="${carry.primerAP || ''}"></label>
          </div>
          <div class="carry-col">
            <h4>Vacaciones</h4>
            <label class="field"><span>Pendientes de ${year - 1}</span><input type="number" id="cfg-carry-vac" min="0" max="60" value="${carry.vacaciones}"></label>
            <label class="field"><span>1.er día de vacaciones de ${year} el</span><input type="date" id="cfg-primer-vac" value="${carry.primerVac || ''}"></label>
          </div>
        </div>
        <button type="button" class="btn btn-primary" id="save-conta">Guardar contabilidad</button>
      `)}

      ${section('profiles', 'Perfiles', `${state.profiles.length} perfil${state.profiles.length === 1 ? '' : 'es'} · activo: ${esc(profile.name)}`, `
        <label class="field"><span>Nombre de este perfil</span><input type="text" id="cfg-name" maxlength="40" value="${esc(profile.name)}"></label>
        <div class="field-row">
          <div><span class="field-label">Vínculo con el cuadrante</span>
            <p class="set-help">${profile.cuadranteName ? `Vinculado a <strong>${esc(displayName(profile.cuadranteName))}</strong> desde el ${fmt(profile.syncDesde || defaultSyncStart())}. Al cargar un cuadrante nuevo se actualiza solo.` : 'Sin vincular. Vincúlalo en «Importar cuadrante» o desde la pantalla Cuadrante.'}</p>
          </div>
          ${profile.cuadranteName ? '<button type="button" class="btn btn-sm" id="unlink-profile">Desvincular</button>' : ''}
        </div>
        <ul class="profile-mini-list">
          ${state.profiles.map(p => `
            <li class="${p.id === profile.id ? 'active' : ''}">
              ${avatarHTML(p.name, 'avatar-sm')}<span>${esc(p.name)}${p.id === state.config.meProfileId ? ' <span class="me-badge">tú</span>' : ''}</span>
              ${p.id === profile.id ? '<em>activo</em>' : `<button type="button" class="link-btn" data-switch="${esc(p.id)}">Abrir</button>`}
            </li>`).join('')}
        </ul>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="save-profile">Guardar nombre</button>
          <button type="button" class="btn" id="new-profile">＋ Nuevo perfil</button>
          <button type="button" class="btn" id="who-am-i">¿Quién soy yo?</button>
          <button type="button" class="btn btn-danger" id="delete-profile" ${state.profiles.length <= 1 ? 'disabled' : ''}>Borrar este perfil</button>
        </div>
      `)}

      ${section('import', 'Importar cuadrante a este perfil', 'Sincroniza calendario y contabilidad', `
        <p class="set-help">Reimportar es seguro: sustituye lo que vino del cuadrante antes y <strong>respeta lo que hayas apuntado a mano</strong>. Si un libre cambió de día, el antiguo desaparece.</p>
        <div class="form-grid two">
          <label class="field"><span>Archivo (opcional)</span>
            <input type="file" id="imp-file" accept=".xlsx,.xls,.csv,.txt,.pdf,.json">
            <small id="imp-file-help">Si no eliges archivo, se usa el cuadrante del grupo ya cargado.</small>
          </label>
          <label class="field"><span>Persona</span><select id="imp-person"><option value="">Cargando…</option></select></label>
          <label class="field"><span>Importar desde</span><input type="date" id="imp-desde" value="${profile.syncDesde || defaultSyncStart()}"></label>
        </div>
        <div id="imp-preview" class="import-preview" hidden></div>
        <div class="btn-row">
          <button type="button" class="btn" id="imp-preview-btn">Ver vista previa</button>
          <button type="button" class="btn btn-primary" id="imp-run" disabled>Sincronizar</button>
        </div>
      `)}

      ${section('rules', 'Reglas del grupo', 'Guardias y escalafón', `
        <div class="form-grid two">
          <label class="field"><span>Días libres por guardia</span><input type="number" id="cfg-dias-guardia" min="1" max="15" value="${config.diasPorGuardia || 5}"></label>
          <label class="field checkbox"><input type="checkbox" id="cfg-excl-weekends" ${config.excludeWeekendsVacation ? 'checked' : ''}><span>No contar fines de semana en vacaciones</span></label>
        </div>
        <label class="field"><span>Escalafón (plantilla actual, uno por línea)</span>
          <textarea id="cfg-escalafon" rows="7">${esc((config.escalafonOrder || []).join('\n'))}</textarea>
          <small>Ordena el cuadrante y oculta a quien ya no está. Basta con parte del nombre: «CARMEN» agrupa también «Mª CARMEN».</small>
        </label>
        <label class="field" id="esc-add-wrap" hidden><span>¿Ha entrado alguien? Añádelo tal como sale en el cuadrante</span>
          <select id="esc-add"></select>
        </label>
        <button type="button" class="btn btn-primary" id="save-rules">Guardar reglas</button>
      `)}

      ${section('look', 'Apariencia', '', `
        <div class="segmented" role="radiogroup" aria-label="Tema">
          ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `
            <label class="seg-opt"><input type="radio" name="theme" value="${v}" ${state.themePreference === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
      `)}

      ${section('security', 'Seguridad', config.pinHash ? 'PIN activado' : 'Sin PIN', `
        <div class="form-grid two">
          <label class="field"><span>${config.pinHash ? 'Nuevo PIN' : 'PIN'} (4–8 dígitos)</span><input type="password" id="cfg-pin" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password"></label>
          <label class="field"><span>Bloqueo automático (minutos)</span><input type="number" id="cfg-autolock" min="1" max="60" value="${config.autoLockMinutes || 5}"></label>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="save-security">Guardar seguridad</button>
          ${config.pinHash ? '<button type="button" class="btn" id="lock-now">Bloquear ahora</button><button type="button" class="btn btn-danger" id="remove-pin">Quitar PIN</button>' : ''}
        </div>
      `)}

      ${section('backup', 'Copias de seguridad', 'Todos los perfiles y el cuadrante', `
        <p class="set-help">Guarda una copia de vez en cuando (o antes de cambiar de móvil). La copia cifrada solo se abre con tu contraseña.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="backup-export">Descargar copia</button>
          <button type="button" class="btn" id="backup-export-enc">Copia cifrada</button>
          <label class="btn">Restaurar copia<input type="file" id="backup-import" accept=".json" hidden></label>
        </div>
      `)}

      ${section('export', 'Exportar y compartir', 'Calendario, CSV y mensajes', `
        <div class="btn-row">
          <button type="button" class="btn" id="exp-ics">Calendario (.ics)</button>
          <button type="button" class="btn" id="exp-csv-days">Días (CSV)</button>
          <button type="button" class="btn" id="exp-csv-ledger">Movimientos (CSV)</button>
          <button type="button" class="btn" id="exp-csv-services">Servicios (CSV)</button>
          <button type="button" class="btn" id="exp-print">Imprimir</button>
        </div>
        <div class="btn-row">
          <button type="button" class="btn" id="tpl-semanal">Mensaje: resumen semanal</button>
          <button type="button" class="btn" id="tpl-guardias">Mensaje: resumen de guardias</button>
        </div>
      `)}

      ${section('advanced', 'Bitácora y avanzado', '', `
        <label class="field"><span>Tipos de servicio (uno por línea)</span>
          <textarea id="cfg-service-types" rows="6">${esc((config.serviceTypes || []).join('\n'))}</textarea></label>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="save-service-types">Guardar tipos</button>
          <button type="button" class="btn" id="goto-diagnostics">Diagnóstico interno</button>
        </div>
        <div class="danger-zone">
          <strong>Zona de peligro</strong>
          <p>Borra todos los perfiles, días, movimientos, servicios y el cuadrante de este dispositivo.</p>
          <button type="button" class="btn btn-danger" id="reset-all">Borrar todos los datos</button>
        </div>
      `)}

      <p class="app-version">CalGuard · funciona sin conexión · tus datos no salen de este dispositivo</p>
    </div>
  `;

  container.querySelectorAll('.set-section').forEach(d => {
    d.addEventListener('toggle', () => {
      if (d.open) openSections.add(d.dataset.section); else openSections.delete(d.dataset.section);
    });
  });

  bindContabilidad(container, year);
  bindProfiles(container);
  bindImport(container);
  bindRulesAndLook(container);
  bindSecurity(container);
  bindBackup(container);
  bindExports(container);
}

// ─── Mi contabilidad ───
function bindContabilidad(container, year) {
  container.querySelector('#save-conta').addEventListener('click', async () => {
    const eff = effectiveConfig();
    const prev = eff.carryovers?.[year] || {};
    const carryovers = {
      ...(eff.carryovers || {}),
      [year]: {
        ...prev,
        libres: num('cfg-carry-libres'),
        ap: num('cfg-carry-ap'),
        vacaciones: num('cfg-carry-vac'),
        primerLibre: document.getElementById('cfg-primer-libre').value || null,
        primerAP: document.getElementById('cfg-primer-ap').value || null,
        primerVac: document.getElementById('cfg-primer-vac').value || null
      }
    };
    for (const k of ['primerLibre', 'primerAP', 'primerVac']) {
      const v = carryovers[year][k];
      if (v && !v.startsWith(String(year))) {
        Actions.showToast(`Las fechas de corte deben ser de ${year}`);
        return;
      }
    }
    await updateActiveProfile({
      settings: { asuntosAnuales: num('cfg-ap'), vacacionesAnuales: num('cfg-vac'), carryovers }
    });
    const b = getState().balances;
    Actions.showToast(`Guardado · libres ${b.libres.disponibles} · AP ${b.ap.disponibles} · vacaciones ${b.vacaciones.disponibles}`);
  });
}

// ─── Perfiles ───
function bindProfiles(container) {
  container.querySelector('#save-profile').addEventListener('click', async () => {
    const name = document.getElementById('cfg-name').value.trim();
    if (!name) { Actions.showToast('El perfil necesita un nombre'); return; }
    await updateActiveProfile({ name });
    Actions.showToast('Nombre guardado');
  });
  container.querySelector('#new-profile').addEventListener('click', createAndSwitchProfile);
  container.querySelector('#who-am-i').addEventListener('click', () => askWhoAmI({ manual: true }));
  container.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => switchToProfile(b.dataset.switch)));
  container.querySelector('#unlink-profile')?.addEventListener('click', async () => {
    await updateActiveProfile({ cuadranteName: null, lastSyncAt: null });
    Actions.showToast('Perfil desvinculado del cuadrante (sus datos se conservan)');
  });
  container.querySelector('#delete-profile').addEventListener('click', async () => {
    const p = getState().activeProfile;
    const ok = await confirmDialog({
      title: `Borrar «${p.name}»`,
      message: 'Se borrarán su calendario, su contabilidad y su bitácora de este dispositivo. No se puede deshacer.',
      confirmLabel: 'Borrar perfil',
      danger: true
    });
    if (!ok) return;
    await deleteProfile(p.id);
    Actions.showToast(`Perfil «${p.name}» borrado`);
  });
}

// ─── Importar cuadrante (vista previa + sincronización) ───
function bindImport(container) {
  const personSel = container.querySelector('#imp-person');
  const previewEl = container.querySelector('#imp-preview');
  const runBtn = container.querySelector('#imp-run');
  let entries = null;
  let names = [];

  const fillPeople = () => {
    const s = getState();
    const roster = currentRoster(names, effectiveConfig(s).escalafonOrder || []);
    const list = roster.length ? roster : names;
    const selected = s.activeProfile.cuadranteName || '';
    personSel.innerHTML = list.length
      ? `<option value="">— Elige persona —</option>` + list.map(n => `<option value="${esc(n)}" ${n === selected ? 'selected' : ''}>${esc(displayName(n))}</option>`).join('')
      : '<option value="">Carga un cuadrante primero</option>';
  };

  loadGroupCuadrante().then(data => {
    if (data) { entries = data.entries; names = data.names; }
    fillPeople();
  });

  container.querySelector('#imp-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Actions.setBusy('Leyendo el cuadrante…');
    try {
      const result = await importGroupCuadranteFile(file);
      invalidateCuadranteCache();
      entries = result.data.entries;
      names = result.data.names;
      fillPeople();
      container.querySelector('#imp-file-help').textContent = `${result.entries} turnos de ${result.names} personas. También queda como cuadrante del grupo.`;
    } catch (err) {
      Actions.showToast('No se pudo leer: ' + err.message);
    } finally {
      Actions.setBusy(null);
    }
  });

  const showPreview = () => {
    const person = personSel.value;
    const desde = container.querySelector('#imp-desde').value || defaultSyncStart();
    if (!entries) { Actions.showToast('Carga primero un cuadrante'); return null; }
    if (!person) { Actions.showToast('Elige la persona'); return null; }
    const r = previewSync({ entries, person, desde });
    const s = r.summary;
    const t = s.byType;
    previewEl.hidden = false;
    previewEl.innerHTML = s.entries === 0
      ? `<p>No hay turnos de ${esc(displayName(person))} desde el ${esc(desde.split('-').reverse().join('/'))}.</p>`
      : `
        <p><strong>${esc(displayName(person))}</strong> · del ${esc(s.desde.split('-').reverse().join('/'))} al ${esc(s.hasta.split('-').reverse().join('/'))}</p>
        <ul class="preview-stats">
          <li><b>${s.guardias}</b> guardias</li>
          <li><b>${t.LIBRE || 0}</b> libres</li>
          <li><b>${s.vacaciones || 0}</b> días de vacaciones</li>
          <li><b>${t.AP || 0}</b> AP</li>
          <li><b>${(t.TURNO_M || 0) + (t.TURNO_T || 0) + (t.TURNO_N || 0)}</b> turnos</li>
        </ul>
        <p class="set-help">${s.removed ? `Se sustituyen ${s.removed} etiquetas importadas antes. ` : ''}${s.skipped.length ? `${s.skipped.length} día(s) se omiten por chocar con lo apuntado a mano (p. ej. ${esc(s.skipped[0].date.split('-').reverse().join('/'))}).` : 'Sin conflictos.'}</p>`;
    runBtn.disabled = s.entries === 0;
    return r;
  };

  container.querySelector('#imp-preview-btn').addEventListener('click', showPreview);
  personSel.addEventListener('change', () => { previewEl.hidden = true; runBtn.disabled = true; });

  runBtn.addEventListener('click', async () => {
    const person = personSel.value;
    const desde = container.querySelector('#imp-desde').value || defaultSyncStart();
    const current = getState().activeProfile;
    if (current.cuadranteName && current.cuadranteName !== person) {
      const ok = await confirmDialog({
        title: 'Cambiar vínculo',
        message: `Este perfil está vinculado a ${displayName(current.cuadranteName)}. ¿Vincularlo a ${displayName(person)}?`,
        confirmLabel: 'Sí, cambiar'
      });
      if (!ok) return;
    }
    Actions.setBusy('Sincronizando…');
    try {
      const s = await syncActiveProfile({ entries, person, desde });
      Actions.showToast(`Sincronizado: ${s.added} etiquetas, ${s.guardias} guardias`);
      Actions.setScreen('dashboard');
    } catch (err) {
      Actions.showToast('No se pudo sincronizar: ' + err.message);
    } finally {
      Actions.setBusy(null);
    }
  });
}

// ─── Reglas + apariencia ───
/** Names in the cuadrante that the escalafón does not cover yet (new members). */
function bindEscalafonPicker(container) {
  const ta = container.querySelector('#cfg-escalafon');
  const sel = container.querySelector('#esc-add');
  const wrap = container.querySelector('#esc-add-wrap');
  let names = [];
  const fill = () => {
    const current = ta.value.split('\n').map(t => t.trim().toUpperCase()).filter(Boolean);
    const out = [...new Set(names.map(n => String(n).toUpperCase().trim()))]
      .filter(n => n && !current.some(o => n.includes(o)))
      .sort((a, b) => a.localeCompare(b, 'es'));
    wrap.hidden = out.length === 0;
    sel.innerHTML = '<option value="">＋ Añadir del cuadrante…</option>' + out.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  };
  loadGroupCuadrante().then(data => { names = data?.names || []; fill(); });
  ta.addEventListener('input', fill);
  sel.addEventListener('change', () => {
    const name = sel.value;
    if (!name) return;
    ta.value = ta.value.replace(/\s*$/, '') + (ta.value.trim() ? '\n' : '') + name;
    fill();
    Actions.showToast(`${name} añadido · pulsa «Guardar reglas»`);
  });
}

function bindRulesAndLook(container) {
  bindEscalafonPicker(container);
  container.querySelector('#save-rules').addEventListener('click', async () => {
    const escalafon = document.getElementById('cfg-escalafon').value
      .split('\n').map(t => t.trim().toUpperCase()).filter(Boolean);
    await saveGlobalConfig({
      diasPorGuardia: Math.max(1, num('cfg-dias-guardia') || 5),
      excludeWeekendsVacation: document.getElementById('cfg-excl-weekends').checked,
      escalafonOrder: escalafon
    });
    invalidateCuadranteCache();
    Actions.showToast('Reglas guardadas');
  });
  container.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', () => saveTheme(r.value)));
  container.querySelector('#save-service-types')?.addEventListener('click', async () => {
    const types = document.getElementById('cfg-service-types').value.split('\n').map(t => t.trim()).filter(Boolean);
    if (!types.length) { Actions.showToast('Deja al menos un tipo'); return; }
    await saveGlobalConfig({ serviceTypes: types });
    Actions.showToast('Tipos de servicio guardados');
  });
  container.querySelector('#goto-diagnostics')?.addEventListener('click', () => Actions.setScreen('diagnostics'));
  container.querySelector('#reset-all')?.addEventListener('click', async () => {
    const first = await confirmDialog({ title: 'Borrar todos los datos', message: 'Se borrará TODO lo guardado en este dispositivo: perfiles, calendarios, contabilidad, bitácora y cuadrante.', confirmLabel: 'Continuar', danger: true });
    if (!first) return;
    const typed = await promptDialog({ title: 'Confirmación final', label: 'Escribe BORRAR para confirmar', confirmLabel: 'Borrar todo' });
    if ((typed || '').trim().toUpperCase() !== 'BORRAR') { Actions.showToast('Cancelado: no se ha borrado nada'); return; }
    for (const store of Object.values(STORES)) await clearStore(store);
    Actions.showToast('Datos borrados. Recargando…');
    setTimeout(() => location.reload(), 900);
  });
}

// ─── Seguridad ───
function bindSecurity(container) {
  container.querySelector('#save-security').addEventListener('click', async () => {
    const pin = document.getElementById('cfg-pin').value.trim();
    const config = getState().config;
    let pinHash = config.pinHash;
    if (pin) {
      if (!/^\d{4,8}$/.test(pin)) { Actions.showToast('El PIN debe tener entre 4 y 8 cifras'); return; }
      pinHash = await hashPIN(pin);
      await put(STORES.CONFIG, { key: 'pinHash', value: pinHash });
    }
    await saveGlobalConfig({ pinHash, autoLockMinutes: Math.min(60, Math.max(1, num('cfg-autolock') || 5)) });
    Actions.showToast(pin ? 'PIN guardado' : 'Seguridad guardada');
  });
  container.querySelector('#remove-pin')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Quitar PIN', message: 'La app se abrirá sin pedir PIN.', confirmLabel: 'Quitar', danger: true });
    if (!ok) return;
    await put(STORES.CONFIG, { key: 'pinHash', value: null });
    await saveGlobalConfig({ pinHash: null });
    Actions.showToast('PIN quitado');
  });
  container.querySelector('#lock-now')?.addEventListener('click', () => Actions.setLocked(true));
}

// ─── Copias ───
function bindBackup(container) {
  const stamp = () => new Date().toISOString().slice(0, 10);
  container.querySelector('#backup-export').addEventListener('click', async () => {
    downloadFile(await exportBackup(), `calguard-copia-${stamp()}.json`);
    await put(STORES.CONFIG, { key: 'lastBackupAt', value: new Date().toISOString() });
    Actions.showToast('Copia descargada');
  });
  container.querySelector('#backup-export-enc').addEventListener('click', async () => {
    const pass = await promptDialog({ title: 'Copia cifrada', label: 'Contraseña (mínimo 8 caracteres)', type: 'password', confirmLabel: 'Cifrar y descargar' });
    if (pass === null) return;
    if (pass.length < 8) { Actions.showToast('La contraseña debe tener al menos 8 caracteres'); return; }
    Actions.setBusy('Cifrando…');
    try {
      downloadFile(await exportBackup(pass), `calguard-copia-cifrada-${stamp()}.json`);
      await put(STORES.CONFIG, { key: 'lastBackupAt', value: new Date().toISOString() });
      Actions.showToast('Copia cifrada descargada');
    } finally {
      Actions.setBusy(null);
    }
  });
  container.querySelector('#backup-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { Actions.showToast('El archivo no es una copia válida'); return; }

    let pass = null;
    if (parsed.encrypted) {
      pass = await promptDialog({ title: 'Copia cifrada', label: 'Contraseña de la copia', type: 'password' });
      if (pass === null) return;
    }
    const mode = await chooseRestoreMode();
    if (!mode) return;

    Actions.setBusy('Restaurando copia…');
    try {
      const result = await importBackup(text, pass, mode);
      if (!result.success) {
        Actions.showToast('No se pudo restaurar: ' + (result.errors[0] || 'error desconocido'));
        return;
      }
      // Reload only the active (or first) profile's data
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

// ─── Exportar ───
function bindExports(container) {
  const on = (id, fn) => container.querySelector(id)?.addEventListener('click', fn);
  on('#exp-ics', () => { exportICS(); Actions.showToast('Calendario .ics descargado'); });
  on('#exp-csv-ledger', () => { exportLedgerCSV(); Actions.showToast('CSV de movimientos descargado'); });
  on('#exp-csv-services', () => { exportServicesCSV(); Actions.showToast('CSV de servicios descargado'); });
  on('#exp-csv-days', () => { exportDaysCSV(); Actions.showToast('CSV de días descargado'); });
  on('#exp-print', () => window.print());
  on('#tpl-semanal', () => showMessageSheet(templateResumenSemanal(), 'Resumen semanal'));
  on('#tpl-guardias', () => showMessageSheet(templateResumenGuardias(), 'Resumen de guardias'));
}

function showMessageSheet(msg, title) {
  openSheet({
    title,
    body: `<textarea class="message-box" readonly rows="10">${esc(msg)}</textarea>`,
    footer: `
      <button type="button" class="btn" data-act="copy">Copiar</button>
      <button type="button" class="btn btn-primary" data-act="share">Compartir</button>`,
    onMount(root) {
      root.querySelector('[data-act="copy"]').addEventListener('click', async () => {
        await copyToClipboard(msg);
        Actions.showToast('Copiado');
      });
      root.querySelector('[data-act="share"]').addEventListener('click', () => shareText(msg, title));
    }
  });
}
