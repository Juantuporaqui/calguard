/**
 * @module ui/settings/advanced
 * Bloque «Avanzado» (plegado): importar el cuadrante a este perfil, exportar,
 * reglas del grupo, tipos de servicio, diagnóstico y forzar actualización.
 */

import { getState, Actions, effectiveConfig } from '../../state/store.js';
import { exportICS } from '../../exports/ics.js';
import { exportLedgerCSV, exportServicesCSV, exportDaysCSV } from '../../exports/csv.js';
import { templateResumenSemanal, templateResumenGuardias, copyToClipboard, shareText } from '../../exports/templates.js';
import { displayName } from '../../domain/profiles.js';
import { loadGroupCuadrante, importGroupCuadranteFile, currentRoster, notesCount } from '../../domain/groupCuadrante.js';
import { previewSync, syncActiveProfile, defaultSyncStart } from '../../domain/cuadranteSync.js';
import { invalidateCuadranteCache } from '../cuadrante.js';
import { openSheet, confirmDialog } from '../sheet.js';
import { forceUpdate } from '../help.js';
import { esc } from '../utils.js';
import { section, autosave, intRange, saveGlobalConfig } from './common.js';

const dmy = (iso) => String(iso || '').split('-').reverse().join('/');

export function advancedHTML(state) {
  const config = state.config;
  const profile = state.activeProfile;
  return `
    ${section('import', 'Importar cuadrante a este perfil', 'Calendario y días desde un archivo', `
      <p class="set-help">Reimportar es seguro: sustituye lo que vino del cuadrante antes y <strong>respeta lo que hayas apuntado a mano</strong>. Si un libre cambió de día, el antiguo desaparece.</p>
      <div class="form-grid two">
        <label class="field"><span>Archivo (opcional)</span>
          <input type="file" id="imp-file" accept=".xlsx,.xls,.csv,.txt,.pdf,.json">
          <small id="imp-file-help">Si no eliges archivo, se usa el cuadrante del grupo ya cargado.</small>
        </label>
        <label class="field"><span>Persona</span><select id="imp-person"><option value="">Cargando…</option></select></label>
        <label class="field"><span>Importar desde</span><input type="date" id="imp-desde" value="${esc(profile.syncDesde || defaultSyncStart())}"></label>
      </div>
      <div id="imp-preview" class="import-preview" hidden></div>
      <div class="btn-row">
        <button type="button" class="btn" id="imp-preview-btn">Ver vista previa</button>
        <button type="button" class="btn btn-primary" id="imp-run" disabled>Sincronizar</button>
      </div>`)}

    ${section('export', 'Exportar y compartir', 'Calendario, hojas de cálculo y mensajes', `
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
      </div>`)}

    ${section('rules', 'Reglas del grupo', 'Guardias y escalafón', `
      <p class="set-help">Valen para todos los perfiles de este móvil. Se guardan solas al cambiarlas.</p>
      <div class="form-grid two">
        <label class="field"><span>Días libres por guardia</span><input type="number" id="cfg-dias-guardia" min="1" max="15" inputmode="numeric" value="${config.diasPorGuardia || 5}"></label>
        <label class="field checkbox"><input type="checkbox" id="cfg-excl-weekends" ${config.excludeWeekendsVacation ? 'checked' : ''}><span>No contar fines de semana en vacaciones</span></label>
      </div>
      <label class="field"><span>Escalafón (plantilla actual, uno por línea)</span>
        <textarea id="cfg-escalafon" rows="7">${esc((config.escalafonOrder || []).join('\n'))}</textarea>
        <small>Ordena el cuadrante y oculta a quien ya no está. Basta con parte del nombre: «CARMEN» agrupa también «Mª CARMEN».</small>
      </label>
      <label class="field" id="esc-add-wrap" hidden><span>¿Ha entrado alguien? Añádelo tal como sale en el cuadrante</span>
        <select id="esc-add"></select>
      </label>`)}

    ${section('types', 'Tipos de servicio', 'Los que aparecen al apuntar un servicio', `
      <label class="field"><span>Tipos de servicio (uno por línea)</span>
        <textarea id="cfg-service-types" rows="6">${esc((config.serviceTypes || []).join('\n'))}</textarea></label>`)}

    ${section('tools', 'Diagnóstico y actualización', 'Para cuando algo no va bien', `
      <p class="set-help"><strong>Forzar actualización</strong> descarga de nuevo la app sin tocar tus datos. Úsalo si no te llega una versión nueva.</p>
      <div class="btn-row">
        <button type="button" class="btn" id="goto-diagnostics">Diagnóstico</button>
        <button type="button" class="btn" id="force-update">Forzar actualización</button>
      </div>`)}`;
}

