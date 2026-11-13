/**
 * @module ui/calendar/views
 * Cómo se pinta el calendario: cabecera «‹ Mes Año ›», vistas de mes, semana
 * y año, la leyenda plegable y el manejo de la rejilla (toques, flechas del
 * teclado y deslizar de lado). Cada día es un <button> dentro de role="grid".
 */

import { daysInMonth, firstDayOffset, todayISO, isWeekend, getWeekDates } from '../../domain/rules.js';
import { effectiveConfig } from '../../state/store.js';
import { eventItems, eventIcon, eventTitle, eventSummary } from '../../domain/events.js';
import { esc } from '../utils.js';
import { dayName, dayShort, dayClass, dayCellClass, daySlug, dayCodeTypes, LEGEND_TYPES } from '../labels.js';
import { MONTHS, keyTarget } from './grid.js';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Días del perfil activo por fecha (se rehace en cada pintado). */
let dayIndex = new Map();
let exentos = new Set();   // libres concedidos que no computan
export function buildDayIndex(state) {
  dayIndex = new Map(state.days.map(d => [d.dateISO, d]));
  exentos = new Set(effectiveConfig(state).libresExentos || []);
}

const pad = (n) => String(n).padStart(2, '0');

// ─── Cabecera ───

/**
 * «‹ Noviembre 2026 ›» (el título se toca para elegir mes y año), «Hoy» y
 * Semana / Mes / Año. En los modos de selección no se cambia de vista.
 */
export function headerHTML({ view, title, selecting }) {
  const unit = view === 'week' ? 'Semana' : view === 'year' ? 'Año' : 'Mes';
  return `
    <div class="calendar-nav">
      <button type="button" class="btn btn-icon cal-step" id="cal-prev" aria-label="${unit} anterior">‹</button>
      <button type="button" class="calendar-title-btn" id="cal-title" aria-haspopup="dialog" aria-label="${esc(title)}: elegir mes y año">
        <span class="calendar-title">${esc(title)}</span><span class="cal-title-caret" aria-hidden="true">▾</span>
      </button>
      <button type="button" class="btn btn-icon cal-step" id="cal-next" aria-label="${view === 'week' ? 'Semana siguiente' : view === 'year' ? 'Año siguiente' : 'Mes siguiente'}">›</button>
    </div>
    <div class="calendar-actions">
      ${selecting ? '' : `
      <div class="view-switcher" role="group" aria-label="Vista del calendario">
        <button type="button" class="btn btn-sm ${view === 'week' ? 'btn-primary' : ''}" id="view-week" aria-pressed="${view === 'week'}">Semana</button>
        <button type="button" class="btn btn-sm ${view === 'month' ? 'btn-primary' : ''}" id="view-month" aria-pressed="${view === 'month'}">Mes</button>
        <button type="button" class="btn btn-sm ${view === 'year' ? 'btn-primary' : ''}" id="view-year" aria-pressed="${view === 'year'}">Año</button>
      </div>`}
      <button type="button" class="btn btn-sm" id="goto-today">Hoy</button>
    </div>`;
}

// ─── Celdas ───

