/**
 * @module ui/alerts
 * Avisos de Inicio: frases cortas (máx. 120 caracteres), sin jerga y con una
 * acción directa. Función pura: recibe los saldos ya calculados y devuelve qué
 * avisar; la pantalla decide cómo pintarlos y qué hace cada botón.
 *
 * Cada aviso: { id, level: 'danger'|'warn'|'info', text, primary?, secondary? }
 * donde primary/secondary = { label, act } y act es uno de:
 *   { type: 'goto', screen }      ir a una pantalla
 *   { type: 'calendar', date }    abrir el calendario en ese día
 *   { type: 'exento', dates }     marcar esos libres como concedidos (no descuentan)
 *   { type: 'guard', date }       ver una guardia
 *   { type: 'pedir-ap' }          pedir asuntos propios
 *   { type: 'dismiss' }           no volver a mostrar
 * El `id` cambia si cambian los datos: un aviso descartado vuelve si la situación es otra.
 */

export const MAX_ALERT_CHARS = 120;
/** Cuántos avisos se ven sin pulsar «Ver N avisos más». */
export const VISIBLE_ALERTS = 2;

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const d = (iso) => new Date(iso + 'T12:00:00');
const fmtShort = (iso) => `${d(iso).getDate()} ${MONTHS_SHORT[d(iso).getMonth()]}`;
const joinY = (list) => list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;

/** «3 y 4 ene», «30 dic y 2 ene»; con más de `max` fechas, «…». */
export function shortDates(dates, max = 3) {
  const shown = [...dates].sort().slice(0, max);
  const groups = [];
  for (const iso of shown) {
    const x = d(iso);
    const last = groups[groups.length - 1];
    if (last && last.m === x.getMonth()) last.days.push(x.getDate());
    else groups.push({ m: x.getMonth(), days: [x.getDate()] });
  }
  return joinY(groups.map(g => `${joinY(g.days.map(String))} ${MONTHS_SHORT[g.m]}`)) + (dates.length > max ? '…' : '');
}

const LEVEL_ORDER = { danger: 0, warn: 1, info: 2 };

/**
 * @param {Object} b - state.balances
 * @param {Object} o
 * @param {number} o.year
 * @param {Object} [o.carry] - días del año pasado indicados a mano para ese año (cfg.carryovers[year])
 * @param {Array} [o.overGuards] - guardias con más días de los que dan (guardsOfYear(...).filter(g => g.excede))
 * @param {{at: string, texts: string[]}} [o.lastChanges] - cambios de guardia de la última actualización
 * @returns {Array} avisos ordenados por importancia
 */
export function buildAlerts(b, { year, carry = null, overGuards = [], lastChanges = null } = {}) {
  const out = [];
  const L = b.libres;

  if (L.disponibles < 0) {
    const n = -L.disponibles;
    out.push({
      id: `libres-neg:${year}:${n}`, level: 'danger',
      text: `Has pedido ${n} ${n === 1 ? 'libre' : 'libres'} más de los que tienes. Revisa tus días pedidos.`,
      primary: { label: 'Revisar', act: { type: 'goto', screen: 'calendar' } }
    });
  }

  // cambios de guardia al actualizar con el cuadrante
  for (const [i, text] of (lastChanges?.texts || []).entries()) {
    out.push({ id: `sync:${lastChanges.at}:${i}`, level: 'info', text: `${text}.`, primary: { label: 'Ver', act: { type: 'goto', screen: 'calendar' } } });
  }

  if (L.sinCubrir?.length) {
    const dates = L.sinCubrir;
    const one = dates.length === 1;
    out.push({
      id: `sin-cubrir:${[...dates].sort().join(',')}`, level: 'warn',
      text: one
        ? `El libre del ${shortDates(dates)} no corresponde a ninguna guardia. ¿Te lo concedieron?`
        : `Tus libres del ${shortDates(dates)} no corresponden a ninguna guardia. ¿Te los concedieron?`,
      primary: { label: 'Sí, no descontar', act: { type: 'exento', dates: [...dates] } },
      secondary: { label: 'Revisar', act: { type: 'calendar', date: [...dates].sort()[0] } }
    });
  }

  if (b.ap.disponibles === 1) {
    out.push({ id: `ap-1:${year}`, level: 'warn', text: 'Te queda 1 asunto propio este año.', primary: { label: 'Pedirlo', act: { type: 'pedir-ap' } } });
  }

  if (overGuards.length) {
    const g = overGuards[0];
    const text = overGuards.length === 1
      ? `Las notas del cuadrante dan a tu guardia del ${fmtShort(g.dateISO)} más días de los que tiene (${g.used} de ${g.total}).`
      : `Las notas del cuadrante dan a ${overGuards.length} guardias más días de los que tienen (${shortDates(overGuards.map(x => x.dateISO))}).`;
    out.push({
      id: `excede:${overGuards.map(x => `${x.dateISO}/${x.used}`).join(',')}`, level: 'info', text,
      primary: { label: 'Ver la guardia', act: { type: 'guard', date: g.dateISO } }
    });
  }

  // días que la app cuenta como del año pasado, sin que tú lo hayas indicado
  const prev = year - 1;
  const estimates = [
    ['libres', L.arrastreEstimado, L.sinGuardia, (n) => n === 1 ? '1 de tus libres' : `${n} de tus libres`],
    ['ap', b.ap.arrastreEstimado, b.ap.estimadoFechas, (n) => n === 1 ? '1 de tus asuntos propios' : `${n} de tus asuntos propios`],
    ['vac', b.vacaciones.arrastreEstimado, b.vacaciones.estimadoFechas, (n) => n === 1 ? '1 día de vacaciones' : `${n} días de vacaciones`]
  ];
  let anyEstimate = false;
  for (const [key, n, dates, what] of estimates) {
    if (!n) continue;
    anyEstimate = true;
    const list = dates?.length ? ` (${shortDates(dates)})` : '';
    out.push({
      id: `estimado-${key}:${year}:${n}:${(dates || []).join(',')}`, level: 'info',
      text: `${what(n)}${list} ${n === 1 ? 'parece' : 'parecen'} de ${prev}. ¿Es correcto?`,
      primary: { label: 'No, corregir', act: { type: 'goto', screen: 'settings' } },
      secondary: { label: 'Sí', act: { type: 'dismiss' } }
    });
  }
  if (!anyEstimate && !carry && !L.arrastreAuto && (L.disfrutados > 0 || b.ap.disfrutados > 0)) {
    out.push({
      id: `traes:${year}`, level: 'info',
      text: `¿Te quedaron días de ${prev} por disfrutar? Apúntalos para que la cuenta cuadre.`,
      primary: { label: 'Apuntarlos', act: { type: 'goto', screen: 'settings' } }
    });
  }

  return out.sort((a, c) => LEVEL_ORDER[a.level] - LEVEL_ORDER[c.level]);
}

/** Quita los avisos descartados con «No volver a mostrar». */
export function activeAlerts(alerts, dismissedIds = []) {
  const off = new Set(dismissedIds);
  return alerts.filter(a => !off.has(a.id));
}
