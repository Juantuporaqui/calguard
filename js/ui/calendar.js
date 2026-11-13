/**
 * @module ui/calendar
 * Calendar view - dynamic multi-year, month navigation
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import { daysInMonth, firstDayOffset, todayISO, formatISO, isWeekend, getWeekDates, formatDMY, getDateRange, countWorkingDays, detectConflict, formatDM } from '../domain/rules.js';
import { planFreeDayRequest, isWithinYearAfter } from '../domain/reconcile.js';
import { guardsOfYear } from '../domain/balances.js';
import { commitDayChanges, newMovement } from '../domain/changes.js';
import { esc } from './utils.js';
import { confirmDialog, openSheet } from './sheet.js';
import { EVENT_KINDS, eventItems, eventIcon, eventTitle, eventSummary, withEventItems, makeEventItem } from '../domain/events.js';
import { updateActiveProfile } from '../domain/profiles.js';
import { syncNow } from './flows.js';
import { dayName, dayShort, dayClass, dayCellClass, daySlug, BADGE_TYPES, LEGEND_TYPES } from './labels.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Index of the active profile's days, rebuilt once per render (O(1) lookups). */
let dayIndex = new Map();
let exentos = new Set();   // libres concedidos que no computan
function buildDayIndex(state) {
  dayIndex = new Map(state.days.map(d => [d.dateISO, d]));
  exentos = new Set(effectiveConfig(state).libresExentos || []);
}

/**
 * @param {HTMLElement} container
 */
export function renderCalendar(container) {
  const state = getState();
  const { calendarYear: year, calendarMonth: month } = state;
  buildDayIndex(state);

  // Check for range selection mode
  if (state.rangeSelection) {
    renderRangeMode(container, state);
    return;
  }

  // Check for multi-select mode
  if (state.multiSelect && state.multiSelect.active) {
    renderMultiSelectMode(container, state);
    return;
  }

  // View mode: 'week' | 'month' | 'year' (legacy month=-1 means year)
  const view = month < 0 ? 'year' : (state.calendarView || 'month');
  const weekAnchor = state.calendarWeekAnchor || todayISO();
  const weekDates = getWeekDates(weekAnchor);

  let title;
  if (view === 'week') {
    title = `${formatDM(weekDates[0])} – ${formatDM(weekDates[6])} · ${weekDates[0].slice(0, 4)}`;
  } else if (view === 'month') {
    title = `${MONTHS[month]} ${year}`;
  } else {
    title = `${year}`;
  }

  let gridHTML;
  if (view === 'week') gridHTML = renderWeek(weekDates, state);
  else if (view === 'month') gridHTML = renderMonth(year, month, state);
  else gridHTML = renderFullYear(year, state);

  container.innerHTML = `
    <div class="calendar-view">
      <div class="calendar-nav">
        <button class="btn btn-icon" id="prev-month" aria-label="${view === 'week' ? 'Semana anterior' : view === 'month' ? 'Mes anterior' : 'Año anterior'}">&laquo;</button>
        <div class="calendar-title-group">
          <button class="btn btn-icon btn-sm" id="prev-year" aria-label="Año anterior">&lsaquo;</button>
          <h2 class="calendar-title">${title}</h2>
          <button class="btn btn-icon btn-sm" id="next-year" aria-label="Año siguiente">&rsaquo;</button>
        </div>
        <button class="btn btn-icon" id="next-month" aria-label="${view === 'week' ? 'Semana siguiente' : view === 'month' ? 'Mes siguiente' : 'Año siguiente'}">&raquo;</button>
      </div>
      <div class="calendar-actions">
        <div class="view-switcher" role="group" aria-label="Vista del calendario">
          <button class="btn btn-sm ${view === 'week' ? 'btn-primary' : ''}" id="view-week" aria-pressed="${view === 'week'}">Semana</button>
          <button class="btn btn-sm ${view === 'month' ? 'btn-primary' : ''}" id="view-month" aria-pressed="${view === 'month'}">Mes</button>
          <button class="btn btn-sm ${view === 'year' ? 'btn-primary' : ''}" id="view-year" aria-pressed="${view === 'year'}">Año</button>
        </div>
        <button class="btn btn-sm" id="goto-today">Hoy</button>
      </div>
      <div id="calendar-grid-container" class="calendar-grid-container">
        ${gridHTML}
      </div>
      ${renderLegend()}
    </div>
  `;

  // Prev/next: move by week, month or year depending on the active view
  document.getElementById('prev-month')?.addEventListener('click', () => {
    if (view === 'week') {
      Actions.setWeekAnchor(shiftDays(weekAnchor, -7));
    } else if (view === 'year') {
      Actions.setYear(year - 1);
    } else if (month === 0) {
      Actions.setYear(year - 1);
      Actions.setMonth(11);
    } else {
      Actions.setMonth(month - 1);
    }
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    if (view === 'week') {
      Actions.setWeekAnchor(shiftDays(weekAnchor, 7));
    } else if (view === 'year') {
      Actions.setYear(year + 1);
    } else if (month === 11) {
      Actions.setYear(year + 1);
      Actions.setMonth(0);
    } else {
      Actions.setMonth(month + 1);
    }
  });

  document.getElementById('prev-year')?.addEventListener('click', () => Actions.setYear(year - 1));
  document.getElementById('next-year')?.addEventListener('click', () => Actions.setYear(year + 1));

  document.getElementById('goto-today')?.addEventListener('click', () => {
    const now = new Date();
    Actions.setWeekAnchor(todayISO());
    Actions.setYear(now.getFullYear());
    Actions.setMonth(now.getMonth());
  });

  // View switcher
  document.getElementById('view-week')?.addEventListener('click', () => {
    if (month < 0) Actions.setMonth(new Date().getMonth());
    Actions.setCalendarView('week');
  });
  document.getElementById('view-month')?.addEventListener('click', () => {
    if (month < 0) Actions.setMonth(new Date().getMonth());
    Actions.setCalendarView('month');
  });
  document.getElementById('view-year')?.addEventListener('click', () => {
    if (month < 0) Actions.setMonth(new Date().getMonth());
    Actions.setCalendarView('year');
  });

  // One delegated handler for every day cell / week row (mouse + keyboard)
  bindDayActivation(container.querySelector('#calendar-grid-container'), (el, e) => showContextMenu(e, el));

  // Swipe left/right to change period on touch screens
  bindSwipe(container.querySelector('#calendar-grid-container'),
    () => document.getElementById('next-month')?.click(),
    () => document.getElementById('prev-month')?.click());
}

