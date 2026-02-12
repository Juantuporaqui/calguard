/**
 * @module ui/cuadrante
 * Cuadrante Grupal - Group schedule view with file import (Excel/PDF)
 * Displays all team members' shifts in a monthly grid table
 */

import { Actions } from '../state/store.js';
import { parseCuadrante, getPersonNames, filterByPerson } from '../imports/cuadranteParser.js';
import { addDayTag, addDayTagBatch } from './calendar.js';
import { recalcCounters } from '../app.js';

const CUADRANTE_KEY = 'calguard-cuadrante';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS = ['D','L','M','X','J','V','S'];

/** Escalafón order - fixed hierarchy */
const ESCALAFON_ORDER = ['TESA', 'PACO', 'RAFA', 'CARME', 'MARIO', 'REINO', 'NURIA', 'JUAN'];

const EVENT_ICONS = {
  'GUARDIA_REAL': 'G', 'GUARDIA_PLAN': 'P', 'LIBRE': 'L',
  'VACACIONES': 'V', 'AP': 'A', 'TURNO_M': 'M', 'TURNO_T': 'T',
  'TURNO_N': 'N', 'FORMACION': 'F', 'JUICIO': 'J', 'BAJA': 'B', 'OTRO': '?'
};

const EVENT_CSS = {
  'GUARDIA_REAL': 'cq-guardia', 'GUARDIA_PLAN': 'cq-plan', 'LIBRE': 'cq-libre',
  'VACACIONES': 'cq-vacaciones', 'AP': 'cq-asunto', 'TURNO_M': 'cq-turno-m',
  'TURNO_T': 'cq-turno-t', 'TURNO_N': 'cq-turno-n', 'FORMACION': 'cq-formacion',
  'JUICIO': 'cq-juicio', 'BAJA': 'cq-baja', 'OTRO': ''
};

let cuadranteMonth = new Date().getMonth();
let cuadranteYear = new Date().getFullYear();
let actionsVisible = false;
let orientationListenerBound = false;

