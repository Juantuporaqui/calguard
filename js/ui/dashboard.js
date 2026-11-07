/**
 * @module ui/dashboard
 * Panel de inicio: saldos "al día" del perfil activo, próximos eventos y
 * guardias del año. Todo se calcula en el store (state.balances).
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import { todayISO, getWeekDates, isWeekend } from '../domain/rules.js';
import { guardsOfYear, upcomingEvents } from '../domain/balances.js';
import { hasFestivoRate } from '../domain/reconcile.js';
import { conceptLabel } from '../domain/notes.js';
import { fmtDias } from '../domain/compensations.js';
import { openCompensaciones } from './compensaciones.js';
import { EVENT_KINDS } from '../domain/events.js';
import { loadGroupCuadrante } from '../domain/groupCuadrante.js';
import { startPedirDias } from './calendar.js';
import { avatarHTML, quickBackup, backupReminderDue, daysSinceBackup, refreshEverything } from './flows.js';
import { openSheet } from './sheet.js';
import { esc } from './utils.js';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
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
  OTRO: { label: 'Otro', short: '+', cls: 'otro' },
  EVENTO: { label: 'Evento', short: '💬', cls: 'evento' }
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
const joinY = list => list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
/** ['2026-11-04','2026-11-05'] → "4 y 5 nov"; varios meses → "30 oct y 4 nov". */
function fmtDateList(dates, max = 6) {
  const shown = dates.slice(0, max);
  const byMonth = [];
  for (const iso of shown) {
    const x = d(iso);
    const last = byMonth[byMonth.length - 1];
    if (last && last.m === x.getMonth()) last.days.push(x.getDate());
    else byMonth.push({ m: x.getMonth(), days: [x.getDate()] });
  }
  const parts = byMonth.map(g => `${joinY(g.days.map(String))} ${MONTHS_SHORT[g.m]}`);
  return joinY(parts) + (dates.length > max ? '…' : '');
}

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
    <article class="quota-card ${over ? 'over' : ''}" data-quota="${key}" role="button" tabindex="0" aria-label="${title}: ver qué días">
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
      ${q.caduca && q.arrastreRestante > 0 ? `<p class="quota-warn soft">Te ${q.arrastreRestante === 1 ? 'queda' : 'quedan'} ${q.arrastreRestante} de ${Number(q.caduca.slice(0, 4)) - 1}: úsa${q.arrastreRestante === 1 ? 'lo' : 'los'} antes del ${fmtShort(q.caduca)}</p>` : ''}
      ${q.arrastreCaducado ? `<p class="quota-note">${q.arrastreCaducado} de ${Number(q.caduca.slice(0, 4)) - 1} ${q.arrastreCaducado === 1 ? 'caducó' : 'caducaron'} el ${fmtShort(q.caduca)}</p>` : ''}
      ${q.arrastreEstimado ? `<p class="quota-note">${plural(q.arrastreEstimado, 'día', 'días')} (${fmtDateList(q.estimadoFechas)}) ${q.arrastreEstimado === 1 ? 'cuenta' : 'cuentan'} como del año anterior</p>`
        : q.delArrastre ? `<p class="quota-note">${q.caduca ? `${plural(q.delArrastre, 'disfrutado', 'disfrutados')} de ${Number(q.caduca.slice(0, 4)) - 1} (hasta el ${fmtShort(q.caduca)})` : `${plural(q.delArrastre, 'día', 'días')} del año anterior`}</p>` : ''}
      ${over ? `<p class="quota-warn">Hay ${-q.disponibles} más asignados que disponibles. Revisa el cupo o el arrastre.</p>` : ''}
    </article>`;
}

const WEEKDAYS_LONG_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** "lun 22 sep" */
function fmtDay(iso) { const x = d(iso); return `${WEEKDAYS_LONG_SHORT[x.getDay()]} ${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`; }

/** Consecutive days (weekends in between allowed) → ranges with their count. */
function groupRanges(dates) {
  const out = [];
  for (const iso of [...dates].sort()) {
    const last = out[out.length - 1];
    if (last && (d(iso) - d(last.end)) / 86400000 <= 3) { last.end = iso; last.count++; }
    else out.push({ start: iso, end: iso, count: 1 });
  }
  return out;
}

/** Which AP / vacation days were enjoyed, requested or came from last year. */
function openQuotaSheet(key) {
  const b = getState().balances;
  const q = key === 'ap' ? b.ap : b.vacaciones;
  const title = key === 'ap' ? 'Asuntos propios' : 'Vacaciones';
  const f = q.fechas || { anterior: [], disfrutados: [], pedidos: [] };
  const block = (label, dates, cls, note = '') => dates.length ? `
    <h4 class="qd-title">${label} <small>${plural(dates.length, 'día', 'días')}${note}</small></h4>
    <ul class="gd-list">${groupRanges(dates).map(r => `
      <li class="gd-item ${cls}"><span class="gd-dot" aria-hidden="true"></span>
        <span>${r.count === 1 ? fmtDay(r.start) : fmtRange(r.start, r.end)}</span>
        <small>${r.count > 1 ? plural(r.count, 'día', 'días') : ''}</small></li>`).join('')}</ul>` : '';
  openSheet({
    title: `${title} ${b.year}`,
    body: `
      <div class="mini-stats three">
        <div class="mini-stat"><strong>${q.disfrutados}</strong><span>disfrutados</span></div>
        <div class="mini-stat"><strong>${q.planificados}</strong><span>pedidos</span></div>
        <div class="mini-stat"><strong>${q.disponibles}</strong><span>disponibles</span></div>
      </div>
      <div class="qd" data-kind="${key}">
        ${block(`Del año ${b.year - 1}`, f.anterior, 'prev', q.caduca ? ` · valían hasta el ${fmtShort(q.caduca)}` : '')}
        ${block('Disfrutados', f.disfrutados, 'on')}
        ${block('Pedidos', f.pedidos, 'req')}
        ${!f.anterior.length && !f.disfrutados.length && !f.pedidos.length ? `<p class="sheet-hint">Todavía no hay ${key === 'ap' ? 'asuntos propios' : 'días de vacaciones'} este año.</p>` : ''}
      </div>
      <p class="sheet-hint muted">Cupo ${b.year}: ${q.cupo}${q.arrastreRestante ? ` + ${q.arrastreRestante} de ${b.year - 1}` : ''}${key === 'vac' ? ' · sin contar fines de semana' : ''}.</p>`
  });
}

/** Detail of one guard: when each of its days was (or will be) enjoyed. */
function openGuardSheet(g) {
  if (!g) return;
  const monday = g.dateISO;
  const sunday = getWeekDates(monday)[6];
  const libres = Math.max(0, g.total - g.used);
  const dayMap = new Map(getState().days.map(x => [x.dateISO, x]));
  const noteOf = iso => (dayMap.get(iso)?.tags || []).find(t => t.type === 'LIBRE')?.meta?.note;
  // what the cuadrante says about the guard week itself ("Rafa hace S y D…")
  const incNotes = [...new Set(getWeekDates(monday).flatMap(iso => (dayMap.get(iso)?.tags || [])
    .filter(t => t.type === 'GUARDIA_REAL' && t.meta?.note).map(t => t.meta.note)))];
  const before = g.usedBefore || 0;
  const list = (dates, cls, label, offset) => dates.map((iso, i) => {
    const note = noteOf(iso);
    return `
    <li class="gd-item ${cls}"><span class="gd-dot" aria-hidden="true"></span><span>${fmtDay(iso)}${note ? `<br><small class="gd-note">«${esc(note)}»</small>` : ''}</span><small>${label} · D.${offset + i + 1}</small></li>`;
  }).join('');
  const thisYearUsed = g.enjoyedDates.length + g.requestedDates.length;
  openSheet({
    title: g.festivo ? `Festivo ${fmtShort(monday)}` : `Guardia ${fmtRange(monday, sunday)}${g.prevYear ? ` ${monday.slice(0, 4)}` : ''}`,
    body: `
      <div class="mini-stats three">
        <div class="mini-stat"><strong>${g.enjoyed}</strong><span>disfrutados</span></div>
        <div class="mini-stat"><strong>${g.requested}</strong><span>pedidos</span></div>
        <div class="mini-stat"><strong>${g.worked ? libres : '—'}</strong><span>${g.worked ? 'por disfrutar' : 'aún no generados'}</span></div>
      </div>
      ${incNotes.length ? `<p class="sheet-hint">Cuadrante: ${incNotes.map(n => `«${esc(n)}»`).join(' · ')}</p>` : ''}
      ${g.excede ? `<p class="quota-warn">Esta guardia da ${plural(g.total, 'día', 'días')} y tiene ${g.used} asignados según las notas del cuadrante. Conviene revisarlo.</p>` : ''}
      ${before ? `<p class="sheet-hint">${plural(before, 'día disfrutado', 'días disfrutados')} en ${monday.slice(0, 4)}, antes del 1 de enero.</p>` : ''}
      ${thisYearUsed ? `<ul class="gd-list">${list(g.enjoyedDates, 'on', 'disfrutado', before)}${list(g.requestedDates, 'req', 'pedido', before + g.enjoyedDates.length)}</ul>`
        : g.used ? '' : `<p class="sheet-hint">${g.worked ? `Aún no has gastado ningún día de esta guardia: tienes ${plural(g.total, 'día', 'días')} por disfrutar.` : `Guardia prevista: sus ${g.total} días se generan el lunes ${fmtShort(monday)}.`}</p>`}
      ${g.worked && libres && g.used ? `<p class="sheet-hint">Te ${libres === 1 ? 'queda' : 'quedan'} ${plural(libres, 'día', 'días')} de esta guardia por disfrutar.</p>` : ''}
      <p class="sheet-hint muted">Referencia ${esc(g.ref)} · cada libre va a la guardia que dice su nota en el cuadrante; sin nota, a la más antigua con días pendientes.</p>`
  });
}

function buildAlerts(b, profile, cfg, year) {
  const alerts = [];
  if (b.libres.disponibles < 0) {
    alerts.push({ level: 'danger', text: `Has pedido ${plural(-b.libres.disponibles, 'libre', 'libres')} más de los que tienes generados.` });
  }
  if (b.ap.disponibles === 1) alerts.push({ level: 'warn', text: 'Te queda 1 asunto propio.' });
  if (backupReminderDue()) {
    const n = daysSinceBackup();
    alerts.push({
      level: 'warn',
      text: n === Infinity
        ? 'Aún no tienes copia de seguridad. Tus datos solo están en este dispositivo.'
        : `Tu última copia de seguridad es de hace ${n} días.`,
      action: { label: 'Guardar copia', run: 'backup' }
    });
  }
  if (b.libres.sinCubrir?.length) {
    alerts.push({
      level: 'warn',
      text: `${plural(b.libres.sinCubrir.length, 'libre no lo cubre', 'libres no los cubre')} ninguna guardia (${fmtDateList(b.libres.sinCubrir)}). Si fue un día concedido, márcalo en el calendario como «no computa».`
    });
  }
  const over = guardsOfYear(getState().ledger, year, cfg.diasPorGuardia ?? 5, b.today, cfg.libresExentos || []).filter(g => g.excede);
  if (over.length) {
    alerts.push({
      level: 'info',
      text: `Según las notas del cuadrante, ${over.length === 1 ? 'la guardia' : 'las guardias'} ${joinY(over.map(g => `del ${fmtShort(g.dateISO)}${g.prevYear ? ` de ${g.dateISO.slice(0, 4)}` : ''} (${g.used}/${g.total})`))} ${over.length === 1 ? 'tiene' : 'tienen'} más días de los que da${over.length === 1 ? '' : 'n'}.`
    });
  }
  const carry = cfg.carryovers?.[String(year)];
  const est = [
    b.libres.arrastreEstimado ? `${plural(b.libres.arrastreEstimado, 'libre', 'libres')} (${fmtDateList(b.libres.sinGuardia)}) que no cubre ninguna guardia de ${year}` : '',
    b.ap.arrastreEstimado ? `${plural(b.ap.arrastreEstimado, 'asunto propio', 'asuntos propios')} (${fmtDateList(b.ap.estimadoFechas)}) que ${b.ap.arrastreEstimado === 1 ? 'pasa' : 'pasan'} del cupo` : '',
    b.vacaciones.arrastreEstimado ? `${plural(b.vacaciones.arrastreEstimado, 'día', 'días')} de vacaciones (${fmtDateList(b.vacaciones.estimadoFechas)}) que ${b.vacaciones.arrastreEstimado === 1 ? 'pasa' : 'pasan'} del cupo` : ''
  ].filter(Boolean);
  if (est.length) {
    alerts.push({
      level: 'info',
      text: `Se cuentan como de ${year - 1}, sin restar de ${year}: ${joinY(est)}. Si no es así, indica el arrastre de ${year - 1}.`,
      action: { label: 'Revisar arrastre', screen: 'settings' }
    });
  } else if (!carry && !b.libres.arrastreAuto && (b.libres.disfrutados > 0 || b.ap.disfrutados > 0)) {
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
  const events = upcomingEvents(state.days, today, { limit: 5, separateFestivos: hasFestivoRate(cfg) });
  const guards = guardsOfYear(state.ledger, year, cfg.diasPorGuardia ?? 5, today, cfg.libresExentos || []);
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
        <div class="hero-sync">
          <span id="dash-sync-info">${profile?.cuadranteName
            ? `Cuadrante · ${profile.lastSyncAt ? `actualizado ${agoText(profile.lastSyncAt)}` : 'sin actualizar'}`
            : 'Sin vincular al cuadrante'}</span>
          <button type="button" class="hero-refresh" id="dash-refresh" aria-label="Actualizar cuadrante y calendario">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Actualizar
          </button>
        </div>
        <p class="hero-stale" id="dash-stale" hidden></p>
      </section>

      ${alerts.map(a => `
        <div class="notice notice-${a.level}" role="${a.level === 'danger' ? 'alert' : 'status'}">
          <span>${esc(a.text)}</span>
          ${a.action ? `<button type="button" class="link-btn" ${a.action.run ? `data-run="${a.action.run}"` : `data-goto="${a.action.screen}"`}>${esc(a.action.label)}</button>` : ''}
        </div>`).join('')}

      <div class="dash-cols">
      <div class="dash-col">
      <section class="libres-card dash-o1 ${L.disponibles < 0 ? 'neg' : ''}" aria-labelledby="libres-title">
        <div class="libres-gauge">
          ${ring(Math.max(0, L.disponibles), Math.max(ganados, 1), L.disponibles < 0 ? 'danger' : 'accent')}
          <div class="gauge-center">
            <span class="gauge-value">${fmtDias(L.disponibles)}</span>
            <span class="gauge-label">libres<br>para pedir</span>
          </div>
        </div>
        <div class="libres-body">
          <h2 id="libres-title">Días libres ${year}</h2>
          <dl class="ledger-lines">
            ${L.arrastre - (L.arrastreEstimado || 0) > 0 ? `<div><dt>Arrastre ${year - 1}${L.arrastreAuto ? ' <small>(según el cuadrante)</small>' : ''}</dt><dd>+${L.arrastreRestante}${L.delArrastre - (L.arrastreEstimado || 0) > 0 ? ` <small>(${plural(L.delArrastre - (L.arrastreEstimado || 0), 'ya usado', 'ya usados')})</small>` : ''}</dd></div>` : ''}
            <div><dt>Generados (${plural(b.guardias.realizadas, 'guardia', 'guardias')}${b.guardias.festivos ? ` + ${plural(b.guardias.festivos, 'festivo', 'festivos')}` : ''})</dt><dd class="pos">${signed(L.generados)}</dd></div>
            ${L.ajustes ? `<div><dt>Ajustes</dt><dd>${L.ajustes > 0 ? '+' : ''}${L.ajustes}</dd></div>` : ''}
            <div><dt>Disfrutados</dt><dd class="neg">${signed(-L.disfrutados)}</dd></div>
            <div><dt>Pedidos (futuros)</dt><dd class="neg">${signed(-L.reservados)}</dd></div>
            ${(L.compensaciones || []).map(c => c.recibidos === 0
              ? `<div><dt>${esc(c.label)}</dt><dd><small>+${fmtDias(c.previstos)} el ${fmtDateList(c.items.map(x => x.fecha).sort())}</small></dd></div>`
              : `<div><dt>${esc(c.label)}${c.disfrutados ? ` <small>(${fmtDias(c.recibidos)} − ${c.disfrutados})</small>` : ''}</dt><dd class="pos">${c.pendientes ? '+' + fmtDias(c.pendientes) : '0'}</dd></div>`).join('')}
            ${(L.porConcepto || []).filter(c => !(L.compensaciones || []).some(x => x.concepto === c.concepto)).map(c => `<div><dt>${esc(conceptLabel(c.concepto))}</dt><dd><small>${plural(c.fechas.length, 'libre', 'libres')} · no gasta${c.fechas.length === 1 ? '' : 'n'} guardias</small></dd></div>`).join('')}
            ${L.concedidosFechas?.length ? `<div><dt>🎁 Concedidos</dt><dd><small>${fmtDateList(L.concedidosFechas)} · no computan</small></dd></div>` : ''}
            <div class="total"><dt>Para pedir</dt><dd>${fmtDias(L.disponibles)}</dd></div>
          </dl>
          ${L.reservados ? `<p class="libres-pending"><strong>${L.porDisfrutar} por disfrutar:</strong> ${L.disponibles} para pedir + ${plural(L.reservados, 'ya pedido', 'ya pedidos')} (${fmtDateList(L.reservadosFechas)})</p>` : ''}
          ${L.arrastreEstimado ? `<p class="libres-future">${plural(L.arrastreEstimado, `libre disfrutado este año es de ${year - 1}`, `libres disfrutados este año son de ${year - 1}`)} (no restan)</p>` : ''}
          ${L.porGenerar ? `<p class="libres-future">+${L.porGenerar} más al hacer ${plural(b.guardias.planificadas, 'guardia prevista', 'guardias previstas')}${nextGuard ? ` · próxima ${fmtShort(nextGuard)}` : ''}</p>` : ''}
          ${L.compPrevistos ? `<p class="libres-future">+${fmtDias(L.compPrevistos)} por compensaciones con fecha más adelante</p>` : ''}
          <button type="button" class="btn btn-primary btn-block" id="dash-pedir" ${L.disponibles < 1 ? 'disabled' : ''}>Pedir días libres</button>
          <button type="button" class="link-btn dash-comps" id="dash-comps">＋ Compensaciones (juicios, elecciones…)</button>
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
            <span class="panel-meta">${b.guardias.realizadas} hechas · ${b.guardias.planificadas} previstas${b.guardias.festivos ? ` · ${plural(b.guardias.festivos, 'festivo', 'festivos')}` : ''}</span>
          </div>
          <ul class="guard-grid">
            ${guards.map(g => `
              <li><button type="button" class="guard-tile ${g.worked ? 'worked' : 'planned'} ${g.dateISO === nextGuard ? 'next' : ''} ${g.excede ? 'excede' : ''} ${g.prevYear ? 'prev-year' : ''}" data-guard="${esc(g.dateISO)}"
                aria-label="Guardia del ${fmtShort(g.dateISO)}: ${g.enjoyed} disfrutados${g.requested ? `, ${g.requested} pedidos` : ''}, ${Math.max(0, g.total - g.used)} por disfrutar. Ver fechas">
                <span class="gt-date">${fmtShort(g.dateISO)}${g.dateISO.slice(0, 4) !== String(year) ? `<small> ’${g.dateISO.slice(2, 4)}</small>` : ''}</span>
                <span class="gt-dots" aria-hidden="true">${Array.from({ length: g.total }, (_, i) => `<i class="${i < g.enjoyed ? 'on' : i < g.used ? 'req' : ''}"></i>`).join('')}</span>
                <span class="gt-state">${g.festivo ? `festivo · ${g.enjoyed}/${g.total}` : g.worked || g.used ? `${g.enjoyed}/${g.total}${g.excede ? ' ⚠' : ''}` : 'prevista'}</span>
                ${g.requested ? `<span class="gt-sub">+${plural(g.requested, 'pedido', 'pedidos')}</span>` : ''}
              </button></li>`).join('')}
          </ul>
          <p class="gt-legend"><i class="on"></i> disfrutado <i class="req"></i> pedido <i></i> por disfrutar</p>
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
                  <strong>${e.type === 'EVENTO' ? `${EVENT_KINDS[e.kind]?.icon || '💬'} ` : ''}${esc(e.label)}${e.semana ? ' · semana completa' : e.count > 1 ? ` · ${plural(e.count, 'día', 'días')}` : ''}</strong>
                  <span>${fmtRange(e.start, e.end)}${e.hora ? ` · ${esc(e.hora)}` : ''}${e.lugar ? ` · ${esc(e.lugar)}` : ''}</span>
                </div>
                <span class="tl-when">${e.start < today && e.end >= today ? 'en curso' : inDaysText(e.inDays)}</span>
              </li>`).join('')}
          </ol>` : '<p class="empty-hint">Nada previsto en las próximas semanas.</p>'}
      </section>

      </div>
      </div>

      <nav class="quick-actions" aria-label="Accesos rápidos">
        <button type="button" class="qa" data-goto="calendar"><span class="qa-ico">📅</span>Calendario</button>
        <button type="button" class="qa" data-goto="cuadrante"><span class="qa-ico">👥</span>Cuadrante</button>
        <button type="button" class="qa" data-goto="biblioteca"><span class="qa-ico">📚</span>Biblioteca</button>
        <button type="button" class="qa" data-goto="stats"><span class="qa-ico">📊</span>Estadísticas</button>
      </nav>
    </div>
  `;

  container.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => Actions.setScreen(btn.dataset.goto));
  });
  container.querySelector('[data-run="backup"]')?.addEventListener('click', () => quickBackup());
  container.querySelectorAll('.quota-card[data-quota]').forEach(card => {
    const open = () => openQuotaSheet(card.dataset.quota);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  container.querySelector('#dash-comps')?.addEventListener('click', () => openCompensaciones());
  container.querySelectorAll('[data-guard]').forEach(btn => {
    btn.addEventListener('click', () => openGuardSheet(guards.find(g => g.dateISO === btn.dataset.guard)));
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
  container.querySelector('#dash-refresh')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spinning');
    try { await refreshEverything(); } finally { btn.classList.remove('spinning'); }
  });

  // Tell the user when the group cuadrante is newer than this profile's last sync
  if (profile?.cuadranteName) {
    loadGroupCuadrante().then(data => {
      const info = container.querySelector('#dash-sync-info');
      if (info && data?.publishedAt) info.textContent = `Cuadrante del ${new Date(data.publishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · actualizado ${profile.lastSyncAt ? agoText(profile.lastSyncAt) : '—'}`;
      const el = container.querySelector('#dash-stale');
      if (!el || !data?.importedAt || !profile.lastSyncAt || data.importedAt <= profile.lastSyncAt) return;
      el.textContent = 'Hay un cuadrante más reciente: pulsa Actualizar.';
      el.hidden = false;
    }).catch(() => {});
  }
}
