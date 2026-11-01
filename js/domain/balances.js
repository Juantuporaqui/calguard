/**
 * @module domain/balances
 * Saldos anuales con contabilidad "al día". Cálculo puro, sin I/O.
 *
 * Reglas acordadas con el usuario (Policía Científica):
 *  - La contabilidad es ANUAL. Lo que se trae del año anterior se introduce a
 *    mano por año en config.carryovers[año] = { libres, ap, vacaciones, ... }.
 *  - GANAR: una guardia genera sus días cuando llega su lunes (la fecha del
 *    crédito). Antes cuenta como "por generar" y la guardia como planificada.
 *  - GASTAR: lo que se pide se descuenta YA aunque sea futuro (reservado), para
 *    no pedir de más. Vale para libres, asuntos propios y vacaciones.
 *  - FECHAS DE CORTE (primerLibre / primerAP / primerVac): lo disfrutado antes
 *    de esa fecha pertenece al año anterior; se descuenta del arrastre y nunca
 *    del cupo ni de lo generado este año.
 */

import { getWeekDates, isWeekend, todayISO } from './rules.js';
import { isWithinYearAfter } from './reconcile.js';

/**
 * Arrastre manual del año anterior y fechas de corte, para un año.
 * @param {Object} config - configuración efectiva (global + perfil)
 * @param {number} year
 */
