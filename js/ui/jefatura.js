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
import { buildFichas, unflattenSettings, ownProfile, hasJefatura, jefaturaStatus } from '../domain/fichas.js';
import { compsForPerson, customConcepts, compLabel, fmtDias } from '../domain/compensations.js';
import { groupNoteContext, accountingHints, conceptLabel, noteOrdinal } from '../domain/notes.js';
import { planCuadranteSync, movementsFromPlan } from '../domain/cuadranteSync.js';
import { computeBalances, guardsOfYear } from '../domain/balances.js';
import { displayName } from '../domain/profiles.js';
import { getGroupComps, setGroupComps, getGroupOrden, setGroupOrden } from '../domain/sharedCuadrante.js';
import { todayISO, formatDMY, getWeekDates } from '../domain/rules.js';
import { openSheet, confirmDialog } from './sheet.js';
import { openAddComp } from './compensaciones.js';
import { canPublish, publishSharedCuadrante, avatarHTML, syncNow } from './flows.js';
import { esc } from './utils.js';
import { icon } from './icons.js';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const short = iso => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const list = dates => dates.map(short).join(', ');
const plural = (n, one, many) => `${fmtDias(n)} ${Number(n) === 1 || Number(n) === 0.5 ? one : many}`;

/**
 * Is this device the administrator's, or that of someone whose ficha has
 * «Jefatura» (the chief)? The published ficha decides, so it shows as soon as
 * the publication arrives, even if «¿Quién eres?» was skipped.
 */
export async function canSeeJefatura() {
  if (await canPublish()) return true;
  const s = getState();
  const me = ownProfile(s.profiles, s.config.meProfileId);
  if (!me) return false;
  let published = {};
  try { published = (await loadGroupCuadrante())?.fichas || {}; } catch { /* nothing received yet */ }
  return hasJefatura(me, published);
}

/** Administrator: who sees this section, and what is still to be published. */
function jefaturaWhoHTML(data) {
  const { ven, porPublicar, porQuitar } = jefaturaStatus(data?.fichas || {}, buildFichas(getState().profiles));
  const names = l => l.map(displayName).join(', ');
  return `
    <p class="sheet-hint">${icon('shield', 'inline-icon')} La ves tú (administrador)${ven.length ? ` y ${esc(names(ven))}` : ''}.${ven.length || porPublicar.length ? '' : ' Para que la vea alguien más: Ajustes → Administración → Fichas de cada policía → su nombre → «Jefatura», y Publicar.'}</p>
    ${porPublicar.length ? `<p class="notice notice-warn">${esc(names(porPublicar))}: «Jefatura» marcada en la ficha, pero sin publicar. No la verá hasta que pulses Publicar.</p>` : ''}
    ${porQuitar.length ? `<p class="notice notice-warn">${esc(names(porQuitar))}: «Jefatura» quitada de la ficha, pero la sigue viendo hasta que pulses Publicar.</p>` : ''}`;
}

/**
 * Everyone's accounting for the current year, from the group cuadrante (pure
 * functions; nothing is written).
 */
