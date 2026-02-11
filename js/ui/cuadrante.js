/**
 * @module ui/cuadrante
 * Cuadrante Grupal - Group schedule view with file import (Excel/PDF)
 * Displays all team members' shifts in a monthly grid table
 */

import { Actions } from '../state/store.js';
import { parseCuadrante, getPersonNames, filterByPerson } from '../imports/cuadranteParser.js';
import { addDayTag } from './calendar.js';
import { recalcCounters } from '../app.js';

const CUADRANTE_KEY = 'calguard-cuadrante';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS = ['D','L','M','X','J','V','S'];

const EVENT_ICONS = {
  'GUARDIA_REAL': 'G', 'GUARDIA_PLAN': 'P', 'LIBRE': 'L',
  'VACACIONES': 'V', 'AP': 'A', 'TURNO_M': 'M', 'TURNO_T': 'T',
  'TURNO_N': 'N', 'FORMACION': 'F', 'JUICIO': 'J', 'OTRO': '?'
};

const EVENT_CSS = {
  'GUARDIA_REAL': 'cq-guardia', 'GUARDIA_PLAN': 'cq-plan', 'LIBRE': 'cq-libre',
  'VACACIONES': 'cq-vacaciones', 'AP': 'cq-asunto', 'TURNO_M': 'cq-turno-m',
  'TURNO_T': 'cq-turno-t', 'TURNO_N': 'cq-turno-n', 'FORMACION': 'cq-formacion',
  'JUICIO': 'cq-juicio', 'OTRO': ''
};

let cuadranteMonth = new Date().getMonth();
let cuadranteYear = new Date().getFullYear();

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
 * Render the cuadrante grupal view
 * @param {HTMLElement} container
 */
export function renderCuadrante(container) {
  const data = loadData();

  container.innerHTML = `
    <div class="cuadrante-view">
      <div class="cuadrante-nav">
        <button class="btn btn-icon" id="cq-prev">&laquo;</button>
        <h2 class="cuadrante-title">${MONTHS[cuadranteMonth]} ${cuadranteYear}</h2>
        <button class="btn btn-icon" id="cq-next">&raquo;</button>
      </div>
      <div class="cuadrante-actions">
        <label class="btn btn-primary btn-sm cq-upload-label">
          Cargar archivo (Excel / PDF)
          <input type="file" id="cq-file" accept=".xlsx,.xls,.pdf" hidden>
        </label>
        <button class="btn btn-sm" id="cq-export" ${!data ? 'disabled' : ''}>Exportar JSON</button>
        <button class="btn btn-sm btn-danger" id="cq-clear" ${!data ? 'disabled' : ''}>Borrar</button>
      </div>
      <div id="cq-status" style="font-size:var(--text-xs);color:var(--text-muted);text-align:center;margin-bottom:var(--space-sm)"></div>
      <div id="cq-table-container" class="cuadrante-table-wrap">
        ${data ? renderTable(data) : '<div class="empty-state">Carga un archivo Excel o PDF con el cuadrante de tu grupo para visualizarlo aquí.</div>'}
      </div>
      ${data ? renderStats(data) : ''}
    </div>
  `;

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

  // Import to personal calendar buttons
  container.querySelectorAll('.cq-import-person').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.person;
      if (!data) return;
      const entries = filterByPerson(data.entries, name);
      if (entries.length === 0) {
        Actions.showToast(`Sin datos para ${name}`);
        return;
      }
      if (!confirm(`Importar ${entries.length} turnos de "${name}" a tu calendario personal?`)) return;
      let imported = 0, skipped = 0;
      for (const entry of entries) {
        const tag = { type: entry.tagType, meta: { source: 'cuadrante', code: entry.code } };
        const ok = await addDayTag(entry.date, tag);
        if (ok) imported++; else skipped++;
      }
      recalcCounters();
      Actions.showToast(`${imported} turnos importados${skipped > 0 ? `, ${skipped} omitidos` : ''}`);
    });
  });
}

/**
 * Render the group schedule table for current month
 */
function renderTable(data) {
  const { entries, names } = data;
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

  // Person rows
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

      html += `<td class="cq-cell ${cssClass} ${isWeekend ? 'cq-weekend' : ''} ${isToday ? 'cq-today-col' : ''}" title="${title}">${icon}</td>`;
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
