/**
 * @module ui/compensaciones
 * Añadir y consultar días de compensación que no salen de una guardia:
 * juicios (½ día), elecciones, servicios extraordinarios, eventos, el Patrón u
 * otro motivo. Cada uno apunta las suyas; el administrador, las del grupo.
 */

import { getState, Actions, effectiveConfig } from '../state/store.js';
import { COMP_KINDS, compLabel, conceptOf, fmtDias } from '../domain/compensations.js';
import { conceptLabel } from '../domain/notes.js';
import { updateActiveProfile, displayName } from '../domain/profiles.js';
import { getGroupComps, setGroupComps } from '../domain/sharedCuadrante.js';
import { loadGroupCuadrante, currentRoster } from '../domain/groupCuadrante.js';
import { syncActiveProfile, defaultSyncStart } from '../domain/cuadranteSync.js';
import { todayISO, formatDMY } from '../domain/rules.js';
import { openSheet, confirmDialog } from './sheet.js';
import { esc } from './utils.js';
import { infoBtn } from './glossary.js';

const plural = (n, one, many) => `${fmtDias(n)} ${Number(n) === 1 || Number(n) === 0.5 ? one : many}`;

/** Re-read the notes when a new named motive appears (its CH may name it). */
async function resyncIfNamed(comp) {
  if (comp?.concepto !== 'otro') return;
  const p = getState().activeProfile;
  const data = await loadGroupCuadrante();
  if (!p?.cuadranteName || !data?.entries?.length) return;
  try { await syncActiveProfile({ entries: data.entries, person: p.cuadranteName, desde: p.syncDesde || defaultSyncStart() }); } catch { /* the count is still right */ }
}

/**
 * Form to add a compensation.
 * @param {{fecha?: string, concepto?: string, group?: boolean, onDone?: Function}} [opts]
 *  group: for the group (administrator), choosing who gets it
 */
