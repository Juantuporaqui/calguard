/**
 * @module ui/dashboard
 * Dashboard view - today's overview, counters, alerts
 */

import { getState, Actions } from '../state/store.js';
import { todayISO, formatDMY, formatDM, getWeekDates, isWeekend } from '../domain/rules.js';
import { getGuardDetails } from '../domain/ledger.js';
import { recalcCounters } from '../app.js';

/**
 * @param {HTMLElement} container
 */
export function renderDashboard(container) {
  recalcCounters();
  const state = getState();
  const today = todayISO();
  const todayDay = state.days.find(d => d.dateISO === today && d.profileId === state.activeProfileId);
  const todayTags = todayDay ? todayDay.tags.map(t => t.type) : [];
  const weekDates = getWeekDates(today);

  // Find next guard
  const nextGuard = findNextGuard(state);
  const guardDetails = getGuardDetails();

  // Alerts
  const alerts = getAlerts(state);

  // Week overview
  const weekOverview = weekDates.map(d => {
    const dayData = state.days.find(dd => dd.dateISO === d && dd.profileId === state.activeProfileId);
    const tags = dayData ? dayData.tags : [];
    const isToday = d === today;
    const weekend = isWeekend(d);
    return { date: d, tags, isToday, weekend };
  });

  container.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <h1>CalGuard</h1>
        <p class="subtitle">Policía Científica - Cuadrante Operativo</p>
        <p class="today-date">${formatDMY(today)} - ${getDayName(today)}</p>
      </header>

      ${todayTags.length > 0 ? `
        <div class="today-status">
          <h3>Hoy</h3>
          <div class="tag-list">${todayTags.map(t => `<span class="tag tag-${t.toLowerCase()}">${tagLabel(t)}</span>`).join('')}</div>
        </div>
      ` : ''}

      ${alerts.length > 0 ? `
        <div class="alerts-section">
          ${alerts.map(a => `<div class="alert alert-${a.level}">${a.message}</div>`).join('')}
        </div>
      ` : ''}

      <div class="counters-grid">
        <div class="counter-card">
          <span class="counter-value">${state.counters.libresAcumulados}</span>
          <span class="counter-label">Libres Acumulados</span>
        </div>
        <div class="counter-card">
          <span class="counter-value">${state.counters.libresGastados}</span>
          <span class="counter-label">Libres Gastados</span>
        </div>
        <div class="counter-card">
          <span class="counter-value">${state.counters.asuntosPropios}</span>
          <span class="counter-label">A. Propios</span>
        </div>
        <div class="counter-card">
          <span class="counter-value">${state.counters.vacaciones}</span>
          <span class="counter-label">Vacaciones</span>
        </div>
        <div class="counter-card">
          <span class="counter-value">${state.counters.guardiasRealizadas}</span>
          <span class="counter-label">Guardias Realizadas</span>
        </div>
        <div class="counter-card">
          <span class="counter-value">${state.counters.guardiasPlanificadas}</span>
          <span class="counter-label">Guardias Planificadas</span>
        </div>
      </div>

      <div class="week-overview">
        <h3>Esta semana</h3>
        <div class="week-row">
          ${weekOverview.map(d => `
            <div class="week-day ${d.isToday ? 'today' : ''} ${d.weekend ? 'weekend' : ''} ${d.tags.length > 0 ? getMainClass(d.tags) : ''}">
              <span class="week-day-name">${getDayShort(d.date)}</span>
              <span class="week-day-num">${d.date.split('-')[2]}</span>
              ${d.tags.map(t => `<span class="week-tag tag-${t.type.toLowerCase()}" title="${tagLabel(t.type)}">${tagIcon(t.type)}</span>`).join('')}
            </div>
          `).join('')}
        </div>
      </div>

      ${nextGuard ? `
        <div class="next-guard-card">
          <h3>Próxima Guardia</h3>
          <p>${formatDMY(nextGuard)} (${getDayName(nextGuard)})</p>
        </div>
      ` : ''}

      ${guardDetails.length > 0 ? `
        <div class="guard-summary">
          <h3>Detalle de Guardias</h3>
          <div class="guard-list">
            ${guardDetails.slice(-5).reverse().map(g => `
              <div class="guard-item">
                <strong>${g.ref}</strong>
                <span class="guard-balance">${g.used}/${g.total} usados</span>
                <div class="guard-progress">
                  <div class="guard-progress-bar" style="width:${(g.used / g.total) * 100}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="quick-actions">
        <button class="btn btn-primary" id="goto-calendar">Ir al Calendario</button>
        <button class="btn btn-secondary" id="goto-registry">Nueva Entrada Bitácora</button>
      </div>
    </div>
  `;

  document.getElementById('goto-calendar')?.addEventListener('click', () => Actions.setScreen('calendar'));
  document.getElementById('goto-registry')?.addEventListener('click', () => Actions.setScreen('registry'));
}

function findNextGuard(state) {
  const today = todayISO();
  const guardDays = state.days
    .filter(d => d.profileId === state.activeProfileId && d.dateISO > today)
    .filter(d => d.tags.some(t => t.type === 'GUARDIA_PLAN'))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  return guardDays.length > 0 ? guardDays[0].dateISO : null;
}

function getAlerts(state) {
  const alerts = [];
  if (state.counters.libresAcumulados <= 0 && state.counters.guardiasRealizadas > 0) {
    alerts.push({ level: 'warn', message: 'Sin días libres acumulados' });
  }
  if (state.counters.asuntosPropios <= 1) {
    alerts.push({ level: 'warn', message: `Solo quedan ${state.counters.asuntosPropios} asuntos propios` });
  }
  if (state.counters.vacaciones <= 3) {
    alerts.push({ level: 'info', message: `Quedan ${state.counters.vacaciones} días de vacaciones` });
  }
  return alerts;
}

function tagLabel(type) {
  const labels = {
    'GUARDIA_REAL': 'Guardia', 'GUARDIA_PLAN': 'Próx. Guardia',
    'LIBRE': 'Libre', 'VACACIONES': 'Vacaciones', 'AP': 'A. Propio',
    'TURNO_M': 'Mañana', 'TURNO_T': 'Tarde', 'TURNO_N': 'Noche',
    'FORMACION': 'Formación', 'JUICIO': 'Juicio', 'OTRO': 'Otro'
  };
  return labels[type] || type;
}

function tagIcon(type) {
  const icons = {
    'GUARDIA_REAL': 'G', 'GUARDIA_PLAN': 'P', 'LIBRE': 'L',
    'VACACIONES': 'V', 'AP': 'A', 'TURNO_M': 'M', 'TURNO_T': 'T',
    'TURNO_N': 'N', 'FORMACION': 'F', 'JUICIO': 'J', 'OTRO': '?'
  };
  return icons[type] || '?';
}

function getMainClass(tags) {
  if (tags.some(t => t.type === 'GUARDIA_REAL')) return 'has-guardia';
  if (tags.some(t => t.type === 'GUARDIA_PLAN')) return 'has-plan';
  if (tags.some(t => t.type === 'VACACIONES')) return 'has-vacaciones';
  if (tags.some(t => t.type === 'LIBRE')) return 'has-libre';
  if (tags.some(t => t.type === 'AP')) return 'has-ap';
  return '';
}

function getDayName(dateISO) {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date(dateISO + 'T12:00:00').getDay()];
}

function getDayShort(dateISO) {
  const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  return days[new Date(dateISO + 'T12:00:00').getDay()];
}
