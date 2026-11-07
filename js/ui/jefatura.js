/**
 * @module ui/jefatura
 * Apartado Jefatura (la jefa y el administrador): cuántos días tiene cada uno
 * pendientes de compensar y por qué (guardias, juicios, elecciones…), con lo
 * que conviene revisar (libres sin guardia, guardias con más días de la
 * cuenta, notas sin guardia).
 *
 * Se calcula en este móvil con el cuadrante publicado, las fichas y las
 * compensaciones del grupo, con las MISMAS reglas que la contabilidad de cada
 * uno. Lo que alguien apunte solo en su móvil no aparece aquí.
 */

import { getState, Actions } from '../state/store.js';
import { loadGroupCuadrante, currentRoster, canonicalPerson, entriesForPerson } from '../domain/groupCuadrante.js';
import { buildFichas, unflattenSettings } from '../domain/fichas.js';
import { compsForPerson, customConcepts, compLabel, fmtDias } from '../domain/compensations.js';
import { groupNoteContext, accountingHints, conceptLabel } from '../domain/notes.js';
import { planCuadranteSync, movementsFromPlan } from '../domain/cuadranteSync.js';
import { computeBalances, guardsOfYear } from '../domain/balances.js';
import { displayName } from '../domain/profiles.js';
import { getGroupComps, setGroupComps } from '../domain/sharedCuadrante.js';
import { todayISO, formatDMY, getWeekDates } from '../domain/rules.js';
import { openSheet, confirmDialog } from './sheet.js';
import { openAddComp } from './compensaciones.js';
import { canPublish, myProfile, publishSharedCuadrante, avatarHTML } from './flows.js';
import { esc } from './utils.js';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const short = iso => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const list = dates => dates.map(short).join(', ');
const plural = (n, one, many) => `${fmtDias(n)} ${Number(n) === 1 || Number(n) === 0.5 ? one : many}`;

/** Is this device the chief's (her ficha says so) or the administrator's? */
export async function canSeeJefatura() {
  if (myProfile()?.settings?.jefatura === true) return true;
  return canPublish();
}

/**
 * Everyone's accounting for the current year, from the group cuadrante (pure
 * functions; nothing is written).
 */
export async function groupAccounts() {
  const data = await loadGroupCuadrante();
  if (!data?.entries?.length) return null;
  const s = getState();
  const escalafon = s.config.escalafonOrder || [];
  const roster = currentRoster(data.names, escalafon);
  // the fichas as published, with the ones edited on this device on top
  const fichas = { ...(data.fichas || {}), ...buildFichas(s.profiles) };
  const groupComps = s.config.groupComps || [];
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const desde = `${year}-01-01`;
  const { groupComps: _g, compensaciones: _c, meProfileId: _m, pinHash: _p, ...base } = s.config;
  const configs = {};
  for (const person of roster) {
    const values = Object.fromEntries(Object.entries(fichas[person]?.values || {}).filter(([, v]) => v !== null && v !== undefined));
    configs[person] = { ...unflattenSettings(base, values), compensaciones: compsForPerson(groupComps, person) };
  }
  const ctx = groupNoteContext(data.entries, {
    canonical: n => canonicalPerson(n, escalafon), configs, extraConcepts: customConcepts(groupComps)
  });
  return roster.map(person => {
    const config = configs[person];
    const hints = accountingHints(ctx, person, { config, desde });
    const r = planCuadranteSync({
      days: [], ledger: [], entries: entriesForPerson(data.entries, person, escalafon),
      profileId: person, desde, config, hints
    });
    const ledger = movementsFromPlan(r.plan, { profileId: person });
    const b = computeBalances(r.newDays, ledger, config, { today });
    const guards = guardsOfYear(ledger, year, config.diasPorGuardia ?? 5, today, config.libresExentos || []);
    return { person, b, guards, hints, days: r.newDays };
  });
}

function pendingGuards(a) {
  return a.guards.filter(g => g.worked && g.total - g.used > 0).map(g => ({ ...g, left: g.total - g.used }));
}