/**
 * Delegated activation for day cells: click, Enter or Space.
 * @param {HTMLElement} root
 * @param {(el: HTMLElement, e: Event) => void} handler
 */
function bindDayActivation(root, handler) {
  if (!root) return;
  const pick = (e) => {
    const el = e.target.closest('.day[data-date], .week-row[data-date]');
    return el && !el.classList.contains('empty') && root.contains(el) ? el : null;
  };
  root.addEventListener('click', (e) => {
    const el = pick(e);
    if (el) handler(el, e);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = pick(e);
    if (!el) return;
    e.preventDefault();
    handler(el, e);
  });
}

/** Horizontal swipe detection (ignores mostly-vertical gestures). */
function bindSwipe(root, onLeft, onRight) {
  if (!root) return;
  let x0 = null, y0 = null;
  root.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = y0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onLeft(); else onRight();
  }, { passive: true });
}

/**
 * Shift an ISO date by n days
 * @param {string} dateISO
 * @param {number} n
 * @returns {string}
 */
function shiftDays(dateISO, n) {
  const d = parseISODate(dateISO);
  d.setDate(d.getDate() + n);
  return formatISO(d);
}

function parseISODate(dateISO) {
  return new Date(dateISO + 'T12:00:00');
}

const WEEKDAYS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Week view: one detailed row per day (tags with full names + services)
 * @param {string[]} weekDates - 7 ISO dates, Monday first
 * @param {Object} state
 */
function renderWeek(weekDates, state) {
  const today = todayISO();
  const dayMap = dayIndex;

  const rows = weekDates.map((dateISO, i) => {
    const tags = dayMap.get(dateISO)?.tags || [];
    const services = (state.services || []).filter(s => s.dateISO === dateISO);
    const weekend = isWeekend(dateISO);
    const isToday = dateISO === today;

    const classes = ['week-row'];
    if (weekend) classes.push('weekend');
    if (isToday) classes.push('today');
    const tagTypes = tags.map(t => t.type);
    for (const type of tagTypes) {
      const cellCls = dayCellClass(type);
      if (cellCls && !classes.includes(cellCls)) classes.push(cellCls);
    }

    const tagChips = tags.filter(t => t.type !== 'EVENTO').map(t => {
      if (t.type === 'LIBRE' && exentos.has(dateISO)) return '<span class="week-tag-chip week-chip-libre">🎁 Libre concedido</span>';
      const label = t.type === 'OTRO' ? (t.meta?.label || dayName('OTRO')) : dayName(t.type);
      return `<span class="week-tag-chip week-chip-${daySlug(t.type)}">${esc(label)}</span>`;
    }).join('') + eventItems(tags).map(ev =>
      `<span class="week-tag-chip week-chip-evento">${eventIcon(ev)} ${esc(eventSummary(ev))}</span>`).join('');

    const serviceLines = services.map(s =>
      `<div class="week-service">${s.startTime ? esc(s.startTime) + ' · ' : ''}${esc(s.type)}${s.locationGeneral ? ' · ' + esc(s.locationGeneral) : ''}</div>`
    ).join('');

    return `
      <div class="${classes.join(' ')}" data-date="${dateISO}" role="button" tabindex="0"
           aria-label="${buildAriaLabel(dateISO, tags)}">
        <div class="week-row-date">
          <span class="week-row-dayname">${WEEKDAYS_LONG[i]}</span>
          <span class="week-row-daynum">${parseInt(dateISO.split('-')[2])}</span>
        </div>
        <div class="week-row-content">
          ${tagChips || '<span class="week-row-empty">—</span>'}
          ${serviceLines}
        </div>
      </div>`;
  }).join('');

  return `<div class="week-view">${rows}</div>`;
}

function renderMonth(year, month, state) {
  const days = daysInMonth(year, month);
  const offset = firstDayOffset(year, month);
  const today = todayISO();

  let html = `<div class="month-block">
    <div class="calendar-grid">
      ${WEEKDAYS.map(d => `<div class="weekday">${d}</div>`).join('')}`;

  for (let i = 0; i < offset; i++) {
    html += '<div class="day empty"></div>';
  }

  for (let d = 1; d <= days; d++) {
    const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    html += renderDayCell(dateISO, today, state);
  }

  html += '</div></div>';
  return html;
}

