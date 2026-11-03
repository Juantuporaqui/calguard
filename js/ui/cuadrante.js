/**
 * @module ui/cuadrante
 * Cuadrante del grupo: quién trabaja cada día y de qué, con la plantilla
 * actual (escalafón). Tocar a un compañero abre su ficha: ver su
 * contabilidad con un toque, o vincularlo a tu perfil.
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import {
  loadGroupCuadrante, importGroupCuadranteFile, clearGroupCuadrante,
  canonicalPerson, currentRoster
} from '../domain/groupCuadrante.js';
import { autoSyncIfStale } from '../domain/cuadranteSync.js';
import { displayName } from '../domain/profiles.js';
import { openPersonAccounting, syncNow, avatarHTML, becomeMe, myProfile, askWhoAmIIfNeeded, canPublish, publishSharedCuadrante } from './flows.js';
import { openSheet, confirmDialog } from './sheet.js';
import { getWeekDates, todayISO } from '../domain/rules.js';
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
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  let head = '';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
    const dow = new Date(viewYear, viewMonth, d).getDay();
    head += `<th class="cq-day-header ${dow === 0 || dow === 6 ? 'cq-weekend' : ''} ${iso === today ? 'cq-today-col' : ''} ${iso === selectedDay ? 'cq-sel-col' : ''}" scope="col" data-date="${iso}" tabindex="0" aria-label="Ver el ${d}">
      <span class="cq-day-num">${d}</span><span class="cq-day-name">${WEEKDAYS[dow]}</span></th>`;
  }

  const rows = roster.map(person => {
    const byDate = idx.get(person) || new Map();
    let cells = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const types = byDate.get(iso) || [];
      const code = CODE[mainCode(types)];
      const dow = new Date(viewYear, viewMonth, d).getDay();
      const weekend = (dow === 0 || dow === 6) && !types.length;
      cells += `<td data-date="${iso}" class="cq-cell ${code?.cls || ''} ${weekend ? 'cq-weekend' : ''} ${iso === today ? 'cq-today-col' : ''} ${iso === selectedDay ? 'cq-sel-col' : ''}"
        ${types.length ? `title="${esc(types.map(t => CODE[t]?.label || t).join(', '))}"` : ''}>${code?.s || ''}</td>`;
    }
    return `<tr class="${person === myPerson ? 'cq-me' : ''}">
      <th scope="row" class="cq-name-cell">
        <button type="button" class="cq-person" data-person="${esc(person)}">${esc(displayName(person))}</button>
      </th>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="cq">
      <section class="cq-today-card" aria-live="polite">${dayCardHTML(selectedDay || today, idx, roster, today)}</section>

      <div class="cq-toolbar">
        <button type="button" class="btn btn-icon" id="cq-prev" aria-label="Mes anterior">‹</button>
        <h2 class="cq-title">${MONTHS[viewMonth]} ${viewYear}</h2>
        <button type="button" class="btn btn-icon" id="cq-next" aria-label="Mes siguiente">›</button>
        <button type="button" class="btn btn-sm" id="cq-today">Hoy</button>
        <button type="button" class="btn btn-sm" id="cq-more" aria-haspopup="dialog">Archivo ⋯</button>
      </div>

      <p class="cq-meta">${esc(data.fileName || 'Cuadrante')} · ${data.publishedAt ? `publicado ${agoText(data.publishedAt)} 🔒` : `cargado ${agoText(data.importedAt)}`} · ${roster.length} en plantilla. Toca un nombre para ver su contabilidad.</p>
      <p class="cq-orientation-hint">Desliza la tabla a los lados o gira el móvil para ver el mes entero.</p>

      <div class="cuadrante-table-wrap" tabindex="0" aria-label="Tabla del cuadrante">
        <table class="cq-table">
          <thead><tr><th class="cq-name-col" scope="col">Nombre</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="cq-legend">
        ${['TURNO_M', 'TURNO_T', 'GUARDIA_REAL', 'LIBRE', 'VACACIONES', 'AP', 'BAJA', 'JUICIO', 'FORMACION']
          .map(t => `<span class="legend-item"><span class="cq-swatch ${CODE[t].cls}">${CODE[t].s}</span>${CODE[t].label}</span>`).join('')}
      </div>
    </div>`;

  const rerender = () => renderCuadrante(container);
  container.querySelector('#cq-prev').addEventListener('click', () => {
    if (viewMonth === 0) { viewMonth = 11; viewYear--; } else viewMonth--;
    rerender();
  });
  container.querySelector('#cq-next').addEventListener('click', () => {
    if (viewMonth === 11) { viewMonth = 0; viewYear++; } else viewMonth++;
    rerender();
  });
  container.querySelector('#cq-today').addEventListener('click', () => {
    const n = new Date(); viewYear = n.getFullYear(); viewMonth = n.getMonth(); selectedDay = null; rerender();
  });

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
      Actions.showToast(`Cuadrante cargado: ${plantilla} en plantilla${summary ? ' · tu contabilidad está al día' : ''}`,
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
