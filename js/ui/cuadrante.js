/**
 * @module ui/cuadrante
 * Cuadrante del grupo: quién trabaja cada día y de qué, con la plantilla
 * actual (escalafón). Tocar a un compañero abre su ficha: ver su
 * contabilidad con un toque, o vincularlo a tu perfil.
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import {
  loadGroupCuadrante, importGroupCuadranteFile, clearGroupCuadrante,
  canonicalPerson, currentRoster, notesCount
} from '../domain/groupCuadrante.js';
import { autoSyncIfStale } from '../domain/cuadranteSync.js';
import { displayName } from '../domain/profiles.js';
import { openPersonAccounting, syncNow, avatarHTML, becomeMe, myProfile, askWhoAmIIfNeeded, canPublish, publishSharedCuadrante } from './flows.js';
import { openSheet, confirmDialog } from './sheet.js';
import { getWeekDates, todayISO } from '../domain/rules.js';
import { classifyIncWeeks } from '../domain/reconcile.js';
import { esc } from './utils.js';
import { icon } from './icons.js';
import { emptyStateFor, emptyHTML, bindEmpty } from './emptyStates.js';
import { askGroupPassword } from './onboarding.js';
import { getGroupPassword } from '../domain/sharedCuadrante.js';
import { dayName, dayCqClass } from './labels.js';
import {
  cqCode, defaultView, orderRoster, filterRoster, listDates, addDays, guardsByWeek,
  whoListHTML, statusText, indexCuadrante
} from './cuadranteView.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** Casilla del cuadrante por tipo: abreviatura (GU, AP, CUR…) de cuadranteView.js, color de labels.js. */
const CODE = Object.fromEntries(
  ['GUARDIA_REAL', 'GUARDIA_PLAN', 'LIBRE', 'VACACIONES', 'AP', 'TURNO_M', 'TURNO_T', 'TURNO_N', 'FORMACION', 'JUICIO', 'BAJA', 'OTRO']
    .map(t => [t, { s: cqCode(t).code, one: cqCode(t).one, cls: dayCqClass(t), label: cqCode(t).name }])
);
/** Which code wins when a person has several on the same day. */
const PRIORITY = ['GUARDIA_REAL', 'VACACIONES', 'LIBRE', 'AP', 'BAJA', 'JUICIO', 'FORMACION', 'GUARDIA_PLAN', 'TURNO_N', 'TURNO_T', 'TURNO_M', 'OTRO'];

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let cache = null; // group cuadrante data (invalidated on import/clear)
let selectedDay = null; // day shown in the top card (null = today)
let viewMode = readViewMode(); // 'list' | 'month' | 'week'
let weekAnchor = null;         // a day in the visible week (null = this week)
let listStart = null;          // primer día de la lista (null = hoy)
let query = '';                // filtro por persona

/** La vista que se guardó; si no hay ninguna, lista en el móvil y mes en pantallas grandes. */
function readViewMode() {
  let saved = null;
  try { saved = localStorage.getItem('calguard-cq-view'); } catch { /* modo privado */ }
  return defaultView(saved, typeof window !== 'undefined' ? window.innerWidth : 1024);
}

/** Cuándo se comprobó por última vez el cuadrante publicado (lo apunta flows.js). */
function lastCheckAt() {
  try { return localStorage.getItem('calguard-cq-checked'); } catch { return null; }
}
function saveViewMode(mode) {
  try { localStorage.setItem('calguard-cq-view', mode); } catch { /* private mode */ }
}

