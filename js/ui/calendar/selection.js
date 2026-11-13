/**
 * @module ui/calendar/selection
 * Modos de selección del calendario: varios días sueltos (pedir libres o
 * asuntos propios) y un rango (vacaciones). Mientras dura, una barra fija
 * arriba dice qué hacer y cuántos días van, con Cancelar y Confirmar.
 */

import { getState, Actions } from '../../state/store.js';
import { esc } from '../utils.js';
import { dayName } from '../labels.js';
import { requestLibres, requestAsuntos, requestRange } from './actions.js';
import { rangeDates, shortDate } from './grid.js';

// ─── Empezar ───

/** Pedir varios días libres (botón «＋ Pedir días» y «Pedir días libres» de Inicio). */
export function startPedirDias(dates = []) {
  Actions.setMultiSelect({ active: true, selectedDates: [...dates] });
  Actions.hideContextMenu();
}

/** Pedir asuntos propios (desde Inicio). */
export function startPedirAsuntos(dates = []) {
  Actions.setMultiSelect({ active: true, kind: 'AP', selectedDates: [...dates] });
  Actions.hideContextMenu();
}

/** Vacaciones desde un día del calendario: ese es el primero. */
export function startVacacionesRange(startDateISO) {
  Actions.setRangeSelection({ type: 'VACACIONES', startDate: startDateISO, endDate: null });
  Actions.hideContextMenu();
}

/** Pedir vacaciones desde Inicio: se eligen el primer y el último día (con mensaje al terminar). */
export function startPedirVacaciones() {
  Actions.setRangeSelection({ type: 'VACACIONES', startDate: null, endDate: null, pedir: true });
  Actions.hideContextMenu();
}

// ─── Qué se pinta ───

/** Días elegidos y rango marcado, para pintar la rejilla. */
export function selectionMarks(state) {
  if (state.multiSelect?.active) return { selected: new Set(state.multiSelect.selectedDates), range: null };
  const r = state.rangeSelection;
  if (r?.startDate) {
    const days = rangeDates(r.startDate, r.endDate || r.startDate);
    return { selected: new Set([r.startDate, r.endDate].filter(Boolean)), range: [days[0], days[days.length - 1]] };
  }
  return { selected: new Set(), range: null };
}

/** Barra fija superior: qué hacer, cuántos días van, Cancelar y Confirmar. */
export function selectionBarHTML(state) {
  let title, line, ready, kindSwitch = '';
  if (state.multiSelect?.active) {
    const isAP = state.multiSelect.kind === 'AP';
    const n = state.multiSelect.selectedDates.length;
    const left = isAP ? state.balances.ap.disponibles : state.balances.libres.disponibles;
    title = isAP ? 'Pedir asuntos propios' : 'Pedir días libres';
    kindSwitch = `
      <div class="segmented sel-kind" role="group" aria-label="Qué pides">
        <button type="button" class="seg-btn ${isAP ? '' : 'active'}" data-kind="libres" aria-pressed="${!isAP}">Libres</button>
        <button type="button" class="seg-btn ${isAP ? 'active' : ''}" data-kind="ap" aria-pressed="${isAP}">Asuntos propios</button>
      </div>`;
    line = `Toca los días · ${n} ${n === 1 ? 'seleccionado' : 'seleccionados'} · te ${left === 1 ? 'queda' : 'quedan'} ${left}`;
    ready = n > 0;
  } else {
    const r = state.rangeSelection;
    title = r.type === 'VACACIONES' ? dayName('VACACIONES') : 'Periodo';
    if (!r.startDate) { line = 'Toca el primer día'; ready = false; }
    else if (!r.endDate) { line = `Desde el ${shortDate(r.startDate)} · toca el último día (o confirma solo ese)`; ready = true; }
    else {
      const days = rangeDates(r.startDate, r.endDate);
      line = `Del ${shortDate(days[0])} al ${shortDate(days[days.length - 1])} · ${days.length} ${days.length === 1 ? 'día' : 'días'}`;
      ready = true;
    }
  }
  return `
    <div class="select-bar" role="region" aria-label="${esc(title)}">
      <p class="select-bar-text"><strong>${esc(title)}</strong><span aria-live="polite">${esc(line)}</span></p>
      ${kindSwitch}
      <div class="select-bar-actions">
        <button type="button" class="btn btn-sm" id="sel-cancel">Cancelar</button>
        <button type="button" class="btn btn-sm btn-primary" id="sel-confirm" ${ready ? '' : 'disabled'}>Confirmar</button>
      </div>
    </div>`;
}

// ─── Qué hace cada toque ───

/** Un toque en un día mientras se elige. */
export function selectionTap(iso) {
  const s = getState();
  if (s.multiSelect?.active) {
    const set = new Set(s.multiSelect.selectedDates);
    if (set.has(iso)) set.delete(iso); else set.add(iso);
    Actions.setMultiSelect({ ...s.multiSelect, active: true, selectedDates: [...set].sort() });
    return;
  }
  const r = s.rangeSelection;
  if (!r) return;
  if (!r.startDate || r.endDate) Actions.setRangeSelection({ ...r, startDate: iso, endDate: null });
  else if (iso === r.startDate) Actions.setRangeSelection({ ...r, startDate: null, endDate: null });
  else Actions.setRangeSelection({ ...r, endDate: iso });
}

export function bindSelectionBar(root) {
  // cambiar entre libres y asuntos propios sin perder los días tocados
  root.querySelectorAll('.sel-kind [data-kind]').forEach(btn => btn.addEventListener('click', () => {
    const m = getState().multiSelect;
    if (!m?.active) return;
    const kind = btn.dataset.kind === 'ap' ? 'AP' : undefined;
    if ((m.kind === 'AP') === (kind === 'AP')) return;
    Actions.setMultiSelect({ active: true, selectedDates: m.selectedDates, ...(kind ? { kind } : {}) });
  }));
  root.querySelector('#sel-cancel')?.addEventListener('click', () => {
    Actions.setMultiSelect(null);
    Actions.setRangeSelection(null);
  });
  root.querySelector('#sel-confirm')?.addEventListener('click', async () => {
    const s = getState();
    if (s.multiSelect?.active) {
      const dates = [...s.multiSelect.selectedDates];
      const ok = s.multiSelect.kind === 'AP' ? await requestAsuntos(dates) : await requestLibres(dates);
      if (ok !== false) Actions.setMultiSelect(null);
      return;
    }
    const r = s.rangeSelection;
    if (!r?.startDate) return;
    const ok = await requestRange({ type: r.type, start: r.startDate, end: r.endDate || r.startDate, pedir: r.pedir });
    if (ok) Actions.setRangeSelection(null);
  });
}
