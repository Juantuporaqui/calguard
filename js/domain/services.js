/**
 * @module domain/services
 * Service log (bitácora operativa) for Policía Científica
 */

import { put, remove, getAllByIndex, STORES } from '../persistence/db.js';
import { getState, Actions } from '../state/store.js';

/**
 * @typedef {Object} ServiceLog
 * @property {string} id
 * @property {string} profileId
 * @property {string} dateISO
 * @property {string} [startTime] - HH:MM
 * @property {string} [endTime] - HH:MM
 * @property {number} durationMin
 * @property {string} type - Service type from config
 * @property {string} [locationGeneral] - Municipality/district
 * @property {string} [unit] - inspections, lab, etc.
 * @property {string[]} [tags]
 * @property {string} [notes] - Operational notes (no PII!)
 * @property {'NORMAL'|'SENSIBLE'} sensitivity
 * @property {string} createdAt
 */

/**
 * Create a new service log entry
 * @param {Object} params
 * @returns {Promise<ServiceLog>}
 */
export async function createService(params) {
  const state = getState();
  const service = {
    id: crypto.randomUUID(),
    profileId: state.activeProfileId,
    dateISO: params.dateISO,
    startTime: params.startTime || '',
    endTime: params.endTime || '',
    durationMin: params.durationMin || 0,
    type: params.type || 'Otro',
    locationGeneral: params.locationGeneral || '',
    unit: params.unit || '',
    tags: params.tags || [],
    notes: params.notes || '',
    sensitivity: params.sensitivity || 'NORMAL',
    createdAt: new Date().toISOString()
  };

  await put(STORES.SERVICES, service);
  Actions.addService(service);

  // Audit
  await put(STORES.AUDIT, {
    id: crypto.randomUUID(),
    profileId: state.activeProfileId,
    action: 'SERVICE_CREATE',
    detail: `${service.type} - ${service.dateISO}`,
    timestamp: new Date().toISOString()
  });

  return service;
}

/**
 * Update an existing service
 * @param {ServiceLog} service
 * @returns {Promise<void>}
 */
export async function updateService(service) {
  await put(STORES.SERVICES, service);
  const state = getState();
  const updated = state.services.map(s => s.id === service.id ? service : s);
  Actions.setServices(updated);
}

/**
 * Delete a service
 * @param {string} serviceId
 * @returns {Promise<void>}
 */
export async function deleteService(serviceId) {
  await remove(STORES.SERVICES, serviceId);
  Actions.removeService(serviceId);
}

/**
 * Load all services for active profile
 * @returns {Promise<Array>}
 */
export async function loadServices() {
  const state = getState();
  if (!state.activeProfileId) return [];
  const services = await getAllByIndex(STORES.SERVICES, 'profileId', state.activeProfileId);
  services.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  Actions.setServices(services);
  return services;
}

/**
 * Get statistics for a date range
 * @param {string} startISO
 * @param {string} endISO
 * @returns {Object}
 */
export function getStats(startISO, endISO) {
  const state = getState();
  const filtered = state.services.filter(s =>
    s.dateISO >= startISO && s.dateISO <= endISO
  );

  const byType = {};
  let totalMinutes = 0;
  let totalServices = filtered.length;
  const byTag = {};
  const byMonth = {};

  for (const s of filtered) {
    // By type
    byType[s.type] = (byType[s.type] || 0) + 1;
    // Total duration
    totalMinutes += s.durationMin || 0;
    // By tag
    for (const tag of (s.tags || [])) {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }
    // By month
    const monthKey = s.dateISO.slice(0, 7);
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
  }

  return {
    totalServices,
    totalMinutes,
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    byType,
    byTag,
    byMonth
  };
}

/**
 * Generate weekly summary text
 * @param {string} weekStartISO
 * @returns {string}
 */
export function generateWeeklySummary(weekStartISO) {
  const endDate = new Date(weekStartISO + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 6);
  const endISO = endDate.toISOString().split('T')[0];

  const stats = getStats(weekStartISO, endISO);
  const [sy, sm, sd] = weekStartISO.split('-');
  const [ey, em, ed] = endISO.split('-');

  let text = `RESUMEN SEMANAL (${sd}/${sm} - ${ed}/${em}/${ey})\n`;
  text += `${'─'.repeat(40)}\n`;
  text += `Total servicios: ${stats.totalServices}\n`;
  text += `Horas totales: ${stats.totalHours}h\n\n`;

  if (Object.keys(stats.byType).length > 0) {
    text += `Por tipo:\n`;
    for (const [type, count] of Object.entries(stats.byType)) {
      text += `  - ${type}: ${count}\n`;
    }
  }

  return text;
}
