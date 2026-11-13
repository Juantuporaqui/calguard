/**
 * @module ui/calendar/dialogs
 * Hojas del calendario: la del día (lo que hay y qué apuntar), eventos,
 * juicio, «Otros eventos» y el selector de mes y año.
 */

import { getState, Actions, effectiveConfig } from '../../state/store.js';
import { formatDMY } from '../../domain/rules.js';
import { EVENT_KINDS, eventItems, eventIcon, eventTitle, makeEventItem } from '../../domain/events.js';
import { conceptLabel } from '../../domain/notes.js';
import { openSheet } from '../sheet.js';
import { esc } from '../utils.js';
import { dayInfo, dayName, dayShort, dayIconClass } from '../labels.js';
import { pedirOExplicar, hasDaysLeft, explainNoDays } from '../noDays.js';
import { MONTHS } from './grid.js';
import {
  addDayTag, markWeekGuardia, markWeekGuardiaPlan, markAsuntoPropio, markShift, markFormacion, markBaja,
  markOtros, removeAllDayEvents, removeOneTag, saveDayEvents, toggleLibreExento, requestLibres
} from './actions.js';

const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_LOWER = MONTHS.map(m => m.toLowerCase());

/** «Viernes, 13 de noviembre de 2026» */
function longDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  const w = WEEKDAYS_LONG[d.getDay()];
  return `${w.charAt(0).toUpperCase() + w.slice(1)}, ${d.getDate()} de ${MONTHS_LOWER[d.getMonth()]} de ${d.getFullYear()}`;
}

const icon = (type) => `<span class="ctx-icon ${dayIconClass(type)}" aria-hidden="true">${dayShort(type)}</span>`;

/**
 * Hoja del día: la fecha en grande, lo que hay apuntado y qué se puede apuntar.
 * Cuatro acciones frecuentes en botones grandes; el resto, tras «Más opciones».
 * @param {string} dateISO
 * @param {{startVacaciones: Function, startPedirDias: Function}} hooks - arranques de los modos de selección
 */
export function openDaySheet(dateISO, hooks) {
  const state = getState();
  const tags = state.days.find(d => d.dateISO === dateISO)?.tags || [];
  const hasLibre = tags.some(t => t.type === 'LIBRE');
  const libreExento = hasLibre && (effectiveConfig(state).libresExentos || []).includes(dateISO);
  const hasJuicio = tags.some(t => t.type === 'JUICIO' || (t.type === 'EVENTO' && eventItems([t]).some(ev => ev.kind === 'JUICIO')));

  const big = (act, type, label) => `<button type="button" class="day-act" data-act="${act}">${icon(type)}<span>${label}</span></button>`;
  const more = (act, type, label, extra = '') => `<button type="button" class="action-item ${extra}" data-act="${act}">${type ? icon(type) : ''}<span><strong>${label}</strong></span></button>`;

  openSheet({
    title: longDate(dateISO),
    className: 'sheet-day',
    body: `
      <section class="day-now" aria-label="Lo que hay este día">
        ${tags.length ? `<div class="ctx-events-list">${tags.map((t, i) => renderTagSummary(t, i, true)).join('')}</div>` : '<p class="muted">Nada apuntado este día.</p>'}
        ${hasLibre ? `<p class="ctx-libre-for">${esc(libreAttribution(dateISO, state, libreExento))}</p>
          <button type="button" class="btn btn-sm" data-act="exento">🎁 ${libreExento ? 'Sí computa (quitar «concedido»)' : 'No computa: día concedido'}</button>` : ''}
        ${hasJuicio ? '<button type="button" class="btn btn-sm" data-act="comp-juicio">⚖️ Me lo compensan (½ día)…</button>' : ''}
      </section>
      <div class="day-acts" role="group" aria-label="Apuntar en este día">
        ${big('libre', 'LIBRE', 'Libre')}
        ${big('ap', 'AP', dayName('AP'))}
        ${big('vacaciones', 'VACACIONES', dayName('VACACIONES'))}
        ${big('evento', 'EVENTO', dayName('EVENTO'))}
      </div>
      <details class="day-more">
        <summary>Más opciones</summary>
        <div class="action-list">
          ${more('guardia', 'GUARDIA_REAL', `${dayName('GUARDIA_REAL')} (toda la semana)`)}
          ${more('plan', 'GUARDIA_PLAN', `${dayName('GUARDIA_PLAN')} (toda la semana)`)}
          ${more('manana', 'TURNO_M', dayName('TURNO_M'))}
          ${more('tarde', 'TURNO_T', dayName('TURNO_T'))}
          ${more('formacion', 'FORMACION', dayName('FORMACION'))}
          ${more('baja', 'BAJA', dayName('BAJA'))}
          ${more('otros', 'OTRO', 'Otros eventos (suman o restan días)')}
          ${more('pedir', 'LIBRE', 'Pedir varios días libres')}
          ${tags.length ? more('eliminar', '', 'Borrar todo lo de este día', 'danger') : ''}
        </div>
      </details>`,
    onMount(root, close) {
      root.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', async () => {
        close();
        await removeOneTag(dateISO, btn.dataset.remove);
      }));
      root.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        close();
        switch (act) {
          case 'libre': pedirOExplicar('libres', () => requestLibres([dateISO])); break;
          case 'ap': if (hasDaysLeft('ap')) await markAsuntoPropio(dateISO); else explainNoDays('ap'); break;
          case 'vacaciones': pedirOExplicar('vac', () => hooks.startVacaciones(dateISO)); break;
          case 'evento': openEventSheet(dateISO); break;
          case 'guardia': await markWeekGuardia(dateISO); break;
          case 'plan': await markWeekGuardiaPlan(dateISO); break;
          case 'manana': await markShift(dateISO, 'TURNO_M'); break;
          case 'tarde': await markShift(dateISO, 'TURNO_T'); break;
          case 'formacion': await markFormacion(dateISO); break;
          case 'baja': await markBaja(dateISO); break;
          case 'otros': showOtrosDialog(dateISO); break;
          case 'pedir': pedirOExplicar('libres', () => hooks.startPedirDias()); break;
          case 'eliminar': await removeAllDayEvents(dateISO); break;
          case 'exento': await toggleLibreExento(dateISO); break;
          case 'comp-juicio': { const { openAddComp } = await import('../compensaciones.js'); openAddComp({ fecha: dateISO, concepto: 'juicio' }); break; }
        }
      }));
    }
  });
}

