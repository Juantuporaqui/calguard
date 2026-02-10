/**
 * @module ui/stats
 * Statistics view - charts and summaries
 * Uses simple DOM-based bar charts (no external libraries)
 */

import { getState, Actions } from '../state/store.js';
import { getStats, generateWeeklySummary } from '../domain/services.js';
import { getGuardDetails } from '../domain/ledger.js';
import { todayISO, getWeekDates, formatDMY, formatDM } from '../domain/rules.js';
import { recalcCounters } from '../app.js';

let statsPeriod = 'month'; // 'week', 'month', 'year', 'all'

/**
 * @param {HTMLElement} container
 */
export function renderStats(container) {
  recalcCounters();
  const state = getState();
  const today = todayISO();
  const { startISO, endISO, label } = getPeriodRange(today, statsPeriod);
  const stats = getStats(startISO, endISO);
  const guardDetails = getGuardDetails();

  const maxTypeCount = Math.max(1, ...Object.values(stats.byType));

  container.innerHTML = `
    <div class="stats-view">
      <h2>Estadísticas</h2>

      <div class="stats-period-selector">
        ${['week', 'month', 'year', 'all'].map(p => `
          <button class="btn btn-sm ${statsPeriod === p ? 'active' : ''}" data-period="${p}">
            ${p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : p === 'year' ? 'Año' : 'Todo'}
          </button>
        `).join('')}
      </div>
      <p class="stats-range">${label}</p>

      <div class="stats-summary-cards">
        <div class="stat-card">
          <span class="stat-value">${stats.totalServices}</span>
          <span class="stat-label">Servicios</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${stats.totalHours}h</span>
          <span class="stat-label">Horas</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${state.counters.guardiasRealizadas}</span>
          <span class="stat-label">Guardias</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${state.counters.libresAcumulados}</span>
          <span class="stat-label">Libres disp.</span>
        </div>
      </div>

      ${Object.keys(stats.byType).length > 0 ? `
        <div class="stats-section">
          <h3>Servicios por tipo</h3>
          <div class="bar-chart">
            ${Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `
              <div class="bar-row">
                <span class="bar-label">${type}</span>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${(count / maxTypeCount) * 100}%"></div>
                </div>
                <span class="bar-value">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '<p class="empty-state">Sin servicios en este período</p>'}

      ${Object.keys(stats.byMonth).length > 1 ? `
        <div class="stats-section">
          <h3>Servicios por mes</h3>
          <div class="bar-chart">
            ${Object.entries(stats.byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => {
              const maxMonth = Math.max(...Object.values(stats.byMonth));
              return `
                <div class="bar-row">
                  <span class="bar-label">${formatMonthShort(month)}</span>
                  <div class="bar-track">
                    <div class="bar-fill bar-fill-alt" style="width:${(count / maxMonth) * 100}%"></div>
                  </div>
                  <span class="bar-value">${count}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${guardDetails.length > 0 ? `
        <div class="stats-section">
          <h3>Balance de guardias</h3>
          <div class="guard-stats-list">
            ${guardDetails.map(g => `
              <div class="guard-stat-row">
                <span class="guard-ref">${g.ref}</span>
                <div class="guard-progress-bar-container">
                  <div class="guard-progress-bar" style="width:${(g.used / g.total) * 100}%"></div>
                </div>
                <span class="guard-fraction">${g.used}/${g.total}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="stats-section">
        <h3>Resumen rápido</h3>
        <div class="counters-grid compact">
          <div class="counter-card">
            <span class="counter-value">${state.counters.libresAcumulados}</span>
            <span class="counter-label">Libres</span>
          </div>
          <div class="counter-card">
            <span class="counter-value">${state.counters.libresGastados}</span>
            <span class="counter-label">Gastados</span>
          </div>
          <div class="counter-card">
            <span class="counter-value">${state.counters.asuntosPropios}</span>
            <span class="counter-label">A.P.</span>
          </div>
          <div class="counter-card">
            <span class="counter-value">${state.counters.vacaciones}</span>
            <span class="counter-label">Vacaciones</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Period selector
  container.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      statsPeriod = btn.dataset.period;
      renderStats(container);
    });
  });
}

function getPeriodRange(today, period) {
  const d = new Date(today + 'T12:00:00');
  let startISO, endISO, label;

  switch (period) {
    case 'week': {
      const week = getWeekDates(today);
      startISO = week[0];
      endISO = week[6];
      label = `Semana del ${formatDM(week[0])} al ${formatDM(week[6])}`;
      break;
    }
    case 'month': {
      const y = d.getFullYear();
      const m = d.getMonth();
      startISO = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      endISO = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      label = `${months[m]} ${y}`;
      break;
    }
    case 'year': {
      const y = d.getFullYear();
      startISO = `${y}-01-01`;
      endISO = `${y}-12-31`;
      label = `Año ${y}`;
      break;
    }
    default: {
      startISO = '2000-01-01';
      endISO = '2099-12-31';
      label = 'Todo el historial';
    }
  }

  return { startISO, endISO, label };
}

function formatMonthShort(ym) {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(m) - 1]} ${y}`;
}