export async function groupAccounts({ overrides = {}, only = null } = {}) {
  const data = await loadGroupCuadrante();
  if (!data?.entries?.length) return null;
  const s = getState();
  const escalafon = s.config.escalafonOrder || [];
  const roster = currentRoster(data.names, escalafon);
  // the fichas as published, with the ones edited on this device on top
  const fichas = { ...(data.fichas || {}), ...buildFichas(s.profiles) };
  const groupComps = s.config.groupComps || [];
  const orden = s.config.groupOrden || {};
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const desde = `${year}-01-01`;
  const { groupComps: _g, groupOrden: _o, compensaciones: _c, meProfileId: _m, pinHash: _p, ...base } = s.config;
  const configs = {};
  for (const person of roster) {
    const values = Object.fromEntries(Object.entries(fichas[person]?.values || {}).filter(([, v]) => v !== null && v !== undefined));
    const ordenDesde = Object.prototype.hasOwnProperty.call(overrides, person) ? overrides[person] : (orden[person] || null);
    configs[person] = { ...unflattenSettings(base, values), compensaciones: compsForPerson(groupComps, person), ordenDesde };
  }
  const ctx = groupNoteContext(data.entries, {
    canonical: n => canonicalPerson(n, escalafon), configs, extraConcepts: customConcepts(groupComps)
  });
  return roster.filter(person => !only || person === only).map(person => {
    const config = configs[person];
    const hints = accountingHints(ctx, person, { config, desde });
    const r = planCuadranteSync({
      days: [], ledger: [], entries: entriesForPerson(data.entries, person, escalafon),
      profileId: person, desde, config, hints
    });
    const ledger = movementsFromPlan(r.plan, { profileId: person });
    const b = computeBalances(r.newDays, ledger, config, { today });
    const guards = guardsOfYear(ledger, year, config.diasPorGuardia ?? 5, today, config.libresExentos || []);
    return { person, b, guards, hints, days: r.newDays, ledger, ordenDesde: config.ordenDesde || null };
  });
}

function pendingGuards(a) {
  return a.guards.filter(g => g.worked && !g.cerrada && g.total - g.used > 0).map(g => ({ ...g, left: g.total - g.used }));
}

