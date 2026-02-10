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

  // Guard duty conflicts
  if (newTagType === 'GUARDIA_REAL' || newTagType === 'GUARDIA_PLAN') {
    if (types.includes('VACACIONES')) return 'No se puede asignar guardia en un día de vacaciones';
    if (types.includes('AP')) return 'No se puede asignar guardia en un día de asunto propio';
    if (types.includes('LIBRE')) return 'No se puede asignar guardia en un día libre';
  }

  // Vacation conflicts
  if (newTagType === 'VACACIONES') {
    if (types.includes('GUARDIA_REAL') || types.includes('GUARDIA_PLAN'))
      return 'No se pueden pedir vacaciones en un día de guardia';
  }

  // Free day conflicts
  if (newTagType === 'LIBRE') {
    if (types.includes('GUARDIA_REAL') || types.includes('GUARDIA_PLAN'))
      return 'No se puede marcar libre en un día de guardia';
    if (types.includes('VACACIONES'))
      return 'No se puede marcar libre en un día de vacaciones';
  }

  // AP conflicts
  if (newTagType === 'AP') {
    if (types.includes('GUARDIA_REAL') || types.includes('GUARDIA_PLAN'))
      return 'No se puede marcar asunto propio en un día de guardia';
  }

  return null;
}

/**
 * Calculate current counters from days and ledger
 * @param {Array} days - Day records for active profile
 * @param {Array} ledger - Ledger movements for active profile
 * @param {Object} config
 * @returns {Object} counters
 */
export function calculateCounters(days, ledger, config) {
  const year = new Date().getFullYear();

  // Ledger-based balance
  let libresAcumulados = 0;
  let libresGastados = 0;
  let guardiasRealizadas = 0;

  for (const m of ledger) {
    if (m.category === 'GUARDIA' && m.kind === 'CREDIT') {
      libresAcumulados += m.amount;
      guardiasRealizadas++;
    } else if (m.category === 'LIBRE' && m.kind === 'DEBIT') {
      libresGastados += Math.abs(m.amount);
      libresAcumulados -= Math.abs(m.amount);
    } else if (m.kind === 'ADJUST') {
      libresAcumulados += m.amount;
    } else if (m.category === 'OTROS' && m.kind === 'CREDIT') {
      libresAcumulados += m.amount;
    } else if (m.category === 'OTROS' && m.kind === 'DEBIT') {
      libresAcumulados -= Math.abs(m.amount);
    }
  }

  // Count used AP and vacaciones from days (current year)
  let apUsados = 0;
  let vacacionesUsadas = 0;
  let guardiasPlanificadas = 0;
  const guardiaWeeks = new Set();

  for (const d of days) {
    if (!d.dateISO.startsWith(String(year))) continue;
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
    asuntosPropios: Math.max(0, (config.asuntosAnuales || 8) - apUsados),
    vacaciones: Math.max(0, (config.vacacionesAnuales || 25) - vacacionesUsadas),
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