/**
 * Elegir mes y año tocando el título del calendario.
 * @param {{year: number, month: number}} current
 * @param {(year: number, month: number) => void} onPick
 */
export function openPeriodPicker(current, onPick) {
  let year = current.year;
  openSheet({
    title: 'Ir a un mes',
    body: `
      <div class="picker-year">
        <button type="button" class="btn btn-icon" data-y="-1" aria-label="Año anterior">‹</button>
        <strong class="picker-year-num" aria-live="polite">${year}</strong>
        <button type="button" class="btn btn-icon" data-y="1" aria-label="Año siguiente">›</button>
      </div>
      <div class="picker-months">
        ${MONTHS.map((m, i) => `<button type="button" class="btn picker-month ${i === current.month ? 'btn-primary' : ''}" data-m="${i}">${m.slice(0, 3)}</button>`).join('')}
      </div>`,
    onMount(root, close) {
      const num = root.querySelector('.picker-year-num');
      const paint = () => {
        num.textContent = String(year);
        root.querySelectorAll('[data-m]').forEach(b => {
          const on = year === current.year && Number(b.dataset.m) === current.month;
          b.classList.toggle('btn-primary', on);
          b.setAttribute('aria-pressed', String(on));
          b.setAttribute('aria-label', `${MONTHS[Number(b.dataset.m)]} de ${year}`);
        });
      };
      paint();
      root.querySelectorAll('[data-y]').forEach(b => b.addEventListener('click', () => { year += Number(b.dataset.y); paint(); }));
      root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { close(); onPick(year, Number(b.dataset.m)); }));
    }
  });
}

/**
 * Sheet to add (and remove) special events of a day: juicio, tiro, curso,
 * reunión… Shown on the calendar as a little speech bubble.
 * @param {string} dateISO
 * @param {string} [presetKind]
 */