// ─── Importar cuadrante (vista previa + sincronización) ───
function bindImport(root) {
  const personSel = root.querySelector('#imp-person');
  const previewEl = root.querySelector('#imp-preview');
  const runBtn = root.querySelector('#imp-run');
  if (!personSel) return;
  let entries = null;
  let names = [];

  const fillPeople = () => {
    const s = getState();
    const roster = currentRoster(names, effectiveConfig(s).escalafonOrder || []);
    const list = roster.length ? roster : names;
    const selected = s.activeProfile.cuadranteName || '';
    personSel.innerHTML = list.length
      ? '<option value="">— Elige persona —</option>' + list.map(n => `<option value="${esc(n)}" ${n === selected ? 'selected' : ''}>${esc(displayName(n))}</option>`).join('')
      : '<option value="">Carga un cuadrante primero</option>';
  };

  loadGroupCuadrante().then(data => {
    if (data) { entries = data.entries; names = data.names; }
    if (personSel.isConnected) fillPeople();
  });

  root.querySelector('#imp-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Actions.setBusy('Leyendo el cuadrante…');
    try {
      const result = await importGroupCuadranteFile(file);
      invalidateCuadranteCache();
      entries = result.data.entries;
      names = result.data.names;
      fillPeople();
      const notas = notesCount(result.data);
      root.querySelector('#imp-file-help').textContent = `${result.entries} turnos de ${result.names} personas${notas ? ` y ${notas} notas` : ''}. También queda como cuadrante del grupo.`;
    } catch (err) {
      Actions.showToast('No se pudo leer el archivo.', { level: 'error', detail: err.message });
    } finally {
      Actions.setBusy(null);
    }
  });

  const showPreview = () => {
    const person = personSel.value;
    const desde = root.querySelector('#imp-desde').value || defaultSyncStart();
    if (!entries) { Actions.showToast('Carga primero un cuadrante'); return null; }
    if (!person) { Actions.showToast('Elige la persona'); return null; }
    const r = previewSync({ entries, person, desde });
    const s = r.summary;
    const t = s.byType;
    previewEl.hidden = false;
    previewEl.innerHTML = s.entries === 0
      ? `<p>No hay turnos de ${esc(displayName(person))} desde el ${esc(dmy(desde))}.</p>`
      : `
        <p><strong>${esc(displayName(person))}</strong> · del ${esc(dmy(s.desde))} al ${esc(dmy(s.hasta))}</p>
        <ul class="preview-stats">
          <li><b>${s.guardias}</b> guardias</li>
          <li><b>${t.LIBRE || 0}</b> libres</li>
          <li><b>${s.vacaciones || 0}</b> días de vacaciones</li>
          <li><b>${t.AP || 0}</b> asuntos propios</li>
          <li><b>${(t.TURNO_M || 0) + (t.TURNO_T || 0) + (t.TURNO_N || 0)}</b> turnos</li>
        </ul>
        <p class="set-help">${s.removed ? `Se sustituyen ${s.removed} días que vinieron del cuadrante antes. ` : ''}${s.skipped.length ? `${s.skipped.length} día(s) se dejan como están porque ya los apuntaste a mano (p. ej. ${esc(dmy(s.skipped[0].date))}).` : 'Sin choques con lo que apuntaste a mano.'}</p>`;
    runBtn.disabled = s.entries === 0;
    return r;
  };

  root.querySelector('#imp-preview-btn').addEventListener('click', showPreview);
  personSel.addEventListener('change', () => { previewEl.hidden = true; runBtn.disabled = true; });

  runBtn.addEventListener('click', async () => {
    const person = personSel.value;
    const desde = root.querySelector('#imp-desde').value || defaultSyncStart();
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
      Actions.showToast(`Listo: ${s.added} días apuntados, ${s.guardias} guardias`);
      Actions.setScreen('dashboard');
    } catch (err) {
      Actions.showToast('No se pudo sincronizar.', { level: 'error', detail: err.message });
    } finally {
      Actions.setBusy(null);
    }
  });
}

