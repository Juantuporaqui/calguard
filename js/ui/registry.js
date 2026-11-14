/**
 * @module ui/registry
 * Service log (bitácora) view - list, create, filter
 */

import { getState, Actions } from '../state/store.js';
import { createService, deleteService } from '../domain/services.js';
import { put, STORES } from '../persistence/db.js';
import { openSheet } from './sheet.js';
import { todayISO, formatDMY } from '../domain/rules.js';
import { esc } from './utils.js';
import { emptyStateFor, emptyHTML, bindEmpty } from './emptyStates.js';

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

  // sin ningún servicio: una frase y un botón
  if (!services.length) {
    container.innerHTML = `
      <div class="registry-view">
        <div class="registry-header"><h2>Bitácora de servicios</h2></div>
        ${emptyHTML(emptyStateFor('registry', { services: 0 }))}
      </div>`;
    bindEmpty(container, { new: () => showCreateDialog(state) });
    return;
  }

  container.innerHTML = `
    <div class="registry-view">
      <div class="registry-header">
        <h2>Bitácora de servicios</h2>
        <button class="btn btn-primary" id="new-service">+ Nuevo servicio</button>
      </div>

      <div class="registry-filters">
        <select id="filter-type" aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          ${serviceTypes.map(t => `<option value="${esc(t)}" ${filterType === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
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
        ${emptyHTML(emptyStateFor('registry', { services: services.length, shown: filtered.length }))}
        ${filtered.map(s => `
          <div class="service-card" data-id="${s.id}">
            <div class="service-header">
              <span class="service-type">${esc(s.type)}</span>
              <span class="service-date">${formatDMY(s.dateISO)}</span>
            </div>
            <div class="service-details">
              ${s.startTime ? `<span>${esc(s.startTime)}${s.endTime ? ' - ' + esc(s.endTime) : ''}</span>` : ''}
              ${s.durationMin ? `<span>${esc(s.durationMin)} min</span>` : ''}
              ${s.locationGeneral ? `<span>${esc(s.locationGeneral)}</span>` : ''}
            </div>
            ${s.tags && s.tags.length > 0 ? `
              <div class="service-tags">
                ${s.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
              </div>
            ` : ''}
            ${s.notes ? `<div class="service-notes">${esc(s.notes)}</div>` : ''}
            ${s.sensitivity === 'SENSIBLE' ? '<span class="sensitivity-badge">SENSIBLE</span>' : ''}
            <button type="button" class="service-more" data-id="${s.id}" aria-label="Más acciones: ${esc(s.type)} del ${formatDMY(s.dateISO)}" aria-haspopup="dialog">⋯</button>
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

  bindEmpty(container, { clear: () => { filterType = ''; filterMonth = ''; renderRegistry(container); } });

  container.querySelectorAll('.service-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const service = getState().services.find(sv => sv.id === btn.dataset.id);
      if (service) openServiceActions(service);
    });
  });
}

/** Menú «⋯» de un servicio. Borrar no pregunta: el aviso ofrece «Deshacer», como en el calendario. */
function openServiceActions(service) {
  openSheet({
    title: `${service.type} · ${formatDMY(service.dateISO)}`,
    body: `
      <div class="action-list">
        <button type="button" class="action-item danger" data-act="delete">
          <span class="action-ico" aria-hidden="true">🗑️</span><span><strong>Eliminar este servicio</strong><small>Podrás deshacerlo desde el aviso que aparece abajo.</small></span>
        </button>
      </div>`,
    onMount(root, close) {
      root.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        close();
        await deleteService(service.id);
        Actions.showToast('Servicio eliminado', {
          onAction: async () => {
            await put(STORES.SERVICES, service);
            Actions.setServices([...getState().services, service].sort((a, b) => b.dateISO.localeCompare(a.dateISO)));
            Actions.showToast('Servicio recuperado');
          }
        });
        const content = document.getElementById('screen-content');
        if (content && getState().currentScreen === 'registry') renderRegistry(content);
      });
    }
  });
}

function showCreateDialog(state) {
  const serviceTypes = state.config.serviceTypes || [];
  const serviceTags = state.config.serviceTags || [];

  openSheet({
    title: 'Nuevo servicio',
    body: `
      <p class="notice notice-warn">No introduzcas datos personales (nombres, DNI, direcciones exactas de víctimas o testigos).</p>
      <div class="form-grid two svc-form">
        <label class="field"><span>Fecha</span><input type="date" id="svc-date" value="${todayISO()}"></label>
        <label class="field"><span>Tipo</span>
          <select id="svc-type">${serviceTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label>
        <label class="field"><span>Hora de inicio</span><input type="time" id="svc-start"></label>
        <label class="field"><span>Hora de fin</span><input type="time" id="svc-end"></label>
        <label class="field"><span>Duración (minutos)</span><input type="number" id="svc-duration" min="0" max="1440" value="60"></label>
        <label class="field"><span>Lugar (municipio o distrito)</span><input type="text" id="svc-location" placeholder="Ej: Madrid Centro"></label>
        <label class="field"><span>Unidad o área</span><input type="text" id="svc-unit" placeholder="Ej: Laboratorio"></label>
      </div>
      ${serviceTags.length ? `
      <fieldset class="svc-tags">
        <legend class="field-label">Etiquetas</legend>
        <div class="tag-selector">
          ${serviceTags.map(t => `<label class="tag-checkbox"><input type="checkbox" value="${esc(t)}"> ${esc(t)}</label>`).join('')}
        </div>
      </fieldset>` : ''}
      <label class="field"><span>Notas</span><textarea id="svc-notes" rows="3" placeholder="Observaciones (sin datos personales)"></textarea></label>
      <label class="field checkbox"><input type="checkbox" id="svc-sensitive"><span>Marcar como sensible</span></label>`,
    footer: `
      <button type="button" class="btn" data-act="cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" data-act="save">Guardar</button>`,
    onMount(root, close) {
      const $ = (sel) => root.querySelector(sel);
      const startInput = $('#svc-start');
      const endInput = $('#svc-end');
      const durationInput = $('#svc-duration');
      // la duración sale sola de las horas
      const calcDuration = () => {
        if (startInput.value && endInput.value) {
          const [sh, sm] = startInput.value.split(':').map(Number);
          const [eh, em] = endInput.value.split(':').map(Number);
          let mins = (eh * 60 + em) - (sh * 60 + sm);
          if (mins <= 0) mins += 1440; // servicio que pasa de medianoche (22:00 → 03:00)
          durationInput.value = mins;
        }
      };
      startInput.addEventListener('change', calcDuration);
      endInput.addEventListener('change', calcDuration);

      $('[data-act="cancel"]').addEventListener('click', close);
      $('[data-act="save"]').addEventListener('click', async () => {
        const selectedTags = Array.from(root.querySelectorAll('.tag-checkbox input:checked')).map(cb => cb.value);
        await createService({
          dateISO: $('#svc-date').value || todayISO(),
          type: $('#svc-type').value,
          startTime: startInput.value,
          endTime: endInput.value,
          durationMin: parseInt(durationInput.value) || 0,
          locationGeneral: $('#svc-location').value.trim(),
          unit: $('#svc-unit').value.trim(),
          tags: selectedTags,
          notes: $('#svc-notes').value.trim(),
          sensitivity: $('#svc-sensitive').checked ? 'SENSIBLE' : 'NORMAL'
        });
        close();
        Actions.showToast('Servicio registrado');
        const content = document.getElementById('screen-content');
        if (content && getState().currentScreen === 'registry') renderRegistry(content);
      });
    }
  });
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