export function openEventSheet(dateISO, presetKind = 'JUICIO') {
  const items = eventItems(getState().days.find(d => d.dateISO === dateISO)?.tags || []);
  openSheet({
    title: `Eventos · ${formatDMY(dateISO)}`,
    body: `
      ${items.length ? `<ul class="ev-list">${items.map(ev => `
        <li class="ev-item"><span class="ev-ico" aria-hidden="true">${eventIcon(ev)}</span>
          <span class="ev-text"><strong>${esc(eventTitle(ev))}</strong><small>${esc([ev.hora, ev.lugar, ev.nota].filter(Boolean).join(' · '))}</small></span>
          <button type="button" class="btn btn-icon btn-sm" data-del="${esc(ev.id)}" aria-label="Quitar ${esc(eventTitle(ev))}">✕</button></li>`).join('')}</ul>` : ''}
      <div class="ev-kinds" role="radiogroup" aria-label="Tipo de evento">
        ${Object.entries(EVENT_KINDS).map(([k, v]) => `
          <label class="ev-kind"><input type="radio" name="ev-kind" value="${k}" ${k === presetKind ? 'checked' : ''}><span>${v.icon} ${v.label}</span></label>`).join('')}
      </div>
      <label class="field"><span>Título (opcional)</span><input type="text" id="ev-title" maxlength="60" placeholder="Ej.: Juicio rápido, Tiro trimestral…"></label>
      <div class="form-grid two">
        <label class="field"><span>Hora</span><input type="time" id="ev-hora"></label>
        <label class="field"><span>Lugar</span><input type="text" id="ev-lugar" maxlength="60" placeholder="Juzgado, galería de tiro…"></label>
      </div>
      <label class="field"><span>Nota</span><input type="text" id="ev-nota" maxlength="140" placeholder="Diligencias, qué llevar…"></label>`,
    footer: `
      <button type="button" class="btn" data-act="close">Cerrar</button>
      <button type="button" class="btn btn-primary" data-act="add">Añadir evento</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="close"]').addEventListener('click', close);
      root.querySelector('[data-act="add"]').addEventListener('click', async () => {
        const item = makeEventItem({
          kind: root.querySelector('input[name="ev-kind"]:checked')?.value,
          title: root.querySelector('#ev-title').value,
          hora: root.querySelector('#ev-hora').value,
          lugar: root.querySelector('#ev-lugar').value,
          nota: root.querySelector('#ev-nota').value
        });
        close();
        await saveDayEvents(dateISO, [...items, item], `${eventIcon(item)} ${eventTitle(item)} el ${formatDMY(dateISO)}`);
      });
      root.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
        const gone = items.find(ev => ev.id === btn.dataset.del);
        close();
        await saveDayEvents(dateISO, items.filter(ev => ev.id !== btn.dataset.del), `Quitado: ${eventTitle(gone)}`);
      }));
    }
  });
}

/**
 * Mark court/citation
 * @param {string} dateISO
 */
/** Ficha de juicio con juzgado y diligencias (se conserva; hoy el juicio se apunta como Evento → Juicio). */
export async function markJuicio(dateISO) {
  const existing = getState().days
    .find(d => d.dateISO === dateISO)
    ?.tags?.find(t => t.type === 'JUICIO');
  const m = existing?.meta || {};

  openSheet({
    title: `${dayName('JUICIO')} del ${formatDMY(dateISO)}`,
    body: `
      <div class="form-grid two">
        <label class="field"><span>Hora</span><input type="time" id="juicio-hora" value="${esc(m.hora || '')}"></label>
        <label class="field"><span>Juzgado</span><input type="text" id="juicio-juzgado" maxlength="80" placeholder="Ej: Juzgado de Instrucción nº 3" value="${esc(m.juzgado || '')}"></label>
        <label class="field"><span>Diligencias</span><input type="text" id="juicio-diligencias" maxlength="120" placeholder="Ej: Previas 132/2026" value="${esc(m.diligencias || '')}"></label>
      </div>
      <label class="field"><span>Notas</span><textarea id="juicio-notas" rows="3" maxlength="220" placeholder="Lo que conviene recordar">${esc(m.notas || '')}</textarea></label>`,
    footer: `
      <button type="button" class="btn" data-act="cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" data-act="save">Guardar</button>`,
    onMount(root, close) {
      const $ = (sel) => root.querySelector(sel);
      $('[data-act="cancel"]').addEventListener('click', close);
      $('[data-act="save"]').addEventListener('click', async () => {
        const undo = await addDayTag(dateISO, {
          type: 'JUICIO',
          meta: { hora: $('#juicio-hora').value, juzgado: $('#juicio-juzgado').value.trim(), diligencias: $('#juicio-diligencias').value.trim(), notas: $('#juicio-notas').value.trim() }
        });
        close();
        if (undo) Actions.showToast(`${dayName('JUICIO')} registrado`, typeof undo === 'function' ? { onAction: undo } : {});
      });
    }
  });
}

function renderTagSummary(tag, index, removable = false) {
  const info = dayInfo(tag.type);
  const meta = formatTagMeta(tag);
  const name = tag.type === 'OTRO' && tag.meta?.label ? tag.meta.label : info.name;
  const guard = tag.type === 'GUARDIA_REAL' || tag.type === 'GUARDIA_PLAN';
  return `<div class="ctx-btn ctx-event-info" style="cursor:default;opacity:0.96">
    <span class="ctx-icon ${info.iconCls}">${info.short}</span>
    <span style="flex:1">
      <strong style="font-size:var(--fs-sm)">${removable ? '' : `${index + 1}. `}${esc(name)}</strong>
      ${meta ? `<br><span style="font-size:var(--fs-xs);color:var(--text-muted)">${esc(meta)}</span>` : ''}
    </span>
    ${removable ? `<button type="button" class="tag-remove" data-remove="${esc(tag.type)}" aria-label="Quitar ${esc(name)}${guard ? ' de toda la semana' : ''}" title="Quitar${guard ? ' (toda la semana)' : ''}">✕</button>` : ''}
  </div>`;
}

/** What a day off is charged to: a guard (and which day of it), another reason, or nothing. */
function libreAttribution(dateISO, state, exento) {
  if (exento) return 'No computa: libre concedido.';
  const m = (state.ledger || []).find(x => x.kind === 'DEBIT' && x.category === 'LIBRE' && x.dateISO === dateISO);
  if (!m) return '';
  if (m.concepto) {
    if (m.compartida) return `Compensa la guardia del ${formatDMY(m.compartida.start)} al ${formatDMY(m.compartida.end)} (figura a nombre de ${displayNameOf(m.compartida.person)}): no gasta tus guardias.`;
    return `Por ${conceptLabel(m.concepto).toLowerCase()}: no gasta días de guardia.`;
  }
  if (!m.sourceRef) return 'No lo cubre ninguna guardia: si fue un día concedido, márcalo como «no computa».';
  const credit = (state.ledger || []).find(c => c.kind === 'CREDIT' && c.category === 'GUARDIA' && c.sourceRef === m.sourceRef && (!m.sourceDate || c.dateISO === m.sourceDate));
  const what = credit?.festivo ? `el festivo del ${formatDMY(credit.dateISO)}` : credit ? `la guardia de la semana del ${formatDMY(credit.dateISO)}` : `la guardia ${m.sourceRef}`;
  return `Compensa ${what}${m.porNota ? ' (según la nota)' : ''}${m.excede ? '; esa guardia ya tenía todos sus días' : ''}.`;
}

function displayNameOf(name) {
  const s = String(name || '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTagMeta(tag) {
  if (!tag.meta) return '';
  if (tag.type === 'EVENTO') return eventItems([tag]).map(ev => `${eventIcon(ev)} ${eventTitle(ev)}${ev.hora ? ' ' + ev.hora : ''}`).join(' · ');
  if (tag.type === 'JUICIO') {
    const juicioParts = [
      tag.meta.hora ? `Hora: ${tag.meta.hora}` : '',
      tag.meta.juzgado ? `Juzgado: ${tag.meta.juzgado}` : '',
      tag.meta.diligencias ? `Diligencias: ${tag.meta.diligencias}` : '',
      tag.meta.notas ? `Notas: ${tag.meta.notas}` : ''
    ].filter(Boolean);
    if (juicioParts.length > 0) return juicioParts.join(' · ');
  }

  let meta = '';
  if (tag.meta.label) meta = tag.meta.label;
  if (tag.meta.guardRef) meta = `Guardia: ${tag.meta.guardRef}`;
  if (tag.meta.ordinal) meta += ` (${tag.meta.ordinal})`;
  if (tag.meta.diasAfectados != null && tag.meta.diasAfectados !== 0) {
    meta += ` · ${tag.meta.diasAfectados > 0 ? '+' : ''}${tag.meta.diasAfectados} días`;
  }
  if (tag.meta.source === 'cuadrante') meta = (meta ? meta + ' · ' : '') + 'Importado';
  if (tag.meta.cambio) meta = (meta ? meta + ' · ' : '') + 'Cambio: la guardia de esa semana es de otra persona (tiene las notas)';
  if (tag.meta.note) meta = (meta ? meta + ' · ' : '') + `Nota del cuadrante: «${tag.meta.note}»`;
  return meta;
}

export function showOtrosDialog(dateISO) {
  openSheet({
    title: 'Otros eventos',
    variant: 'dialog',
    body: `
      <label class="field"><span>Concepto</span>
        <input type="text" id="otros-concepto" placeholder="Ej: comisión, curso…" maxlength="50" autofocus></label>
      <label class="field"><span>Días que suma o resta (+ o −)</span>
        <input type="number" id="otros-dias" value="0" min="-30" max="30"></label>`,
    footer: `
      <button type="button" class="btn" data-act="cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" data-act="ok">Aceptar</button>`,
    onMount(root, close) {
      const concepto = root.querySelector('#otros-concepto');
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      root.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        const text = concepto.value.trim();
        if (!text) {
          Actions.showToast('Escribe el concepto');
          concepto.focus();
          return;
        }
        const dias = parseInt(root.querySelector('#otros-dias').value) || 0;
        close();
        await markOtros(dateISO, text, dias);
      });
    }
  });
}
