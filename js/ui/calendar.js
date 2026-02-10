/**
 * @module ui/calendar
 * Calendar view - dynamic multi-year, month navigation
 */

import { getState, Actions } from '../state/store.js';
import { daysInMonth, firstDayOffset, todayISO, formatISO, isWeekend, getWeekDates, formatDMY, getDateRange, countWorkingDays, detectConflict, formatDM } from '../domain/rules.js';
import { put, STORES } from '../persistence/db.js';
import { creditGuardia, debitLibre, adjustOtros, findAvailableGuard, loadLedger } from '../domain/ledger.js';
import { recalcCounters } from '../app.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

let calendarRendered = false;
let lastYear = null;
let lastMonth = null;

/**
 * @param {HTMLElement} container
 */
export function renderCalendar(container) {
  const state = getState();
  const { calendarYear: year, calendarMonth: month } = state;

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

  const forceRender = lastYear !== year || lastMonth !== month;
  lastYear = year;
  lastMonth = month;

  container.innerHTML = `
    <div class="calendar-view">
      <div class="calendar-nav">
        <button class="btn btn-icon" id="prev-month" aria-label="Mes anterior">&laquo;</button>
        <div class="calendar-title-group">
          <button class="btn btn-icon btn-sm" id="prev-year" aria-label="Año anterior">&lsaquo;</button>
          <h2 class="calendar-title">${month >= 0 ? MONTHS[month] + ' ' : ''}${year}</h2>
          <button class="btn btn-icon btn-sm" id="next-year" aria-label="Año siguiente">&rsaquo;</button>
        </div>
        <button class="btn btn-icon" id="next-month" aria-label="Mes siguiente">&raquo;</button>
      </div>
      <div class="calendar-actions">
        <button class="btn btn-sm" id="goto-today">Hoy</button>
        <button class="btn btn-sm" id="view-full-year">${month >= 0 ? 'Ver año completo' : 'Ver mes'}</button>
      </div>
      <div id="calendar-grid-container" class="calendar-grid-container">
        ${month >= 0 ? renderMonth(year, month, state) : renderFullYear(year, state)}
      </div>
    </div>
  `;

  // Event listeners for navigation
  document.getElementById('prev-month')?.addEventListener('click', () => {
    if (month < 0) {
      Actions.setYear(year - 1);
    } else if (month === 0) {
      Actions.setYear(year - 1);
      Actions.setMonth(11);
    } else {
      Actions.setMonth(month - 1);
    }
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    if (month < 0) {
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
    Actions.setYear(now.getFullYear());
    Actions.setMonth(now.getMonth());
  });

  document.getElementById('view-full-year')?.addEventListener('click', () => {
    Actions.setMonth(month >= 0 ? -1 : new Date().getMonth());
  });

  // Day click handlers
  container.querySelectorAll('.day[data-date]').forEach(el => {
    if (el.classList.contains('empty')) return;
    el.addEventListener('click', (e) => {
      const dateISO = el.dataset.date;
      if (!dateISO) return;
      showContextMenu(e, dateISO);
    });
  });
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
  const dayData = state.days.find(d => d.dateISO === dateISO && d.profileId === state.activeProfileId);
  const tags = dayData ? dayData.tags : [];
  const weekend = isWeekend(dateISO);
  const isToday = dateISO === today;
  const dayNum = parseInt(dateISO.split('-')[2]);

  const classes = ['day'];
  if (compact) classes.push('compact');
  if (weekend) classes.push('weekend');
  if (isToday) classes.push('today');

  // Tag-based classes
  const tagTypes = tags.map(t => t.type);
  if (tagTypes.includes('GUARDIA_REAL')) classes.push('guardia');
  if (tagTypes.includes('GUARDIA_PLAN')) classes.push('proxima-guardia');
  if (tagTypes.includes('LIBRE')) classes.push('libre');
  if (tagTypes.includes('VACACIONES')) classes.push('vacaciones');
  if (tagTypes.includes('AP')) classes.push('asunto');
  if (tagTypes.includes('FORMACION')) classes.push('formacion');
  if (tagTypes.includes('JUICIO')) classes.push('juicio');
  // Shift classes (for standalone color + diagonal divisions)
  if (tagTypes.includes('TURNO_M')) classes.push('turno-m');
  if (tagTypes.includes('TURNO_T')) classes.push('turno-t');

  // Labels
  let labels = '';
  if (!compact) {
    if (tagTypes.includes('TURNO_M')) labels += '<span class="day-label label-m" title="Mañana">M</span>';
    if (tagTypes.includes('TURNO_T')) labels += '<span class="day-label label-t" title="Tarde">T</span>';
    if (tagTypes.includes('TURNO_N')) labels += '<span class="day-label label-n" title="Noche">N</span>';
    const otroTag = tags.find(t => t.type === 'OTRO');
    if (otroTag && otroTag.meta && otroTag.meta.label) {
      const lbl = otroTag.meta.label.substring(0, 6);
      labels += `<span class="day-label label-otro" title="${otroTag.meta.label}">${lbl}</span>`;
    }
  }

  const ariaLabel = buildAriaLabel(dateISO, tags);

  return `<div class="${classes.join(' ')}" data-date="${dateISO}" role="button" tabindex="0" aria-label="${ariaLabel}">
    <span class="day-num">${dayNum}</span>
    ${labels}
  </div>`;
}

function buildAriaLabel(dateISO, tags) {
  const [y, m, d] = dateISO.split('-');
  let label = `${d}/${m}/${y}`;
  if (tags.length > 0) {
    const tagNames = tags.map(t => {
      const labels = {
        'GUARDIA_REAL': 'Guardia', 'GUARDIA_PLAN': 'Próxima guardia',
        'LIBRE': 'Libre', 'VACACIONES': 'Vacaciones', 'AP': 'Asunto propio',
        'TURNO_M': 'Mañana', 'TURNO_T': 'Tarde', 'FORMACION': 'Formación',
        'JUICIO': 'Juicio', 'OTRO': 'Otro'
      };
      return labels[t.type] || t.type;
    });
    label += ': ' + tagNames.join(', ');
  }
  return label;
}

// ─── Context Menu ───

function showContextMenu(event, dateISO) {
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  Actions.showContextMenu({
    dateISO,
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY,
    screenX: event.clientX,
    screenY: event.clientY
  });
}

// ─── Day operations (called from contextMenu) ───

/**
 * Add a tag to a day
 * @param {string} dateISO
 * @param {Object} tag
 */
export async function addDayTag(dateISO, tag) {
  const state = getState();
  const profileId = state.activeProfileId;
  let dayData = state.days.find(d => d.dateISO === dateISO && d.profileId === profileId);

  if (!dayData) {
    dayData = { profileId, dateISO, tags: [], updatedAt: new Date().toISOString() };
  } else {
    dayData = { ...dayData, tags: [...dayData.tags] };
  }

  // Check conflict
  const conflict = detectConflict(dayData.tags, tag.type);
  if (conflict) {
    Actions.showToast(conflict);
    return false;
  }

  // Remove existing same-type tag
  dayData.tags = dayData.tags.filter(t => t.type !== tag.type);
  dayData.tags.push(tag);
  dayData.updatedAt = new Date().toISOString();

  await put(STORES.DAYS, dayData);
  Actions.updateDay(dayData);

  // Audit
  await put(STORES.AUDIT, {
    id: crypto.randomUUID(),
    profileId,
    action: 'DAY_TAG_ADD',
    detail: `${dateISO}: ${tag.type}`,
    timestamp: new Date().toISOString()
  });

  recalcCounters();
  return true;
}

/**
 * Remove a specific tag from a day
 * @param {string} dateISO
 * @param {string} tagType
 */
export async function removeDayTag(dateISO, tagType) {
  const state = getState();
  const profileId = state.activeProfileId;
  const dayData = state.days.find(d => d.dateISO === dateISO && d.profileId === profileId);
  if (!dayData) return;

  const newDay = {
    ...dayData,
    tags: dayData.tags.filter(t => t.type !== tagType),
    updatedAt: new Date().toISOString()
  };

  await put(STORES.DAYS, newDay);
  Actions.updateDay(newDay);
  recalcCounters();
}

/**
 * Mark entire week as guard duty (realized)
 * @param {string} dateISO - any day in the week
 */
export async function markWeekGuardia(dateISO) {
  const weekDates = getWeekDates(dateISO);
  const state = getState();

  for (const wd of weekDates) {
    await addDayTag(wd, { type: 'GUARDIA_REAL' });
  }

  // Credit free days
  await creditGuardia(weekDates[0], state.config.diasPorGuardia || 5);
  await loadLedger();
  recalcCounters();
  Actions.showToast(`Guardia registrada: +${state.config.diasPorGuardia || 5} días libres`);
}

/**
 * Mark entire week as planned guard duty
 * @param {string} dateISO
 */
export async function markWeekGuardiaPlan(dateISO) {
  const weekDates = getWeekDates(dateISO);
  for (const wd of weekDates) {
    await addDayTag(wd, { type: 'GUARDIA_PLAN' });
  }
  recalcCounters();
  Actions.showToast('Guardia planificada');
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
  recalcCounters();
  Actions.showToast('Asunto propio registrado');
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
  Actions.showToast(shift === 'TURNO_M' ? 'Mañana' : shift === 'TURNO_T' ? 'Tarde' : 'Noche');
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
  await addDayTag(dateISO, { type: 'JUICIO' });
  Actions.showToast('Juicio/Citación registrado');
}

/**
 * Remove all events from a day
 * @param {string} dateISO
 */
export async function removeAllDayEvents(dateISO) {
  const state = getState();
  const dayData = state.days.find(d => d.dateISO === dateISO && d.profileId === state.activeProfileId);
  if (!dayData || dayData.tags.length === 0) {
    Actions.showToast('No hay nada que eliminar');
    return;
  }

  // Special handling for guardia - remove whole week
  const hasGuardia = dayData.tags.some(t => t.type === 'GUARDIA_REAL' || t.type === 'GUARDIA_PLAN');
  if (hasGuardia) {
    const weekDates = getWeekDates(dateISO);
    for (const wd of weekDates) {
      const wdDay = state.days.find(d => d.dateISO === wd && d.profileId === state.activeProfileId);
      if (wdDay) {
        const cleaned = {
          ...wdDay,
          tags: wdDay.tags.filter(t => t.type !== 'GUARDIA_REAL' && t.type !== 'GUARDIA_PLAN'),
          updatedAt: new Date().toISOString()
        };
        await put(STORES.DAYS, cleaned);
        Actions.updateDay(cleaned);
      }
    }
    Actions.showToast('Guardia eliminada de la semana');
  } else {
    const cleaned = { ...dayData, tags: [], updatedAt: new Date().toISOString() };
    await put(STORES.DAYS, cleaned);
    Actions.updateDay(cleaned);
    Actions.showToast('Eventos eliminados');
  }

  recalcCounters();
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
        if (workDays > state.counters.vacaciones) {
          Actions.showToast(`Solo quedan ${state.counters.vacaciones} días de vacaciones`);
          return;
        }
      }

      // Confirm
      if (!confirm(`Se marcarán ${workDays} días de ${rangeSelection.type === 'VACACIONES' ? 'vacaciones' : 'el período'}.\n(${formatDMY(rangeSelection.startDate)} - ${formatDMY(endDate)})\n¿Confirmar?`)) {
        return;
      }

      const rangeId = crypto.randomUUID();
      for (const d of range) {
        if (excludeWeekends && isWeekend(d) && rangeSelection.type === 'VACACIONES') continue;
        await addDayTag(d, { type: rangeSelection.type, meta: { rangeId } });
      }

      Actions.setRangeSelection(null);
      recalcCounters();
      Actions.showToast(`${rangeSelection.type === 'VACACIONES' ? 'Vacaciones' : 'Período'} registrado: ${workDays} días`);
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
      <div class="range-banner">
        Selecciona días libres (${multiSelect.selectedDates.length} seleccionados)
        <button class="btn btn-sm btn-success" id="confirm-multi">Confirmar</button>
        <button class="btn btn-sm btn-danger" id="cancel-multi">Cancelar</button>
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
    const dates = multiSelect.selectedDates;
    if (dates.length === 0) {
      Actions.showToast('No has seleccionado ningún día');
      return;
    }

    const s = getState();
    if (dates.length > s.counters.libresAcumulados) {
      Actions.showToast('No tienes suficientes días libres acumulados');
      return;
    }

    // Assign days to guards
    const assignments = [];
    const tempDates = [...dates].sort();
    const guardCredits = s.ledger.filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA');
    const guardDebits = s.ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE');
    const daysPerGuard = s.config.diasPorGuardia || 5;

    for (const credit of guardCredits) {
      const ref = credit.sourceRef;
      const usedCount = guardDebits.filter(d => d.sourceRef === ref).length;
      let remaining = daysPerGuard - usedCount;
      let ordinal = usedCount + 1;

      while (remaining > 0 && tempDates.length > 0) {
        const date = tempDates.shift();
        assignments.push({ date, guardRef: ref, ordinal: `D.${ordinal}` });
        remaining--;
        ordinal++;
      }

      if (tempDates.length === 0) break;
    }

    if (tempDates.length > 0) {
      Actions.showToast('No hay suficientes guardias para cubrir todos los días');
      return;
    }

    // Apply
    for (const a of assignments) {
      await addDayTag(a.date, { type: 'LIBRE', meta: { guardRef: a.guardRef, ordinal: a.ordinal } });
      await debitLibre(a.date, a.guardRef);
    }

    await loadLedger();
    recalcCounters();
    Actions.setMultiSelect(null);

    // Generate WhatsApp message
    const msg = generatePedirDiasMsg(assignments);
    showSharePopup(msg);
  });
}