// ─── Exportar ───
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

function bindExports(root) {
  const on = (id, fn) => root.querySelector(id)?.addEventListener('click', fn);
  on('#exp-ics', () => { exportICS(); Actions.showToast('Calendario .ics descargado'); });
  on('#exp-csv-ledger', () => { exportLedgerCSV(); Actions.showToast('CSV de movimientos descargado'); });
  on('#exp-csv-services', () => { exportServicesCSV(); Actions.showToast('CSV de servicios descargado'); });
  on('#exp-csv-days', () => { exportDaysCSV(); Actions.showToast('CSV de días descargado'); });
  on('#exp-print', () => window.print());
  on('#tpl-semanal', () => showMessageSheet(templateResumenSemanal(), 'Resumen semanal'));
  on('#tpl-guardias', () => showMessageSheet(templateResumenGuardias(), 'Resumen de guardias'));
}

// ─── Reglas del grupo ───
const escalafonFrom = (text) => text.split('\n').map(t => t.trim().toUpperCase()).filter(Boolean);

async function saveEscalafon(text) {
  await saveGlobalConfig({ escalafonOrder: escalafonFrom(text) });
  invalidateCuadranteCache();
}

/** Nombres del cuadrante que el escalafón aún no recoge (gente nueva). */
function bindEscalafonPicker(root) {
  const ta = root.querySelector('#cfg-escalafon');
  const sel = root.querySelector('#esc-add');
  const wrap = root.querySelector('#esc-add-wrap');
  if (!ta || !sel) return;
  let names = [];
  const fill = () => {
    const current = escalafonFrom(ta.value);
    const out = [...new Set(names.map(n => String(n).toUpperCase().trim()))]
      .filter(n => n && !current.some(o => n.includes(o)))
      .sort((a, b) => a.localeCompare(b, 'es'));
    wrap.hidden = out.length === 0;
    sel.innerHTML = '<option value="">＋ Añadir del cuadrante…</option>' + out.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  };
  loadGroupCuadrante().then(data => { names = data?.names || []; if (ta.isConnected) fill(); });
  ta.addEventListener('input', fill);
  sel.addEventListener('change', async () => {
    const name = sel.value;
    if (!name) return;
    ta.value = ta.value.replace(/\s*$/, '') + (ta.value.trim() ? '\n' : '') + name;
    fill();
    await saveEscalafon(ta.value);
    Actions.showToast(`${name} añadido al escalafón`);
  });
}

function bindRules(root) {
  bindEscalafonPicker(root);
  autosave(root.querySelector('#cfg-dias-guardia'), {
    validate: intRange(1, 15),
    save: async (v) => { await saveGlobalConfig({ diasPorGuardia: Number(v) }); invalidateCuadranteCache(); }
  });
  autosave(root.querySelector('#cfg-excl-weekends'), {
    save: async (v) => { await saveGlobalConfig({ excludeWeekendsVacation: v === 'true' }); }
  });
  autosave(root.querySelector('#cfg-escalafon'), { save: saveEscalafon });
  autosave(root.querySelector('#cfg-service-types'), {
    validate: (v) => (v.split('\n').some(t => t.trim()) ? null : 'Deja al menos un tipo'),
    save: async (v) => { await saveGlobalConfig({ serviceTypes: v.split('\n').map(t => t.trim()).filter(Boolean) }); }
  });
}

export function bindAdvanced(root) {
  bindImport(root);
  bindExports(root);
  bindRules(root);
  root.querySelector('#goto-diagnostics')?.addEventListener('click', () => Actions.setScreen('diagnostics'));
  root.querySelector('#force-update')?.addEventListener('click', forceUpdate);
}
