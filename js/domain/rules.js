/**
 * @module domain/rules
 * Guard duty rules, validation, conflict detection
 */

/**
 * Get Monday-Sunday week dates for a given date
 * @param {string} dateISO - YYYY-MM-DD
 * @returns {string[]} array of 7 ISO date strings
 */
export function getWeekDates(dateISO) {
  const d = new Date(dateISO + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  const week = [];
  for (let i = 0; i < 7; i++) {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    week.push(formatISO(wd));
  }
  return week;
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} d
 * @returns {string}
 */
export function formatISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format date as DD/MM/YYYY
 * @param {string} dateISO
 * @returns {string}
 */
export function formatDMY(dateISO) {
  const [y, m, d] = dateISO.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Format date as DD/MM
 * @param {string} dateISO
 * @returns {string}
 */
export function formatDM(dateISO) {
  const [, m, d] = dateISO.split('-');
  return `${d}/${m}`;
}

/**
 * Get date range (inclusive)
 * @param {string} startISO
 * @param {string} endISO
 * @returns {string[]}
 */
export function getDateRange(startISO, endISO) {
  const dates = [];
  const current = new Date(startISO + 'T12:00:00');
  const end = new Date(endISO + 'T12:00:00');
  while (current <= end) {
    dates.push(formatISO(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Count working days in range (exclude weekends)
 * @param {string[]} dates
 * @returns {number}
 */
export function countWorkingDays(dates) {
  return dates.filter(d => {
    const day = new Date(d + 'T12:00:00').getDay();
    return day !== 0 && day !== 6;
  }).length;
}

/**
 * Check if a date is a weekend
 * @param {string} dateISO
 * @returns {boolean}
 */
export function isWeekend(dateISO) {
  const day = new Date(dateISO + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

/**
 * Detect conflicts between tags on a day
 * @param {Array} existingTags
 * @param {string} newTagType
 * @returns {string|null} conflict message or null
 */
export function detectConflict(existingTags, newTagType) {
  const types = existingTags.map(t => t.type);

  // Vacation conflicts - can't overlap with guardia
  if (newTagType === 'VACACIONES') {
    if (types.includes('GUARDIA_REAL') || types.includes('GUARDIA_PLAN'))
      return 'No se pueden pedir vacaciones en un día de guardia';
  }

  // Guard conflicts - can't overlap with vacaciones (but libre/AP allowed during guardia week)
  if (newTagType === 'GUARDIA_REAL' || newTagType === 'GUARDIA_PLAN') {
    if (types.includes('VACACIONES')) return 'No se puede asignar guardia en un día de vacaciones';
  }

  // Free day conflicts - only with vacaciones
  if (newTagType === 'LIBRE') {
    if (types.includes('VACACIONES'))
      return 'No se puede marcar libre en un día de vacaciones';
  }

  return null;
}

/**
 * Read the manual carry-over for a given year from config.
 * carryovers is keyed by year string: { '2026': { libres, ap, vacaciones } }.
 * @param {Object} config
 * @param {number} year
 * @returns {{libres:number, ap:number, vacaciones:number}}
 */
export function getCarryover(config, year) {
  const c = (config.carryovers && config.carryovers[String(year)]) || {};
  return {
    libres: Number(c.libres) || 0,
    ap: Number(c.ap) || 0,
    vacaciones: Number(c.vacaciones) || 0
  };
}

/**
 * Calculate counters for a single accounting year (annual accounting with a
 * manual carry-over from the previous year). Only movements/tags dated in the
 * year are counted; the carry-over supplies the starting balance.
 * @param {Array} days - Day records for active profile
 * @param {Array} ledger - Ledger movements for active profile
 * @param {Object} config
 * @param {number} [year] - accounting year (defaults to current year)
 * @returns {Object} counters
 */
export function calculateCounters(days, ledger, config, year = new Date().getFullYear()) {
  const yearStr = String(year);
  const carry = getCarryover(config, year);

  // Ledger, scoped to this year (libres accumulate, so add the carry-over)
  let generados = 0;
  let libresGastados = 0;
  let adjustsInYear = 0;
  let guardiasRealizadas = 0;

  for (const m of ledger) {
    if (!m.dateISO || !m.dateISO.startsWith(yearStr)) continue;
    if (m.category === 'GUARDIA' && m.kind === 'CREDIT') {
      generados += m.amount;
      guardiasRealizadas++;
    } else if (m.category === 'LIBRE' && m.kind === 'DEBIT') {
      libresGastados += Math.abs(m.amount);
    } else if (m.kind === 'ADJUST') {
      adjustsInYear += m.amount;
    } else if (m.category === 'OTROS' && m.kind === 'CREDIT') {
      adjustsInYear += m.amount;
    } else if (m.category === 'OTROS' && m.kind === 'DEBIT') {
      adjustsInYear -= Math.abs(m.amount);
    }
  }

  const libresAcumulados = carry.libres + generados + adjustsInYear - libresGastados;

  // Count used AP and vacaciones from day tags in this year
  let apUsados = 0;
  let vacacionesUsadas = 0;
  let guardiasPlanificadas = 0;
  const guardiaWeeks = new Set();

  for (const d of days) {
    if (!d.dateISO.startsWith(yearStr)) continue;
    for (const t of (d.tags || [])) {
      if (t.type === 'AP') apUsados++;
      if (t.type === 'VACACIONES') {
        if (!isWeekend(d.dateISO) || !config.excludeWeekendsVacation) {
          vacacionesUsadas++;
        }
      }
      if (t.type === 'GUARDIA_PLAN') {
        const weekKey = getWeekDates(d.dateISO)[0];
        if (!guardiaWeeks.has(weekKey)) {
          guardiaWeeks.add(weekKey);
          guardiasPlanificadas++;
        }
      }
    }
  }

  return {
    libresAcumulados: Math.max(0, libresAcumulados),
    asuntosPropios: Math.max(0, (config.asuntosAnuales || 8) + carry.ap - apUsados),
    vacaciones: Math.max(0, (config.vacacionesAnuales || 25) + carry.vacaciones - vacacionesUsadas),
    libresGastados,
    guardiasRealizadas,
    guardiasPlanificadas
  };
}

/**
 * Get the ordinal (1st, 2nd, etc.) of a free day relative to its guard duty
 * @param {string} dateISO
 * @param {Array} ledger
 * @returns {string|null} e.g. "D.1 G.03/02"
 */
export function getLibreOrdinal(dateISO, ledger) {
  // Find which guardia this libre was debited from
  const debitEntry = ledger.find(m =>
    m.kind === 'DEBIT' && m.category === 'LIBRE' && m.dateISO === dateISO
  );
  if (!debitEntry || !debitEntry.sourceRef) return null;

  // Count how many libres from same guard before this date
  const sameGuardDebits = ledger.filter(m =>
    m.kind === 'DEBIT' && m.category === 'LIBRE' && m.sourceRef === debitEntry.sourceRef
  ).sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const idx = sameGuardDebits.findIndex(m => m.dateISO === dateISO);
  if (idx < 0) return null;

  return `D.${idx + 1} ${debitEntry.sourceRef}`;
}

/**
 * Get the number of days in a month
 * @param {number} year
 * @param {number} month - 0-based
 * @returns {number}
 */
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get first day of month as 0=Monday offset
 * @param {number} year
 * @param {number} month - 0-based
 * @returns {number} 0=Monday, 6=Sunday
 */
export function firstDayOffset(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/**
 * Get today as ISO string
 * @returns {string}
 */
export function todayISO() {
  return formatISO(new Date());
}

/**
 * Parse ISO date to Date object at noon (avoids timezone issues)
 * @param {string} dateISO
 * @returns {Date}
 */
export function parseISO(dateISO) {
  return new Date(dateISO + 'T12:00:00');
}
