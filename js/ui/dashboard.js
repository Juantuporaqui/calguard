/**
 * @module ui/dashboard
 * Panel de inicio: saldos "al día" del perfil activo, próximos eventos y
 * guardias del año. Todo se calcula en el store (state.balances).
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import { todayISO, getWeekDates, isWeekend } from '../domain/rules.js';
import { guardsOfYear, upcomingEvents } from '../domain/balances.js';
import { loadGroupCuadrante } from '../domain/groupCuadrante.js';
import { startPedirDias } from './calendar.js';
import { syncNow, avatarHTML } from './flows.js';
import { esc } from './utils.js';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const TAG_INFO = {
  GUARDIA_REAL: { label: 'Guardia', short: 'G', cls: 'guardia' },
  GUARDIA_PLAN: { label: 'Guardia prevista', short: 'P', cls: 'plan' },
  LIBRE: { label: 'Libre', short: 'L', cls: 'libre' },
  VACACIONES: { label: 'Vacaciones', short: 'V', cls: 'vacaciones' },
  AP: { label: 'Asunto propio', short: 'A', cls: 'ap' },
  TURNO_M: { label: 'Mañana', short: 'M', cls: 'turno-m' },
  TURNO_T: { label: 'Tarde', short: 'T', cls: 'turno-t' },
  TURNO_N: { label: 'Noche', short: 'N', cls: 'turno-n' },
  FORMACION: { label: 'Formación', short: 'F', cls: 'formacion' },
  JUICIO: { label: 'Juicio', short: 'J', cls: 'juicio' },
  BAJA: { label: 'Baja / A. familiar', short: 'B', cls: 'baja' },
  OTRO: { label: 'Otro', short: '+', cls: 'otro' }
};

function d(iso) { return new Date(iso + 'T12:00:00'); }
function fmtShort(iso) { const x = d(iso); return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`; }
function fmtRange(a, b) {
  if (a === b) return fmtShort(a);
  const x = d(a), y = d(b);
  return x.getMonth() === y.getMonth() ? `${x.getDate()}–${y.getDate()} ${MONTHS_SHORT[y.getMonth()]}` : `${fmtShort(a)} – ${fmtShort(b)}`;
}
function inDaysText(n) {
  if (n <= 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n < 14) return `en ${n} días`;
  if (n < 60) return `en ${Math.round(n / 7)} semanas`;
  return `en ${Math.round(n / 30)} meses`;
}
function agoText(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Ring gauge (SVG). */
function ring(value, max, tone) {
  const r = 52, c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return `
    <svg class="ring ring-${tone}" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="ring-track" cx="60" cy="60" r="${r}"/>
      <circle class="ring-value" cx="60" cy="60" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - ratio)).toFixed(1)}"/>
    </svg>`;
}

/** Segmented quota bar: disfrutados | planificados | disponibles. */
function quotaCard(key, title, q, unit) {
  const total = Math.max(q.cupo + q.arrastreRestante, q.asignados, 1);
  const pct = n => `${Math.max(0, (n / total) * 100).toFixed(2)}%`;
  const over = q.disponibles < 0;
  return `
    <article class="quota-card ${over ? 'over' : ''}" data-quota="${key}">
      <header>
        <h3>${title}</h3>
        <span class="quota-big ${over ? 'neg' : ''}">${q.disponibles}<small> ${unit}</small></span>
      </header>
      <div class="quota-bar" role="img" aria-label="${title}: ${q.disfrutados} disfrutados, ${q.planificados} planificados, ${q.disponibles} disponibles de ${q.cupo + q.arrastreRestante}">
        <span class="seg seg-used" style="width:${pct(q.disfrutados)}"></span>
        <span class="seg seg-planned" style="width:${pct(q.planificados)}"></span>
      </div>
      <ul class="quota-legend">
        <li><i class="dot dot-used"></i>${q.disfrutados} disfrutado${q.disfrutados === 1 ? "" : "s"}</li>
        <li><i class="dot dot-planned"></i>${q.planificados} pedido${q.planificados === 1 ? "" : "s"}</li>
        <li><i class="dot dot-free"></i>de ${q.cupo}${q.arrastreRestante ? ` + ${q.arrastreRestante} arrastre` : ''}</li>
      </ul>
      ${q.delArrastre ? `<p class="quota-note">${plural(q.delArrastre, 'día', 'días')} antes del corte, del año anterior</p>` : ''}
      ${over ? `<p class="quota-warn">Hay ${-q.disponibles} más asignados que disponibles. Revisa el cupo o el arrastre.</p>` : ''}
    </article>`;
}

function buildAlerts(b, profile, cfg, year) {
  const alerts = [];
  if (b.libres.disponibles < 0) {
    alerts.push({ level: 'danger', text: `Has pedido ${plural(-b.libres.disponibles, 'libre', 'libres')} más de los que tienes generados.` });
  }
  if (b.ap.disponibles === 1) alerts.push({ level: 'warn', text: 'Te queda 1 asunto propio.' });
  const carry = cfg.carryovers?.[String(year)];
  if (!carry && (b.libres.disfrutados > 0 || b.ap.disfrutados > 0)) {
    alerts.push({
      level: 'info',
      text: `¿Traes días de ${year - 1}? Indica el arrastre y las fechas de corte para que la cuenta cuadre.`,
      action: { label: 'Indicar arrastre', screen: 'settings' }
    });
  }
  return alerts;
}