function generatePedirDiasMsg(assignments) {
  let msg = 'Solicito librar los siguientes días:\n';
  for (const a of assignments) {
    msg += `${a.ordinal} ${a.guardRef}: ${formatDM(a.date)}\n`;
  }
  msg += '\nGracias.';
  return msg;
}

function showSharePopup(msg) {
  const existing = document.querySelector('.share-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'share-popup';
  popup.innerHTML = `
    <div class="share-popup-content">
      <h3>Mensaje generado</h3>
      <textarea readonly rows="8">${msg}</textarea>
      <div class="share-actions">
        <button class="btn btn-primary" id="share-copy">Copiar</button>
        <button class="btn btn-secondary" id="share-whatsapp">WhatsApp</button>
        <button class="btn btn-sm" id="share-close">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);

  document.getElementById('share-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(msg);
      Actions.showToast('Copiado al portapapeles');
    } catch {
      Actions.showToast('No se pudo copiar');
    }
  });

  document.getElementById('share-whatsapp')?.addEventListener('click', () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  });

  document.getElementById('share-close')?.addEventListener('click', () => popup.remove());
}

/**
 * Mark "otros eventos" with concept and days impact
 * @param {string} dateISO
 * @param {string} concept
 * @param {number} daysImpact
 */
export async function markOtros(dateISO, concept, daysImpact) {
  await addDayTag(dateISO, { type: 'OTRO', meta: { label: concept, diasAfectados: daysImpact } });
  if (daysImpact !== 0) {
    await adjustOtros(dateISO, daysImpact, concept);
    await loadLedger();
  }
  recalcCounters();
  Actions.showToast(`${concept}: ${daysImpact >= 0 ? '+' : ''}${daysImpact} días`);
}
