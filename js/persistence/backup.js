/**
 * @module persistence/backup
 * Export and import full application backup
 */

import { get, getAll, applyBatch, STORES } from './db.js';
import { encrypt, decrypt } from './crypto.js';

const BACKUP_VERSION = 3;

// El PIN y su contador pertenecen al móvil, igual que los secretos del grupo.
export const SECRET_CONFIG_KEYS = new Set(['ghPublish', 'secretSalt', 'groupKey']);
const DEVICE_CONFIG_KEYS = new Set([...SECRET_CONFIG_KEYS, 'pinHash', 'pinAttempts']);

function staysOnDevice(key) {
  return key.startsWith('__') || DEVICE_CONFIG_KEYS.has(key);
}

export function backupableConfig(rows = []) {
  return rows.filter(c => c && typeof c.key === 'string' && !staysOnDevice(c.key)).map(c => {
    if (c.key !== 'appConfig' || !isRecord(c.value)) return c;
    const value = Object.fromEntries(Object.entries(c.value).filter(([key]) => !staysOnDevice(key)));
    return { key: c.key, value };
  });
}

/**
 * Export all data as JSON
 * @param {string} [passphrase] - If provided, encrypts the backup
 * @returns {Promise<string>} JSON string (or encrypted base64)
 */
export async function exportBackup(passphrase) {
  const data = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'CalGuard-PolicíaCientífica',
    profiles: await getAll(STORES.PROFILES),
    days: await getAll(STORES.DAYS),
    ledger: await getAll(STORES.LEDGER),
    services: await getAll(STORES.SERVICES),
    config: backupableConfig(await getAll(STORES.CONFIG)),
    audit: await getAll(STORES.AUDIT),
    cuadrante: await getAll(STORES.CUADRANTE)
  };

  const json = JSON.stringify(data, null, 2);

  if (passphrase) {
    const encrypted = await encrypt(json, passphrase);
    return JSON.stringify({
      version: BACKUP_VERSION,
      encrypted: true,
      data: encrypted
    });
  }

  return json;
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const optionalText = value => value == null || typeof value === 'string';
const optionalArray = (value, valid) => value == null || (Array.isArray(value) && value.every(valid));
// Versiones antiguas pueden guardar los números como cadenas.
const optionalNumber = value => value == null || Number.isFinite(value)
  || (isText(value) && Number.isFinite(Number(value)));
const optionalDate = value => value == null || value === '' || isDate(value);

function isCompensation(row) {
  return isRecord(row) && optionalArray(row.personas, isText);
}

function areDaySettings(value) {
  const { carryovers, libresExentos } = value;
  return ['diasPorGuardia', 'diasPorFestivo', 'asuntosAnuales', 'vacacionesAnuales']
    .every(key => optionalNumber(value[key]))
    && optionalArray(libresExentos, isDate)
    && (carryovers == null || (isRecord(carryovers) && Object.values(carryovers).every(carry =>
      isRecord(carry) && ['libres', 'ap', 'vacaciones'].every(key => optionalNumber(carry[key]))
      && ['primerLibre', 'primerAP', 'primerVac', 'caducaAP'].every(key => optionalDate(carry[key]))
    )));
}

function isProfile(row) {
  return isText(row.id) && isText(row.name) && optionalText(row.cuadranteName)
    && optionalArray(row.compensaciones, isCompensation)
    && (row.settings == null || (isRecord(row.settings) && areDaySettings(row.settings)));
}

function isDay(row) {
  return isText(row.profileId) && isDate(row.dateISO)
    && Array.isArray(row.tags) && row.tags.every(tag => isRecord(tag) && isText(tag.type)
      && (tag.type !== 'EVENTO' || optionalArray(tag.meta?.items, item =>
        isRecord(item) && optionalText(item.hora) && optionalText(item.title))));
}

function isCuadrante(row) {
  return isText(row.key) && isRecord(row.data)
    && Array.isArray(row.data.names) && row.data.names.every(isText)
    && Array.isArray(row.data.entries) && row.data.entries.every(entry => isRecord(entry)
      && isDate(entry.date) && isText(entry.person) && isText(entry.tagType));
}

function isConfig(row) {
  if (!isText(row.key)) return false;
  const { key, value } = row;
  if (staysOnDevice(key)) return true;
  if (!Object.hasOwn(row, 'value')) return false;
  if (key === 'appConfig') {
    return isRecord(value) && areDaySettings(value) && optionalNumber(value.autoLockMinutes)
      && optionalArray(value.groupComps, isCompensation)
      && ['escalafonOrder', 'serviceTypes', 'serviceTags'].every(name => optionalArray(value[name], isText));
  }
  if (key === 'groupComps') return Array.isArray(value) && value.every(isCompensation);
  if (key === 'groupOrden') return isRecord(value) && Object.values(value).every(isDate);
  if (key === 'themePreference') return ['auto', 'light', 'dark'].includes(value);
  return true;
}

