/**
 * @module ui/calendar
 * Pantalla Calendario. Junta las piezas de js/ui/calendar/:
 *  - views.js: cabecera, mes / semana / año, leyenda y rejilla (teclado, deslizar);
 *  - selection.js: elegir varios días o un rango, con la barra superior;
 *  - dialogs.js: la hoja de cada día y las demás hojas;
 *  - actions.js: lo que se apunta (con «Deshacer»).
 * Un toque en un día abre su hoja; «＋ Pedir días» empieza a elegir días.
 */

import { getState, Actions } from '../state/store.js';
import { todayISO, getWeekDates } from '../domain/rules.js';
import { pedirOExplicar } from './noDays.js';
import {
  buildDayIndex, headerHTML, monthHTML, weekHTML, yearHTML, legendHTML,
  bindGrid, bindSwipe, setRovingFocus
} from './calendar/views.js';
import {
  startPedirDias, startPedirAsuntos, startPedirVacaciones, startVacacionesRange,
  selectionMarks, selectionBarHTML, selectionTap, bindSelectionBar
} from './calendar/selection.js';
import { openDaySheet, openPeriodPicker } from './calendar/dialogs.js';
import { periodTitle, stepDate } from './calendar/grid.js';

// Lo que usan otras pantallas (Inicio, avisos…)
export { startPedirDias, startPedirAsuntos, startPedirVacaciones, startVacacionesRange } from './calendar/selection.js';
export {
  addDayTag, addDayTagBatch, removeDayTag, markWeekGuardia, markWeekGuardiaPlan, markAsuntoPropio,
  markShift, markFormacion, markBaja, removeAllDayEvents, markOtros, markLibresConcedidos, toggleLibreExento,
  requestLibres, requestAsuntos, requestRange
} from './calendar/actions.js';
export { openEventSheet, markJuicio, openDaySheet } from './calendar/dialogs.js';

let slide = null;          // 'next' | 'prev': hacia dónde entra el periodo nuevo (transición breve)
let focusDate = null;      // día que debe recibir el foco tras pintar (teclado)
let legendOpen = false;    // la leyenda recuerda si la abriste

const hooks = { startVacaciones: startVacacionesRange, startPedirDias };

/**
 * @param {HTMLElement} container
 */
export function renderCalendar(container) {
  const state = getState();
  buildDayIndex(state);
  const { calendarYear: year } = state;
  const month = state.calendarMonth >= 0 ? state.calendarMonth : new Date().getMonth();
  const selecting = Boolean(state.rangeSelection || state.multiSelect?.active);
  // eligiendo días se ve siempre el mes
  const view = selecting ? 'month' : (state.calendarMonth < 0 ? 'year' : (state.calendarView || 'month'));
  const weekAnchor = state.calendarWeekAnchor || todayISO();
  const weekDates = getWeekDates(weekAnchor);

  let grid;
  if (view === 'week') grid = weekHTML(weekDates, state.services || []);
  else if (view === 'year') grid = yearHTML(year);
  else grid = monthHTML(year, month, selecting ? selectionMarks(state) : {});

  const slideCls = slide ? `slide-${slide}` : '';
  slide = null;

  container.innerHTML = `
    <div class="calendar-view ${selecting ? 'is-selecting' : ''}">
      ${selecting ? selectionBarHTML(state) : ''}
      ${headerHTML({ view, title: periodTitle(view, year, month, weekDates), selecting })}
      <div id="calendar-grid-container" class="calendar-grid-container ${slideCls}">${grid}</div>
      ${legendHTML(legendOpen)}
      ${selecting ? '' : `
      <div class="fab-group" role="group" aria-label="Pedir días">
        <button type="button" class="fab fab-half" id="cal-fab" data-kind="libres" aria-label="Pedir días libres: elegir los días en el calendario">＋ Libres</button>
        <button type="button" class="fab fab-half" id="cal-fab-ap" data-kind="ap" aria-label="Pedir asuntos propios: elegir los días en el calendario">＋ Asuntos propios</button>
      </div>`}
    </div>`;

  // ─── Cambiar de periodo ───
  const go = (dir) => {
    slide = dir > 0 ? 'next' : 'prev';
    if (view === 'week') Actions.setWeekAnchor(stepDate(weekAnchor, 7 * dir));
    else if (view === 'year') Actions.setYear(year + dir);
    else if (month + dir < 0) { Actions.setYear(year - 1); Actions.setMonth(11); }
    else if (month + dir > 11) { Actions.setYear(year + 1); Actions.setMonth(0); }
    else Actions.setMonth(month + dir);
  };
  container.querySelector('#cal-prev')?.addEventListener('click', () => go(-1));
  container.querySelector('#cal-next')?.addEventListener('click', () => go(1));
  container.querySelector('#cal-title')?.addEventListener('click', () => openPeriodPicker({ year, month }, (y, m) => {
    slide = y * 12 + m >= year * 12 + month ? 'next' : 'prev';
    Actions.setYear(y);
    Actions.setMonth(m);
    if (view === 'week') Actions.setWeekAnchor(`${y}-${String(m + 1).padStart(2, '0')}-01`);
  }));
  container.querySelector('#goto-today')?.addEventListener('click', () => {
    const now = new Date();
    Actions.setWeekAnchor(todayISO());
    Actions.setYear(now.getFullYear());
    Actions.setMonth(now.getMonth());
    focusDate = todayISO();
  });
  const setView = (v) => {
    if (state.calendarMonth < 0) Actions.setMonth(new Date().getMonth());
    Actions.setCalendarView(v);
  };
  container.querySelector('#view-week')?.addEventListener('click', () => setView('week'));
  container.querySelector('#view-month')?.addEventListener('click', () => setView('month'));
  container.querySelector('#view-year')?.addEventListener('click', () => setView('year'));

  // ─── Días ───
  const gridRoot = container.querySelector('#calendar-grid-container');
  bindGrid(gridRoot, {
    view,
    onActivate: (iso) => {
      focusDate = iso;
      if (selecting) selectionTap(iso);
      else openDaySheet(iso, hooks);
    },
    // la tecla lleva fuera de lo pintado: se cambia de mes, semana o año y se sigue allí
    onOutside: (iso) => {
      focusDate = iso;
      slide = iso > (view === 'week' ? weekDates[6] : `${year}-${String(month + 1).padStart(2, '0')}-31`) ? 'next' : 'prev';
      const [y, m] = iso.split('-').map(Number);
      if (view === 'week') Actions.setWeekAnchor(iso);
      Actions.setYear(y);
      if (view !== 'year') Actions.setMonth(m - 1);
    }
  });
  bindSwipe(gridRoot, () => go(1), () => go(-1));
  // foco: el día con el que se estaba trabajando, si sigue a la vista
  const restore = focusDate && !document.querySelector('.sheet-backdrop:not(.closing)') && (!document.activeElement || document.activeElement === document.body);
  setRovingFocus(gridRoot, focusDate, { focus: Boolean(restore && gridRoot.querySelector(`[data-date="${focusDate}"]`)) });

  container.querySelector('#cal-legend')?.addEventListener('toggle', (e) => { legendOpen = e.currentTarget.open; });
  container.querySelector('#cal-fab')?.addEventListener('click', () => pedirOExplicar('libres', () => startPedirDias()));
  container.querySelector('#cal-fab-ap')?.addEventListener('click', () => pedirOExplicar('ap', () => startPedirAsuntos()));
  if (selecting) bindSelectionBar(container);
}
