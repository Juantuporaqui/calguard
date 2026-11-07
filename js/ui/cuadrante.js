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

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const CODE = {
  GUARDIA_REAL: { s: 'G', cls: 'cq-guardia', label: 'Guardia' },
  GUARDIA_PLAN: { s: 'P', cls: 'cq-plan', label: 'Guardia prevista' },
  LIBRE: { s: 'L', cls: 'cq-libre', label: 'Libre' },
  VACACIONES: { s: 'V', cls: 'cq-vacaciones', label: 'Vacaciones' },
  AP: { s: 'A', cls: 'cq-asunto', label: 'Asunto propio' },
  TURNO_M: { s: 'M', cls: 'cq-turno-m', label: 'Mañana' },
  TURNO_T: { s: 'T', cls: 'cq-turno-t', label: 'Tarde' },
  TURNO_N: { s: 'N', cls: 'cq-turno-n', label: 'Noche' },
  FORMACION: { s: 'F', cls: 'cq-formacion', label: 'Formación' },
  JUICIO: { s: 'J', cls: 'cq-juicio', label: 'Juicio' },
  BAJA: { s: 'B', cls: 'cq-baja', label: 'Baja / A. familiar' },
  OTRO: { s: '?', cls: '', label: 'Otro' }
};
/** Which code wins when a person has several on the same day. */
const PRIORITY = ['GUARDIA_REAL', 'VACACIONES', 'LIBRE', 'AP', 'BAJA', 'JUICIO', 'FORMACION', 'GUARDIA_PLAN', 'TURNO_N', 'TURNO_T', 'TURNO_M', 'OTRO'];

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let cache = null; // group cuadrante data (invalidated on import/clear)
let selectedDay = null; // day shown in the top card (null = today)
let viewMode = readViewMode(); // 'month' | 'week'
let weekAnchor = null;         // a day in the visible week (null = this week)

function readViewMode() {
  try { return localStorage.getItem('calguard-cq-view') === 'week' ? 'week' : 'month'; } catch { return 'month'; }
}
function saveViewMode(mode) {
  try { localStorage.setItem('calguard-cq-view', mode); } catch { /* private mode */ }
}

/**
 * Who is on guard each week (by Monday): weeks with INC on the weekend, plus
 * holidays stuck to them. Isolated holidays (e.g. the chief) are not a guard.
 * @returns {Map<string, string[]>} monday → people
 */