function issuesOf(a) {
  const out = [];
  const L = a.b.libres;
  if (L.sinCubrir?.length) out.push(`${L.sinCubrir.length === 1 ? '1 libre' : `${L.sinCubrir.length} libres`} sin guardia que lo cubra (${list(L.sinCubrir)})`);
  for (const g of a.guards.filter(x => x.excede)) out.push(`guardia del ${short(g.dateISO)}${g.prevYear ? ` de ${g.dateISO.slice(0, 4)}` : ''} con ${g.used} días (da ${g.total})`);
  const closed = new Set((L.cerradas || []).map(c => c.dateISO));
  for (const u of a.hints.undecided || []) {
    if (u.monday >= `${a.b.year - 1}-01-01` && !closed.has(u.monday)) out.push(`fin de semana del ${short(getWeekDates(u.monday)[5])} repartido con ${u.with.map(displayName).join(', ')} y sin notas: ¿de quién es la guardia?`);
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
  const who = admin ? jefaturaWhoHTML(await loadGroupCuadrante().catch(() => null)) : '';
  openSheet({
    title: `Jefatura · pendientes ${year}`,
    body: `
      <p class="sheet-hint">Días que cada uno tiene por disfrutar y por qué, según el cuadrante publicado y sus notas.</p>
      ${who}
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
              ${(L.cerradas || []).length ? `<small>${plural(L.cerradas.reduce((n, c) => n + c.dias, 0), 'día cerrado', 'días cerrados')} por orden</small>` : ''}
              <small>Asuntos propios ${a.b.ap.disponibles} · Vacaciones ${a.b.vacaciones.disponibles}${L.reservados ? ` · ${L.reservados} pedidos` : ''}</small>
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
        openPersonDetail(accounts.find(a => a.person === b.dataset.person), { admin });
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
function openPersonDetail(a, { admin = false } = {}) {
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
        <div class="mini-stat"><strong>${a.b.ap.disponibles}</strong><span>Asuntos propios</span></div>
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
      ${(L.cerradas || []).length ? `<h4 class="qd-title">Guardias cerradas por orden</h4><ul class="gd-list">${L.cerradas.map(c => `
        <li class="gd-item prev"><span class="gd-dot" aria-hidden="true"></span>
          <span>${c.festivo ? `Festivo ${short(c.dateISO)}` : `Semana del ${short(c.dateISO)}`}${c.prevYear ? ` de ${c.dateISO.slice(0, 4)}` : ''}<br><small class="gd-note">después se compensó entera la del ${short(c.por)}${c.por.slice(0, 4) !== c.dateISO.slice(0, 4) ? ` de ${c.por.slice(0, 4)}` : ''}</small></span>
          <small>${plural(c.dias, 'día no cuenta', 'días no cuentan')}</small></li>`).join('')}</ul>
        <p class="sheet-hint">Los días se gastan por orden. Si alguno de estos sí está pendiente, apúntalo como compensación para esa persona.</p>` : ''}
      ${a.ordenDesde ? `<div class="orden-box">
          <p class="sheet-hint">Sus CH desde el ${formatDMY(a.ordenDesde)} cuentan <strong>en orden</strong>: cada uno, para la guardia abierta más antigua (no la que diga la nota).</p>
          <div class="orden-actions">
            <button type="button" class="btn btn-sm" data-act="orden-lista">Lista para corregir el Excel</button>
            ${admin ? '<button type="button" class="btn btn-sm" data-act="orden-quitar">Quitar</button>' : ''}
          </div></div>`
        : admin ? `<div class="orden-box">
          <button type="button" class="btn btn-sm" data-act="orden">Poner sus CH en orden…</button>
          <small>Para quien no pide los días por orden: desde una fecha, cada CH cuenta para la guardia abierta más antigua, y se prepara la lista para corregir las notas del Excel.</small></div>` : ''}
      ${(L.compensaciones || []).length ? `<h4 class="qd-title">Compensaciones</h4><ul class="gd-list">${L.compensaciones.map(c => `
        <li class="gd-item prev"><span class="gd-dot" aria-hidden="true"></span><span>${esc(c.label)}</span>
          <small>${fmtDias(c.recibidos)} concedidos · ${c.disfrutados} disfrutados · <b>${fmtDias(c.pendientes)} pendientes</b>${c.previstos ? ` · +${fmtDias(c.previstos)} más adelante` : ''}</small></li>`).join('')}</ul>` : ''}
      ${implicit.length ? `<p class="sheet-hint">Por otros motivos (según las notas, no gastan guardias): ${implicit.map(c => `${c.fechas.length} por ${esc(conceptLabel(c.concepto).toLowerCase())}`).join(', ')}.</p>` : ''}
      ${L.arrastreRestante || L.delArrastre ? `<p class="sheet-hint">Días del año pasado: ${L.arrastreRestante} pendientes (${L.delArrastre} ya usados)${L.arrastreAuto ? ', según el cuadrante' : ''}.</p>` : ''}
      ${L.arrastreManualIgnorado != null ? `<p class="sheet-hint">Su ficha tiene ${plural(L.arrastreManualIgnorado, 'libre', 'libres')} de ${a.b.year - 1} apuntados a mano: no se usan, mandan los días del año pasado que salen del cuadrante.</p>` : ''}
      <p class="sheet-hint muted">Asuntos propios: ${a.b.ap.disfrutados} disfrutados, ${a.b.ap.planificados} pedidos de ${a.b.ap.cupo}${a.b.ap.delArrastre ? ` (+${a.b.ap.delArrastre} de ${a.b.year - 1})` : ''} · Vacaciones: ${a.b.vacaciones.disfrutados} + ${a.b.vacaciones.planificados} de ${a.b.vacaciones.cupo}.</p>`,
    onMount(root, close) {
      root.querySelector('[data-act="orden"]')?.addEventListener('click', () => openOrdenar(a));
      root.querySelector('[data-act="orden-lista"]')?.addEventListener('click', () => openOrdenLista(a));
      root.querySelector('[data-act="orden-quitar"]')?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: 'Quitar el orden', message: `Los CH de ${displayName(a.person)} volverán a contar para la guardia que diga su nota.`, confirmLabel: 'Quitar' }))) return;
        await saveOrden(a.person, null);
        close();
      });
    }
  });
}