// La comprobación usa el esquema de la copia, sin cambiar los almacenes ni su versión.
const STORED_ROWS = [
  [STORES.PROFILES, 'perfiles', isProfile],
  [STORES.DAYS, 'días del calendario', isDay],
  [STORES.LEDGER, 'movimientos de días', row => isText(row.id) && isText(row.profileId)
    && isDate(row.dateISO) && isText(row.kind) && row.amount != null && optionalNumber(row.amount)
    && optionalText(row.createdAt) && optionalText(row.sourceRef) && optionalText(row.note)],
  [STORES.SERVICES, 'servicios', row => isText(row.id) && isText(row.profileId) && isDate(row.dateISO)
    && isText(row.type) && optionalArray(row.tags, isText)],
  [STORES.CONFIG, 'ajustes', isConfig],
  [STORES.AUDIT, 'historial', row => isText(row.id), true],
  [STORES.CUADRANTE, 'cuadrante', isCuadrante, true]
];

/** Lee y valida la copia completa antes de mostrar el resumen o escribir datos. */
export async function prepareBackup(data, passphrase) {
  if (data?.encrypted === true) {
    if (!passphrase) throw new Error('Escribe la contraseña de la copia.');
    try {
      data = JSON.parse(await decrypt(data.data, passphrase));
    } catch {
      throw new Error('La contraseña es incorrecta o la copia está dañada.');
    }
  }
  if (!isRecord(data) || ![1, 2, BACKUP_VERSION].includes(data.version)) {
    throw new Error('El archivo no es una copia de CalGuard compatible.');
  }

  const stores = {};
  for (const [name, label, valid, optional] of STORED_ROWS) {
    // Las copias antiguas pueden no traer el historial o el cuadrante del grupo.
    const rows = optional && data.version < BACKUP_VERSION && !Object.hasOwn(data, name) ? [] : data[name];
    if (!Array.isArray(rows)) throw new Error('La copia tiene un apartado incompleto: ' + label + '.');
    const index = rows.findIndex(row => !isRecord(row) || !valid(row));
    if (index !== -1) throw new Error('Hay un dato inválido en ' + label + ' (elemento ' + (index + 1) + ').');
    const filtered = name === STORES.CONFIG ? backupableConfig(rows) : rows;
    const keys = new Set(filtered.map(row =>
      name === STORES.DAYS ? JSON.stringify([row.profileId, row.dateISO])
        : name === STORES.CONFIG || name === STORES.CUADRANTE ? row.key : row.id
    ));
    if (keys.size !== filtered.length) throw new Error('La copia tiene registros repetidos en ' + label + '.');
    stores[name] = filtered;
  }
  return stores;
}

/** Guarda la copia solo si se pueden escribir todos sus datos. */
export async function restoreBackup(stores, mode) {
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Elige cómo restaurar la copia.');
  if (mode === 'replace') {
    const profiles = new Set(stores[STORES.PROFILES].map(row => row.id));
    if (!profiles.size) throw new Error('La copia no tiene ningún perfil para reemplazar los actuales.');
    if ([STORES.DAYS, STORES.LEDGER, STORES.SERVICES].some(name =>
      stores[name].some(row => !profiles.has(row.profileId))
    )) {
      throw new Error('La copia tiene datos de un perfil que falta. No se puede reemplazar con esta copia.');
    }
  }

  const batch = Object.fromEntries(Object.entries(stores).map(([name, puts]) => [
    name, { puts, clear: mode === 'replace' && name !== STORES.CONFIG }
  ]));
  const config = batch[STORES.CONFIG];
  if (config.puts.some(row => row.key === 'appConfig')) {
    // Algunas instalaciones antiguas solo tenían el hash dentro de appConfig.
    const [pin, local] = await Promise.all([
      get(STORES.CONFIG, 'pinHash'), get(STORES.CONFIG, 'appConfig')
    ]);
    if (!pin && local?.value?.pinHash) {
      config.puts = config.puts.map(row => row.key === 'appConfig'
        ? { ...row, value: { ...row.value, pinHash: local.value.pinHash } }
        : row);
    }
  }
  await applyBatch(batch);
}

/**
 * Download a string as a file
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadFile(content, filename, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
