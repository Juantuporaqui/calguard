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
 *  - GUARDIA QUE CRUZA DE AÑO: cuenta en el año en que termina (su domingo).
 *    La del 29/12/2025 al 04/01/2026 suma sus libres a 2026.
 *  - CADUCIDAD DE LOS AP: los asuntos propios del año anterior se pueden
 *    disfrutar hasta una fecha (por defecto el 25 de marzo). Los AP hasta esa
 *    fecha gastan primero lo que se trae del año anterior; pasada la fecha, lo
 *    que quede del arrastre caduca.
 *  - ARRASTRE ESTIMADO: si no se ha indicado arrastre de libres, un libre ya
 *    disfrutado que ninguna guardia del año puede cubrir (todas las anteriores
 *    a él estaban agotadas) solo puede venir del año anterior: se cuenta como
 *    tal en vez de restarlo de lo generado este año, y el panel lo avisa.
 */

import { getWeekDates, isWeekend, todayISO } from './rules.js';
import { isWithinYearAfter, guardYear, movementYear, guardWeeksFromDays } from './reconcile.js';
import { eventItems, eventTitle, EVENT_KINDS } from './events.js';

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
    caducaAP: c.caducaAP || null,
    desde: c.desde || null
  };
}

/** Fecha hasta la que se pueden disfrutar los AP del año anterior (en `year`). */
export function apDeadline(config, year) {
  const own = getCarryover(config, year).caducaAP;
  if (own) return own;
  const mmdd = /^\d{2}-\d{2}$/.test(config.apPlazo || '') ? config.apPlazo : '03-25';
  return `${year}-${mmdd}`;
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Saldo de un cupo anual (AP o vacaciones) con arrastre y corte.
 * Sin arrastre ni fecha de corte indicados, lo YA disfrutado que excede el
 * cupo del año solo puede ser del año anterior (los primeros días del año):
 * se cuenta como tal (arrastre estimado) en vez de dejar el saldo en negativo.
 */
function quotaBalance({ cupo, arrastre, antes, disfrutados, planificados, pastDates = [], estimate = false, caduca = null, today = null }) {
  const excess = Math.max(0, disfrutados + planificados - cupo);
  // only past days the previous year's allowance could still cover (until it expired)
  const coverable = [...pastDates].sort().filter(d => !caduca || d <= caduca);
  const estimado = estimate ? Math.min(excess, disfrutados, coverable.length) : 0;
  const delCupo = disfrutados - estimado;
  const sobrante = Math.max(0, arrastre - antes);
  const caducado = Boolean(caduca && today && today > caduca);
  const arrastreRestante = caducado ? 0 : sobrante;
  return {
    cupo,
    arrastre: arrastre + estimado,
    delArrastre: antes + estimado, // disfrutados del año anterior (corte o estimado)
    arrastreRestante,
    caduca,                        // hasta cuándo vale el arrastre (AP)
    arrastreCaducado: caducado ? sobrante : 0,
    arrastreEstimado: estimado,
    estimadoFechas: coverable.slice(0, estimado),
    disfrutados: delCupo,          // hasta hoy, contra el cupo del año
    planificados,                  // futuros: ya reservados
    disponibles: arrastreRestante + cupo - delCupo - planificados,
    asignados: delCupo + planificados
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
  const yearCredits = [];
  const yearDebits = [];
  const reservadosFechas = [];
  const exentos = new Set(config.libresExentos || []);
  const concedidosFechas = [];

  for (const m of ledger) {
    if (!m.dateISO || movementYear(m) !== year) continue;
    const future = m.dateISO > today;

    if (m.kind === 'CREDIT' && m.category === 'GUARDIA') {
      if (future) { porGenerar += m.amount; plannedWeeks.add(m.dateISO); }
      else { generados += m.amount; realWeeks.add(m.dateISO); }
      yearCredits.push(m);
    } else if (m.kind === 'DEBIT' && m.category === 'LIBRE') {
      if (exentos.has(m.dateISO)) { concedidosFechas.push(m.dateISO); continue; }
      const n = Math.abs(m.amount);
      if (carry.primerLibre && m.dateISO < carry.primerLibre) libresAntes += n;
      else {
        if (future) { libresReservados += n; reservadosFechas.push(m.dateISO); }
        else libresDisfrutados += n;
        yearDebits.push(m);
      }
    } else if (m.kind === 'ADJUST' || m.category === 'OTROS') {
      const signed = m.kind === 'DEBIT' ? -Math.abs(m.amount) : m.amount;
      if (signed >= 0 && future) continue; // lo que suma, solo al llegar
      ajustes += signed;
    }
  }

  const libresArrastreRestante = Math.max(0, carry.libres - libresAntes);

  // Arrastre estimado: libres ya disfrutados que no cubre ninguna guardia del año
  const sinGuardia = (carry.libres === 0 && !carry.primerLibre)
    ? uncoveredPastDebits(yearCredits, yearDebits, today)
    : [];
  const estimado = sinGuardia.length;

  const disfrutados = libresDisfrutados - estimado;
  const disponibles = libresArrastreRestante + generados + ajustes - disfrutados - libresReservados;
  const libres = {
    arrastre: carry.libres + estimado,
    delArrastre: libresAntes + estimado,
    arrastreRestante: libresArrastreRestante,
    arrastreEstimado: estimado,
    sinGuardia,
    generados,
    porGenerar,
    ajustes,
    disfrutados,
    reservados: libresReservados,
    reservadosFechas: reservadosFechas.sort(),
    // libres concedidos que no computan: los marcados en el calendario
    concedidosFechas: [...new Set([...(config.libresExentos || []).filter(d => d.startsWith(y)), ...concedidosFechas])].sort(),
    disponibles,
    porDisfrutar: disponibles + libresReservados
  };

  // ── AP, vacaciones y guardias (etiquetas de días) ──
  let apAntes = 0, apPasados = 0, apFuturos = 0;
  let vacAntes = 0, vacPasados = 0, vacFuturos = 0;
  const apDates = [], apPastDates = [], vacPastDates = [];
  const planTagWeeks = new Set();

  for (const d of days) {
    if (!d.dateISO) continue;
    const inYear = d.dateISO.startsWith(y);
    // late December of the previous year can hold days of a guard that ends in this one
    if (!inYear && !d.dateISO.startsWith(`${year - 1}-12`)) continue;
    const future = d.dateISO > today;
    for (const t of (d.tags || [])) {
      if (!inYear && t.type !== 'GUARDIA_REAL' && t.type !== 'GUARDIA_PLAN') continue;
      if (t.type === 'AP') {
        apDates.push(d.dateISO);
      } else if (t.type === 'VACACIONES') {
        if (config.excludeWeekendsVacation && isWeekend(d.dateISO)) continue;
        if (carry.primerVac && d.dateISO < carry.primerVac) vacAntes++;
        else if (future) vacFuturos++;
        else { vacPasados++; vacPastDates.push(d.dateISO); }
      } else if (t.type === 'GUARDIA_PLAN') {
        const monday = getWeekDates(d.dateISO)[0];
        if (guardYear(monday) === year && monday >= currentMonday) planTagWeeks.add(monday);
      }
    }
  }

  // Semanas de guardia desde las etiquetas (un festivo pegado no es otra guardia)
  for (const monday of guardWeeksFromDays(days)) {
    if (guardYear(monday) !== year) continue;
    if (monday <= today) realWeeks.add(monday); else plannedWeeks.add(monday);
  }

  // AP: lo que cubre el arrastre del año anterior. Con fecha de corte, lo
  // anterior a ella; si no, los primeros AP hasta la caducidad (hasta agotarlo).
  const caducaAP = apDeadline(config, year);
  const apSorted = [...new Set(apDates)].sort();
  const apDelArrastre = new Set(carry.primerAP
    ? apSorted.filter(iso => iso < carry.primerAP)
    : apSorted.filter(iso => iso <= caducaAP).slice(0, carry.ap));
  for (const iso of apSorted) {
    if (apDelArrastre.has(iso)) apAntes++;
    else if (iso > today) apFuturos++;
    else { apPasados++; apPastDates.push(iso); }
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
      planificados: apFuturos,
      pastDates: apPastDates,
      estimate: carry.ap === 0 && !carry.primerAP,
      caduca: caducaAP,
      today
    }),
    vacaciones: quotaBalance({
      cupo: toNumber(config.vacacionesAnuales, 25),
      arrastre: carry.vacaciones,
      antes: vacAntes,
      disfrutados: vacPasados,
      planificados: vacFuturos,
      pastDates: vacPastDates,
      estimate: carry.vacaciones === 0 && !carry.primerVac
    }),
    guardias: {
      realizadas: realWeeks.size,
      planificadas: plannedWeeks.size,
      proximas: [...plannedWeeks].sort()
    }
  };
}