export async function openAddComp({ fecha = todayISO(), concepto = 'juicio', group = false, onDone } = {}) {
  let roster = [];
  if (group) {
    const data = await loadGroupCuadrante();
    roster = data ? currentRoster(data.names, getState().config.escalafonOrder || []) : [];
  }
  const kind = COMP_KINDS.find(k => k.key === concepto) || COMP_KINDS[0];
  openSheet({
    title: group ? 'Compensación para el grupo' : 'Añadir días de compensación',
    body: `
      <p class="sheet-hint">${group
        ? 'Para días que se compensan aparte de las guardias (elecciones, un servicio…). Llegan a cada uno al publicar.'
        : 'Días que te compensan aparte de las guardias. Suman a tus libres cuando llega la fecha.'}</p>
      <fieldset class="comp-field"><legend>Motivo</legend>
        <div class="choice-chips" role="radiogroup">
          ${COMP_KINDS.map(k => `<label class="seg-opt"><input type="radio" name="comp-kind" value="${k.key}" ${k.key === kind.key ? 'checked' : ''}><span>${esc(k.label)}</span></label>`).join('')}
        </div>
        <p class="comp-kind-hint muted" id="comp-kind-hint">${esc(kind.hint || '')}</p>
      </fieldset>
      <label class="field" id="comp-other" ${kind.key === 'otro' ? '' : 'hidden'}><span>¿Qué motivo?</span>
        <input type="text" id="comp-label" maxlength="60" placeholder="Ej.: Incendio Paiporta">
        <small>Si un CH del cuadrante lleva este nombre en su nota, gasta esta compensación.</small></label>
      <div class="form-grid">
        <label class="field"><span>Fecha</span><input type="date" id="comp-date" value="${esc(fecha)}"></label>
        <fieldset class="comp-field"><legend>Días</legend>
          <div class="choice-chips" role="radiogroup" id="comp-days">
            ${[0.5, 1, 2, 3].map(n => `<label class="seg-opt"><input type="radio" name="comp-days" value="${n}" ${n === kind.dias ? 'checked' : ''}><span>${fmtDias(n)}</span></label>`).join('')}
            <label class="seg-opt"><input type="radio" name="comp-days" value="otro"><span>Otro</span></label>
          </div>
          <input type="number" id="comp-days-n" min="0.5" max="30" step="0.5" value="4" hidden aria-label="Número de días">
        </fieldset>
      </div>
      <label class="field"><span>Nota (opcional)</span><input type="text" id="comp-note" maxlength="100" placeholder="Ej.: Penal 12, citado a las 10:00"></label>
      ${group ? `
        <fieldset class="comp-field"><legend>Para quién</legend>
          <label class="check-row"><input type="checkbox" id="comp-all" checked> <strong>Todo el grupo</strong></label>
          <div class="comp-people" id="comp-people" hidden>
            ${roster.map(p => `<label class="check-row"><input type="checkbox" name="comp-p" value="${esc(p)}"> ${esc(displayName(p))}</label>`).join('')}
          </div>
        </fieldset>` : ''}`,
    footer: `
      <button type="button" class="btn" data-act="cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" data-act="save">Añadir</button>`,
    onMount(root, close) {
      const $ = sel => root.querySelector(sel);
      root.querySelectorAll('input[name="comp-kind"]').forEach(r => r.addEventListener('change', () => {
        const k = COMP_KINDS.find(x => x.key === r.value);
        $('#comp-other').hidden = r.value !== 'otro';
        $('#comp-kind-hint').textContent = k?.hint || '';
        const d = root.querySelector(`input[name="comp-days"][value="${k?.dias}"]`);
        if (d) d.checked = true;
        $('#comp-days-n').hidden = true;
      }));
      root.querySelectorAll('input[name="comp-days"]').forEach(r => r.addEventListener('change', () => {
        $('#comp-days-n').hidden = r.value !== 'otro';
      }));
      $('#comp-all')?.addEventListener('change', e => { $('#comp-people').hidden = e.target.checked; });
      $('[data-act="cancel"]').addEventListener('click', close);
      $('[data-act="save"]').addEventListener('click', async () => {
        const concepto = root.querySelector('input[name="comp-kind"]:checked')?.value || 'otro';
        const etiqueta = $('#comp-label').value.trim();
        if (concepto === 'otro' && !etiqueta) { Actions.showToast('Escribe el motivo'); $('#comp-label').focus(); return; }
        const fechaV = $('#comp-date').value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaV)) { Actions.showToast('Indica la fecha'); return; }
        const dv = root.querySelector('input[name="comp-days"]:checked')?.value;
        const dias = dv === 'otro' ? Number($('#comp-days-n').value) : Number(dv);
        if (!(dias > 0) || dias > 30 || Math.round(dias * 2) !== dias * 2) { Actions.showToast('Los días van de medio en medio (½, 1, 1½…)'); return; }
        const comp = {
          id: crypto.randomUUID(), fecha: fechaV, concepto, dias,
          ...(concepto === 'otro' ? { etiqueta } : {}),
          ...($('#comp-note').value.trim() ? { nota: $('#comp-note').value.trim() } : {}),
          creada: new Date().toISOString()
        };
        if (group) {
          const all = $('#comp-all').checked;
          const personas = all ? ['*'] : [...root.querySelectorAll('input[name="comp-p"]:checked')].map(i => i.value);
          if (!personas.length) { Actions.showToast('Elige a quién'); return; }
          await setGroupComps([...(await getGroupComps()), { ...comp, personas }]);
          Actions.setConfig({ groupComps: await getGroupComps() });
          close();
          const { publishSharedCuadrante } = await import('./flows.js');
          Actions.showToast(`Añadido: ${fmtDias(dias)} ${dias > 1 ? 'días' : 'día'} por ${compLabel(comp).toLowerCase()} (${formatDMY(fechaV)}) · se enviará al publicar`,
            { actionLabel: 'Publicar', onAction: () => publishSharedCuadrante(), duration: 9000 });
        } else {
          const list = [...(getState().activeProfile?.compensaciones || []), comp];
          await updateActiveProfile({ compensaciones: list });
          close();
          Actions.showToast(`Añadido: ${fmtDias(dias)} ${dias > 1 ? 'días' : 'día'} por ${compLabel(comp).toLowerCase()} (${formatDMY(fechaV)})`, {
            actionLabel: 'Deshacer',
            onAction: async () => {
              await updateActiveProfile({ compensaciones: (getState().activeProfile?.compensaciones || []).filter(c => c.id !== comp.id) });
            }
          });
          await resyncIfNamed(comp);
        }
        onDone?.();
      });
    }
  });
}

