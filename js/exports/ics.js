/**
 * @module exports/ics
 * Export calendar data as iCalendar (.ics) format
 */

import { getState } from '../state/store.js';
import { downloadFile } from '../persistence/backup.js';
import { eventItems, eventTitle, EVENT_KINDS } from '../domain/events.js';

/** RFC 5545 text escaping */
function icsText(v) {
  return String(v || '').replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
}

/** All-day events end on the next day (DTEND is exclusive). */
function nextDay(dateISO) {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

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

  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  for (const day of state.days) {
    // Special events: one VEVENT each, with time if known
    if (opts.formacion) {
      for (const ev of eventItems(day.tags || [])) {
        const dateClean = day.dateISO.replace(/-/g, '');
        lines.push('BEGIN:VEVENT');
        if (ev.hora) {
          const [h, m] = ev.hora.split(':').map(Number);
          const end = `${String(Math.min(23, h + 1)).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
          lines.push(`DTSTART:${dateClean}T${ev.hora.replace(':', '')}00`);
          lines.push(`DTEND:${dateClean}T${end}`);
        } else {
          lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
          lines.push(`DTEND;VALUE=DATE:${nextDay(day.dateISO)}`);
        }
        lines.push(`SUMMARY:${icsText(`${(EVENT_KINDS[ev.kind] || EVENT_KINDS.OTRO).label}: ${eventTitle(ev)}`)}`);
        if (ev.lugar) lines.push(`LOCATION:${icsText(ev.lugar)}`);
        if (ev.nota) lines.push(`DESCRIPTION:${icsText(ev.nota)}`);
        lines.push(`UID:${day.dateISO}-${ev.id}@calguard`);
        lines.push(`DTSTAMP:${stamp}`);
        lines.push('END:VEVENT');
      }
    }
    for (const tag of (day.tags || [])) {
      const config = typeMap[tag.type];
      if (!config || !config.enabled) continue;

      const dateClean = day.dateISO.replace(/-/g, '');
      const uid = `${day.dateISO}-${tag.type}-${state.activeProfileId}@calguard`;

      lines.push('BEGIN:VEVENT');
      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(day.dateISO)}`);
      lines.push(`SUMMARY:${config.summary}`);
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${stamp}`);
      if (tag.meta && tag.meta.label) {
        lines.push(`DESCRIPTION:${icsText(tag.meta.label)}`);
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
