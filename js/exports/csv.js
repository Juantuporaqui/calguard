/**
 * @module exports/csv
 * Export data as CSV
 */

import { getState } from '../state/store.js';
import { downloadFile } from '../persistence/backup.js';
import { formatDMY } from '../domain/rules.js';

/**
 * Export ledger movements as CSV
 */
export function exportLedgerCSV() {
  const state = getState();
  const header = 'Fecha,Tipo,Categoría,Cantidad,Referencia,Nota,Creado';
  const rows = state.ledger.map(m => {
    return [
      formatDMY(m.dateISO),
      m.kind,
      m.category,
      m.amount,
      csvEscape(m.sourceRef || ''),
      csvEscape(m.note || ''),
      m.createdAt
    ].join(',');
  });

  const content = [header, ...rows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadFile(content, `calguard-movimientos-${date}.csv`, 'text/csv;charset=utf-8');
}

/**
 * Export services as CSV (non-sensitive fields only)
 */
export function exportServicesCSV() {
  const state = getState();
  const header = 'Fecha,Tipo,Duración(min),Ubicación,Unidad,Tags,Hora Inicio,Hora Fin';
  const rows = state.services
    .filter(s => s.sensitivity !== 'SENSIBLE')
    .map(s => {
      return [
        formatDMY(s.dateISO),
        csvEscape(s.type),
        s.durationMin || 0,
        csvEscape(s.locationGeneral || ''),
        csvEscape(s.unit || ''),
        csvEscape((s.tags || []).join('; ')),
        s.startTime || '',
        s.endTime || ''
      ].join(',');
    });

  const content = [header, ...rows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadFile(content, `calguard-servicios-${date}.csv`, 'text/csv;charset=utf-8');
}

/**
 * Export calendar days summary as CSV
 */
export function exportDaysCSV() {
  const state = getState();
  const header = 'Fecha,Tipos';
  const rows = state.days.map(d => {
    const types = (d.tags || []).map(t => t.type).join('; ');
    return `${formatDMY(d.dateISO)},${csvEscape(types)}`;
  });

  const content = [header, ...rows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadFile(content, `calguard-calendario-${date}.csv`, 'text/csv;charset=utf-8');
}

function csvEscape(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
