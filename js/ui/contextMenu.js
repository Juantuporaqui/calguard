/**
 * @module ui/contextMenu
 * Context menu for day actions
 */

import { getState, Actions } from '../state/store.js';
import {
  markWeekGuardia, markWeekGuardiaPlan, markAsuntoPropio,
  startVacacionesRange, startPedirDias, markShift,
  markFormacion, markJuicio, markBaja, markOtros, removeAllDayEvents
} from './calendar.js';
import { formatDMY } from '../domain/rules.js';

/** Tag type display config */
const TAG_DISPLAY = {
  'GUARDIA_REAL': { label: 'Guardia Realizada', icon: 'G', cls: 'guardia-icon' },
  'GUARDIA_PLAN': { label: 'Próxima Guardia', icon: 'P', cls: 'plan-icon' },
  'LIBRE': { label: 'Día Libre', icon: 'L', cls: 'libre-icon' },
  'VACACIONES': { label: 'Vacaciones', icon: 'V', cls: 'vac-icon' },
  'AP': { label: 'Asunto Propio', icon: 'A', cls: 'ap-icon' },
  'TURNO_M': { label: 'Turno Mañana', icon: 'M', cls: 'turno-icon' },
  'TURNO_T': { label: 'Turno Tarde', icon: 'T', cls: 'turno-icon' },
  'TURNO_N': { label: 'Turno Noche', icon: 'N', cls: 'turno-icon' },
  'FORMACION': { label: 'Formación', icon: 'F', cls: 'form-icon' },
  'JUICIO': { label: 'Juicio/Citación', icon: 'J', cls: 'juicio-icon' },
  'BAJA': { label: 'Baja / Asunto Familiar', icon: 'B', cls: 'baja-icon' },
  'OTRO': { label: 'Otro Evento', icon: '+', cls: 'otros-icon' },
};

/**
 * @param {HTMLElement} container
 */
export function renderContextMenu(container) {
  if (!container) return;
  const state = getState();

  if (!state.contextMenu) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const { dateISO, x, y, screenX, screenY } = state.contextMenu;
  const dayData = state.days.find(d => d.dateISO === dateISO && d.profileId === state.activeProfileId);
  const tags = dayData ? dayData.tags : [];
  const hasEvents = tags.length > 0;

  container.style.display = 'block';

  // Build event detail section if day has events
  let eventDetailHTML = '';
  if (hasEvents) {
    eventDetailHTML = `<div class="ctx-section">
      <div class="ctx-section-title">Registrado</div>
      ${tags.map(t => {
        const info = TAG_DISPLAY[t.type] || { label: t.type, icon: '?', cls: 'otros-icon' };
        let meta = '';
        if (t.meta) {
          if (t.meta.label) meta = t.meta.label;
          if (t.meta.guardRef) meta = `Guardia: ${t.meta.guardRef}`;
          if (t.meta.ordinal) meta += ` (${t.meta.ordinal})`;
          if (t.meta.diasAfectados != null && t.meta.diasAfectados !== 0) meta += ` · ${t.meta.diasAfectados > 0 ? '+' : ''}${t.meta.diasAfectados} días`;
          if (t.meta.source === 'cuadrante') meta = (meta ? meta + ' · ' : '') + 'Importado';
        }
        return `<div class="ctx-btn ctx-event-info" style="cursor:default;opacity:0.9">
          <span class="ctx-icon ${info.cls}">${info.icon}</span>
          <span style="flex:1">
            <strong style="font-size:var(--text-sm)">${info.label}</strong>
            ${meta ? `<br><span style="font-size:var(--text-xs);color:var(--text-muted)">${meta}</span>` : ''}
          </span>
        </div>`;
      }).join('')}
    </div>`;
  }

  container.innerHTML = `
    <div class="ctx-overlay" id="ctx-overlay"></div>
    <div class="ctx-menu" role="menu" aria-label="Acciones del día ${formatDMY(dateISO)}" style="top:0;left:0">
      <div class="ctx-header">${formatDMY(dateISO)}</div>
      ${eventDetailHTML}
      <div class="ctx-section">
        <div class="ctx-section-title">Guardias</div>
        <button class="ctx-btn" data-action="guardia" role="menuitem">
          <span class="ctx-icon guardia-icon">G</span> Guardia Realizada
        </button>
        <button class="ctx-btn" data-action="plan" role="menuitem">
          <span class="ctx-icon plan-icon">P</span> Próx. Guardia
        </button>
        <button class="ctx-btn" data-action="pedir" role="menuitem">
          <span class="ctx-icon libre-icon">L</span> Pedir Días Libres
        </button>
      </div>
      <div class="ctx-section">
        <div class="ctx-section-title">Permisos</div>
        <button class="ctx-btn" data-action="ap" role="menuitem">
          <span class="ctx-icon ap-icon">A</span> Asunto Propio
        </button>
        <button class="ctx-btn" data-action="vacaciones" role="menuitem">
          <span class="ctx-icon vac-icon">V</span> Vacaciones
        </button>
        <button class="ctx-btn" data-action="baja" role="menuitem">
          <span class="ctx-icon baja-icon">B</span> Baja / Asunto Familiar
        </button>
      </div>
      <div class="ctx-section">
        <div class="ctx-section-title">Turnos / Otros</div>
        <button class="ctx-btn" data-action="manana" role="menuitem">
          <span class="ctx-icon turno-icon">M</span> Mañana
        </button>
        <button class="ctx-btn" data-action="tarde" role="menuitem">
          <span class="ctx-icon turno-icon">T</span> Tarde
        </button>
        <button class="ctx-btn" data-action="formacion" role="menuitem">
          <span class="ctx-icon form-icon">F</span> Formación
        </button>
        <button class="ctx-btn" data-action="juicio" role="menuitem">
          <span class="ctx-icon juicio-icon">J</span> Juicio/Citación
        </button>
        <button class="ctx-btn" data-action="otros" role="menuitem">
          <span class="ctx-icon otros-icon">+</span> Otros Eventos
        </button>
      </div>
      <div class="ctx-section ctx-danger-section">
        <button class="ctx-btn ctx-danger" data-action="eliminar" role="menuitem">
          Eliminar
        </button>
      </div>
    </div>
  `;

  // Position the menu using screen coordinates for accuracy
  const menu = container.querySelector('.ctx-menu');
  positionMenu(menu, screenX || x, screenY || y);

  // Overlay click closes
  document.getElementById('ctx-overlay')?.addEventListener('click', () => {
    Actions.hideContextMenu();
  });

  // Action handlers
  container.querySelectorAll('.ctx-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      Actions.hideContextMenu();

      switch (action) {
        case 'guardia':
          await markWeekGuardia(dateISO);
          break;
        case 'plan':
          await markWeekGuardiaPlan(dateISO);
          break;
        case 'pedir':
          startPedirDias();
          break;
        case 'ap':
          await markAsuntoPropio(dateISO);
          break;
        case 'vacaciones':
          startVacacionesRange(dateISO);
          break;
        case 'manana':
          await markShift(dateISO, 'TURNO_M');
          break;
        case 'tarde':
          await markShift(dateISO, 'TURNO_T');
          break;
        case 'formacion':
          await markFormacion(dateISO);
          break;
        case 'juicio':
          await markJuicio(dateISO);
          break;
        case 'baja':
          await markBaja(dateISO);
          break;
        case 'otros':
          showOtrosDialog(dateISO);
          break;
        case 'eliminar':
          await removeAllDayEvents(dateISO);
          break;
      }
    });
  });
}