export function getCarryover(config, year) {
  const c = (config.carryovers && config.carryovers[String(year)]) || {};
  return {
    libres: toNumber(c.libres, 0),
    ap: toNumber(c.ap, 0),
    vacaciones: toNumber(c.vacaciones, 0),
    primerLibre: c.primerLibre || null,
    primerAP: c.primerAP || null,
    primerVac: c.primerVac || null,
    desde: c.desde || null
  };
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Saldo de un cupo anual (AP o vacaciones) con arrastre y corte. */
function quotaBalance({ cupo, arrastre, antes, disfrutados, planificados }) {
  const arrastreRestante = Math.max(0, arrastre - antes);
  return {
    cupo,
    arrastre,
    delArrastre: antes,            // disfrutados antes del corte (año anterior)
    arrastreRestante,
    disfrutados,                   // hasta hoy, contra el cupo del año
    planificados,                  // futuros: ya reservados
    disponibles: arrastreRestante + cupo - disfrutados - planificados,
    asignados: disfrutados + planificados
  };
}

/**
 * Saldos completos de un año.
 * @param {Array} days - Day records del perfil activo
 * @param {Array} ledger - movimientos del perfil activo
 * @param {Object} config - configuración efectiva
 * @param {{year?: number, today?: string}} [opts]
 */
export function computeBalances(days, ledger, config, opts = {}) {
  const today = opts.today || todayISO();
  const year = opts.year || Number(today.slice(0, 4));
  const y = String(year);
  const carry = getCarryover(config, year);
  const currentMonday = getWeekDates(today)[0];

  // ── Libres (ledger) ──
  let generados = 0, porGenerar = 0, ajustes = 0;
  let libresAntes = 0, libresDisfrutados = 0, libresReservados = 0;
  const realWeeks = new Set();
  const plannedWeeks = new Set();

  for (const m of ledger) {
    if (!m.dateISO || !m.dateISO.startsWith(y)) continue;
    const future = m.dateISO > today;

    if (m.kind === 'CREDIT' && m.category === 'GUARDIA') {
      if (future) { porGenerar += m.amount; plannedWeeks.add(m.dateISO); }
      else { generados += m.amount; realWeeks.add(m.dateISO); }
    } else if (m.kind === 'DEBIT' && m.category === 'LIBRE') {
      const n = Math.abs(m.amount);
      if (carry.primerLibre && m.dateISO < carry.primerLibre) libresAntes += n;
      else if (future) libresReservados += n;
      else libresDisfrutados += n;
    } else if (m.kind === 'ADJUST' || m.category === 'OTROS') {
      const signed = m.kind === 'DEBIT' ? -Math.abs(m.amount) : m.amount;
      if (signed >= 0 && future) continue; // lo que suma, solo al llegar
      ajustes += signed;
    }
  }

  const libresArrastreRestante = Math.max(0, carry.libres - libresAntes);
  const libres = {
    arrastre: carry.libres,
    delArrastre: libresAntes,
    arrastreRestante: libresArrastreRestante,
    generados,
    porGenerar,
    ajustes,
    disfrutados: libresDisfrutados,
    reservados: libresReservados,
    disponibles: libresArrastreRestante + generados + ajustes - libresDisfrutados - libresReservados
  };

  // ── AP, vacaciones y guardias (etiquetas de días) ──
  let apAntes = 0, apPasados = 0, apFuturos = 0;
  let vacAntes = 0, vacPasados = 0, vacFuturos = 0;
  const planTagWeeks = new Set();

  for (const d of days) {
    if (!d.dateISO || !d.dateISO.startsWith(y)) continue;
    const future = d.dateISO > today;
    for (const t of (d.tags || [])) {
      if (t.type === 'AP') {
        if (carry.primerAP && d.dateISO < carry.primerAP) apAntes++;
        else if (future) apFuturos++;
        else apPasados++;
      } else if (t.type === 'VACACIONES') {
        if (config.excludeWeekendsVacation && isWeekend(d.dateISO)) continue;
        if (carry.primerVac && d.dateISO < carry.primerVac) vacAntes++;
        else if (future) vacFuturos++;
        else vacPasados++;
      } else if (t.type === 'GUARDIA_REAL') {
        const monday = getWeekDates(d.dateISO)[0];
        if (!monday.startsWith(y)) continue;
        if (monday <= today) realWeeks.add(monday); else plannedWeeks.add(monday);
      } else if (t.type === 'GUARDIA_PLAN') {
        const monday = getWeekDates(d.dateISO)[0];
        if (monday.startsWith(y) && monday >= currentMonday) planTagWeeks.add(monday);
      }
    }
  }

  for (const w of planTagWeeks) if (!realWeeks.has(w)) plannedWeeks.add(w);
  for (const w of realWeeks) plannedWeeks.delete(w);

  return {
    year,
    today,
    libres,
    ap: quotaBalance({
      cupo: toNumber(config.asuntosAnuales, 8),
      arrastre: carry.ap,
      antes: apAntes,
      disfrutados: apPasados,
      planificados: apFuturos
    }),
    vacaciones: quotaBalance({
      cupo: toNumber(config.vacacionesAnuales, 25),
      arrastre: carry.vacaciones,
      antes: vacAntes,
      disfrutados: vacPasados,
      planificados: vacFuturos
    }),
    guardias: {
      realizadas: realWeeks.size,
      planificadas: plannedWeeks.size,
      proximas: [...plannedWeeks].sort()
    }
  };
}

/**
 * Contadores "planos" (compatibilidad con la UI y exportaciones existentes).
 * Los saldos negativos se muestran como 0 aquí; el panel usa el saldo real.
 * @param {ReturnType<typeof computeBalances>} b
 */
export function countersFromBalances(b) {
  return {
    libresAcumulados: Math.max(0, b.libres.disponibles),
    libresGastados: b.libres.disfrutados + b.libres.reservados + b.libres.delArrastre,
    asuntosPropios: Math.max(0, b.ap.disponibles),
    vacaciones: Math.max(0, b.vacaciones.disponibles),
    guardiasRealizadas: b.guardias.realizadas,
    guardiasPlanificadas: b.guardias.planificadas
  };
}

/**
 * Contadores de un año (API histórica).
 * @param {Array} days
 * @param {Array} ledger
 * @param {Object} config
 * @param {number} [year]
 * @param {string} [today]
 */
export function calculateCounters(days, ledger, config, year, today) {
  const t = today || todayISO();
  return countersFromBalances(computeBalances(days, ledger, config, { year: year || Number(t.slice(0, 4)), today: t }));
}

const EVENT_LABELS = {
  GUARDIA_REAL: 'Guardia',
  GUARDIA_PLAN: 'Guardia prevista',
  LIBRE: 'Libre',
  VACACIONES: 'Vacaciones',
  AP: 'Asunto propio',
  JUICIO: 'Juicio',
  FORMACION: 'Formación',
  BAJA: 'Baja / A. familiar'
};

function daysBetween(aISO, bISO) {
  return Math.round((new Date(bISO + 'T12:00:00') - new Date(aISO + 'T12:00:00')) / 86400000);
}

/**
 * Próximos eventos agrupados en tramos (p. ej. "Vacaciones 3–28 ago").
 * Días seguidos del mismo tipo (con huecos de fin de semana) forman un tramo.
 * @param {Array} days
 * @param {string} [today]
 * @param {{limit?: number}} [opts]
 * @returns {Array<{type:string,label:string,start:string,end:string,count:number,inDays:number}>}
 */
export function upcomingEvents(days, today = todayISO(), opts = {}) {
  const limit = opts.limit || 6;
  const byType = new Map();
  for (const d of days) {
    if (!d.dateISO || d.dateISO < today) continue;
    for (const t of (d.tags || [])) {
      if (!EVENT_LABELS[t.type]) continue;
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type).push(d.dateISO);
    }
  }

  const events = [];
  for (const [type, dates] of byType) {
    const sorted = [...new Set(dates)].sort();
    let start = sorted[0], end = sorted[0], count = 1;
    for (let i = 1; i <= sorted.length; i++) {
      const cur = sorted[i];
      if (cur && daysBetween(end, cur) <= 3) { end = cur; count++; continue; }
      events.push({ type, label: EVENT_LABELS[type], start, end, count, inDays: daysBetween(today, start) });
      start = end = cur; count = 1;
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit);
}

/**
 * Guardias de un año con su consumo, en orden cronológico.
 * @param {Array} ledger
 * @param {number} year
 * @param {number} daysPerGuard
 * @param {string} [today]
 */
export function guardsOfYear(ledger, year, daysPerGuard = 5, today = todayISO()) {
  const y = String(year);
  const debits = ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && m.sourceRef);
  return ledger
    .filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && m.dateISO && m.dateISO.startsWith(y))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map(m => ({
      ref: m.sourceRef,
      dateISO: m.dateISO,
      total: m.amount || daysPerGuard,
      // the "G.dd/mm" ref has no year: only count free days within the year after it
      used: debits.filter(d => d.sourceRef === m.sourceRef && isWithinYearAfter(m.dateISO, d.dateISO)).length,
      worked: m.dateISO <= today
    }));
}
