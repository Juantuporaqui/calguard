/**
 * @module ui/settings/days
 * «Mis días»: cupos de este perfil y lo que trae del año pasado, con sus fechas
 * de corte. Cada campo se guarda solo al cambiarlo.
 */

import { getState, effectiveConfig } from '../../state/store.js';
import { getCarryover, apDeadline } from '../../domain/balances.js';
import { commitDayChanges } from '../../domain/changes.js';
import { updateActiveProfile } from '../../domain/profiles.js';
import { syncNow } from '../flows.js';
import { openCompensaciones } from '../compensaciones.js';
import { esc } from '../utils.js';
import { section, autosave, intRange, intOrNull } from './common.js';

/** Campos numéricos: id → [mín, máx, opcional]. */
const NUMS = {
  'cfg-ap': [0, 30], 'cfg-vac': [0, 60], 'cfg-dpg': [0, 15], 'cfg-dpf': [0, 10, true],
  'cfg-carry-libres': [0, 365], 'cfg-carry-ap': [0, 30], 'cfg-carry-vac': [0, 60]
};
const DATES = ['cfg-primer-libre', 'cfg-primer-ap', 'cfg-primer-vac', 'cfg-caduca-ap'];

/** Lo que la app ha deducido como del año pasado mientras no se indique. */
function estimateHint(b, year) {
  const parts = [
    b.libres.arrastreEstimado ? `${b.libres.arrastreEstimado} libre${b.libres.arrastreEstimado === 1 ? '' : 's'}` : '',
    b.ap.arrastreEstimado ? `${b.ap.arrastreEstimado} asunto${b.ap.arrastreEstimado === 1 ? '' : 's'} propio${b.ap.arrastreEstimado === 1 ? '' : 's'}` : '',
    b.vacaciones.arrastreEstimado ? `${b.vacaciones.arrastreEstimado} día${b.vacaciones.arrastreEstimado === 1 ? '' : 's'} de vacaciones` : ''
  ].filter(Boolean);
  if (!parts.length) return '';
  return `<p class="import-preview">Mientras no indiques los días del año pasado, la app deduce del cuadrante que ya disfrutaste de ${year - 1}: <strong>${esc(parts.join(', '))}</strong>. Si traías más, escríbelo abajo; lo que indiques manda.</p>`;
}

export function daysHTML(state) {
  const config = state.config;
  const eff = effectiveConfig(state);
  const profile = state.activeProfile;
  const year = state.balances.year;
  const carry = getCarryover(eff, year);
  return section('days', `Mis días ${year}`, 'Cupos y días que traes del año pasado', `
    <p class="set-help">Cada funcionario tiene sus propios cupos. Los <strong>días del año pasado</strong> son lo que traes pendiente de ${year - 1}; las <strong>fechas de corte</strong> indican cuándo empezaste a disfrutar lo de ${year}: lo anterior se descuenta de esos días, nunca del cupo nuevo. Se guarda solo al cambiar cada dato.</p>
    ${profile.fichaAdminAt ? `<p class="import-preview">El administrador configuró tu ficha el ${new Date(profile.fichaAdminAt).toLocaleDateString('es-ES')}. Si cambias algo, se queda lo tuyo (salvo que él vuelva a cambiar ese dato más tarde).</p>` : ''}
    ${estimateHint(state.balances, year)}
    <div class="form-grid three">
      <label class="field"><span>Asuntos propios al año</span><input type="number" id="cfg-ap" min="0" max="30" inputmode="numeric" value="${eff.asuntosAnuales ?? 8}"></label>
      <label class="field"><span>Vacaciones al año (días hábiles)</span><input type="number" id="cfg-vac" min="0" max="60" inputmode="numeric" value="${eff.vacacionesAnuales ?? 25}"></label>
      <label class="field"><span>Días libres por guardia</span><input type="number" id="cfg-dpg" min="0" max="15" inputmode="numeric" value="${eff.diasPorGuardia ?? 5}">
        <small>${Number(eff.diasPorGuardia) !== Number(config.diasPorGuardia) ? `Propio de este perfil (el grupo usa ${config.diasPorGuardia})` : 'Lo normal en el grupo. Cámbialo si a este perfil le corresponde otra compensación.'}</small></label>
      <label class="field"><span>Días por festivo suelto</span><input type="number" id="cfg-dpf" min="0" max="10" inputmode="numeric" placeholder="—" value="${eff.diasPorFestivo ?? ''}">
        <small>Un festivo trabajado sin guardia esa semana (p. ej. la jefa). Vacío: cuenta como una guardia.</small></label>
    </div>
    <div class="carry-grid">
      <div class="carry-col">
        <h4>Libres</h4>
        <label class="field"><span>Pendientes de ${year - 1}</span><input type="number" id="cfg-carry-libres" min="0" max="365" inputmode="numeric" value="${carry.libres}">
          ${state.balances?.libres?.arrastreAuto ? `<small>No se usa: el cuadrante y sus notas dan tus días del año pasado (${state.balances.libres.arrastre}).</small>` : ''}</label>
        <label class="field"><span>1.er libre de ${year} disfrutado el</span><input type="date" id="cfg-primer-libre" value="${carry.primerLibre || ''}"></label>
      </div>
      <div class="carry-col">
        <h4>Asuntos propios</h4>
        <label class="field"><span>Pendientes de ${year - 1}</span><input type="number" id="cfg-carry-ap" min="0" max="30" inputmode="numeric" value="${carry.ap}"></label>
        <label class="field"><span>Los de ${year - 1} valen hasta el</span><input type="date" id="cfg-caduca-ap" value="${apDeadline(eff, year)}" min="${year}-01-01" max="${year}-12-31">
          <small>Hasta ese día, los asuntos propios que disfrutes gastan primero los de ${year - 1}; después, lo que quede caduca.</small></label>
        <label class="field"><span>1.er asunto propio de ${year} disfrutado el (opcional)</span><input type="date" id="cfg-primer-ap" value="${carry.primerAP || ''}"></label>
      </div>
      <div class="carry-col">
        <h4>Vacaciones</h4>
        <label class="field"><span>Pendientes de ${year - 1}</span><input type="number" id="cfg-carry-vac" min="0" max="60" inputmode="numeric" value="${carry.vacaciones}"></label>
        <label class="field"><span>1.er día de vacaciones de ${year} el</span><input type="date" id="cfg-primer-vac" value="${carry.primerVac || ''}"></label>
      </div>
    </div>
    <button type="button" class="action-item" id="open-comps">
      <span class="action-ico" aria-hidden="true">➕</span><span><strong>Compensaciones</strong><small>Juicios, elecciones, servicios… aparte de las guardias</small></span>
    </button>`);
}

