/**
 * @module ui/contextMenu
 * Context menu for day actions
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import {
  markWeekGuardia, markWeekGuardiaPlan, markAsuntoPropio,
  startVacacionesRange, startPedirDias, markShift,
  markFormacion, markBaja, markOtros, removeAllDayEvents,
  openEventSheet, toggleLibreExento
} from './calendar.js';
import { formatDMY } from '../domain/rules.js';
import { eventItems, eventIcon, eventTitle } from '../domain/events.js';
import { conceptLabel } from '../domain/notes.js';
import { esc } from './utils.js';
import { dayInfo, dayName, dayShort, dayIconClass } from './labels.js';
import { openSheet } from './sheet.js';
import { pedirOExplicar, hasDaysLeft, explainNoDays } from './noDays.js';

/**
 * @param {HTMLElement} container
 */
let lastMenu = null;
let lastDays = null;
let keyListenerBound = false;
let menuOpener = null;

export function renderContextMenu(container) {
  if (!container) return;
  const state = getState();

  if (!keyListenerBound) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && getState().contextMenu) Actions.hideContextMenu();
    });
    keyListenerBound = true;
  }

  if (!state.contextMenu) {
    if (lastMenu) {
      container.innerHTML = '';
      container.style.display = 'none';
      if (menuOpener?.isConnected) menuOpener.focus();
      menuOpener = null;
    }
    lastMenu = null;
    return;
  }

  // Re-render only when the menu or the day's data changes (not on toasts)
  if (state.contextMenu === lastMenu && state.days === lastDays) return;
  if (!lastMenu) menuOpener = document.activeElement;
  lastMenu = state.contextMenu;
  lastDays = state.days;

  const { dateISO, x, y, screenX, screenY } = state.contextMenu;
  const dayData = state.days.find(d => d.dateISO === dateISO);
  const tags = dayData ? dayData.tags : [];
  const hasEvents = tags.length > 0;
  const eventPreview = tags.slice(0, 3);
  const hasLibre = tags.some(t => t.type === 'LIBRE');
  const libreExento = hasLibre && (effectiveConfig(state).libresExentos || []).includes(dateISO);

  container.style.display = 'block';

  // Build event detail section if day has events
  let eventDetailHTML = '';
  if (hasEvents) {
    eventDetailHTML = `<div class="ctx-section">
      <div class="ctx-section-title">Registrado (${tags.length})</div>
      ${eventPreview.map((t, idx) => renderTagSummary(t, idx)).join('')}
      ${tags.length > 3 ? `<button class="ctx-btn ctx-more-events" data-action="view-events" role="menuitem">Ver ${tags.length - 3} evento(s) más</button>` : ''}
      ${hasLibre ? `<p class="ctx-libre-for">${esc(libreAttribution(dateISO, state, libreExento))}</p>` : ''}
    </div>`;
  }

  container.innerHTML = `
    <div class="ctx-overlay" id="ctx-overlay"></div>
    <div class="ctx-menu" role="menu" aria-label="Acciones del día ${formatDMY(dateISO)}" style="top:0;left:0">
      <div class="ctx-header">${formatDMY(dateISO)}</div>
      ${eventDetailHTML}
      ${tags.some(t => t.type === 'JUICIO' || (t.type === 'EVENTO' && eventItems([t]).some(ev => ev.kind === 'JUICIO'))) ? `<div class="ctx-section">
        <div class="ctx-section-title">Juicio</div>
        <button class="ctx-btn" data-action="comp-juicio" role="menuitem">
          <span class="ctx-icon">⚖️</span> Me lo compensan (½ día)…
        </button>
      </div>` : ''}
      ${hasLibre ? `<div class="ctx-section">
        <div class="ctx-section-title">Este libre</div>
        <button class="ctx-btn" data-action="exento" role="menuitem">
          <span class="ctx-icon">🎁</span> ${libreExento ? 'Sí computa (quitar «concedido»)' : 'No computa: día concedido'}
        </button>
      </div>` : ''}
      <div class="ctx-section">
        <div class="ctx-section-title">Guardias</div>
        <button class="ctx-btn" data-action="guardia" role="menuitem">
          <span class="ctx-icon ${dayIconClass('GUARDIA_REAL')}">${dayShort('GUARDIA_REAL')}</span> ${dayName('GUARDIA_REAL')}
        </button>
        <button class="ctx-btn" data-action="plan" role="menuitem">
          <span class="ctx-icon ${dayIconClass('GUARDIA_PLAN')}">${dayShort('GUARDIA_PLAN')}</span> ${dayName('GUARDIA_PLAN')}
        </button>
        <button class="ctx-btn" data-action="pedir" role="menuitem">
          <span class="ctx-icon ${dayIconClass('LIBRE')}">${dayShort('LIBRE')}</span> Pedir días libres
        </button>
      </div>
      <div class="ctx-section">
        <div class="ctx-section-title">Permisos</div>
        <button class="ctx-btn" data-action="ap" role="menuitem">
          <span class="ctx-icon ${dayIconClass('AP')}">${dayShort('AP')}</span> ${dayName('AP')}
        </button>
        <button class="ctx-btn" data-action="vacaciones" role="menuitem">
          <span class="ctx-icon ${dayIconClass('VACACIONES')}">${dayShort('VACACIONES')}</span> ${dayName('VACACIONES')}
        </button>
        <button class="ctx-btn" data-action="baja" role="menuitem">
          <span class="ctx-icon ${dayIconClass('BAJA')}">${dayShort('BAJA')}</span> ${dayName('BAJA')}
        </button>
      </div>
      <div class="ctx-section">
        <div class="ctx-section-title">Turnos / Otros</div>
        <button class="ctx-btn" data-action="manana" role="menuitem">
          <span class="ctx-icon ${dayIconClass('TURNO_M')}">${dayShort('TURNO_M')}</span> ${dayName('TURNO_M')}
        </button>
        <button class="ctx-btn" data-action="tarde" role="menuitem">
          <span class="ctx-icon ${dayIconClass('TURNO_T')}">${dayShort('TURNO_T')}</span> ${dayName('TURNO_T')}
        </button>
        <button class="ctx-btn" data-action="formacion" role="menuitem">
          <span class="ctx-icon ${dayIconClass('FORMACION')}">${dayShort('FORMACION')}</span> ${dayName('FORMACION')}
        </button>
        <button class="ctx-btn" data-action="evento" role="menuitem">
          <span class="ctx-icon ${dayIconClass('EVENTO')}">${dayShort('EVENTO')}</span> ${dayName('EVENTO')}: juicio, tiro, curso…
        </button>
        <button class="ctx-btn" data-action="otros" role="menuitem">
          <span class="ctx-icon ${dayIconClass('OTRO')}">${dayShort('OTRO')}</span> Otros eventos
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
  menu?.querySelector('.ctx-btn[data-action]')?.focus({ preventScroll: true });

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
        // sin días que pedir, se explica por qué y cuándo llegan los siguientes
        case 'pedir':
          pedirOExplicar('libres', () => startPedirDias());
          break;
        case 'ap':
          if (hasDaysLeft('ap')) await markAsuntoPropio(dateISO); else { Actions.hideContextMenu(); explainNoDays('ap'); }
          break;
        case 'vacaciones':
          pedirOExplicar('vac', () => startVacacionesRange(dateISO));
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
        case 'evento':
          openEventSheet(dateISO);
          break;
        case 'exento':
          await toggleLibreExento(dateISO);
          break;
        case 'comp-juicio': {
          const { openAddComp } = await import('./compensaciones.js');
          openAddComp({ fecha: dateISO, concepto: 'juicio' });
          break;
        }
        case 'baja':
          await markBaja(dateISO);
          break;
        case 'otros':
          showOtrosDialog(dateISO);
          break;
        case 'view-events':
          showDayEventsDialog(dateISO, tags);
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
  const mw = Math.min(340, vw - 20);

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


function renderTagSummary(tag, index) {
  const info = dayInfo(tag.type);
  const meta = formatTagMeta(tag);
  return `<div class="ctx-btn ctx-event-info" style="cursor:default;opacity:0.96">
    <span class="ctx-icon ${info.iconCls}">${info.short}</span>
    <span style="flex:1">
      <strong style="font-size:var(--fs-sm)">${index + 1}. ${esc(info.name)}</strong>
      ${meta ? `<br><span style="font-size:var(--fs-xs);color:var(--text-muted)">${esc(meta)}</span>` : ''}
    </span>
  </div>`;
}

/** What a day off is charged to: a guard (and which day of it), another reason, or nothing. */
function libreAttribution(dateISO, state, exento) {
  if (exento) return 'No computa: libre concedido.';
  const m = (state.ledger || []).find(x => x.kind === 'DEBIT' && x.category === 'LIBRE' && x.dateISO === dateISO);
  if (!m) return '';
  if (m.concepto) {
    if (m.compartida) return `Compensa la guardia del ${formatDMY(m.compartida.start)} al ${formatDMY(m.compartida.end)} (figura a nombre de ${displayNameOf(m.compartida.person)}): no gasta tus guardias.`;
    return `Por ${conceptLabel(m.concepto).toLowerCase()}: no gasta días de guardia.`;
  }
  if (!m.sourceRef) return 'No lo cubre ninguna guardia: si fue un día concedido, márcalo como «no computa».';
  const credit = (state.ledger || []).find(c => c.kind === 'CREDIT' && c.category === 'GUARDIA' && c.sourceRef === m.sourceRef && (!m.sourceDate || c.dateISO === m.sourceDate));
  const what = credit?.festivo ? `el festivo del ${formatDMY(credit.dateISO)}` : credit ? `la guardia de la semana del ${formatDMY(credit.dateISO)}` : `la guardia ${m.sourceRef}`;
  return `Compensa ${what}${m.porNota ? ' (según la nota)' : ''}${m.excede ? '; esa guardia ya tenía todos sus días' : ''}.`;
}

function displayNameOf(name) {
  const s = String(name || '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTagMeta(tag) {
  if (!tag.meta) return '';
  if (tag.type === 'EVENTO') return eventItems([tag]).map(ev => `${eventIcon(ev)} ${eventTitle(ev)}${ev.hora ? ' ' + ev.hora : ''}`).join(' · ');
  if (tag.type === 'JUICIO') {
    const juicioParts = [
      tag.meta.hora ? `Hora: ${tag.meta.hora}` : '',
      tag.meta.juzgado ? `Juzgado: ${tag.meta.juzgado}` : '',
      tag.meta.diligencias ? `Diligencias: ${tag.meta.diligencias}` : '',
      tag.meta.notas ? `Notas: ${tag.meta.notas}` : ''
    ].filter(Boolean);
    if (juicioParts.length > 0) return juicioParts.join(' · ');
  }

  let meta = '';
  if (tag.meta.label) meta = tag.meta.label;
  if (tag.meta.guardRef) meta = `Guardia: ${tag.meta.guardRef}`;
  if (tag.meta.ordinal) meta += ` (${tag.meta.ordinal})`;
  if (tag.meta.diasAfectados != null && tag.meta.diasAfectados !== 0) {
    meta += ` · ${tag.meta.diasAfectados > 0 ? '+' : ''}${tag.meta.diasAfectados} días`;
  }
  if (tag.meta.source === 'cuadrante') meta = (meta ? meta + ' · ' : '') + 'Importado';
  if (tag.meta.cambio) meta = (meta ? meta + ' · ' : '') + 'Cambio: la guardia de esa semana es de otra persona (tiene las notas)';
  if (tag.meta.note) meta = (meta ? meta + ' · ' : '') + `Nota del cuadrante: «${tag.meta.note}»`;
  return meta;
}

function showDayEventsDialog(dateISO, tags) {
  openSheet({
    title: `Eventos del ${formatDMY(dateISO)}`,
    body: `<div class="ctx-events-list">${tags.map((t, idx) => renderTagSummary(t, idx)).join('')}</div>`,
    footer: '<button type="button" class="btn btn-primary" data-act="close">Cerrar</button>',
    onMount(root, close) {
      root.querySelector('[data-act="close"]').addEventListener('click', close);
    }
  });
}

function showOtrosDialog(dateISO) {
  openSheet({
    title: 'Otros eventos',
    variant: 'dialog',
    body: `
      <label class="field"><span>Concepto</span>
        <input type="text" id="otros-concepto" placeholder="Ej: comisión, curso…" maxlength="50" autofocus></label>
      <label class="field"><span>Días que suma o resta (+ o −)</span>
        <input type="number" id="otros-dias" value="0" min="-30" max="30"></label>`,
    footer: `
      <button type="button" class="btn" data-act="cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" data-act="ok">Aceptar</button>`,
    onMount(root, close) {
      const concepto = root.querySelector('#otros-concepto');
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      root.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        const text = concepto.value.trim();
        if (!text) {
          Actions.showToast('Escribe el concepto');
          concepto.focus();
          return;
        }
        const dias = parseInt(root.querySelector('#otros-dias').value) || 0;
        close();
        await markOtros(dateISO, text, dias);
      });
    }
  });
}