/**
 * Libres ya disfrutados (fecha ≤ hoy) que ninguna guardia del año puede
 * cubrir: se reparte cada libre, por orden de fecha, a la guardia más antigua
 * con saldo cuyo lunes no sea posterior al libre (mismo criterio que la
 * importación). Los que sobran solo pueden venir del año anterior.
 * @returns {string[]} fechas
 */
function uncoveredPastDebits(credits, debits, today) {
  const slots = credits
    .map(c => ({ date: c.dateISO, left: Math.abs(c.amount) || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  for (const d of [...debits].sort((a, b) => a.dateISO.localeCompare(b.dateISO))) {
    for (let i = 0; i < Math.abs(d.amount || 1); i++) {
      const slot = slots.find(c => c.left > 0 && c.date <= d.dateISO);
      if (slot) slot.left--;
      else if (d.dateISO <= today) out.push(d.dateISO);
    }
  }
  return out;
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
  // Special events (juicio, tiro…): one entry each, with its own title
  for (const d of days) {
    if (!d.dateISO || d.dateISO < today) continue;
    for (const ev of eventItems(d.tags || [])) {
      events.push({
        type: 'EVENTO', kind: EVENT_KINDS[ev.kind] ? ev.kind : 'OTRO', label: eventTitle(ev), hora: ev.hora || '',
        lugar: ev.lugar || '', start: d.dateISO, end: d.dateISO, count: 1, inDays: daysBetween(today, d.dateISO)
      });
    }
  }
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
export function guardsOfYear(ledger, year, daysPerGuard = 5, today = todayISO(), exentos = []) {
  const y = String(year);
  const skip = new Set(exentos);
  const debits = ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && m.sourceRef && !skip.has(m.dateISO));
  return ledger
    .filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && m.dateISO && guardYear(m.dateISO) === Number(y))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map(m => {
      // the "G.dd/mm" ref has no year: only count free days within the year after it
      const mine = debits.filter(d => d.sourceRef === m.sourceRef && isWithinYearAfter(m.dateISO, d.dateISO));
      const pedidos = mine.filter(d => d.dateISO > today).map(d => d.dateISO).sort();
      const disfrutados = mine.filter(d => d.dateISO <= today).map(d => d.dateISO).sort();
      return {
        ref: m.sourceRef,
        dateISO: m.dateISO,
        total: m.amount || daysPerGuard,
        used: mine.length,
        enjoyed: mine.length - pedidos.length,   // ya disfrutados
        requested: pedidos.length,               // pedidos para más adelante
        requestedDates: pedidos,
        enjoyedDates: disfrutados,
        worked: m.dateISO <= today
      };
    });
}