function positionMenu(menu, clientX, clientY) {
  if (!menu) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = Math.min(280, vw - 20);

  // Force layout to measure actual menu height
  menu.style.visibility = 'hidden';
  menu.style.display = 'block';
  menu.style.maxWidth = mw + 'px';
  const mh = menu.offsetHeight;
  menu.style.visibility = '';

  let left, top;

  // On mobile, center horizontally and position near top
  if (vw < 600) {
    left = (vw - mw) / 2;
    // Place at top with some margin, scrollable if too tall
    top = Math.max(10, Math.min(clientY - mh / 2, vh - mh - 10));
    if (top < 10) top = 10;
  } else {
    left = clientX + 8;
    top = clientY;

    // Clamp right edge
    if (left + mw > vw - 10) left = clientX - mw - 8;
    if (left < 10) left = 10;

    // Clamp bottom edge - if menu would go off-screen, flip above click point
    if (top + mh > vh - 10) {
      top = clientY - mh;
    }
    // Final clamp to viewport
    if (top < 10) top = 10;
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function showOtrosDialog(dateISO) {
  const popup = document.createElement('div');
  popup.className = 'modal-overlay';
  popup.innerHTML = `
    <div class="modal-card">
      <h3>Otros Eventos</h3>
      <label>
        Concepto:
        <input type="text" id="otros-concepto" placeholder="Ej: Comisión, Curso..." maxlength="50">
      </label>
      <label>
        Días que afecta (+ o -):
        <input type="number" id="otros-dias" value="0" min="-30" max="30">
      </label>
      <div class="modal-actions">
        <button class="btn btn-primary" id="otros-ok">Aceptar</button>
        <button class="btn btn-sm" id="otros-cancel">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById('otros-ok')?.addEventListener('click', async () => {
    const concepto = document.getElementById('otros-concepto').value.trim();
    if (!concepto) {
      Actions.showToast('Introduce un concepto');
      return;
    }
    const dias = parseInt(document.getElementById('otros-dias').value) || 0;
    popup.remove();
    await markOtros(dateISO, concepto, dias);
  });

  document.getElementById('otros-cancel')?.addEventListener('click', () => popup.remove());
  document.getElementById('otros-concepto')?.focus();
}
