/**
 * @module ui/stats
 * Estadísticas: el año en cifras (saldos, mapa mensual de guardias y días
 * libres) y la actividad de la bitácora por periodo. Gráficos en HTML/CSS.
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import { getStats } from '../domain/services.js';
import { guardsOfYear } from '../domain/balances.js';
import { todayISO, getWeekDates, formatDM } from '../domain/rules.js';
import { esc } from './utils.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

let statsPeriod = 'year'; // 'week' | 'month' | 'year' | 'all'

/** Per-month counts of the tags that matter for the accounting. */
function monthlyMap(days, year) {
  const rows = Array.from({ length: 12 }, () => ({ guardia: new Set(), libre: 0, vacaciones: 0, ap: 0 }));
  const y = String(year);
  for (const d of days) {
    if (!d.dateISO?.startsWith(y)) continue;
    const m = Number(d.dateISO.slice(5, 7)) - 1;
    for (const t of d.tags || []) {
      if (t.type === 'GUARDIA_REAL') rows[m].guardia.add(getWeekDates(d.dateISO)[0]);
      else if (t.type === 'LIBRE') rows[m].libre++;
      else if (t.type === 'VACACIONES') rows[m].vacaciones++;
      else if (t.type === 'AP') rows[m].ap++;
    }
  }
  return rows.map(r => ({ ...r, guardia: r.guardia.size }));
}

/**
 * @param {HTMLElement} container
 */