// ─── CH en orden (quien no pide los días correlativamente) ───

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "9-15 marzo", "30 marzo-5 abril" */
function weekLabel(monday) {
  const sun = getWeekDates(monday)[6];
  const d1 = Number(monday.slice(8)), m1 = Number(monday.slice(5, 7)) - 1;
  const d2 = Number(sun.slice(8)), m2 = Number(sun.slice(5, 7)) - 1;
  return m1 === m2 ? `${d1}-${d2} ${MESES[m2]}` : `${d1} ${MESES[m1]}-${d2} ${MESES[m2]}`;
}

/**
 * What the Excel notes should say for this person's CH counted in order: for
 * each one, the guard it pays and its day (the ordinals that guard still had
 * free, so each guard ends with 1º–5º).
 */
export function orderCorrections(acc) {
  const noteOf = new Map(acc.days.flatMap(d => (d.tags || []).filter(t => t.type === 'LIBRE' && t.meta?.note).map(t => [d.dateISO, t.meta.note])));
  const festivos = new Set(acc.guards.filter(g => g.festivo).map(g => g.dateISO));
  const debits = acc.ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && !m.concepto && m.dateISO >= `${acc.b.year}-01-01`)
    .sort((x, y) => x.dateISO.localeCompare(y.dateISO));
  const used = new Map();
  const taken = (g) => used.get(g) || used.set(g, new Set()).get(g);
  for (const m of debits) if (!m.ordenado && m.sourceDate) { const o = noteOrdinal(noteOf.get(m.dateISO)); if (o) taken(m.sourceDate).add(o); }
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  return debits.filter(m => m.ordenado || (acc.ordenDesde && m.dateISO >= acc.ordenDesde && !m.sourceRef)).map(m => {
    const antes = noteOf.get(m.dateISO) || '';
    if (!m.sourceDate) return { fecha: m.dateISO, antes, despues: null, igual: false };
    const set = taken(m.sourceDate);
    let n = 1;
    while (set.has(n)) n++;
    set.add(n);
    const despues = festivos.has(m.sourceDate)
      ? `CH festivo ${Number(m.sourceDate.slice(8))} ${MESES[Number(m.sourceDate.slice(5, 7)) - 1]}. Día ${n}º`
      : `CH incid ${weekLabel(m.sourceDate)}. Día ${n}º`;
    return { fecha: m.dateISO, antes, despues, igual: norm(antes) === norm(despues) };
  });
}

function correctionsText(acc, rows) {
  return [`${displayName(acc.person)} · CH en orden desde el ${formatDMY(acc.ordenDesde)}`,
    'Notas a corregir en el cuadrante:',
    ...rows.map(r => `${formatDMY(r.fecha)}: ${r.igual ? `«${r.antes}» (sin cambios)` : `«${r.antes || 'sin nota'}» → «${r.despues || 'sin guardia'}»`}`)].join('\n');
}

function rowsHTML(rows) {
  return `<ul class="gd-list orden-list">${rows.map(r => `
    <li class="gd-item ${r.igual ? 'prev' : 'on'}"><span class="gd-dot" aria-hidden="true"></span>
      <span>${esc(formatDMY(r.fecha))}<br><small class="gd-note">${r.igual ? `«${esc(r.antes)}» · sin cambios` : `«${esc(r.antes || 'sin nota')}» → <strong>«${esc(r.despues || 'sin guardia')}»</strong>`}</small></span></li>`).join('')}</ul>`;
}

async function saveOrden(person, desde) {
  const map = { ...(await getGroupOrden()) };
  if (desde) map[person] = desde; else delete map[person];
  await setGroupOrden(map);
  Actions.setConfig({ groupOrden: map });
  // this device's own accounting, if it is that person
  if (String(getState().activeProfile?.cuadranteName || '').toUpperCase() === String(person).toUpperCase()) await syncNow().catch(() => null);
  Actions.showToast(desde ? `${displayName(person)}: CH en orden desde el ${formatDMY(desde)}. Publica para que les llegue a todos.` : 'Orden quitado. Publica para que les llegue a todos.',
    { actionLabel: 'Publicar', onAction: () => publishSharedCuadrante(), duration: 12000 });
}