function renderFullYear(year, state) {
  let html = '<div class="year-grid">';
  for (let m = 0; m < 12; m++) {
    html += `<div class="month-block month-compact">
      <div class="month-name">${MONTHS[m]}</div>
      <div class="calendar-grid compact">
        ${WEEKDAYS.map(d => `<div class="weekday compact">${d}</div>`).join('')}`;

    const days = daysInMonth(year, m);
    const offset = firstDayOffset(year, m);

    for (let i = 0; i < offset; i++) {
      html += '<div class="day empty compact"></div>';
    }

    for (let d = 1; d <= days; d++) {
      const dateISO = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      html += renderDayCell(dateISO, todayISO(), state, true);
    }

    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

function renderDayCell(dateISO, today, state, compact = false) {
  const dayData = dayIndex.get(dateISO);
  const tags = dayData ? dayData.tags : [];
  const weekend = isWeekend(dateISO);
  const isToday = dateISO === today;
  const isPast = dateISO < today;
  const dayNum = parseInt(dateISO.split('-')[2]);

  const classes = ['day'];
  if (compact) classes.push('compact');
  if (weekend) classes.push('weekend');
  if (isToday) classes.push('today');
  if (isPast) classes.push('past');

  // Tag-based classes. A guardia whose week hasn't started yet is shown as
  // "prevista": it doesn't generate free days until its Monday.
  const tagTypes = tags.map(t => t.type);
  const guardWeekStarted = getWeekDates(dateISO)[0] <= today;
  for (const type of tagTypes) {
    const cellCls = type === 'GUARDIA_REAL' && !guardWeekStarted ? dayCellClass('GUARDIA_PLAN') : dayCellClass(type);
    if (cellCls && !classes.includes(cellCls)) classes.push(cellCls);
  }
  const libreExento = tagTypes.includes('LIBRE') && exentos.has(dateISO);
  if (libreExento) classes.push('libre-exento');
  const events = eventItems(tags);
  if (events.length) classes.push('has-evento');
  // Shift classes (for standalone color + diagonal divisions)
  // NOTE: TURNO_M/T are shown as labels only, without coloring the whole day.

  // Labels
  let labels = '';
  if (!compact) {
    for (const type of ['TURNO_M', 'TURNO_T', 'TURNO_N']) {
      if (tagTypes.includes(type)) {
        labels += `<span class="day-label label-${dayShort(type).toLowerCase()}" title="${dayName(type)}">${dayShort(type)}</span>`;
      }
    }
    labels += buildSpecialTagBadges(tags);
    const otroTag = tags.find(t => t.type === 'OTRO');
    if (otroTag && otroTag.meta && otroTag.meta.label) {
      labels += `<span class="day-label label-otro" title="${esc(otroTag.meta.label)}">${esc(dayShort('OTRO'))}</span>`;
    }
  }

  const ariaLabel = buildAriaLabel(dateISO, tags);

  const bubble = events.length
    ? `<span class="day-bubble" title="${esc(events.map(eventSummary).join(' / '))}" aria-hidden="true">${eventIcon(events[0])}${events.length > 1 ? `<b>${events.length}</b>` : ''}</span>`
    : '';
  const gift = libreExento ? '<span class="day-gift" title="Libre concedido: no computa" aria-hidden="true">🎁</span>' : '';

  return `<div class="${classes.join(' ')}" data-date="${dateISO}" role="button" tabindex="0" aria-label="${ariaLabel}${libreExento ? ' (libre concedido, no computa)' : ''}">
    <span class="day-num">${dayNum}</span>
    ${labels}${bubble}${gift}
  </div>`;
}

function buildSpecialTagBadges(tags) {
  const present = new Set(tags.map(t => t.type));
  return BADGE_TYPES
    .filter(type => present.has(type))
    .map(type => `<span class="day-badge day-badge-${daySlug(type)}" title="${dayName(type)}">${dayShort(type)}</span>`)
    .join('');
}

function buildAriaLabel(dateISO, tags) {
  const [y, m, d] = dateISO.split('-');
  let label = `${d}/${m}/${y}`;
  if (tags.length > 0) {
    const tagNames = tags.map(t => {
      if (t.type === 'EVENTO') return eventItems([t]).map(eventTitle).join(', ');
      return dayName(t.type);
    });
    label += ': ' + tagNames.join(', ');
  }
  return label;
}

// ─── Legend ───

function renderLegend() {
  const items = LEGEND_TYPES.map(type => ({ cls: `legend-dot-${dayClass(type)}`, letter: dayShort(type), label: dayName(type) }));
  return `<div class="calendar-legend">${items.map(i =>
    `<span class="legend-item"><span class="legend-dot ${i.cls}">${i.letter}</span>${i.label}</span>`
  ).join('')}</div>`;
}

// ─── Context Menu ───

function showContextMenu(event, el) {
  event.stopPropagation();
  const rect = el.getBoundingClientRect();
  Actions.showContextMenu({
    dateISO: el.dataset.date,
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY,
    // Keyboard activation has no pointer position: anchor to the cell
    screenX: event.clientX || rect.left + rect.width / 2,
    screenY: event.clientY || rect.bottom
  });
}

// ─── Day operations (called from contextMenu) ───

/** Day record with a tag added (replacing a tag of the same type). */
function withTag(dateISO, tag) {
  const prev = dayIndex.get(dateISO) || getState().days.find(d => d.dateISO === dateISO);
  const tags = (prev?.tags || []).filter(t => t.type !== tag.type);
  return { ...(prev || { dateISO }), tags: [...tags, tag] };
}

/**
 * Add a tag to a day (atomic, audited). Shows the conflict and returns false
 * when the tag is not compatible with the day.
 * @param {string} dateISO
 * @param {Object} tag
 * @returns {Promise<boolean>}
 */
export async function addDayTag(dateISO, tag) {
  const prev = getState().days.find(d => d.dateISO === dateISO);
  const conflict = detectConflict(prev?.tags || [], tag.type);
  if (conflict) {
    Actions.showToast(conflict);
    return false;
  }
  await commitDayChanges({
    dayPuts: [withTag(dateISO, tag)],
    audit: { action: 'DAY_TAG_ADD', detail: `${dateISO}: ${tag.type}` }
  });
  return true;
}

/**
 * Add many tags in ONE transaction and ONE render.
 * @param {Array<{dateISO: string, tag: Object}>} items
 * @param {Object} [options]
 * @param {boolean} [options.skipIfHasProtectedTags] - skip days with non-shift tags
 * @returns {Promise<{imported: number, skipped: number, undo: Function|null}>}
 */
export async function addDayTagBatch(items, options = {}) {
  const work = new Map(getState().days.map(d => [d.dateISO, { ...d, tags: [...(d.tags || [])] }]));
  const touched = new Set();
  let imported = 0, skipped = 0;

  for (const { dateISO, tag } of items) {
    const day = work.get(dateISO) || { dateISO, tags: [] };
    if (options.skipIfHasProtectedTags && day.tags.some(t => !['TURNO_M', 'TURNO_T', 'TURNO_N'].includes(t.type))) {
      skipped++;
      continue;
    }
    if (detectConflict(day.tags, tag.type)) { skipped++; continue; }
    day.tags = [...day.tags.filter(t => t.type !== tag.type), tag];
    work.set(dateISO, day);
    touched.add(dateISO);
    imported++;
  }

  if (touched.size === 0) return { imported, skipped, undo: null };
  const undo = await commitDayChanges({
    dayPuts: [...touched].map(iso => work.get(iso)),
    audit: { action: 'DAY_TAG_BATCH', detail: `${imported} etiquetas` }
  });
  return { imported, skipped, undo };
}

/**
 * Remove a specific tag from a day
 * @param {string} dateISO
 * @param {string} tagType
 */
export async function removeDayTag(dateISO, tagType) {
  const prev = getState().days.find(d => d.dateISO === dateISO);
  if (!prev) return;
  await commitDayChanges({ dayPuts: [{ ...prev, tags: prev.tags.filter(t => t.type !== tagType) }] });
}

/**
 * Mark entire week as guard duty (worked). Credits its free days once —
 * marking the same week again never credits twice.
 * @param {string} dateISO - any day in the week
 */
export async function markWeekGuardia(dateISO) {
  const s = getState();
  const weekDates = getWeekDates(dateISO);
  const conflicts = weekDates.filter(wd => detectConflict(dayIndex.get(wd)?.tags || [], 'GUARDIA_REAL'));
  if (conflicts.length) {
    Actions.showToast(`No se puede: hay vacaciones el ${formatDM(conflicts[0])}`);
    return;
  }
  const perGuard = effectiveConfig(s).diasPorGuardia ?? 5;
  const alreadyCredited = s.ledger.some(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && m.dateISO === weekDates[0]);
  const undo = await commitDayChanges({
    dayPuts: weekDates.map(wd => {
      const d = withTag(wd, { type: 'GUARDIA_REAL' });
      return { ...d, tags: d.tags.filter(t => t.type !== 'GUARDIA_PLAN') };
    }),
    movPuts: alreadyCredited ? [] : [newMovement({
      dateISO: weekDates[0], kind: 'CREDIT', category: 'GUARDIA', amount: perGuard,
      sourceRef: `G.${formatDM(weekDates[0])}`,
      note: `Guardia semana del ${formatDM(weekDates[0])}: +${perGuard} días libres`
    })],
    audit: { action: 'GUARDIA', detail: `Semana ${weekDates[0]}` }
  });
  const future = weekDates[0] > todayISO();
  Actions.showToast(
    alreadyCredited ? 'La guardia ya estaba registrada'
      : future ? `Guardia prevista: generará ${perGuard} libres el ${formatDM(weekDates[0])}`
      : `Guardia registrada: +${perGuard} días libres`,
    { onAction: undo }
  );
}

/**
 * Mark entire week as planned guard duty
 * @param {string} dateISO
 */
export async function markWeekGuardiaPlan(dateISO) {
  const weekDates = getWeekDates(dateISO);
  const { undo } = await addDayTagBatch(weekDates.map(wd => ({ dateISO: wd, tag: { type: 'GUARDIA_PLAN' } })));
  Actions.showToast('Guardia prevista marcada', undo ? { onAction: undo } : {});
}

/**
 * Mark as personal matter (asunto propio)
 * @param {string} dateISO
 */
export async function markAsuntoPropio(dateISO) {
  const state = getState();
  if (state.counters.asuntosPropios <= 0) {
    Actions.showToast('Sin asuntos propios disponibles');
    return;
  }
  await addDayTag(dateISO, { type: 'AP' });
  Actions.showToast(`${dayName('AP')} registrado`);
}

/**
 * Start vacation range selection
 * @param {string} startDateISO
 */
export function startVacacionesRange(startDateISO) {
  Actions.setRangeSelection({ type: 'VACACIONES', startDate: startDateISO, endDate: null });
  Actions.hideContextMenu();
  Actions.showToast('Selecciona el último día de vacaciones');
}

/**
 * Start free days multi-select
 */
export function startPedirDias() {
  Actions.setMultiSelect({ active: true, selectedDates: [] });
  Actions.hideContextMenu();
  Actions.showToast('Selecciona los días que quieres librar. Pulsa Confirmar al terminar.');
}

/**
 * Mark shift (morning/afternoon/night)
 * @param {string} dateISO
 * @param {'TURNO_M'|'TURNO_T'|'TURNO_N'} shift
 */
export async function markShift(dateISO, shift) {
  await addDayTag(dateISO, { type: shift });
  Actions.showToast(dayName(shift));
}

/**
 * Mark formation/training
 * @param {string} dateISO
 */
export async function markFormacion(dateISO) {
  await addDayTag(dateISO, { type: 'FORMACION' });
  Actions.showToast('Formación registrada');
}

/**
 * Mark court/citation
 * @param {string} dateISO
 */
export async function markJuicio(dateISO) {
  const existing = getState().days
    .find(d => d.dateISO === dateISO)
    ?.tags?.find(t => t.type === 'JUICIO');

  const popup = document.createElement('div');
  popup.className = 'modal-overlay';
  popup.innerHTML = `
    <div class="modal-card modal-large">
      <h3>Juicio / Citación (${formatDMY(dateISO)})</h3>
      <div class="form-grid">
        <label>Hora
          <input type="time" id="juicio-hora" value="${esc(existing?.meta?.hora || '')}">
        </label>
        <label>Juzgado
          <input type="text" id="juicio-juzgado" maxlength="80" placeholder="Ej: Juzgado de Instrucción nº 3" value="${esc(existing?.meta?.juzgado || '')}">
        </label>
        <label>Diligencias
          <input type="text" id="juicio-diligencias" maxlength="120" placeholder="Ej: Previas 132/2026" value="${esc(existing?.meta?.diligencias || '')}">
        </label>
        <label>Notas
          <textarea id="juicio-notas" rows="3" maxlength="220" placeholder="Observaciones relevantes">${esc(existing?.meta?.notas || '')}</textarea>
        </label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="juicio-save">Guardar</button>
        <button class="btn btn-sm" id="juicio-cancel">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  document.getElementById('juicio-save')?.addEventListener('click', async () => {
    const hora = document.getElementById('juicio-hora').value;
    const juzgado = document.getElementById('juicio-juzgado').value.trim();
    const diligencias = document.getElementById('juicio-diligencias').value.trim();
    const notas = document.getElementById('juicio-notas').value.trim();

    await addDayTag(dateISO, {
      type: 'JUICIO',
      meta: { hora, juzgado, diligencias, notas }
    });
    popup.remove();
    Actions.showToast(`${dayName('JUICIO')} registrado`);
  });
  document.getElementById('juicio-cancel')?.addEventListener('click', () => popup.remove());
}

/**
 * Mark sick leave / family matters
 * @param {string} dateISO
 */
export async function markBaja(dateISO) {
  await addDayTag(dateISO, { type: 'BAJA' });
  Actions.showToast(`${dayName('BAJA')} registrada`);
}

/**
 * Remove all events from a day (with "Deshacer").
 * A guardia is removed for its whole week, unless free days were already
 * charged to it.
 * @param {string} dateISO
 */
export async function removeAllDayEvents(dateISO) {
  const s = getState();
  const dayData = s.days.find(d => d.dateISO === dateISO);
  if (!dayData || dayData.tags.length === 0) {
    Actions.showToast('No hay nada que eliminar');
    return;
  }

  const isGuard = dayData.tags.some(t => t.type === 'GUARDIA_REAL' || t.type === 'GUARDIA_PLAN');
  if (isGuard) {
    const weekDates = getWeekDates(dateISO);
    const credits = s.ledger.filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && m.dateISO === weekDates[0]);
    const charged = s.ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE'
      && credits.some(c => c.sourceRef === m.sourceRef && isWithinYearAfter(c.dateISO, m.dateISO)));
    if (charged.length > 0) {
      Actions.showToast(`No se puede borrar: esta guardia ya tiene ${charged.length} libre(s) cargado(s)`);
      return;
    }
    const dayPuts = weekDates
      .map(wd => s.days.find(d => d.dateISO === wd))
      .filter(Boolean)
      .map(d => ({ ...d, tags: d.tags.filter(t => t.type !== 'GUARDIA_REAL' && t.type !== 'GUARDIA_PLAN') }));
    const undo = await commitDayChanges({
      dayPuts,
      movDeleteIds: credits.map(c => c.id),
      audit: { action: 'GUARDIA_DELETE', detail: `Semana ${weekDates[0]}` }
    });
    Actions.showToast('Guardia eliminada de la semana', { onAction: undo });
    return;
  }

  // Ledger effects of this day: its free-day debit and "otros" adjustments
  const otroLabels = new Set(dayData.tags.filter(t => t.type === 'OTRO' && t.meta?.label).map(t => t.meta.label));
  const movDeleteIds = s.ledger.filter(m => m.dateISO === dateISO && (
    (m.kind === 'DEBIT' && m.category === 'LIBRE' && dayData.tags.some(t => t.type === 'LIBRE')) ||
    (m.category === 'OTROS' && otroLabels.has(m.sourceRef))
  )).map(m => m.id);

  const undo = await commitDayChanges({
    dayPuts: [{ ...dayData, tags: [] }],
    movDeleteIds,
    audit: { action: 'DAY_CLEAR', detail: dateISO }
  });
  Actions.showToast(`Eventos del ${formatDM(dateISO)} eliminados`, { onAction: undo });
}

// ─── Range selection mode ───

function renderRangeMode(container, state) {
  const { rangeSelection } = state;
  const year = state.calendarYear;
  const month = state.calendarMonth >= 0 ? state.calendarMonth : new Date().getMonth();

  container.innerHTML = `
    <div class="calendar-view range-mode">
      <div class="range-banner">
        Selecciona el último día de ${rangeSelection.type === 'VACACIONES' ? 'vacaciones' : 'período'}
        <button class="btn btn-sm btn-danger" id="cancel-range">Cancelar</button>
      </div>
      <div class="calendar-nav">
        <button class="btn btn-icon" id="rm-prev">&laquo;</button>
        <h2 class="calendar-title">${MONTHS[month]} ${year}</h2>
        <button class="btn btn-icon" id="rm-next">&raquo;</button>
      </div>
      <div class="calendar-grid-container">
        ${renderMonth(year, month, state)}
      </div>
    </div>
  `;

  document.getElementById('cancel-range')?.addEventListener('click', () => {
    Actions.setRangeSelection(null);
  });

  document.getElementById('rm-prev')?.addEventListener('click', () => {
    if (month === 0) { Actions.setYear(year - 1); Actions.setMonth(11); }
    else Actions.setMonth(month - 1);
  });
  document.getElementById('rm-next')?.addEventListener('click', () => {
    if (month === 11) { Actions.setYear(year + 1); Actions.setMonth(0); }
    else Actions.setMonth(month + 1);
  });

  container.querySelectorAll('.day[data-date]').forEach(el => {
    if (el.classList.contains('empty')) return;
    el.addEventListener('click', async () => {
      const endDate = el.dataset.date;
      if (endDate < rangeSelection.startDate) {
        Actions.showToast('La fecha final debe ser posterior a la inicial');
        return;
      }

      const range = getDateRange(rangeSelection.startDate, endDate);
      const excludeWeekends = state.config.excludeWeekendsVacation;
      const workDays = excludeWeekends ? countWorkingDays(range) : range.length;

      if (rangeSelection.type === 'VACACIONES') {
        const libres = getState().balances.vacaciones.disponibles;
        if (workDays > libres) {
          Actions.showToast(`Solo te quedan ${Math.max(0, libres)} días de vacaciones (has elegido ${workDays})`);
          return;
        }
      }

      // Confirm
      const ok = await confirmDialog({
        title: rangeSelection.type === 'VACACIONES' ? 'Confirmar vacaciones' : 'Confirmar período',
        message: `${workDays} día(s) del ${formatDMY(rangeSelection.startDate)} al ${formatDMY(endDate)}.`,
        confirmLabel: 'Registrar'
      });
      if (!ok) {
        return;
      }

      const rangeId = crypto.randomUUID();
      const items = range
        .filter(d => !(excludeWeekends && isWeekend(d) && rangeSelection.type === 'VACACIONES'))
        .map(d => ({ dateISO: d, tag: { type: rangeSelection.type, meta: { rangeId } } }));
      const { imported, skipped, undo } = await addDayTagBatch(items);

      Actions.setRangeSelection(null);
      Actions.showToast(
        `${rangeSelection.type === 'VACACIONES' ? dayName('VACACIONES') : 'Período'}: ${imported} días${skipped ? ` · ${skipped} omitidos por conflicto` : ''}`,
        undo ? { onAction: undo } : {}
      );
    });
  });
}

// ─── Multi-select mode (pedir días libres) ───

function renderMultiSelectMode(container, state) {
  const { multiSelect } = state;
  const year = state.calendarYear;
  const month = state.calendarMonth >= 0 ? state.calendarMonth : new Date().getMonth();

  container.innerHTML = `
    <div class="calendar-view multi-select-mode">
      <div class="range-banner pedir-banner" role="status">
        <span class="pedir-text">
          <strong>Pedir días libres</strong>
          <small>${multiSelect.selectedDates.length} elegido${multiSelect.selectedDates.length === 1 ? '' : 's'} · tienes ${state.balances.libres.disponibles} disponible${state.balances.libres.disponibles === 1 ? '' : 's'}</small>
        </span>
        <button type="button" class="btn btn-sm" id="cancel-multi">Cancelar</button>
        <button type="button" class="btn btn-sm btn-primary" id="confirm-multi" ${multiSelect.selectedDates.length ? '' : 'disabled'}>Confirmar</button>
      </div>
      <div class="calendar-nav">
        <button class="btn btn-icon" id="ms-prev">&laquo;</button>
        <h2 class="calendar-title">${MONTHS[month]} ${year}</h2>
        <button class="btn btn-icon" id="ms-next">&raquo;</button>
      </div>
      <div class="calendar-grid-container">
        ${renderMonth(year, month, state)}
      </div>
    </div>
  `;

  // Highlight selected days
  for (const d of multiSelect.selectedDates) {
    const el = container.querySelector(`.day[data-date="${d}"]`);
    if (el) el.classList.add('multi-selected');
  }

  document.getElementById('cancel-multi')?.addEventListener('click', () => {
    Actions.setMultiSelect(null);
  });

  document.getElementById('ms-prev')?.addEventListener('click', () => {
    if (month === 0) { Actions.setYear(year - 1); Actions.setMonth(11); }
    else Actions.setMonth(month - 1);
  });
  document.getElementById('ms-next')?.addEventListener('click', () => {
    if (month === 11) { Actions.setYear(year + 1); Actions.setMonth(0); }
    else Actions.setMonth(month + 1);
  });

  container.querySelectorAll('.day[data-date]').forEach(el => {
    if (el.classList.contains('empty')) return;
    el.addEventListener('click', () => {
      const dateISO = el.dataset.date;
      const selected = [...multiSelect.selectedDates];
      const idx = selected.indexOf(dateISO);
      if (idx >= 0) {
        selected.splice(idx, 1);
        el.classList.remove('multi-selected');
      } else {
        selected.push(dateISO);
        el.classList.add('multi-selected');
      }
      Actions.setMultiSelect({ active: true, selectedDates: selected });
    });
  });

  document.getElementById('confirm-multi')?.addEventListener('click', async () => {
    const s = getState();
    const dates = multiSelect.selectedDates;
    if (dates.length === 0) {
      Actions.showToast('No has seleccionado ningún día');
      return;
    }

    const L = s.balances.libres;
    const thisYearUnassigned = s.ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE'
      && (m.sourceRef === 'ARRASTRE' || !m.sourceRef) && m.dateISO?.startsWith(String(s.balances.year))).length;
    const cfgNow = effectiveConfig(s);
    // in order: the oldest guard still open (closed ones are not owed any more);
    // last year's carried guards are among them when the cuadrante gives the carry
    const open = guardsOfYear(s.ledger, s.balances.year, cfgNow.diasPorGuardia ?? 5, todayISO(), cfgNow.libresExentos || [])
      .filter(t => t.worked && !t.cerrada && t.total - t.used > 0);
    const plan = planFreeDayRequest({
      dates,
      days: s.days,
      ledger: s.ledger,
      available: L.disponibles,
      carryFree: L.arrastreAuto ? 0 : Math.max(0, L.arrastreRestante - thisYearUnassigned),
      today: todayISO(),
      daysPerGuard: cfgNow.diasPorGuardia ?? 5,
      slots: open
    });

    if (!plan.ok) {
      Actions.showToast(`Solo tienes ${Math.max(0, plan.available)} libres disponibles hoy y has elegido ${plan.requested}`);
      return;
    }
    if (plan.assignments.length === 0) {
      Actions.showToast(plan.conflicts.length ? plan.conflicts[0].reason : 'Esos días ya estaban pedidos');
      return;
    }

    const dayPuts = plan.assignments.map(a => {
      const prev = dayIndex.get(a.date);
      const tags = (prev?.tags || []).filter(t => t.type !== 'LIBRE');
      return { ...(prev || { dateISO: a.date }), tags: [...tags, { type: 'LIBRE', meta: { guardRef: a.guardRef, ordinal: a.ordinal } }] };
    });
    const movPuts = plan.assignments.map(a => newMovement({
      dateISO: a.date, kind: 'DEBIT', category: 'LIBRE', amount: -1, sourceRef: a.guardRef, ...(a.guardDate ? { sourceDate: a.guardDate } : {}),
      note: `Libre ${formatDM(a.date)} · ${a.ordinal}${a.guardRef !== 'ARRASTRE' ? ' ' + a.guardRef : ''}`
    }));
    const undo = await commitDayChanges({
      dayPuts, movPuts,
      audit: { action: 'LIBRES_PEDIDOS', detail: plan.assignments.map(a => a.date).join(', ') }
    });
    Actions.setMultiSelect(null);

    const skipped = plan.already.length + plan.conflicts.length;
    let closeSheet = null;
    const undoAll = async () => {
      closeSheet?.();
      if (await undo() !== null) Actions.showToast('Petición deshecha');
    };
    const n = plan.assignments.length;
    Actions.showToast(`${n} ${n === 1 ? 'libre pedido' : 'libres pedidos'}${skipped ? ` · ${skipped} omitido(s)` : ''}`, { onAction: undoAll });
    closeSheet = showSharePopup(generatePedirDiasMsg(plan.assignments), undoAll);
  });
}

function generatePedirDiasMsg(assignments) {
  let msg = 'Solicito librar los siguientes días:\n';
  for (const a of assignments) {
    const ref = a.guardRef === 'ARRASTRE' ? 'año anterior' : `${a.ordinal} ${a.guardRef}`;
    msg += `• ${formatDMY(a.date)} (${ref})\n`;
  }
  msg += '\nGracias.';
  return msg;
}

/**
 * After asking for days: the ready-to-send request, with copy / share and
 * an undo that stays at hand while the sheet is open.
 */
function showSharePopup(msg, undo) {
  return openSheet({
    title: 'Días pedidos',
    body: `
      <p class="sheet-hint">Ya están descontados de tu saldo. Envía la solicitud a tu responsable:</p>
      <textarea class="message-box" readonly rows="7">${esc(msg)}</textarea>`,
    footer: `
      ${undo ? '<button type="button" class="btn" data-act="undo">Deshacer</button>' : ''}
      <button type="button" class="btn" data-act="copy">Copiar</button>
      <button type="button" class="btn btn-primary" data-act="share">Compartir</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="copy"]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(msg);
          Actions.showToast('Copiado al portapapeles');
        } catch {
          root.querySelector('textarea').select();
          Actions.showToast('Selecciona el texto y cópialo');
        }
      });
      root.querySelector('[data-act="share"]').addEventListener('click', async () => {
        if (navigator.share) {
          try { await navigator.share({ text: msg }); } catch { /* cancelled */ }
        } else {
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        }
      });
      root.querySelector('[data-act="undo"]')?.addEventListener('click', () => undo());
    }
  });
}