/**
 * @param {HTMLElement} container
 */
export function renderDashboard(container) {
  const state = getState();
  const cfg = effectiveConfig(state);
  const b = state.balances;
  const today = todayISO();
  const year = b.year;
  const profile = state.activeProfile;
  const dayMap = new Map(state.days.map(x => [x.dateISO, x]));
  const todayTags = dayMap.get(today)?.tags || [];
  const week = getWeekDates(today);
  const events = upcomingEvents(state.days, today, { limit: 5 });
  const guards = guardsOfYear(state.ledger, year, cfg.diasPorGuardia || 5, today);
  const alerts = buildAlerts(b, profile, cfg, year);
  const now = new Date();
  const L = b.libres;
  const ganados = L.arrastreRestante + L.generados + Math.max(0, L.ajustes);
  const nextGuard = b.guardias.proximas[0];

  container.innerHTML = `
    <div class="dash">
      <section class="dash-hero">
        <div class="hero-who">
          ${avatarHTML(profile?.name || '?', 'avatar-lg')}
          <div>
            <p class="hero-date">${cap(WEEKDAYS_LONG[now.getDay()])}, ${now.getDate()} de ${MONTHS_LONG[now.getMonth()]}</p>
            <h1 class="hero-name">${esc(profile?.name || 'CalGuard')}</h1>
          </div>
        </div>
        <div class="hero-today">
          ${todayTags.length
            ? todayTags.map(t => `<span class="tag-pill pill-${TAG_INFO[t.type]?.cls || 'otro'}">${esc(TAG_INFO[t.type]?.label || t.type)}</span>`).join('')
            : `<span class="tag-pill pill-muted">${isWeekend(today) ? 'Fin de semana' : 'Hoy sin turno registrado'}</span>`}
        </div>
        ${profile?.cuadranteName ? `
          <div class="hero-sync">
            <span>Cuadrante · ${profile.lastSyncAt ? `sincronizado ${agoText(profile.lastSyncAt)}` : 'sin sincronizar'}</span>
            <button type="button" class="link-btn" id="dash-sync">Sincronizar</button>
          </div>` : ''}
        <p class="hero-stale" id="dash-stale" hidden></p>
      </section>

      ${alerts.map(a => `
        <div class="notice notice-${a.level}" role="${a.level === 'danger' ? 'alert' : 'status'}">
          <span>${esc(a.text)}</span>
          ${a.action ? `<button type="button" class="link-btn" data-goto="${a.action.screen}">${esc(a.action.label)}</button>` : ''}
        </div>`).join('')}

      <div class="dash-cols">
      <div class="dash-col">
      <section class="libres-card dash-o1 ${L.disponibles < 0 ? 'neg' : ''}" aria-labelledby="libres-title">
        <div class="libres-gauge">
          ${ring(Math.max(0, L.disponibles), Math.max(ganados, 1), L.disponibles < 0 ? 'danger' : 'accent')}
          <div class="gauge-center">
            <span class="gauge-value">${L.disponibles}</span>
            <span class="gauge-label">libres<br>disponibles</span>
          </div>
        </div>
        <div class="libres-body">
          <h2 id="libres-title">Días libres ${year}</h2>
          <dl class="ledger-lines">
            ${L.arrastre ? `<div><dt>Arrastre ${year - 1}</dt><dd>+${L.arrastreRestante}${L.delArrastre ? ` <small>(${L.delArrastre} ya usados)</small>` : ''}</dd></div>` : ''}
            <div><dt>Generados (${plural(b.guardias.realizadas, 'guardia', 'guardias')})</dt><dd class="pos">+${L.generados}</dd></div>
            ${L.ajustes ? `<div><dt>Ajustes</dt><dd>${L.ajustes > 0 ? '+' : ''}${L.ajustes}</dd></div>` : ''}
            <div><dt>Disfrutados</dt><dd class="neg">−${L.disfrutados}</dd></div>
            <div><dt>Pedidos (futuros)</dt><dd class="neg">−${L.reservados}</dd></div>
            <div class="total"><dt>Disponibles hoy</dt><dd>${L.disponibles}</dd></div>
          </dl>
          ${L.porGenerar ? `<p class="libres-future">+${L.porGenerar} más al hacer ${plural(b.guardias.planificadas, 'guardia prevista', 'guardias previstas')}${nextGuard ? ` · próxima ${fmtShort(nextGuard)}` : ''}</p>` : ''}
          <button type="button" class="btn btn-primary btn-block" id="dash-pedir" ${L.disponibles <= 0 ? 'disabled' : ''}>Pedir días libres</button>
        </div>
      </section>

      <section class="panel dash-o3">
        <div class="panel-head">
          <h2>Esta semana</h2>
          <button type="button" class="link-btn" id="dash-week">Ver semana</button>
        </div>
        <div class="week-strip">
          ${week.map((iso, i) => {
            const tags = dayMap.get(iso)?.tags || [];
            const main = tags.find(t => ['GUARDIA_REAL', 'GUARDIA_PLAN', 'VACACIONES', 'LIBRE', 'AP', 'BAJA', 'JUICIO', 'FORMACION'].includes(t.type));
            return `
              <button type="button" class="ws-day ${iso === today ? 'is-today' : ''} ${isWeekend(iso) ? 'is-weekend' : ''} ${main ? 'has-' + TAG_INFO[main.type].cls : ''}" data-date="${iso}"
                aria-label="${WEEKDAYS_SHORT[i]} ${iso.slice(8)}: ${tags.map(t => TAG_INFO[t.type]?.label || t.type).join(', ') || 'sin eventos'}">
                <span class="ws-dow">${WEEKDAYS_SHORT[i]}</span>
                <span class="ws-num">${Number(iso.slice(8))}</span>
                <span class="ws-tags">${tags.slice(0, 3).map(t => `<i class="mini mini-${TAG_INFO[t.type]?.cls || 'otro'}">${TAG_INFO[t.type]?.short || '?'}</i>`).join('')}</span>
              </button>`;
          }).join('')}
        </div>
      </section>

      ${guards.length ? `
        <section class="panel dash-o5">
          <div class="panel-head">
            <h2>Guardias ${year}</h2>
            <span class="panel-meta">${b.guardias.realizadas} hechas · ${b.guardias.planificadas} previstas</span>
          </div>
          <ul class="guard-grid">
            ${guards.map(g => `
              <li class="guard-tile ${g.worked ? 'worked' : 'planned'} ${g.dateISO === nextGuard ? 'next' : ''}" title="${esc(g.ref)}: ${g.used} de ${g.total} libres usados">
                <span class="gt-date">${fmtShort(g.dateISO)}</span>
                <span class="gt-dots" aria-hidden="true">${Array.from({ length: g.total }, (_, i) => `<i class="${i < g.used ? 'on' : ''}"></i>`).join('')}</span>
                <span class="gt-state">${g.worked ? `${g.used}/${g.total}` : 'prevista'}</span>
              </li>`).join('')}
          </ul>
        </section>` : ''}

      </div>
      <div class="dash-col">
      <section class="quota-grid dash-o2">
        ${quotaCard('ap', 'Asuntos propios', b.ap, 'disp.')}
        ${quotaCard('vac', 'Vacaciones', b.vacaciones, 'días')}
      </section>

      <section class="panel dash-o4">
        <div class="panel-head"><h2>Próximamente</h2></div>
        ${events.length ? `
          <ol class="timeline">
            ${events.map(e => `
              <li class="tl-item tl-${TAG_INFO[e.type]?.cls || 'otro'}">
                <span class="tl-dot" aria-hidden="true"></span>
                <div class="tl-main">
                  <strong>${esc(e.label)}${e.count > 1 ? ` · ${plural(e.count, 'día', 'días')}` : ''}</strong>
                  <span>${fmtRange(e.start, e.end)}</span>
                </div>
                <span class="tl-when">${inDaysText(e.inDays)}</span>
              </li>`).join('')}
          </ol>` : '<p class="empty-hint">Nada previsto en las próximas semanas.</p>'}
      </section>

      </div>
      </div>

      <nav class="quick-actions" aria-label="Accesos rápidos">
        <button type="button" class="qa" data-goto="calendar"><span class="qa-ico">📅</span>Calendario</button>
        <button type="button" class="qa" data-goto="cuadrante"><span class="qa-ico">👥</span>Cuadrante</button>
        <button type="button" class="qa" data-goto="registry"><span class="qa-ico">📝</span>Bitácora</button>
        <button type="button" class="qa" data-goto="stats"><span class="qa-ico">📊</span>Estadísticas</button>
      </nav>
    </div>
  `;

  container.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => Actions.setScreen(btn.dataset.goto));
  });
  container.querySelector('#dash-pedir')?.addEventListener('click', () => {
    Actions.setScreen('calendar');
    startPedirDias();
  });
  const openWeek = (iso) => {
    Actions.setCalendarView('week');
    Actions.setWeekAnchor(iso || today);
    Actions.setScreen('calendar');
  };
  container.querySelector('#dash-week')?.addEventListener('click', () => openWeek(today));
  container.querySelectorAll('.ws-day').forEach(btn => btn.addEventListener('click', () => openWeek(btn.dataset.date)));
  container.querySelector('#dash-sync')?.addEventListener('click', () => syncNow());

  // Tell the user when the group cuadrante is newer than this profile's last sync
  if (profile?.cuadranteName) {
    loadGroupCuadrante().then(data => {
      const el = container.querySelector('#dash-stale');
      if (!el || !data?.importedAt || !profile.lastSyncAt || data.importedAt <= profile.lastSyncAt) return;
      el.textContent = 'Hay un cuadrante más reciente: pulsa Sincronizar.';
      el.hidden = false;
    }).catch(() => {});
  }
}