export function renderStats(container) {
  const state = getState();
  const b = state.balances;
  const today = todayISO();
  const { startISO, endISO, label } = getPeriodRange(today, statsPeriod);
  const stats = getStats(startISO, endISO);
  const maxType = Math.max(1, ...Object.values(stats.byType));
  const months = monthlyMap(state.days, b.year);
  const maxMonth = Math.max(1, ...months.map(m => m.libre + m.vacaciones + m.ap));
  const guards = guardsOfYear(state.ledger, b.year, effectiveConfig(state).diasPorGuardia ?? 5, today, effectiveConfig(state).libresExentos || []);
  const currentMonth = new Date().getMonth();

  container.innerHTML = `
    <div class="stats-view">
      <section class="panel">
        <div class="panel-head"><h2>${b.year} en cifras</h2></div>
        <div class="kpi-grid">
          <div class="kpi"><span class="kpi-value">${b.guardias.realizadas}</span><span class="kpi-label">guardias hechas</span></div>
          <div class="kpi"><span class="kpi-value">${b.guardias.planificadas}</span><span class="kpi-label">guardias previstas</span></div>
          <div class="kpi"><span class="kpi-value">${b.libres.generados}</span><span class="kpi-label">libres generados</span></div>
          <div class="kpi"><span class="kpi-value">${b.libres.disfrutados + b.libres.delArrastre}</span><span class="kpi-label">libres disfrutados</span></div>
          <div class="kpi"><span class="kpi-value">${b.ap.disfrutados + b.ap.delArrastre}</span><span class="kpi-label">asuntos propios disfrutados</span></div>
          <div class="kpi"><span class="kpi-value">${b.vacaciones.disfrutados + b.vacaciones.delArrastre}</span><span class="kpi-label">días de vacaciones</span></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Mes a mes</h2>
          <span class="panel-meta legend-inline"><i class="dot dot-libre"></i>libres <i class="dot dot-vac"></i>vacaciones <i class="dot dot-ap"></i>asuntos propios <i class="dot dot-guardia"></i>guardia</span>
        </div>
        <div class="month-chart" role="img" aria-label="Días libres, vacaciones y asuntos propios por mes en ${b.year}">
          ${months.map((m, i) => {
            const h = n => `${((n / maxMonth) * 100).toFixed(1)}%`;
            return `
              <div class="mc-col ${i === currentMonth ? 'is-current' : ''}" title="${MONTHS[i]}: ${m.libre} libres, ${m.vacaciones} vacaciones, ${m.ap} AP, ${m.guardia} guardias">
                <div class="mc-bar">
                  <span class="mc-seg mc-ap" data-h="${h(m.ap)}"></span>
                  <span class="mc-seg mc-vac" data-h="${h(m.vacaciones)}"></span>
                  <span class="mc-seg mc-libre" data-h="${h(m.libre)}"></span>
                </div>
                <span class="mc-guard">${m.guardia ? '●'.repeat(Math.min(m.guardia, 3)) : ''}</span>
                <span class="mc-label">${MONTHS_SHORT[i]}</span>
              </div>`;
          }).join('')}
        </div>
      </section>

      ${guards.length ? `
        <section class="panel">
          <div class="panel-head"><h2>Libres por guardia</h2><span class="panel-meta">usados / generados</span></div>
          <div class="guard-stats-list">
            ${guards.map(g => `
              <div class="guard-stat-row ${g.worked ? '' : 'is-planned'}">
                <span class="guard-ref">${formatDM(g.dateISO)}</span>
                <div class="guard-progress-bar-container"><div class="guard-progress-bar" data-w="${(g.used / g.total) * 100}%"></div></div>
                <span class="guard-fraction">${g.worked ? `${g.used}/${g.total}` : 'prevista'}</span>
              </div>`).join('')}
          </div>
        </section>` : ''}

      <section class="panel">
        <div class="panel-head"><h2>Bitácora</h2><button type="button" class="link-btn" id="stats-open-bitacora">Abrir bitácora ›</button></div>
        <div class="segmented compact" role="group" aria-label="Periodo">
          ${[['week', 'Semana'], ['month', 'Mes'], ['year', 'Año'], ['all', 'Todo']].map(([p, l]) => `
            <button type="button" class="seg-btn ${statsPeriod === p ? 'active' : ''}" data-period="${p}" aria-pressed="${statsPeriod === p}">${l}</button>`).join('')}
        </div>
        <p class="stats-range">${esc(label)}</p>
        <div class="kpi-grid two">
          <div class="kpi"><span class="kpi-value">${stats.totalServices}</span><span class="kpi-label">servicios</span></div>
          <div class="kpi"><span class="kpi-value">${stats.totalHours}h</span><span class="kpi-label">de trabajo</span></div>
        </div>
        ${Object.keys(stats.byType).length ? `
          <div class="bar-chart">
            ${Object.entries(stats.byType).sort((a, b2) => b2[1] - a[1]).map(([type, count]) => `
              <div class="bar-row">
                <span class="bar-label">${esc(type)}</span>
                <div class="bar-track"><div class="bar-fill" data-w="${(count / maxType) * 100}%"></div></div>
                <span class="bar-value">${count}</span>
              </div>`).join('')}
          </div>` : '<p class="empty-hint">Sin servicios en este periodo.</p>'}
      </section>
    </div>
  `;

  container.querySelector('#stats-open-bitacora')?.addEventListener('click', () => Actions.setScreen('registry'));
  container.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      statsPeriod = btn.dataset.period;
      renderStats(container);
    });
  });
}

function getPeriodRange(today, period) {
  const d = new Date(today + 'T12:00:00');
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (period) {
    case 'week': {
      const week = getWeekDates(today);
      return { startISO: week[0], endISO: week[6], label: `Semana del ${formatDM(week[0])} al ${formatDM(week[6])}` };
    }
    case 'month': {
      const last = new Date(y, m + 1, 0).getDate();
      const mm = String(m + 1).padStart(2, '0');
      return { startISO: `${y}-${mm}-01`, endISO: `${y}-${mm}-${last}`, label: `${MONTHS[m]} ${y}` };
    }
    case 'year':
      return { startISO: `${y}-01-01`, endISO: `${y}-12-31`, label: `Año ${y}` };
    default:
      return { startISO: '2000-01-01', endISO: '2099-12-31', label: 'Todo el historial' };
  }
}