/**
 * Mark "otros eventos" with concept and days impact
 * @param {string} dateISO
 * @param {string} concept
 * @param {number} daysImpact
 */
export async function markOtros(dateISO, concept, daysImpact) {
  const movPuts = daysImpact !== 0 ? [newMovement({
    dateISO, kind: daysImpact >= 0 ? 'CREDIT' : 'DEBIT', category: 'OTROS', amount: daysImpact,
    sourceRef: concept, note: `${concept}: ${daysImpact >= 0 ? '+' : ''}${daysImpact} días`
  })] : [];
  const undo = await commitDayChanges({
    dayPuts: [withTag(dateISO, { type: 'OTRO', meta: { label: concept, diasAfectados: daysImpact } })],
    movPuts,
    audit: { action: 'OTRO', detail: `${dateISO}: ${concept} (${daysImpact})` }
  });
  Actions.showToast(`${concept}: ${daysImpact >= 0 ? '+' : ''}${daysImpact} días`, { onAction: undo });
}

// ─── Eventos especiales (juicio, tiro, curso…) ───

async function saveDayEvents(dateISO, items, message) {
  const prev = getState().days.find(d => d.dateISO === dateISO);
  const tags = withEventItems(prev?.tags || [], items);
  const undo = await commitDayChanges({
    dayPuts: [{ ...(prev || {}), dateISO, tags }],
    audit: { action: 'EVENTOS_DIA', detail: `${dateISO}: ${items.map(eventTitle).join(', ')}` }
  });
  Actions.showToast(message, { onAction: undo });
}

