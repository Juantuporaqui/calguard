/**
 * @module exports/templates
 * Message templates for WhatsApp/email sharing
 */

import { getState } from '../state/store.js';
import { formatDMY, formatDM, getWeekDates, todayISO } from '../domain/rules.js';
import { getGuardDetails } from '../domain/ledger.js';
import { generateWeeklySummary } from '../domain/services.js';

/**
 * Generate "request days off" message
 * @param {string[]} dates - ISO dates to request
 * @param {Array} assignments - [{date, guardRef, ordinal}]
 * @returns {string}
 */
export function templatePedirDias(dates, assignments) {
  let msg = 'Solicito librar los siguientes días:\n';
  for (const a of assignments) {
    msg += `${a.ordinal} ${a.guardRef}: ${formatDM(a.date)}\n`;
  }
  msg += '\nGracias.';
  return msg;
}

/**
 * Generate "next guard duty" message
 * @param {string} guardDateISO
 * @returns {string}
 */
export function templateProximaGuardia(guardDateISO) {
  const week = getWeekDates(guardDateISO);
  const start = formatDM(week[0]);
  const end = formatDM(week[6]);
  return `Mi próxima guardia es la semana del ${start} al ${end}.`;
}

/**
 * Generate vacation request message
 * @param {string} startISO
 * @param {string} endISO
 * @param {number} workDays
 * @returns {string}
 */
export function templateSolicitudVacaciones(startISO, endISO, workDays) {
  return `Solicito vacaciones del ${formatDMY(startISO)} al ${formatDMY(endISO)} (${workDays} días laborables).\nGracias.`;
}

/**
 * Generate weekly summary message
 * @returns {string}
 */
export function templateResumenSemanal() {
  const today = todayISO();
  const weekDates = getWeekDates(today);
  return generateWeeklySummary(weekDates[0]);
}

/**
 * Generate guard duty balance summary
 * @returns {string}
 */
export function templateResumenGuardias() {
  const details = getGuardDetails();
  const state = getState();

  let msg = `RESUMEN DE GUARDIAS\n${'─'.repeat(30)}\n`;
  msg += `Libres acumulados: ${state.counters.libresAcumulados}\n`;
  msg += `Libres gastados: ${state.counters.libresGastados}\n\n`;

  for (const g of details) {
    msg += `${g.ref}: ${g.used}/${g.total} usados`;
    if (g.remaining > 0) msg += ` (quedan ${g.remaining})`;
    msg += '\n';
    for (const d of g.debits) {
      msg += `  - ${formatDM(d.dateISO)}\n`;
    }
  }

  return msg;
}

/**
 * Copy text to clipboard
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

/**
 * Share via Web Share API or fallback
 * @param {string} text
 * @param {string} title
 */
export async function shareText(text, title = 'CalGuard') {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      // User cancelled
    }
  }
  return copyToClipboard(text);
}