function ariaLabel(dateISO, tags, today) {
  const d = new Date(dateISO + 'T12:00:00');
  let label = `${WEEKDAYS_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
  if (dateISO === today) label = `Hoy, ${label}`;
  if (tags.length) {
    label += ': ' + tags.map(t => (t.type === 'EVENTO' ? eventItems([t]).map(eventTitle).join(', ') : t.type === 'OTRO' && t.meta?.label ? t.meta.label : dayName(t.type))).join(', ');
  }
  if (tags.some(t => t.type === 'LIBRE') && exentos.has(dateISO)) label += ' (libre concedido, no computa)';
  return label;
}

/** Letras del día, siempre en el mismo sitio (debajo del número); dos si hay dos cosas. */
function codesHTML(tags, dateISO, today, max) {
  const guardStarted = getWeekDates(dateISO)[0] <= today;
  // caben `max` etiquetas: si hay más cosas, la primera letra y «+N» con el resto
  const all = dayCodeTypes(tags.filter(t => t.type !== 'EVENTO'), 99).shown;
  if (!all.length) return '';
  const shown = all.length > max ? all.slice(0, Math.max(1, max - 1)) : all;
  const more = all.length - shown.length;
  return `<span class="day-codes" aria-hidden="true">${shown.map(type => {
    const t = type === 'GUARDIA_REAL' && !guardStarted ? 'GUARDIA_PLAN' : type;
    return `<i class="day-code mini-${dayClass(t)}">${dayShort(t)}</i>`;
  }).join('')}${more ? `<i class="day-code day-code-more">+${more}</i>` : ''}</span>`;
}

/**
 * Una celda de la rejilla con su botón.
 * @param {{compact?: boolean, selected?: boolean, inRange?: boolean}} opts
 */
function dayCellHTML(dateISO, today, opts = {}) {
  const tags = dayIndex.get(dateISO)?.tags || [];
  const classes = ['day'];
  if (opts.compact) classes.push('compact');
  if (isWeekend(dateISO)) classes.push('weekend');
  if (dateISO === today) classes.push('today');
  if (dateISO < today) classes.push('past');
  // una guardia cuya semana aún no ha empezado se ve como «prevista»
  const guardStarted = getWeekDates(dateISO)[0] <= today;
  for (const t of tags) {
    const cls = t.type === 'GUARDIA_REAL' && !guardStarted ? dayCellClass('GUARDIA_PLAN') : dayCellClass(t.type);
    if (cls && !classes.includes(cls)) classes.push(cls);
  }
  const exento = tags.some(t => t.type === 'LIBRE') && exentos.has(dateISO);
  if (exento) classes.push('libre-exento');
  const events = eventItems(tags);
  if (events.length) classes.push('has-evento');
  if (opts.selected) classes.push('multi-selected');
  if (opts.inRange) classes.push('in-range');

  const bubble = events.length && !opts.compact
    ? `<span class="day-bubble" title="${esc(events.map(eventSummary).join(' / '))}" aria-hidden="true">${eventIcon(events[0])}${events.length > 1 ? `<b>${events.length}</b>` : ''}</span>`
    : '';
  const gift = exento && !opts.compact ? '<span class="day-gift" aria-hidden="true">🎁</span>' : '';
  return `<div role="gridcell" class="cal-cell" ${opts.selected || opts.inRange ? 'aria-selected="true"' : ''}>
    <button type="button" class="${classes.join(' ')}" data-date="${dateISO}" tabindex="-1" aria-label="${esc(ariaLabel(dateISO, tags, today))}" ${dateISO === today ? 'aria-current="date"' : ''}>
      <span class="day-num">${Number(dateISO.slice(8))}</span>
      ${codesHTML(tags, dateISO, today, opts.compact ? 1 : 2)}${bubble}${gift}
    </button>
  </div>`;
}

const emptyCell = (compact) => `<div role="gridcell" class="cal-cell"><span class="day empty ${compact ? 'compact' : ''}" aria-hidden="true"></span></div>`;

/** Un mes como rejilla: fila de cabecera y una fila por semana. */
function monthGridHTML(year, month, today, { compact = false, selected = new Set(), range = null } = {}) {
  const days = daysInMonth(year, month);
  const offset = firstDayOffset(year, month);
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(emptyCell(compact));
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    cells.push(dayCellHTML(iso, today, { compact, selected: selected.has(iso), inRange: Boolean(range && iso >= range[0] && iso <= range[1]) }));
  }
  while (cells.length % 7) cells.push(emptyCell(compact));
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(`<div role="row" class="cal-row">${cells.slice(i, i + 7).join('')}</div>`);
  return `
    <div class="calendar-grid ${compact ? 'compact' : ''}" role="grid" aria-label="${MONTHS[month]} ${year}">
      <div role="row" class="cal-row">${WEEKDAYS.map((w, i) => `<div role="columnheader" class="weekday ${compact ? 'compact' : ''}" aria-label="${WEEKDAYS_LONG[i]}">${w}</div>`).join('')}</div>
      ${rows.join('')}
    </div>`;
}

export function monthHTML(year, month, opts = {}) {
  return `<div class="month-block">${monthGridHTML(year, month, todayISO(), opts)}</div>`;
}

export function yearHTML(year) {
  const today = todayISO();
  let html = '<div class="year-grid">';
  for (let m = 0; m < 12; m++) {
    html += `<div class="month-block month-compact"><div class="month-name">${MONTHS[m]}</div>${monthGridHTML(year, m, today, { compact: true })}</div>`;
  }
  return html + '</div>';
}

/** Vista semana: una fila por día con los nombres completos y los servicios. */
export function weekHTML(weekDates, services = []) {
  const today = todayISO();
  const rows = weekDates.map((dateISO, i) => {
    const tags = dayIndex.get(dateISO)?.tags || [];
    const classes = ['week-row'];
    if (isWeekend(dateISO)) classes.push('weekend');
    if (dateISO === today) classes.push('today');
    for (const t of tags) {
      const cls = dayCellClass(t.type);
      if (cls && !classes.includes(cls)) classes.push(cls);
    }
    const chips = tags.filter(t => t.type !== 'EVENTO').map(t => {
      if (t.type === 'LIBRE' && exentos.has(dateISO)) return '<span class="week-tag-chip week-chip-libre">🎁 Libre concedido</span>';
      const label = t.type === 'OTRO' ? (t.meta?.label || dayName('OTRO')) : dayName(t.type);
      return `<span class="week-tag-chip week-chip-${daySlug(t.type)}"><b class="week-chip-code" aria-hidden="true">${dayShort(t.type)}</b> ${esc(label)}</span>`;
    }).join('') + eventItems(tags).map(ev => `<span class="week-tag-chip week-chip-evento">${eventIcon(ev)} ${esc(eventSummary(ev))}</span>`).join('');
    const svc = services.filter(s => s.dateISO === dateISO).map(s =>
      `<span class="week-service">${s.startTime ? esc(s.startTime) + ' · ' : ''}${esc(s.type)}${s.locationGeneral ? ' · ' + esc(s.locationGeneral) : ''}</span>`).join('');
    return `<div role="row" class="cal-row-week"><div role="gridcell" class="cal-cell-week">
      <button type="button" class="${classes.join(' ')}" data-date="${dateISO}" tabindex="-1" aria-label="${esc(ariaLabel(dateISO, tags, today))}" ${dateISO === today ? 'aria-current="date"' : ''}>
        <span class="week-row-date"><span class="week-row-dayname">${WEEKDAYS_LONG[i]}</span><span class="week-row-daynum">${Number(dateISO.slice(8))}</span></span>
        <span class="week-row-content">${chips || '<span class="week-row-empty">—</span>'}${svc}</span>
      </button></div></div>`;
  }).join('');
  return `<div class="week-view" role="grid" aria-label="Semana">${rows}</div>`;
}

// ─── Leyenda ───

/** Leyenda de colores y letras, plegada; sale de labels.js. */
export function legendHTML(open = false) {
  return `<details class="calendar-legend-wrap" id="cal-legend" ${open ? 'open' : ''}>
    <summary>Qué significa cada color</summary>
    <div class="calendar-legend">${LEGEND_TYPES.map(type => `
      <span class="legend-item"><i class="day-code mini-${dayClass(type)}" aria-hidden="true">${dayShort(type)}</i>${dayName(type)}</span>`).join('')}
    </div>
  </details>`;
}

// ─── Rejilla: toques, teclado, deslizar ───

const DAY_SELECTOR = 'button.day[data-date], button.week-row[data-date]';

/** Deja un solo día con tabindex=0 (el resto se alcanza con las flechas). */
export function setRovingFocus(root, iso, { focus = false } = {}) {
  if (!root) return;
  const buttons = [...root.querySelectorAll(DAY_SELECTOR)];
  if (!buttons.length) return;
  const target = buttons.find(b => b.dataset.date === iso)
    || buttons.find(b => b.dataset.date === todayISO())
    || buttons[0];
  for (const b of buttons) b.tabIndex = b === target ? 0 : -1;
  if (focus) target.focus({ preventScroll: false });
}

/**
 * @param {HTMLElement} root - contenedor de la rejilla
 * @param {{view: string, onActivate: (iso: string, el: HTMLElement) => void, onOutside: (iso: string) => void}} o
 *   onOutside: la tecla lleva a un día que no está pintado (otro mes, semana o año)
 */
export function bindGrid(root, { view, onActivate, onOutside }) {
  if (!root) return;
  root.addEventListener('click', (e) => {
    const el = e.target.closest(DAY_SELECTOR);
    if (el && root.contains(el)) onActivate(el.dataset.date, el);
  });
  root.addEventListener('keydown', (e) => {
    const el = e.target.closest(DAY_SELECTOR);
    if (!el || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = keyTarget(el.dataset.date, e.key, view);
    if (!target) return;
    e.preventDefault();
    const btn = root.querySelector(`[data-date="${target}"]:is(button.day, button.week-row)`);
    if (btn) setRovingFocus(root, target, { focus: true });
    else onOutside(target);
  });
}

/** Deslizar de lado para cambiar de periodo (ignora gestos casi verticales). */
export function bindSwipe(root, onLeft, onRight) {
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
