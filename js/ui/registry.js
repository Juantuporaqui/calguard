/**
 * @module ui/registry
 * Service log (bitácora) view - list, create, filter
 */

import { getState, Actions } from '../state/store.js';
import { createService, deleteService, loadServices } from '../domain/services.js';
import { todayISO, formatDMY } from '../domain/rules.js';

let filterType = '';
let filterMonth = '';

/**
 * @param {HTMLElement} container
 */
export function renderRegistry(container) {
  const state = getState();
  const services = state.services || [];

  // Filter
  let filtered = services;
  if (filterType) {
    filtered = filtered.filter(s => s.type === filterType);
  }
  if (filterMonth) {
    filtered = filtered.filter(s => s.dateISO.startsWith(filterMonth));
  }

  const serviceTypes = state.config.serviceTypes || [];
  const months = getAvailableMonths(services);

  container.innerHTML = `
    <div class="registry-view">
      <div class="registry-header">
        <h2>Bitácora de Servicios</h2>
        <button class="btn btn-primary" id="new-service">+ Nuevo Servicio</button>
      </div>

      <div class="registry-filters">
        <select id="filter-type" aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          ${serviceTypes.map(t => `<option value="${t}" ${filterType === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <select id="filter-month" aria-label="Filtrar por mes">
          <option value="">Todos los meses</option>
          ${months.map(m => `<option value="${m}" ${filterMonth === m ? 'selected' : ''}>${formatMonthLabel(m)}</option>`).join('')}
        </select>
      </div>

      <div class="registry-summary">
        <span>${filtered.length} servicio${filtered.length !== 1 ? 's' : ''}</span>
        <span>${totalHours(filtered)}h totales</span>
      </div>

      <div class="registry-list">
        ${filtered.length === 0 ? '<p class="empty-state">No hay servicios registrados</p>' : ''}
        ${filtered.map(s => `
          <div class="service-card" data-id="${s.id}">
            <div class="service-header">
              <span class="service-type">${s.type}</span>
              <span class="service-date">${formatDMY(s.dateISO)}</span>
            </div>
            <div class="service-details">
              ${s.startTime ? `<span>${s.startTime}${s.endTime ? ' - ' + s.endTime : ''}</span>` : ''}
              ${s.durationMin ? `<span>${s.durationMin} min</span>` : ''}
              ${s.locationGeneral ? `<span>${s.locationGeneral}</span>` : ''}
            </div>
            ${s.tags && s.tags.length > 0 ? `
              <div class="service-tags">
                ${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}
              </div>
            ` : ''}
            ${s.notes ? `<div class="service-notes">${escapeHtml(s.notes)}</div>` : ''}
            ${s.sensitivity === 'SENSIBLE' ? '<span class="sensitivity-badge">SENSIBLE</span>' : ''}
            <button class="btn btn-sm btn-danger service-delete" data-id="${s.id}">Eliminar</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Event handlers
  document.getElementById('new-service')?.addEventListener('click', () => showCreateDialog(state));

  document.getElementById('filter-type')?.addEventListener('change', (e) => {
    filterType = e.target.value;
    renderRegistry(container);
  });

  document.getElementById('filter-month')?.addEventListener('change', (e) => {
    filterMonth = e.target.value;
    renderRegistry(container);
  });

  container.querySelectorAll('.service-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar este servicio?')) {
        await deleteService(btn.dataset.id);
        renderRegistry(container);
      }
    });
  });
}

function showCreateDialog(state) {
  const serviceTypes = state.config.serviceTypes || [];
  const serviceTags = state.config.serviceTags || [];

  const popup = document.createElement('div');
  popup.className = 'modal-overlay';
  popup.innerHTML = `
    <div class="modal-card modal-large">
      <h3>Nuevo Servicio</h3>

      <div class="form-warning">
        No introduzcas datos personales (nombres, DNI, direcciones exactas de víctimas/testigos).
      </div>

      <div class="form-grid">
        <label>
          Fecha:
          <input type="date" id="svc-date" value="${todayISO()}">
        </label>
        <label>
          Tipo:
          <select id="svc-type">
            ${serviceTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </label>
        <label>
          Hora inicio:
          <input type="time" id="svc-start">
        </label>
        <label>
          Hora fin:
          <input type="time" id="svc-end">
        </label>
        <label>
          Duración (min):
          <input type="number" id="svc-duration" min="0" max="1440" value="60">
        </label>
        <label>
          Ubicación (municipio/distrito):
          <input type="text" id="svc-location" placeholder="Ej: Madrid Centro">
        </label>
        <label>
          Unidad/Área:
          <input type="text" id="svc-unit" placeholder="Ej: Laboratorio">
        </label>
      </div>

      <div class="form-section">
        <label>Etiquetas:</label>
        <div class="tag-selector">
          ${serviceTags.map(t => `
            <label class="tag-checkbox">
              <input type="checkbox" value="${t}"> ${t}
            </label>
          `).join('')}
        </div>
      </div>

      <label>
        Notas operativas:
        <textarea id="svc-notes" rows="3" placeholder="Observaciones (sin datos personales)"></textarea>
      </label>

      <label class="sensitivity-toggle">
        <input type="checkbox" id="svc-sensitive">
        Marcar como SENSIBLE (requiere Modo Seguro para cifrado)
      </label>

      <div class="modal-actions">
        <button class="btn btn-primary" id="svc-save">Guardar</button>
        <button class="btn btn-sm" id="svc-cancel">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Auto-calc duration from times
  const startInput = document.getElementById('svc-start');
  const endInput = document.getElementById('svc-end');
  const durationInput = document.getElementById('svc-duration');

  const calcDuration = () => {
    if (startInput.value && endInput.value) {
      const [sh, sm] = startInput.value.split(':').map(Number);
      const [eh, em] = endInput.value.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins > 0) durationInput.value = mins;
    }
  };
  startInput?.addEventListener('change', calcDuration);
  endInput?.addEventListener('change', calcDuration);

  document.getElementById('svc-save')?.addEventListener('click', async () => {
    const selectedTags = Array.from(popup.querySelectorAll('.tag-checkbox input:checked')).map(cb => cb.value);

    await createService({
      dateISO: document.getElementById('svc-date').value || todayISO(),
      type: document.getElementById('svc-type').value,
      startTime: startInput.value,
      endTime: endInput.value,
      durationMin: parseInt(durationInput.value) || 0,
      locationGeneral: document.getElementById('svc-location').value.trim(),
      unit: document.getElementById('svc-unit').value.trim(),
      tags: selectedTags,
      notes: document.getElementById('svc-notes').value.trim(),
      sensitivity: document.getElementById('svc-sensitive').checked ? 'SENSIBLE' : 'NORMAL'
    });

    popup.remove();
    Actions.showToast('Servicio registrado');
    const content = document.getElementById('screen-content');
    if (content) renderRegistry(content);
  });

  document.getElementById('svc-cancel')?.addEventListener('click', () => popup.remove());
}

function getAvailableMonths(services) {
  const months = new Set();
  for (const s of services) {
    months.add(s.dateISO.slice(0, 7));
  }
  return Array.from(months).sort().reverse();
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(m) - 1]} ${y}`;
}

function totalHours(services) {
  const mins = services.reduce((sum, s) => sum + (s.durationMin || 0), 0);
  return Math.round(mins / 60 * 10) / 10;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