function monthDates(year, month) {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`);
}

function pad(n) { return String(n).padStart(2, '0'); }
function agoText(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
}

const indexEntries = indexCuadrante;

function mainCode(types = []) {
  return [...types].sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0];
}

const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ABSENT = ['VACACIONES', 'LIBRE', 'AP', 'BAJA'];

function weekTitle(dates) {
  const a = new Date(dates[0] + 'T12:00:00'), b = new Date(dates[6] + 'T12:00:00');
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
}

function shiftWeek(mondayISO, weeks) {
  const d = new Date(mondayISO + 'T12:00:00');
  d.setDate(d.getDate() + 7 * weeks);
  return getWeekDates(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

/** Top card: who is on guard that week and what everyone does that day. */
function dayCardHTML(iso, idx, roster, today) {
  const at = p => idx.get(p)?.get(iso) || [];
  const week = getWeekDates(iso);
  const guardIn = days => roster.filter(p => days.some(d => idx.get(p)?.get(d)?.includes('GUARDIA_REAL')));
  const absent = roster.filter(p => at(p).some(t => ABSENT.includes(t)));
  const notAbsent = p => !absent.includes(p);
  const by = type => roster.filter(p => notAbsent(p) && at(p).includes(type));
  const others = roster.filter(p => notAbsent(p) && at(p).some(t => t === 'JUICIO' || t === 'FORMACION'));
  const noData = roster.filter(p => at(p).length === 0);
  const chips = (list, cls, suffix) => list.length
    ? list.map(p => `<span class="person-chip ${cls}">${esc(displayName(p))}${suffix ? suffix(p) : ''}</span>`).join('')
    : '<span class="muted">—</span>';
  const row = (label, html, show = true) => show ? `<div class="cq-today-row"><span class="cq-today-label">${label}</span><div>${html}</div></div>` : '';
  const absentCode = p => { const t = at(p).find(x => ABSENT.includes(x)); return ` <b class="chip-code">${CODE[t]?.s || ''}</b>`; };
  const d = new Date(iso + 'T12:00:00');
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const dayText = `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  const isToday = iso === today;
  return `
    <div class="cq-day-head">
      <strong>${isToday ? `Hoy · ${dayText}` : dayText.charAt(0).toUpperCase() + dayText.slice(1)}</strong>
      ${isToday ? '<span class="muted">Toca un día del cuadrante para verlo</span>' : '<button type="button" class="link-btn" id="cq-back-today">Volver a hoy</button>'}
    </div>
    ${row('Guardia esa semana', chips(guardIn(week), 'chip-guardia'))}
    ${row('Semana siguiente', chips(guardIn(shiftWeek(week[0], 1)), 'chip-guardia'), isToday)}
    ${row('Guardia ese día', chips(by('GUARDIA_REAL'), 'chip-guardia'), by('GUARDIA_REAL').length > 0)}
    ${row(dayName('TURNO_M'), chips(by('TURNO_M'), 'chip-m'), !weekend || by('TURNO_M').length > 0)}
    ${row(dayName('TURNO_T'), chips(by('TURNO_T'), 'chip-t'), !weekend || by('TURNO_T').length > 0)}
    ${row(dayName('TURNO_N'), chips(by('TURNO_N'), ''), by('TURNO_N').length > 0)}
    ${row('Juicio / curso', chips(others, ''), others.length > 0)}
    ${row('Libran / ausentes', chips(absent, 'chip-off', absentCode), !weekend || absent.length > 0)}
    ${row('Sin turno', chips(noData, 'chip-none'), !weekend && noData.length > 0 && noData.length < roster.length)}`;
}

/**
 * @param {HTMLElement} container
 */