/** Load cuadrante data from localStorage */
function loadData() {
  try {
    const raw = localStorage.getItem(CUADRANTE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Save cuadrante data to localStorage */
function saveData(data) {
  localStorage.setItem(CUADRANTE_KEY, JSON.stringify(data));
}

/**
 * Sort names by escalafón order. Names not in the list go at the end alphabetically.
 */
function sortByEscalafon(names) {
  return [...names].sort((a, b) => {
    const aUpper = a.toUpperCase();
    const bUpper = b.toUpperCase();
    let aIdx = ESCALAFON_ORDER.findIndex(n => aUpper.includes(n));
    let bIdx = ESCALAFON_ORDER.findIndex(n => bUpper.includes(n));
    if (aIdx === -1) aIdx = 999;
    if (bIdx === -1) bIdx = 999;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.localeCompare(b);
  });
}


function ensureLandscapeMode() {
  if (window.innerWidth > 900) return;

  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  document.body.classList.toggle('cuadrante-portrait', isPortrait);

  const lock = screen.orientation && screen.orientation.lock;
  if (lock) {
    screen.orientation.lock('landscape').catch(() => {
      // iOS/Safari and some browsers require fullscreen or do not support lock.
    });
  }

  if (!orientationListenerBound) {
    window.addEventListener('orientationchange', () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      document.body.classList.toggle('cuadrante-portrait', portrait);
    });
    orientationListenerBound = true;
  }
}

/**
 * Render the cuadrante grupal view
 * @param {HTMLElement} container
 */
export function renderCuadrante(container) {
  const data = loadData();
  ensureLandscapeMode();

  container.innerHTML = `
    <div class="cuadrante-view">
      <div class="cuadrante-nav">
        <button class="btn btn-icon" id="cq-prev">&laquo;</button>
        <h2 class="cuadrante-title">${MONTHS[cuadranteMonth]} ${cuadranteYear}</h2>
        <button class="btn btn-icon" id="cq-next">&raquo;</button>
      </div>
      <div class="cq-toggle-actions">
        <button class="btn btn-sm" id="cq-toggle-import">${actionsVisible ? 'Ocultar opciones' : 'Importar / Opciones'}</button>
      </div>
      <div class="cuadrante-actions ${actionsVisible ? 'show' : ''}" id="cq-actions-panel">
        <label class="btn btn-primary btn-sm cq-upload-label">
          Cargar archivo (Excel / PDF)
          <input type="file" id="cq-file" accept=".xlsx,.xls,.pdf" hidden>
        </label>
        <button class="btn btn-sm" id="cq-export" ${!data ? 'disabled' : ''}>Exportar JSON</button>
        <button class="btn btn-sm btn-danger" id="cq-clear" ${!data ? 'disabled' : ''}>Borrar</button>
      </div>
      <div class="cq-orientation-hint">🔄 Para ver el cuadrante completo, usa el móvil en horizontal.</div>
      <div id="cq-status" style="font-size:var(--text-xs);color:var(--text-muted);text-align:center;margin-bottom:var(--space-sm)"></div>
      <div id="cq-table-container" class="cuadrante-table-wrap">
        ${data ? renderTable(data) : '<div class="empty-state">Carga un archivo Excel o PDF con el cuadrante de tu grupo para visualizarlo aquí.</div>'}
      </div>
      ${data ? renderStats(data) : ''}
    </div>
  `;

  // Toggle import actions
  document.getElementById('cq-toggle-import')?.addEventListener('click', () => {
    actionsVisible = !actionsVisible;
    const panel = document.getElementById('cq-actions-panel');
    const toggleBtn = document.getElementById('cq-toggle-import');
    if (panel) panel.classList.toggle('show', actionsVisible);
    if (toggleBtn) toggleBtn.textContent = actionsVisible ? 'Ocultar opciones' : 'Importar / Opciones';
  });

  // Navigation
  document.getElementById('cq-prev')?.addEventListener('click', () => {
    if (cuadranteMonth === 0) { cuadranteMonth = 11; cuadranteYear--; }
    else cuadranteMonth--;
    renderCuadrante(container);
  });
  document.getElementById('cq-next')?.addEventListener('click', () => {
    if (cuadranteMonth === 11) { cuadranteMonth = 0; cuadranteYear++; }
    else cuadranteMonth++;
    renderCuadrante(container);
  });

  // File import
  document.getElementById('cq-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('cq-status');
    statusEl.textContent = 'Analizando archivo...';
    statusEl.style.color = 'var(--text-muted)';

    try {
      const entries = await parseCuadrante(file);
      if (entries.length === 0) {
        statusEl.textContent = 'No se encontraron datos en el archivo.';
        statusEl.style.color = 'var(--warn)';
        return;
      }
      const names = getPersonNames(entries);
      const cuadranteData = { entries, names, importedAt: new Date().toISOString(), fileName: file.name };
      saveData(cuadranteData);
      statusEl.textContent = `${entries.length} asignaciones de ${names.length} personas importadas.`;
      statusEl.style.color = 'var(--success)';
      actionsVisible = false;
      renderCuadrante(container);
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.style.color = 'var(--danger)';
    }
  });

  // Export
  document.getElementById('cq-export')?.addEventListener('click', () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuadrante-${cuadranteYear}-${String(cuadranteMonth + 1).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Actions.showToast('Cuadrante exportado');
  });

  // Clear
  document.getElementById('cq-clear')?.addEventListener('click', () => {
    if (!confirm('¿Borrar el cuadrante grupal cargado?')) return;
    localStorage.removeItem(CUADRANTE_KEY);
    renderCuadrante(container);
    Actions.showToast('Cuadrante borrado');
  });

  // Import to personal calendar buttons (batch mode - no flickering)
  container.querySelectorAll('.cq-import-person').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.person;
      if (!data) return;
      const entries = filterByPerson(data.entries, name)
        .filter(e => {
          const [y, m] = e.date.split('-').map(Number);
          return y === cuadranteYear && (m - 1) === cuadranteMonth;
        });
      if (entries.length === 0) {
        Actions.showToast(`Sin datos para ${name} en ${MONTHS[cuadranteMonth]}`);
        return;
      }

      const mode = await askImportMode(name, entries.length);
      if (!mode) return;

      btn.disabled = true;
      btn.textContent = '...';

      const filteredEntries = mode === 'MT'
        ? entries.filter(e => e.tagType === 'TURNO_M' || e.tagType === 'TURNO_T')
        : entries;

      const items = filteredEntries.map(entry => ({
        dateISO: entry.date,
        tag: { type: entry.tagType, meta: { source: 'cuadrante', code: entry.code } }
      }));

      const { imported, skipped } = await addDayTagBatch(items, {
        skipIfHasProtectedTags: mode === 'MT'
      });
      btn.disabled = false;
      btn.textContent = '+';
      Actions.showToast(`${imported} turnos importados${skipped > 0 ? `, ${skipped} omitidos` : ''}`);
    });
  });
}