/**
 * Cambia la compensación por guardia de este perfil: actualiza sus guardias y,
 * si está vinculado al cuadrante, lo vuelve a repartir.
 */
async function applyDaysPerGuard(oldDpg, dpg) {
  const s = getState();
  const movPuts = s.ledger
    .filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && !m.festivo && Number(m.amount) === oldDpg)
    .map(m => ({ ...m, amount: dpg }));
  if (movPuts.length) await commitDayChanges({ movPuts, audit: { action: 'DIAS_POR_GUARDIA', detail: `${oldDpg} → ${dpg}` } });
  if (s.activeProfile?.cuadranteName) await syncNow();
}

export function bindDays(root) {
  const year = getState().balances.year;
  const val = (id) => root.querySelector('#' + id)?.value ?? '';
  // si otro campo está mal, se guarda lo que ya había para ese campo
  const numOr = (id, fallback) => {
    const [min, max, optional] = NUMS[id];
    if (intRange(min, max, { optional })(val(id))) return fallback;
    return intOrNull(val(id));
  };
  const dateOr = (id, fallback) => (validateDate(val(id)) ? fallback : (val(id) || null));
  const validateDate = (v) => (v && !v.startsWith(String(year)) ? `Tiene que ser una fecha de ${year}` : null);

  const save = async () => {
    const eff = effectiveConfig();
    const prev = eff.carryovers?.[year] || {};
    const carryovers = {
      ...(eff.carryovers || {}),
      [year]: {
        ...prev,
        libres: numOr('cfg-carry-libres', prev.libres ?? 0),
        ap: numOr('cfg-carry-ap', prev.ap ?? 0),
        vacaciones: numOr('cfg-carry-vac', prev.vacaciones ?? 0),
        primerLibre: dateOr('cfg-primer-libre', prev.primerLibre ?? null),
        primerAP: dateOr('cfg-primer-ap', prev.primerAP ?? null),
        primerVac: dateOr('cfg-primer-vac', prev.primerVac ?? null),
        caducaAP: dateOr('cfg-caduca-ap', prev.caducaAP ?? null)
      }
    };
    const oldDpg = Number(eff.diasPorGuardia) || 0;
    const dpg = numOr('cfg-dpg', oldDpg);
    const oldDpf = eff.diasPorFestivo ?? null;
    const dpf = numOr('cfg-dpf', oldDpf);
    await updateActiveProfile({
      // valor propio solo si es distinto del del grupo (así los cambios del grupo le siguen llegando)
      settings: {
        asuntosAnuales: numOr('cfg-ap', eff.asuntosAnuales ?? 8),
        vacacionesAnuales: numOr('cfg-vac', eff.vacacionesAnuales ?? 25),
        diasPorGuardia: dpg === Number(getState().config.diasPorGuardia) ? null : dpg,
        diasPorFestivo: dpf,
        carryovers
      }
    });
    if (dpg !== oldDpg) await applyDaysPerGuard(oldDpg, dpg);
    else if (dpf !== (oldDpf === null ? null : Number(oldDpf)) && getState().activeProfile?.cuadranteName) await syncNow();
    const b = getState().balances;
    return `Guardado · libres ${b.libres.disponibles} · asuntos propios ${b.ap.disponibles} · vacaciones ${b.vacaciones.disponibles}`;
  };

  for (const [id, [min, max, optional]] of Object.entries(NUMS)) {
    autosave(root.querySelector('#' + id), { validate: intRange(min, max, { optional }), save });
  }
  for (const id of DATES) autosave(root.querySelector('#' + id), { validate: validateDate, save });
  root.querySelector('#open-comps')?.addEventListener('click', () => openCompensaciones());
}