export async function renderCuadrante(container) {
  if (!cache) cache = await loadGroupCuadrante();
  const data = cache;
  const state = getState();
  const cfg = effectiveConfig(state);
  const escalafon = cfg.escalafonOrder || [];
  const myPerson = state.activeProfile?.cuadranteName || null;

  if (!data) {
    const hasPassword = Boolean(await getGroupPassword().catch(() => null));
    const empty = emptyStateFor('cuadrante', { hasPassword, hasCuadrante: false });
    container.innerHTML = `
      <div class="cq">
        <section class="empty-hero">
          <div class="empty-ico" aria-hidden="true">${icon('people')}</div>
          ${emptyHTML(empty, { fileId: 'cq-file' })}
        </section>
      </div>`;
    bindEmpty(container, { password: () => askGroupPassword() });
    bindFileInput(container);
    return;
  }

  const idx = indexEntries(data, escalafon);
  const fullRoster = currentRoster(data.names, escalafon);
  // mi fila siempre la primera; el buscador filtra por persona
  const roster = filterRoster(orderRoster(fullRoster, myPerson), query);
  const today = todayISO();
  const guards = guardsByWeek(idx, fullRoster);
  const isList = viewMode === 'list';
  const isWeek = viewMode === 'week';
  const dowOf = iso => new Date(iso + 'T12:00:00').getDay();

  const toolbar = isList
    ? `<div class="cq-toolbar">
        <button type="button" class="btn btn-icon" id="cq-prev" aria-label="Semana anterior">‹</button>
        <h2 class="cq-title">${!listStart || listStart === today ? 'Hoy y esta semana' : `Desde el ${Number(listStart.slice(8))}/${Number(listStart.slice(5, 7))}`}</h2>
        <button type="button" class="btn btn-icon" id="cq-next" aria-label="Semana siguiente">›</button>
        <button type="button" class="btn btn-sm" id="cq-today">Hoy</button>
      </div>`
    : '';

  let tableHTML = '';
  let viewDates = [];
  if (!isList) {
    viewDates = isWeek ? getWeekDates(weekAnchor || today) : monthDates(viewYear, viewMonth);
    // a thicker line before each Monday separates the weeks (Mon–Sun)
    const weekStart = (iso, i) => i > 0 && dowOf(iso) === 1 ? 'cq-week-start' : '';
    let head = '';
    viewDates.forEach((iso, i) => {
      const d = Number(iso.slice(8));
      const dow = dowOf(iso);
      head += `<th class="cq-day-header ${dow === 0 || dow === 6 ? 'cq-weekend' : ''} ${iso === today ? 'cq-today-col' : ''} ${iso === selectedDay ? 'cq-sel-col' : ''} ${weekStart(iso, i)}" scope="col" data-date="${iso}" tabindex="0" aria-label="Ver el ${d}${iso === today ? ' (hoy)' : ''}">
        <span class="cq-day-num">${d}</span><span class="cq-day-name">${WEEKDAYS[dow]}</span></th>`;
    });
    // "Guardia" band: who is on guard in each week shown
    const segments = [];
    viewDates.forEach((iso, i) => {
      const monday = getWeekDates(iso)[0];
      const last = segments[segments.length - 1];
      if (last && last.monday === monday) last.span++;
      else segments.push({ monday, span: 1, first: i });
    });
    const band = segments.map(sg => {
      const people = guards.get(sg.monday) || [];
      const label = people.map(p => esc(displayName(p))).join(', ');
      return `<th class="cq-guard-band ${sg.first > 0 ? 'cq-week-start' : ''} ${people.length ? 'has-guard' : ''}" colspan="${sg.span}" scope="colgroup"
        ${people.length ? `title="Guardia: ${label}"` : ''}><span>${people.length ? (sg.span >= 3 || isWeek ? label : esc(people.map(p => displayName(p).slice(0, sg.span === 1 ? 1 : 3)).join(sg.span === 1 ? '·' : ', '))) : ''}</span></th>`;
    }).join('');
    const rows = roster.map(person => {
      const byDate = idx.get(person) || new Map();
      let cells = '';
      viewDates.forEach((iso, i) => {
        const types = byDate.get(iso) || [];
        const code = CODE[mainCode(types)];
        const dow = dowOf(iso);
        const weekend = (dow === 0 || dow === 6) && !types.length;
        const detail = types.map(t => CODE[t]?.label || t).join(', ');
        cells += `<td data-date="${iso}" data-person="${esc(person)}" class="cq-cell ${code?.cls || ''} ${weekend ? 'cq-weekend' : ''} ${iso === today ? 'cq-today-col' : ''} ${iso === selectedDay ? 'cq-sel-col' : ''} ${weekStart(iso, i)}"
          ${types.length ? `title="${esc(detail)}" aria-label="${esc(`${displayName(person)}, ${detail}`)}"` : ''}>${code ? `<span class="cq-c-full">${esc(code.s)}</span><span class="cq-c-one" aria-hidden="true">${esc(code.one)}</span>` : ''}</td>`;
      });
      return `<tr class="${person === myPerson ? 'cq-me' : ''}">
        <th scope="row" class="cq-name-cell">
          <button type="button" class="cq-person" data-person="${esc(person)}">${esc(displayName(person))}${person === myPerson ? '<span class="sr-only"> (tú)</span>' : ''}</button>
        </th>${cells}</tr>`;
    }).join('');
    tableHTML = `
      <section class="cq-today-card" aria-live="polite">${dayCardHTML(selectedDay || today, idx, fullRoster, today)}</section>
      <div class="cq-toolbar">
        <button type="button" class="btn btn-icon" id="cq-prev" aria-label="${isWeek ? 'Semana anterior' : 'Mes anterior'}">‹</button>
        <h2 class="cq-title">${isWeek ? weekTitle(viewDates) : `${MONTHS[viewMonth]} ${viewYear}`}</h2>
        <button type="button" class="btn btn-icon" id="cq-next" aria-label="${isWeek ? 'Semana siguiente' : 'Mes siguiente'}">›</button>
        <button type="button" class="btn btn-sm" id="cq-today">Hoy</button>
      </div>
      <p class="cq-detail" id="cq-detail" role="status" hidden></p>
      <div class="cuadrante-table-wrap ${isWeek ? 'cq-week-mode' : ''}" tabindex="0" aria-label="Tabla del cuadrante">
        <table class="cq-table">
          <thead>
            <tr><th class="cq-name-col" scope="col">Nombre</th>${head}</tr>
            <tr class="cq-band-row"><th class="cq-name-col cq-band-label" scope="row">Guardia</th>${band}</tr>
          </thead>
          <tbody>${rows || `<tr><td class="cq-none" colspan="${viewDates.length + 1}">Nadie se llama así.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="cq-legend">
        ${['GUARDIA_REAL', 'TURNO_M', 'TURNO_T', 'LIBRE', 'VACACIONES', 'AP', 'BAJA', 'JUICIO', 'FORMACION']
          .map(t => `<span class="legend-item"><span class="cq-swatch ${CODE[t].cls}">${CODE[t].s}</span>${CODE[t].label}</span>`).join('')}
      </div>
      ${isWeek ? '<p class="cq-orientation-hint">Desliza el dedo para cambiar de semana.</p>' : '<p class="cq-orientation-hint">Desliza la tabla a los lados o gira el móvil para ver el mes entero.</p>'}`;
  }

  const listHTML = isList
    ? (roster.length
      ? whoListHTML({ dates: listDates(listStart || today, 7), idx, roster, weekGuards: guards, me: myPerson, today, withShifts: Boolean(query.trim()) })
      : '<p class="empty-hint">Nadie se llama así.</p>')
    : '';

  container.innerHTML = `
    <div class="cq">
      <p class="cq-status" id="cq-status" role="status"></p>
      <div class="cq-notes-warn" id="cq-notes-warn" hidden>
        <strong>Este cuadrante no tiene las notas del Excel.</strong>
        <span>Se leyó con una versión anterior de la app. Vuelve a elegir el Excel y publícalo para que las cuentas de todos usen sus notas.</span>
        <button type="button" class="btn btn-primary btn-sm" id="cq-notes-fix">Elegir el Excel y publicar</button>
      </div>
      <div class="cq-toolbar cq-toolbar-2">
        <div class="segmented" role="group" aria-label="Vista">
          <button type="button" class="seg-btn ${isList ? 'active' : ''}" data-view="list" aria-pressed="${isList}">Lista</button>
          <button type="button" class="seg-btn ${viewMode === 'month' ? 'active' : ''}" data-view="month" aria-pressed="${viewMode === 'month'}">Mes</button>
          <button type="button" class="seg-btn ${isWeek ? 'active' : ''}" data-view="week" aria-pressed="${isWeek}">Semana</button>
        </div>
        <button type="button" class="btn btn-sm" id="cq-more" aria-haspopup="dialog">Opciones</button>
      </div>
      <label class="cq-search"><span class="sr-only">Buscar a una persona</span>
        <input type="search" id="cq-q" placeholder="Buscar a una persona…" value="${esc(query)}" autocomplete="off" enterkeyhint="search"></label>
      ${toolbar}
      ${listHTML}
      ${tableHTML}
      <p class="cq-meta cq-meta-bottom">${esc(data.fileName || 'Cuadrante')} · ${data.publishedAt ? `publicado ${agoText(data.publishedAt)}` : `cargado ${agoText(data.importedAt)}`} · ${fullRoster.length} en plantilla. Toca un nombre para ver su contabilidad.</p>
    </div>`;

  paintStatus(container, data);
  const rerender = () => renderCuadrante(container);
  const move = (dir) => {
    if (isList) listStart = addDays(listStart || today, 7 * dir);
    else if (isWeek) weekAnchor = shiftWeek(getWeekDates(weekAnchor || today)[0], dir)[0];
    else if (dir < 0) {
      if (viewMonth === 0) { viewMonth = 11; viewYear--; } else viewMonth--;
    } else if (viewMonth === 11) { viewMonth = 0; viewYear++; } else viewMonth++;
    rerender();
  };
  container.querySelector('#cq-prev')?.addEventListener('click', () => move(-1));
  container.querySelector('#cq-next')?.addEventListener('click', () => move(1));
  container.querySelector('#cq-today')?.addEventListener('click', () => {
    const n = new Date(); viewYear = n.getFullYear(); viewMonth = n.getMonth(); weekAnchor = null; selectedDay = null; listStart = null; rerender();
  });
  container.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.view === viewMode) return;
    const prev = viewMode;
    viewMode = btn.dataset.view;
    saveViewMode(viewMode);
    // keep looking at the same moment: the selected day, or today
    if (viewMode === 'week') {
      const focus = selectedDay || (prev === 'list' ? listStart : null) || (viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth() ? today : `${viewYear}-${pad(viewMonth + 1)}-01`);
      weekAnchor = focus === today ? null : focus;
    } else if (viewMode === 'month') {
      const a = prev === 'week' ? (weekAnchor || today) : (listStart || today);
      viewYear = Number(a.slice(0, 4)); viewMonth = Number(a.slice(5, 7)) - 1;
    }
    rerender();
  }));
  // buscar a una persona: se filtra al escribir y el cursor sigue en su sitio
  const q = container.querySelector('#cq-q');
  q.addEventListener('input', () => {
    query = q.value;
    const pos = q.selectionStart;
    rerender().then(() => {
      const nq = container.querySelector('#cq-q');
      if (!nq) return;
      nq.focus({ preventScroll: true });
      try { nq.setSelectionRange(pos, pos); } catch { /* sin selección */ }
    });
  });
  container.querySelector('#cq-more').addEventListener('click', () => openFileSheet(container));
  // administrator with a cuadrante read before v27 (no notes): one step to fix it
  if (!notesCount(data) && data.source !== 'publicado') {
    canPublish().then(admin => {
      const warn = container.querySelector('#cq-notes-warn');
      if (!admin || !warn) return;
      warn.hidden = false;
      warn.querySelector('#cq-notes-fix').addEventListener('click', () => publishSharedCuadrante());
    }).catch(() => {});
  }
  container.querySelectorAll('.cq-person').forEach(btn => {
    btn.addEventListener('click', () => openPersonSheet(btn.dataset.person, idx, container));
  });
  if (isList) return;

  // Week view: swipe left/right to change week
  if (isWeek) {
    const wrapEl = container.querySelector('.cuadrante-table-wrap');
    let x0 = null, y0 = null;
    wrapEl.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    wrapEl.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  // Tap any day (header or cell): the top card shows that day — no full redraw,
  // so the table keeps its scroll position. A cell also says what it is, in full.
  const card = container.querySelector('.cq-today-card');
  const detailEl = container.querySelector('#cq-detail');
  const showDay = (iso) => {
    selectedDay = iso === today ? null : iso;
    card.innerHTML = dayCardHTML(iso, idx, fullRoster, today);
    container.querySelectorAll('.cq-sel-col').forEach(el => el.classList.remove('cq-sel-col'));
    if (selectedDay) container.querySelectorAll(`[data-date="${iso}"]`).forEach(el => el.classList.add('cq-sel-col'));
  };
  const showCell = (td) => {
    const person = td.dataset.person;
    const types = idx.get(person)?.get(td.dataset.date) || [];
    const d = new Date(td.dataset.date + 'T12:00:00');
    detailEl.hidden = false;
    detailEl.textContent = `${displayName(person)} · ${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()]} ${d.getDate()}: ${types.length ? types.map(t => CODE[t]?.label || t).join(', ') : 'sin nada apuntado'}`;
  };
  card.addEventListener('click', (e) => { if (e.target.closest('#cq-back-today')) showDay(today); });
  const table = container.querySelector('.cq-table');
  table?.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-date]');
    if (!cell) return;
    showDay(cell.dataset.date);
    if (cell.tagName === 'TD') showCell(cell);
  });
  table?.addEventListener('keydown', (e) => {
    const cell = e.target.closest('th[data-date]');
    if (cell && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showDay(cell.dataset.date); }
  });

  // Si la abreviatura (GU, AP, CUR…) no cabe con letra de .75rem, una letra con su color
  const wrap = container.querySelector('.cuadrante-table-wrap');
  fitCodes(wrap);
  // Bring today's column into view (horizontally only: never jump the page)
  const todayCell = container.querySelector('th.cq-today-col');
  if (wrap && todayCell) {
    const nameCol = container.querySelector('.cq-name-col')?.offsetWidth || 0;
    wrap.scrollLeft = Math.max(0, todayCell.offsetLeft - nameCol - (wrap.clientWidth - nameCol) / 2 + todayCell.offsetWidth / 2);
  }
  document.body.classList.toggle('cuadrante-portrait', window.innerWidth < 700 && window.matchMedia('(orientation: portrait)').matches);
}

/** Pasa la tabla a «una letra» si alguna abreviatura no cabe en su casilla. */
function fitCodes(wrap) {
  if (!wrap) return;
  wrap.classList.remove('cq-compact');
  const tooWide = [...wrap.querySelectorAll('.cq-c-full')].some(el => el.scrollWidth > el.parentElement.clientWidth - 2);
  wrap.classList.toggle('cq-compact', tooWide);
}

/** «Actualizado hace 2 h» o «Sin conexión: datos del 12 nov». */
function paintStatus(container, data) {
  const el = container.querySelector('#cq-status');
  if (!el) return;
  const online = navigator.onLine !== false;
  const checked = lastCheckAt();
  const arrived = data.importedAt || data.publishedAt || null;
  const updatedAt = online ? [checked, arrived].filter(Boolean).sort().pop() || null : (data.publishedAt || data.importedAt || null);
  el.textContent = statusText({ updatedAt, online });
  el.classList.toggle('offline', !online);
}

// Al girar el móvil o cambiar la conexión: se repinta (la tabla recalcula su tamaño)
if (typeof window !== 'undefined') {
  let t = null;
  const again = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (getState().currentScreen !== 'cuadrante') return;
      const content = document.getElementById('screen-content');
      if (content) renderCuadrante(content);
    }, 200);
  };
  window.addEventListener('orientationchange', again);
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; again(); } });
  window.addEventListener('online', again);
  window.addEventListener('offline', again);
}

/** Person sheet: summary of the visible month + one-tap actions. */
function openPersonSheet(person, idx, container) {
  const s = getState();
  const isMe = s.activeProfile?.cuadranteName === person;
  const iAmThis = myProfile()?.cuadranteName === person;
  const byDate = idx.get(person) || new Map();
  const prefix = `${viewYear}-${pad(viewMonth + 1)}`;
  const counts = {};
  for (const [iso, types] of byDate) {
    if (!iso.startsWith(prefix)) continue;
    for (const t of types) counts[t] = (counts[t] || 0) + 1;
  }
  const guardWeeks = new Set([...byDate].filter(([iso, t]) => iso.startsWith(prefix) && t.includes('GUARDIA_REAL')).map(([iso]) => getWeekDates(iso)[0])).size;
  const stat = (n, label) => `<div class="mini-stat"><strong>${n || 0}</strong><span>${label}</span></div>`;

  openSheet({
    title: displayName(person),
    body: `
      <div class="person-head">${avatarHTML(person, 'avatar-lg')}<div><strong>${esc(displayName(person))}</strong><small>${MONTHS[viewMonth]} ${viewYear}</small></div></div>
      <div class="mini-stats">
        ${stat(guardWeeks, 'guardias')}${stat(counts.LIBRE, 'libres')}${stat(counts.VACACIONES, 'vacaciones')}${stat(counts.AP, 'AP')}
      </div>
      <p class="sheet-hint">${iAmThis ? 'Eres tú. ' : ''}${isMe ? 'Es el perfil abierto ahora: sincronizar trae al calendario y a la contabilidad lo que diga el cuadrante.' : 'Abre su contabilidad en su propio perfil, calculada desde el 1 de enero.'}</p>`,
    footer: `${iAmThis ? '' : '<button type="button" class="btn" data-act="link">Soy yo</button>'}
      ${isMe
        ? '<button type="button" class="btn btn-primary" data-act="sync">Sincronizar</button>'
        : '<button type="button" class="btn btn-primary" data-act="open">Ver su contabilidad</button>'}`,
    onMount(root, close) {
      root.querySelector('[data-act="open"]')?.addEventListener('click', async () => {
        close();
        await openPersonAccounting(person);
      });
      root.querySelector('[data-act="sync"]')?.addEventListener('click', async () => {
        close();
        await syncNow();
      });
      root.querySelector('[data-act="link"]')?.addEventListener('click', async () => {
        close();
        await becomeMe(person);
      });
    }
  });
}

/** File actions: load a new cuadrante, share it, delete it. */
function openFileSheet(container) {
  openSheet({
    title: 'Cuadrante del grupo',
    body: `
      <div class="action-list">
        <label class="action-item">
          <span class="action-ico">⬆️</span><span><strong>Cargar cuadrante nuevo</strong><small>Excel, PDF, CSV o JSON. Los perfiles vinculados se actualizan solos.</small></span>
          <input type="file" id="cq-file" accept=".xlsx,.xls,.csv,.txt,.pdf,.json" hidden>
        </label>
        <button type="button" class="action-item" data-act="publish" hidden>
          <span class="action-ico">🔒</span><span><strong>Publicar para el grupo</strong><small>Cifrado con la contraseña del grupo: cada compañero lo recibe solo al abrir la app.</small></span>
        </button>
        <button type="button" class="action-item" data-act="share">
          <span class="action-ico">📤</span><span><strong>Compartir con el grupo</strong><small>Envía el cuadrante ya interpretado por WhatsApp o correo.</small></span>
        </button>
        <button type="button" class="action-item danger" data-act="clear">
          <span class="action-ico">🗑️</span><span><strong>Quitar el cuadrante</strong><small>Los calendarios y la contabilidad de cada perfil no se borran.</small></span>
        </button>
      </div>`,
    onMount(root, close) {
      bindFileInput(root, () => { close(); renderCuadrante(container); });
      canPublish().then(ok => { const b = root.querySelector('[data-act="publish"]'); if (b) b.hidden = !ok; });
      root.querySelector('[data-act="publish"]').addEventListener('click', async () => {
        close();
        await publishSharedCuadrante();
      });
      root.querySelector('[data-act="share"]').addEventListener('click', async () => {
        close();
        await shareCuadrante();
      });
      root.querySelector('[data-act="clear"]').addEventListener('click', async () => {
        close();
        const ok = await confirmDialog({ title: 'Quitar el cuadrante', message: '¿Quitar el cuadrante del grupo de este dispositivo?', confirmLabel: 'Quitar', danger: true });
        if (!ok) return;
        await clearGroupCuadrante();
        cache = null;
        renderCuadrante(container);
        Actions.showToast('Cuadrante quitado');
      });
    }
  });
}

function bindFileInput(root, after) {
  root.querySelector('#cq-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Actions.setBusy('Leyendo el cuadrante…');
    try {
      const result = await importGroupCuadranteFile(file);
      cache = result.data;
      Actions.setBusy('Actualizando tu contabilidad…');
      const summary = await autoSyncIfStale();
      const plantilla = currentRoster(result.data.names, effectiveConfig(getState()).escalafonOrder || []).length;
      const admin = await canPublish();
      const notas = notesCount(result.data);
      Actions.showToast(`Cuadrante cargado: ${plantilla} en plantilla${notas ? ` · ${notas.toLocaleString('es-ES')} notas leídas` : ''}${summary ? ' · tu contabilidad está al día' : ''}`,
        admin ? { actionLabel: 'Publicar', onAction: () => publishSharedCuadrante(), duration: 9000 } : {});
    } catch (err) {
      Actions.showToast('No se pudo leer el archivo.', { level: 'error', detail: err.message });
    } finally {
      Actions.setBusy(null);
    }
    if (after) after();
    else {
      const content = document.getElementById('screen-content');
      if (content) renderCuadrante(content);
    }
    if (cache) await askWhoAmIIfNeeded();
  });
}

async function shareCuadrante() {
  const data = cache || await loadGroupCuadrante();
  if (!data) return;
  const json = JSON.stringify(data);
  const fileName = `cuadrante-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], fileName, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Cuadrante CalGuard' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  Actions.showToast('Cuadrante descargado');
}

/** Forget the cached group cuadrante (e.g. after a shared file import). */
export function invalidateCuadranteCache() {
  cache = null;
}

// A new group cuadrante arrived (published by the administrator, or published from here)
if (typeof window !== 'undefined') {
  window.addEventListener('calguard:cuadrante-changed', () => {
    cache = null;
    if (getState().currentScreen === 'cuadrante') {
      const content = document.getElementById('screen-content');
      if (content) renderCuadrante(content);
    }
  });
}