function issuesOf(a) {
  const out = [];
  const L = a.b.libres;
  if (L.sinCubrir?.length) out.push(`${L.sinCubrir.length === 1 ? '1 libre' : `${L.sinCubrir.length} libres`} sin guardia que lo cubra (${list(L.sinCubrir)})`);
  for (const g of a.guards.filter(x => x.excede)) out.push(`guardia del ${short(g.dateISO)}${g.prevYear ? ` de ${g.dateISO.slice(0, 4)}` : ''} con ${g.used} días (da ${g.total})`);
  for (const u of a.hints.undecided || []) {
    if (u.monday >= `${a.b.year - 1}-01-01`) out.push(`fin de semana del ${short(getWeekDates(u.monday)[5])} repartido con ${u.with.map(displayName).join(', ')} y sin notas: ¿de quién es la guardia?`);
  }
  const unmatched = (a.hints.unmatched || []).filter(u => u.date.startsWith(String(a.b.year)));
  if (unmatched.length) out.push(`${unmatched.length === 1 ? '1 CH' : `${unmatched.length} CH`} con nota que no cita guardia (${list(unmatched.map(u => u.date))})`);
  return out;
}

/** The Jefatura sheet. */
export async function openJefatura() {
  if (!(await canSeeJefatura())) { Actions.showToast('Solo para la jefatura y el administrador'); return; }
  Actions.setBusy('Calculando los días de cada uno…');
  let accounts;
  try { accounts = await groupAccounts(); } finally { Actions.setBusy(null); }
  if (!accounts) { Actions.showToast('Primero carga o recibe el cuadrante del grupo'); return; }
  const admin = await canPublish();
  const year = accounts[0]?.b.year;
  const groupComps = await getGroupComps();
  openSheet({
    title: `Jefatura · pendientes ${year}`,
    body: `
      <p class="sheet-hint">Días que cada uno tiene por disfrutar y por qué, según el cuadrante publicado y sus notas.</p>
      <ul class="jefa-list">
        ${accounts.map(a => {
          const L = a.b.libres;
          const pg = pendingGuards(a);
          const guardDays = pg.reduce((n, g) => n + g.left, 0);
          const comps = (L.compensaciones || []).filter(c => c.pendientes > 0);
          const issues = issuesOf(a);
          return `<li><button type="button" class="jefa-row ${L.disponibles < 0 ? 'neg' : ''}" data-person="${esc(a.person)}">
            ${avatarHTML(a.person)}
            <span class="jefa-main">
              <strong>${esc(displayName(a.person))}</strong>
              <small>${guardDays ? `${plural(guardDays, 'día', 'días')} de ${pg.length === 1 ? '1 guardia' : `${pg.length} guardias`}` : 'Guardias al día'}${comps.map(c => ` · ${fmtDias(c.pendientes)} ${esc(c.label.toLowerCase())}`).join('')}</small>
              <small>AP ${a.b.ap.disponibles} · Vac ${a.b.vacaciones.disponibles}${L.reservados ? ` · ${L.reservados} pedidos` : ''}</small>
              ${issues.length ? `<small class="jefa-warn">⚠ ${issues.length === 1 ? '1 cosa' : `${issues.length} cosas`} que revisar</small>` : ''}
            </span>
            <span class="jefa-num"><b>${fmtDias(L.disponibles)}</b><small>para pedir</small></span>
          </button></li>`;
        }).join('')}
      </ul>
      <h4 class="qd-title">Compensaciones del grupo</h4>
      ${groupComps.length ? `<ul class="gd-list">${groupComps.map(c => `
        <li class="gd-item prev"><span class="gd-dot" aria-hidden="true"></span>
          <span>${esc(compLabel(c))} · ${esc(formatDMY(c.fecha))}<br><small class="gd-note">${c.personas?.includes('*') ? 'Todo el grupo' : esc((c.personas || []).map(displayName).join(', '))}${c.nota ? ` · ${esc(c.nota)}` : ''}</small></span>
          <small>${fmtDias(c.dias)} ${Number(c.dias) <= 1 ? 'día' : 'días'}${admin ? ` · <button type="button" class="link-btn" data-del="${esc(c.id)}">Quitar</button>` : ''}</small></li>`).join('')}</ul>`
        : '<p class="sheet-hint">Ninguna todavía (p. ej. el día de las elecciones para todos).</p>'}
      <p class="sheet-hint muted">Se calcula con el cuadrante, las fichas y las compensaciones del grupo. Lo que alguien apunte solo en su móvil no aparece aquí.</p>`,
    footer: admin
      ? `<button type="button" class="btn" data-act="add">＋ Compensación para el grupo</button>
         <button type="button" class="btn btn-primary" data-act="publish">Publicar</button>`
      : '',
    onMount(root, close) {
      root.querySelectorAll('[data-person]').forEach(b => b.addEventListener('click', () => {
        openPersonDetail(accounts.find(a => a.person === b.dataset.person));
      }));
      root.querySelector('[data-act="add"]')?.addEventListener('click', () => { close(); openAddComp({ group: true, concepto: 'elecciones', onDone: () => openJefatura() }); });
      root.querySelector('[data-act="publish"]')?.addEventListener('click', async () => { close(); await publishSharedCuadrante(); });
      root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        const c = groupComps.find(x => x.id === b.dataset.del);
        if (!(await confirmDialog({ title: 'Quitar compensación del grupo', message: `${compLabel(c)} del ${formatDMY(c.fecha)}. Se quitará a todos al publicar.`, confirmLabel: 'Quitar' }))) return;
        await setGroupComps(groupComps.filter(x => x.id !== c.id));
        Actions.setConfig({ groupComps: await getGroupComps() });
        close();
        Actions.showToast('Quitada · se aplicará al publicar', { actionLabel: 'Publicar', onAction: () => publishSharedCuadrante(), duration: 8000 });
        openJefatura();
      }));
    }
  });
}