function guardsByWeek(idx, roster) {
  const out = new Map();
  for (const person of roster) {
    const days = [...(idx.get(person) || new Map())]
      .filter(([, types]) => types.includes('GUARDIA_REAL'))
      .map(([dateISO]) => ({ dateISO, tags: [{ type: 'GUARDIA_REAL' }] }));
    for (const monday of classifyIncWeeks(days).guard) {
      if (!out.has(monday)) out.set(monday, []);
      out.get(monday).push(person);
    }
  }
  return out;
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

/** person (canonical) → date → [tagTypes] */
function indexEntries(data, escalafon) {
  const idx = new Map();
  for (const e of data.entries) {
    const who = canonicalPerson(e.person, escalafon);
    if (!idx.has(who)) idx.set(who, new Map());
    const byDate = idx.get(who);
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    const arr = byDate.get(e.date);
    if (!arr.includes(e.tagType)) arr.push(e.tagType);
  }
  return idx;
}

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
  const dayName = `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  const isToday = iso === today;
  return `
    <div class="cq-day-head">
      <strong>${isToday ? `Hoy · ${dayName}` : dayName.charAt(0).toUpperCase() + dayName.slice(1)}</strong>
      ${isToday ? '<span class="muted">Toca un día del cuadrante para verlo</span>' : '<button type="button" class="link-btn" id="cq-back-today">Volver a hoy</button>'}
    </div>
    ${row('Guardia esa semana', chips(guardIn(week), 'chip-guardia'))}
    ${row('Semana siguiente', chips(guardIn(shiftWeek(week[0], 1)), 'chip-guardia'), isToday)}
    ${row('Guardia ese día', chips(by('GUARDIA_REAL'), 'chip-guardia'), by('GUARDIA_REAL').length > 0)}
    ${row('Mañana', chips(by('TURNO_M'), 'chip-m'), !weekend || by('TURNO_M').length > 0)}
    ${row('Tarde', chips(by('TURNO_T'), 'chip-t'), !weekend || by('TURNO_T').length > 0)}
    ${row('Noche', chips(by('TURNO_N'), ''), by('TURNO_N').length > 0)}
    ${row('Juicio / formación', chips(others, ''), others.length > 0)}
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
    container.innerHTML = `
      <div class="cq">
        <section class="empty-hero">
          <div class="empty-ico" aria-hidden="true">👥</div>
          <h2>Carga el cuadrante del grupo</h2>
          <p>Excel, PDF, CSV o el JSON que te pase un compañero. Verás quién trabaja cada día y podrás abrir la contabilidad de cualquiera con un toque.</p>
          <label class="btn btn-primary">Elegir archivo<input type="file" id="cq-file" accept=".xlsx,.xls,.csv,.txt,.pdf,.json" hidden></label>
          <p class="hint">Con la app instalada en Android también puedes abrir el Excel del correo o WhatsApp y usar <strong>Compartir → CalGuard</strong>.</p>
        </section>
      </div>`;
    bindFileInput(container);
    return;
  }

  const idx = indexEntries(data, escalafon);
  const roster = currentRoster(data.names, escalafon);
  const today = todayISO();
  const isWeek = viewMode === 'week';
  const viewDates = isWeek ? getWeekDates(weekAnchor || today) : monthDates(viewYear, viewMonth);
  const dowOf = iso => new Date(iso + 'T12:00:00').getDay();
  // a thicker line before each Monday separates the weeks (Mon–Sun)
  const weekStart = (iso, i) => i > 0 && dowOf(iso) === 1 ? 'cq-week-start' : '';

  let head = '';
  viewDates.forEach((iso, i) => {
    const d = Number(iso.slice(8));
    const dow = dowOf(iso);
    head += `<th class="cq-day-header ${dow === 0 || dow === 6 ? 'cq-weekend' : ''} ${iso === today ? 'cq-today-col' : ''} ${iso === selectedDay ? 'cq-sel-col' : ''} ${weekStart(iso, i)}" scope="col" data-date="${iso}" tabindex="0" aria-label="Ver el ${d}">
      <span class="cq-day-num">${d}</span><span class="cq-day-name">${WEEKDAYS[dow]}</span></th>`;
  });

  // "Guardia" band: who is on guard in each week shown
  const guards = guardsByWeek(idx, roster);
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
      cells += `<td data-date="${iso}" class="cq-cell ${code?.cls || ''} ${weekend ? 'cq-weekend' : ''} ${iso === today ? 'cq-today-col' : ''} ${iso === selectedDay ? 'cq-sel-col' : ''} ${weekStart(iso, i)}"
        ${types.length ? `title="${esc(types.map(t => CODE[t]?.label || t).join(', '))}"` : ''}>${code?.s || ''}</td>`;
    });
    return `<tr class="${person === myPerson ? 'cq-me' : ''}">
      <th scope="row" class="cq-name-cell">
        <button type="button" class="cq-person" data-person="${esc(person)}">${esc(displayName(person))}</button>
      </th>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="cq">
      <div class="cq-notes-warn" id="cq-notes-warn" hidden>
        <strong>Este cuadrante no tiene las notas del Excel.</strong>
        <span>Se leyó con una versión anterior de la app. Vuelve a elegir el Excel y publícalo para que las cuentas de todos usen sus notas.</span>
        <button type="button" class="btn btn-primary btn-sm" id="cq-notes-fix">Elegir el Excel y publicar</button>
      </div>
      <section class="cq-today-card" aria-live="polite">${dayCardHTML(selectedDay || today, idx, roster, today)}</section>

      <div class="cq-toolbar">
        <button type="button" class="btn btn-icon" id="cq-prev" aria-label="${isWeek ? 'Semana anterior' : 'Mes anterior'}">‹</button>
        <h2 class="cq-title">${isWeek ? weekTitle(viewDates) : `${MONTHS[viewMonth]} ${viewYear}`}</h2>
        <button type="button" class="btn btn-icon" id="cq-next" aria-label="${isWeek ? 'Semana siguiente' : 'Mes siguiente'}">›</button>
        <button type="button" class="btn btn-sm" id="cq-today">Hoy</button>
      </div>
      <div class="cq-toolbar cq-toolbar-2">
        <div class="segmented" role="group" aria-label="Vista">
          <button type="button" class="seg-btn ${isWeek ? '' : 'active'}" data-view="month" aria-pressed="${!isWeek}">Mes</button>
          <button type="button" class="seg-btn ${isWeek ? 'active' : ''}" data-view="week" aria-pressed="${isWeek}">Semana</button>
        </div>
        <button type="button" class="btn btn-sm" id="cq-more" aria-haspopup="dialog">Archivo ⋯</button>
      </div>

      <div class="cuadrante-table-wrap ${isWeek ? 'cq-week-mode' : ''}" tabindex="0" aria-label="Tabla del cuadrante">
        <table class="cq-table">
          <thead>
            <tr><th class="cq-name-col" scope="col">Nombre</th>${head}</tr>
            <tr class="cq-band-row"><th class="cq-name-col cq-band-label" scope="row">Guardia</th>${band}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="cq-legend">
        ${['TURNO_M', 'TURNO_T', 'GUARDIA_REAL', 'LIBRE', 'VACACIONES', 'AP', 'BAJA', 'JUICIO', 'FORMACION']
          .map(t => `<span class="legend-item"><span class="cq-swatch ${CODE[t].cls}">${CODE[t].s}</span>${CODE[t].label}</span>`).join('')}
      </div>
      <p class="cq-meta cq-meta-bottom">${esc(data.fileName || 'Cuadrante')} · ${data.publishedAt ? `publicado ${agoText(data.publishedAt)} 🔒` : `cargado ${agoText(data.importedAt)}`} · ${roster.length} en plantilla. Toca un nombre para ver su contabilidad.</p>
      ${isWeek ? '<p class="cq-orientation-hint">Desliza el dedo para cambiar de semana.</p>' : '<p class="cq-orientation-hint">Desliza la tabla a los lados o gira el móvil para ver el mes entero.</p>'}

    </div>`;

  const rerender = () => renderCuadrante(container);
  const move = (dir) => {
    if (isWeek) {
      weekAnchor = shiftWeek(getWeekDates(weekAnchor || today)[0], dir)[0];
    } else if (dir < 0) {
      if (viewMonth === 0) { viewMonth = 11; viewYear--; } else viewMonth--;
    } else if (viewMonth === 11) { viewMonth = 0; viewYear++; } else viewMonth++;
    rerender();
  };
  container.querySelector('#cq-prev').addEventListener('click', () => move(-1));
  container.querySelector('#cq-next').addEventListener('click', () => move(1));
  container.querySelector('#cq-today').addEventListener('click', () => {
    const n = new Date(); viewYear = n.getFullYear(); viewMonth = n.getMonth(); weekAnchor = null; selectedDay = null; rerender();
  });
  container.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.view === viewMode) return;
    viewMode = btn.dataset.view;
    saveViewMode(viewMode);
    // keep looking at the same moment: the selected day, or today
    const focus = selectedDay || (viewMode === 'week' && viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth() ? today : `${viewYear}-${pad(viewMonth + 1)}-01`);
    if (viewMode === 'week') weekAnchor = focus === today ? null : focus;
    else { const a = weekAnchor || today; viewYear = Number(a.slice(0, 4)); viewMonth = Number(a.slice(5, 7)) - 1; }
    rerender();
  }));
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
  // so the table keeps its scroll position.
  const card = container.querySelector('.cq-today-card');
  const showDay = (iso) => {
    selectedDay = iso === today ? null : iso;
    card.innerHTML = dayCardHTML(iso, idx, roster, today);
    container.querySelectorAll('.cq-sel-col').forEach(el => el.classList.remove('cq-sel-col'));
    if (selectedDay) container.querySelectorAll(`[data-date="${iso}"]`).forEach(el => el.classList.add('cq-sel-col'));
    const r = card.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  card.addEventListener('click', (e) => { if (e.target.closest('#cq-back-today')) showDay(today); });
  const table = container.querySelector('.cq-table');
  table?.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-date]');
    if (cell) showDay(cell.dataset.date);
  });
  table?.addEventListener('keydown', (e) => {
    const cell = e.target.closest('th[data-date]');
    if (cell && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showDay(cell.dataset.date); }
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

  // Bring today's column into view (horizontally only: never jump the page)
  const wrap = container.querySelector('.cuadrante-table-wrap');
  const todayCell = container.querySelector('th.cq-today-col');
  if (wrap && todayCell) {
    const nameCol = container.querySelector('.cq-name-col')?.offsetWidth || 0;
    wrap.scrollLeft = Math.max(0, todayCell.offsetLeft - nameCol - (wrap.clientWidth - nameCol) / 2 + todayCell.offsetWidth / 2);
  }
  document.body.classList.toggle('cuadrante-portrait', window.innerWidth < 700 && window.matchMedia('(orientation: portrait)').matches);
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
      Actions.showToast('No se pudo leer el archivo: ' + err.message);
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