/** What the active person has been compensated apart from guards, and what is left. */
export function openCompensaciones() {
  const s = getState();
  const L = s.balances.libres;
  const comps = effectiveConfig(s).compensaciones || [];
  const summaries = L.compensaciones || [];
  const implicit = (L.porConcepto || []).filter(c => !summaries.some(x => x.concepto === c.concepto));
  const year = s.balances.year;
  openSheet({
    title: 'Compensaciones aparte de guardias',
    body: `
      <p class="sheet-hint">Días que te deben por algo que no es una guardia ${infoBtn('compensacion')}</p>
      ${summaries.length ? `<ul class="comp-summary">${summaries.map(c => `
        <li><strong>${esc(c.label)}</strong>
          <span>${plural(c.recibidos, 'día', 'días')} concedido${c.recibidos === 1 || c.recibidos === 0.5 ? '' : 's'} · ${c.disfrutados} disfrutado${c.disfrutados === 1 ? '' : 's'}${c.previstos ? ` · +${fmtDias(c.previstos)} más adelante` : ''}</span>
          <em class="${c.pendientes ? 'pos' : ''}">${fmtDias(c.pendientes)} por disfrutar</em></li>`).join('')}</ul>` : ''}
      ${implicit.length ? `<p class="sheet-hint">Según las notas del cuadrante, ${implicit.map(c => `${c.fechas.length} CH por ${esc(conceptLabel(c.concepto).toLowerCase())}`).join(', ')} de ${year} no gastan guardias.</p>` : ''}
      <h4 class="qd-title">Apuntadas</h4>
      ${comps.length ? `<ul class="gd-list">${comps.map(c => `
        <li class="gd-item ${c.origen === 'grupo' ? 'prev' : 'on'}"><span class="gd-dot" aria-hidden="true"></span>
          <span>${esc(compLabel(c))} · ${esc(formatDMY(c.fecha))}${c.nota ? `<br><small class="gd-note">${esc(c.nota)}</small>` : ''}</span>
          <small>${fmtDias(c.dias)} ${Number(c.dias) <= 1 ? 'día' : 'días'} · ${c.origen === 'grupo' ? 'del grupo' : `<button type="button" class="link-btn" data-del="${esc(c.id)}">Quitar</button>`}</small></li>`).join('')}</ul>`
        : '<p class="sheet-hint">Aún no hay ninguna. Por ejemplo: medio día por un juicio fuera de tu turno, o el día que den por las elecciones.</p>'}
      <p class="sheet-hint muted">Un CH del cuadrante cuya nota dice el motivo («CH juicio…», «CH elecciones») gasta su compensación y no gasta guardias.</p>`,
    footer: `<button type="button" class="btn btn-primary btn-block" data-act="add">＋ Añadir compensación</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="add"]').addEventListener('click', () => { close(); openAddComp({ onDone: () => {} }); });
      root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        const c = comps.find(x => x.id === b.dataset.del);
        const ok = await confirmDialog({ title: 'Quitar compensación', message: `${compLabel(c)} del ${formatDMY(c.fecha)} (${fmtDias(c.dias)} días).`, confirmLabel: 'Quitar' });
        if (!ok) return;
        await updateActiveProfile({ compensaciones: (getState().activeProfile?.compensaciones || []).filter(x => x.id !== c.id) });
        close();
        Actions.showToast('Compensación quitada');
        openCompensaciones();
      }));
    }
  });
}

export { conceptOf };