/** One person's detail: pending guards, compensations, quotas and what to check. */
function openPersonDetail(a) {
  if (!a) return;
  const L = a.b.libres;
  const pg = pendingGuards(a);
  const issues = issuesOf(a);
  const implicit = (L.porConcepto || []).filter(c => !(L.compensaciones || []).some(x => x.concepto === c.concepto));
  openSheet({
    title: displayName(a.person),
    body: `
      <div class="mini-stats three">
        <div class="mini-stat"><strong>${fmtDias(L.disponibles)}</strong><span>libres para pedir</span></div>
        <div class="mini-stat"><strong>${a.b.ap.disponibles}</strong><span>AP</span></div>
        <div class="mini-stat"><strong>${a.b.vacaciones.disponibles}</strong><span>vacaciones</span></div>
      </div>
      ${issues.length ? `<div class="notice notice-warn"><span>${issues.map(esc).join('<br>')}</span></div>` : ''}
      <h4 class="qd-title">Guardias con días pendientes</h4>
      ${pg.length ? `<ul class="gd-list">${pg.map(g => `
        <li class="gd-item on"><span class="gd-dot" aria-hidden="true"></span>
          <span>${g.festivo ? `Festivo ${short(g.dateISO)}` : `Semana del ${short(g.dateISO)}`}${g.prevYear ? ` de ${g.dateISO.slice(0, 4)}` : ''}</span>
          <small>${plural(g.left, 'pendiente', 'pendientes')} de ${g.total}</small></li>`).join('')}</ul>`
        : '<p class="sheet-hint">Ninguna: ha disfrutado o pedido todos los días de sus guardias.</p>'}
      ${L.reservados ? `<p class="sheet-hint">Ya pedidos: ${list(L.reservadosFechas)}.</p>` : ''}
      ${(L.compensaciones || []).length ? `<h4 class="qd-title">Compensaciones</h4><ul class="gd-list">${L.compensaciones.map(c => `
        <li class="gd-item prev"><span class="gd-dot" aria-hidden="true"></span><span>${esc(c.label)}</span>
          <small>${fmtDias(c.recibidos)} concedidos · ${c.disfrutados} disfrutados · <b>${fmtDias(c.pendientes)} pendientes</b>${c.previstos ? ` · +${fmtDias(c.previstos)} más adelante` : ''}</small></li>`).join('')}</ul>` : ''}
      ${implicit.length ? `<p class="sheet-hint">Por otros motivos (según las notas, no gastan guardias): ${implicit.map(c => `${c.fechas.length} por ${esc(conceptLabel(c.concepto).toLowerCase())}`).join(', ')}.</p>` : ''}
      ${L.arrastre ? `<p class="sheet-hint">Arrastre de ${a.b.year - 1}: ${L.arrastre} (${L.delArrastre} ya usados)${L.arrastreAuto ? ', según el cuadrante' : ''}.</p>` : ''}
      <p class="sheet-hint muted">AP: ${a.b.ap.disfrutados} disfrutados, ${a.b.ap.planificados} pedidos de ${a.b.ap.cupo}${a.b.ap.delArrastre ? ` (+${a.b.ap.delArrastre} de ${a.b.year - 1})` : ''} · Vacaciones: ${a.b.vacaciones.disfrutados} + ${a.b.vacaciones.planificados} de ${a.b.vacaciones.cupo}.</p>`
  });
}