/**
 * Sheet to add (and remove) special events of a day: juicio, tiro, curso,
 * reunión… Shown on the calendar as a little speech bubble.
 * @param {string} dateISO
 * @param {string} [presetKind]
 */
export function openEventSheet(dateISO, presetKind = 'JUICIO') {
  const items = eventItems(getState().days.find(d => d.dateISO === dateISO)?.tags || []);
  openSheet({
    title: `Eventos · ${formatDMY(dateISO)}`,
    body: `
      ${items.length ? `<ul class="ev-list">${items.map(ev => `
        <li class="ev-item"><span class="ev-ico" aria-hidden="true">${eventIcon(ev)}</span>
          <span class="ev-text"><strong>${esc(eventTitle(ev))}</strong><small>${esc([ev.hora, ev.lugar, ev.nota].filter(Boolean).join(' · '))}</small></span>
          <button type="button" class="btn btn-icon btn-sm" data-del="${esc(ev.id)}" aria-label="Quitar ${esc(eventTitle(ev))}">✕</button></li>`).join('')}</ul>` : ''}
      <div class="ev-kinds" role="radiogroup" aria-label="Tipo de evento">
        ${Object.entries(EVENT_KINDS).map(([k, v]) => `
          <label class="ev-kind"><input type="radio" name="ev-kind" value="${k}" ${k === presetKind ? 'checked' : ''}><span>${v.icon} ${v.label}</span></label>`).join('')}
      </div>
      <label class="field"><span>Título (opcional)</span><input type="text" id="ev-title" maxlength="60" placeholder="Ej.: Juicio rápido, Tiro trimestral…"></label>
      <div class="form-grid two">
        <label class="field"><span>Hora</span><input type="time" id="ev-hora"></label>
        <label class="field"><span>Lugar</span><input type="text" id="ev-lugar" maxlength="60" placeholder="Juzgado, galería de tiro…"></label>
      </div>
      <label class="field"><span>Nota</span><input type="text" id="ev-nota" maxlength="140" placeholder="Diligencias, qué llevar…"></label>`,
    footer: `
      <button type="button" class="btn" data-act="close">Cerrar</button>
      <button type="button" class="btn btn-primary" data-act="add">Añadir evento</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="close"]').addEventListener('click', close);
      root.querySelector('[data-act="add"]').addEventListener('click', async () => {
        const item = makeEventItem({
          kind: root.querySelector('input[name="ev-kind"]:checked')?.value,
          title: root.querySelector('#ev-title').value,
          hora: root.querySelector('#ev-hora').value,
          lugar: root.querySelector('#ev-lugar').value,
          nota: root.querySelector('#ev-nota').value
        });
        close();
        await saveDayEvents(dateISO, [...items, item], `${eventIcon(item)} ${eventTitle(item)} el ${formatDMY(dateISO)}`);
      });
      root.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
        const gone = items.find(ev => ev.id === btn.dataset.del);
        close();
        await saveDayEvents(dateISO, items.filter(ev => ev.id !== btn.dataset.del), `Quitado: ${eventTitle(gone)}`);
      }));
    }
  });
}

// ─── Libres concedidos que no computan ───

/**
 * Mark / unmark a free day as granted ("regalo de la jefa"): it stays on the
 * calendar but is not charged to any guard nor to the balance. Re-plans the
 * accounting so later free days are charged correctly.
 * @param {string} dateISO
 */
export async function toggleLibreExento(dateISO) {
  const s = getState();
  const set = new Set(effectiveConfig(s).libresExentos || []);
  const making = !set.has(dateISO);
  if (making) set.add(dateISO); else set.delete(dateISO);
  await updateActiveProfile({ settings: { libresExentos: [...set].sort() } });

  if (making) {
    const ids = getState().ledger
      .filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && m.dateISO === dateISO)
      .map(m => m.id);
    if (ids.length) await commitDayChanges({ movDeleteIds: ids, audit: { action: 'LIBRE_CONCEDIDO', detail: dateISO } });
  }
  if (s.activeProfile?.cuadranteName) {
    await syncNow();
  } else if (!making) {
    await commitDayChanges({
      movPuts: [newMovement({ dateISO, kind: 'DEBIT', category: 'LIBRE', amount: -1, sourceRef: '', note: `Libre ${formatDM(dateISO)}` })],
      audit: { action: 'LIBRE_COMPUTA', detail: dateISO }
    });
  }
  Actions.showToast(making
    ? `🎁 El libre del ${formatDMY(dateISO)} queda como concedido: no computa`
    : `El libre del ${formatDMY(dateISO)} vuelve a computar`);
}