function askImportMode(name, total) {
  return new Promise(resolve => {
    const popup = document.createElement('div');
    popup.className = 'modal-overlay';
    popup.innerHTML = `
      <div class="modal-card">
        <h3>Importar turnos de ${name}</h3>
        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-sm)">
          Mes: <strong>${MONTHS[cuadranteMonth]} ${cuadranteYear}</strong> · ${total} registros disponibles.
        </p>
        <div class="form-grid">
          <label class="tag-checkbox">
            <input type="radio" name="import-mode" value="ALL" checked>
            Importar todo (guardias, permisos, turnos...)
          </label>
          <label class="tag-checkbox">
            <input type="radio" name="import-mode" value="MT">
            Solo turnos M/T (sin tocar días ya pedidos o eventos especiales)
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="import-confirm">Importar</button>
          <button class="btn btn-sm" id="import-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    document.getElementById('import-confirm')?.addEventListener('click', () => {
      const selected = document.querySelector('input[name="import-mode"]:checked')?.value || 'ALL';
      popup.remove();
      resolve(selected);
    });
    document.getElementById('import-cancel')?.addEventListener('click', () => {
      popup.remove();
      resolve(null);
    });
  });
}

/**
 * Render the group schedule table for current month
 */
function renderTable(data) {
  const { entries, names: rawNames } = data;
  const names = sortByEscalafon(rawNames);
  const daysInMonth = new Date(cuadranteYear, cuadranteMonth + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === cuadranteYear && today.getMonth() === cuadranteMonth;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  // Build lookup: person -> day -> [tagTypes]
  const lookup = {};
  for (const name of names) {
    lookup[name] = {};
  }
  for (const e of entries) {
    const [y, m] = e.date.split('-').map(Number);
    if (y !== cuadranteYear || (m - 1) !== cuadranteMonth) continue;
    const d = parseInt(e.date.split('-')[2]);
    if (!lookup[e.person]) lookup[e.person] = {};
    if (!lookup[e.person][d]) lookup[e.person][d] = [];
    lookup[e.person][d].push(e.tagType);
  }

  let html = '<table class="cq-table"><thead><tr><th class="cq-name-col"></th>';

  // Day headers
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(cuadranteYear, cuadranteMonth, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isToday = d === todayDay;
    html += `<th class="cq-day-header ${isWeekend ? 'cq-weekend' : ''} ${isToday ? 'cq-today-col' : ''}">
      <span class="cq-day-num">${d}</span><span class="cq-day-name">${WEEKDAYS[dow]}</span>
    </th>`;
  }
  html += '<th class="cq-action-col"></th></tr></thead><tbody>';

  // Person rows (sorted by escalafón)
  for (const name of names) {
    const abbr = name.length > 5 ? name.substring(0, 5) : name;
    html += `<tr><td class="cq-name-cell" title="${name}">${abbr}</td>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(cuadranteYear, cuadranteMonth, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isToday = d === todayDay;
      const tags = (lookup[name] && lookup[name][d]) || [];
      const icon = tags.length > 0 ? EVENT_ICONS[tags[0]] || '' : '';
      const cssClass = tags.length > 0 ? EVENT_CSS[tags[0]] || '' : '';
      const title = tags.map(t => t.replace('_', ' ')).join(', ');

      // Weekend styling overrides event color only if no event
      const weekendClass = isWeekend && tags.length === 0 ? 'cq-weekend' : '';

      html += `<td class="cq-cell ${cssClass} ${weekendClass} ${isToday ? 'cq-today-col' : ''}" title="${title}">${icon}</td>`;
    }

    html += `<td class="cq-action-cell"><button class="btn btn-sm cq-import-person" data-person="${name}" title="Importar turnos de ${name}">+</button></td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

/**
 * Render quick stats for today
 */
function renderStats(data) {
  const today = new Date().toISOString().split('T')[0];
  let guardias = 0, vacaciones = 0, libres = 0;

  for (const e of data.entries) {
    if (e.date !== today) continue;
    if (e.tagType === 'GUARDIA_REAL') guardias++;
    if (e.tagType === 'VACACIONES') vacaciones++;
    if (e.tagType === 'LIBRE') libres++;
  }

  const disponibles = data.names.length - guardias - vacaciones - libres;
  const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return `
    <div class="cq-stats">
      <div class="cq-stat"><span class="cq-stat-val">${guardias}</span><span class="cq-stat-lbl">Guardias hoy (${hoy})</span></div>
      <div class="cq-stat"><span class="cq-stat-val">${disponibles}</span><span class="cq-stat-lbl">Disponibles</span></div>
      <div class="cq-stat"><span class="cq-stat-val">${vacaciones}</span><span class="cq-stat-lbl">Vacaciones</span></div>
    </div>
  `;
}