/** Administrator: count this person's CH in order from a date (preview first). */
async function openOrdenar(a) {
  const year = a.b.year;
  const first = (a.b.libres.cerradas || []).filter(c => !c.prevYear).sort((x, y) => x.dateISO.localeCompare(y.dateISO))[0];
  const def = first?.por ? `${first.por.slice(0, 8)}01` : `${todayISO().slice(0, 8)}01`;
  openSheet({
    title: `${displayName(a.person)} · CH en orden`,
    body: `
      <p class="sheet-hint">Desde la fecha que elijas, cada CH cuenta para la guardia abierta más antigua (la que debería haber pedido), aunque la nota diga otra. Lo anterior se queda como está.</p>
      <label class="field"><span>Desde</span><input type="date" id="orden-desde" value="${def}" min="${year}-01-01" max="${year}-12-31"></label>
      <div id="orden-preview"><p class="sheet-hint">Calculando…</p></div>`,
    footer: `
      <button type="button" class="btn" data-act="cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" data-act="ok">Aplicar</button>`,
    onMount(root, close) {
      const input = root.querySelector('#orden-desde');
      const out = root.querySelector('#orden-preview');
      let last = null;
      const preview = async () => {
        const desde = input.value;
        if (!desde) return;
        const [acc] = await groupAccounts({ overrides: { [a.person]: desde }, only: a.person });
        const rows = orderCorrections(acc);
        last = { desde, acc, rows };
        const antes = a.b.libres.disponibles, despues = acc.b.libres.disponibles;
        out.innerHTML = `
          <div class="mini-stats three">
            <div class="mini-stat"><strong>${fmtDias(antes)}</strong><span>ahora</span></div>
            <div class="mini-stat"><strong>${fmtDias(despues)}</strong><span>en orden</span></div>
            <div class="mini-stat"><strong>${rows.filter(r => !r.igual).length}</strong><span>notas a corregir</span></div>
          </div>
          ${(acc.b.libres.cerradas || []).filter(c => !c.prevYear).length ? `<p class="sheet-hint">Siguen cerradas: ${acc.b.libres.cerradas.filter(c => !c.prevYear).map(c => `semana del ${short(c.dateISO)} (${c.dias})`).join(', ')}.</p>` : ''}
          ${rowsHTML(rows)}`;
      };
      input.addEventListener('change', preview);
      preview();
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      root.querySelector('[data-act="ok"]').addEventListener('click', async () => {
        if (!last) return;
        await saveOrden(a.person, last.desde);
        close();
        openOrdenLista(last.acc);
      });
    }
  });
}

/** The notes the chief should correct in the original Excel (to share). */
function openOrdenLista(acc) {
  const rows = orderCorrections(acc);
  const text = correctionsText(acc, rows);
  openSheet({
    title: `${displayName(acc.person)} · notas a corregir`,
    body: `
      <p class="sheet-hint">Para que el cuadrante original diga lo mismo: cada CH desde el ${formatDMY(acc.ordenDesde)}, con la guardia y el día que le corresponden en orden. Le quedan <strong>${fmtDias(acc.b.libres.disponibles)}</strong> para pedir.</p>
      ${rowsHTML(rows)}`,
    footer: `<button type="button" class="btn btn-primary" data-act="share">Compartir la lista</button>`,
    onMount(root) {
      root.querySelector('[data-act="share"]').addEventListener('click', async () => {
        try {
          if (navigator.share) { await navigator.share({ title: `Notas a corregir · ${displayName(acc.person)}`, text }); return; }
        } catch (err) { if (err?.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(text); Actions.showToast('Lista copiada: pégala en WhatsApp o en un correo'); }
        catch (err) { Actions.showToast('No se pudo copiar la lista.', { level: 'error', detail: err?.message }); }
      });
    }
  });
}
