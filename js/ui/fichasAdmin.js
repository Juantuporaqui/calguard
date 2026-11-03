/**
 * @module ui/fichasAdmin
 * El administrador rellena la ficha de cada policía (cupos, días libres por
 * guardia, arrastre del año anterior y caducidad de sus AP). Se guardan en el
 * perfil de cada uno en este dispositivo y viajan cifradas al publicar el
 * cuadrante: al instalar la app, cada compañero ya la tiene configurada.
 */

import { getState, Actions } from '../state/store.js';
import { loadGroupCuadrante, currentRoster } from '../domain/groupCuadrante.js';
import { ensureProfileForPerson, findProfileForPerson, updateProfileById, displayName } from '../domain/profiles.js';
import { apDeadline, getCarryover } from '../domain/balances.js';
import { openSheet } from './sheet.js';
import { avatarHTML, canPublish, publishSharedCuadrante } from './flows.js';
import { esc } from './utils.js';

/** Effective ficha values of a person on this device (profile settings over group config). */
function fichaOf(person, year) {
  const cfg = getState().config;
  const p = findProfileForPerson(person);
  const st = p?.settings || {};
  const merged = { ...cfg, ...Object.fromEntries(Object.entries(st).filter(([, v]) => v !== undefined && v !== null)) };
  const carry = getCarryover(merged, year);
  return {
    profile: p,
    ap: merged.asuntosAnuales ?? 8,
    vac: merged.vacacionesAnuales ?? 25,
    dpg: merged.diasPorGuardia ?? 5,
    dpf: merged.diasPorFestivo ?? null,
    carry,
    caducaAP: apDeadline(merged, year)
  };
}

/** List of the roster with each person's ficha. */
export async function openFichasSheet() {
  const data = await loadGroupCuadrante();
  const roster = data ? currentRoster(data.names, getState().config.escalafonOrder || []) : [];
  if (!roster.length) { Actions.showToast('Primero carga el cuadrante del grupo'); return; }
  const year = getState().balances.year;
  openSheet({
    title: 'Fichas de cada policía',
    body: `
      <p class="sheet-hint">Lo que pongas aquí le llega a cada uno al publicar el cuadrante. Después, cada cual puede cambiar lo suyo: manda el cambio más reciente.</p>
      <ul class="profile-list">
        ${roster.map(person => {
          const f = fichaOf(person, year);
          return `<li><button type="button" class="profile-item" data-person="${esc(person)}">
            ${avatarHTML(person)}
            <span class="profile-item-text">
              <strong>${esc(displayName(person))}</strong>
              <small>AP ${f.ap} · Vac ${f.vac} · ${f.dpg} días/guardia${f.dpf !== null ? ` · ${f.dpf}/festivo` : ''} · de ${year - 1}: ${f.carry.libres} L, ${f.carry.ap} AP, ${f.carry.vacaciones} V</small>
            </span>
            <span class="profile-item-check" aria-hidden="true">›</span>
          </button></li>`;
        }).join('')}
      </ul>`,
    footer: `<button type="button" class="btn btn-primary" data-act="publish">Publicar cuadrante y fichas</button>`,
    onMount(root, close) {
      root.querySelectorAll('[data-person]').forEach(btn => btn.addEventListener('click', () => {
        close();
        openFichaForm(btn.dataset.person);
      }));
      root.querySelector('[data-act="publish"]').addEventListener('click', async () => {
        close();
        await publishSharedCuadrante();
      });
    }
  });
}

/** Form for one person's ficha. */
function openFichaForm(person) {
  const year = getState().balances.year;
  const f = fichaOf(person, year);
  const group = getState().config;
  const num = (root, id) => Math.max(0, Number(root.querySelector('#' + id).value) || 0);
  openSheet({
    title: `Ficha de ${displayName(person)}`,
    body: `
      <div class="form-grid three">
        <label class="field"><span>Asuntos propios al año</span><input type="number" id="fi-ap" min="0" max="30" value="${f.ap}"></label>
        <label class="field"><span>Vacaciones al año (días hábiles)</span><input type="number" id="fi-vac" min="0" max="60" value="${f.vac}"></label>
        <label class="field"><span>Días libres por guardia</span><input type="number" id="fi-dpg" min="0" max="15" value="${f.dpg}"></label>
        <label class="field"><span>Días por festivo suelto</span><input type="number" id="fi-dpf" min="0" max="10" placeholder="—" value="${f.dpf ?? ''}">
          <small>INC en festivo sin guardia esa semana. Vacío: cuenta como guardia.</small></label>
      </div>
      <h4 class="fi-sub">Pendiente de ${year - 1}</h4>
      <div class="form-grid three">
        <label class="field"><span>Libres</span><input type="number" id="fi-libres" min="0" max="365" value="${f.carry.libres}"></label>
        <label class="field"><span>Asuntos propios</span><input type="number" id="fi-cap" min="0" max="30" value="${f.carry.ap}"></label>
        <label class="field"><span>Vacaciones</span><input type="number" id="fi-cvac" min="0" max="60" value="${f.carry.vacaciones}"></label>
      </div>
      <label class="field"><span>Los AP de ${year - 1} valen hasta el</span><input type="date" id="fi-caduca" value="${f.caducaAP}" min="${year}-01-01" max="${year}-12-31"></label>
      <p class="sheet-hint">${f.profile ? 'Se guarda en su perfil de este dispositivo y viaja cifrada al publicar.' : 'Se creará su perfil en este dispositivo para guardar la ficha.'}</p>`,
    footer: `
      <button type="button" class="btn" data-act="back">Volver</button>
      <button type="button" class="btn btn-primary" data-act="save">Guardar ficha</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="back"]').addEventListener('click', () => { close(); openFichasSheet(); });
      root.querySelector('[data-act="save"]').addEventListener('click', async () => {
        const caduca = root.querySelector('#fi-caduca').value || null;
        if (caduca && !caduca.startsWith(String(year))) { Actions.showToast(`La fecha debe ser de ${year}`); return; }
        const profile = await ensureProfileForPerson(person);
        const prevCarry = profile.settings?.carryovers || {};
        const dpg = num(root, 'fi-dpg');
        const dpfRaw = root.querySelector('#fi-dpf').value.trim();
        await updateProfileById(profile.id, {
          settings: {
            asuntosAnuales: num(root, 'fi-ap'),
            vacacionesAnuales: num(root, 'fi-vac'),
            diasPorGuardia: dpg === Number(group.diasPorGuardia ?? 5) ? null : dpg,
            diasPorFestivo: dpfRaw === '' ? null : Math.max(0, Number(dpfRaw) || 0),
            carryovers: {
              ...prevCarry,
              [year]: { ...(prevCarry[year] || {}), libres: num(root, 'fi-libres'), ap: num(root, 'fi-cap'), vacaciones: num(root, 'fi-cvac'), caducaAP: caduca }
            }
          }
        });
        close();
        const admin = await canPublish();
        Actions.showToast(`Ficha de ${displayName(person)} guardada${admin ? ' · se enviará al publicar' : ''}`,
          admin ? { actionLabel: 'Publicar', onAction: () => publishSharedCuadrante(), duration: 8000 } : {});
        openFichasSheet();
      });
    }
  });
}
