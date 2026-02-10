/**
 * @module exports/ics
 * Export calendar data as iCalendar (.ics) format
 */

import { getState } from '../state/store.js';
import { downloadFile } from '../persistence/backup.js';

/**
 * Generate iCal content from days data
 * @param {Object} [options]
 * @param {boolean} [options.guardias=true]
 * @param {boolean} [options.vacaciones=true]
 * @param {boolean} [options.ap=true]
 * @param {boolean} [options.formacion=true]
 * @param {boolean} [options.libres=true]
 * @returns {string}
 */
export function generateICS(options = {}) {
  const opts = {
    guardias: true, vacaciones: true, ap: true,
    formacion: true, libres: true, ...options
  };

  const state = getState();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalGuard//Policia Cientifica//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CalGuard - Cuadrante'
  ];

  const typeMap = {
    'GUARDIA_REAL': { enabled: opts.guardias, summary: 'GUARDIA (Realizada)', color: '#FF6961' },
    'GUARDIA_PLAN': { enabled: opts.guardias, summary: 'GUARDIA (Planificada)', color: '#F08080' },
    'VACACIONES': { enabled: opts.vacaciones, summary: 'VACACIONES', color: '#8EC6D7' },
    'AP': { enabled: opts.ap, summary: 'ASUNTO PROPIO', color: '#A2CFFE' },
    'LIBRE': { enabled: opts.libres, summary: 'DIA LIBRE', color: '#FFFC99' },
    'FORMACION': { enabled: opts.formacion, summary: 'FORMACION', color: '#98D8C8' },
    'JUICIO': { enabled: opts.formacion, summary: 'JUICIO/CITACION', color: '#DDA0DD' }
  };

  for (const day of state.days) {
    for (const tag of (day.tags || [])) {
      const config = typeMap[tag.type];
      if (!config || !config.enabled) continue;

      const dateClean = day.dateISO.replace(/-/g, '');
      const uid = `${day.dateISO}-${tag.type}-${state.activeProfileId}@calguard`;

      lines.push('BEGIN:VEVENT');
      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      lines.push(`DTEND;VALUE=DATE:${dateClean}`);
      lines.push(`SUMMARY:${config.summary}`);
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      if (tag.meta && tag.meta.label) {
        lines.push(`DESCRIPTION:${tag.meta.label}`);
      }
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Export and download ICS file
 * @param {Object} [options]
 */
export function exportICS(options) {
  const content = generateICS(options);
  const date = new Date().toISOString().split('T')[0];
  downloadFile(content, `calguard-${date}.ics`, 'text/calendar');
}
