/**
 * @module persistence/backup
 * Export and import full application backup
 */

import { getAll, put, clearStore, STORES } from './db.js';
import { encrypt, decrypt } from './crypto.js';

const BACKUP_VERSION = 2;

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
    config: await getAll(STORES.CONFIG),
    audit: await getAll(STORES.AUDIT)
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

/**
 * Validate a backup structure
 * @param {object} data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateBackup(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['No es un objeto JSON válido'] };
  }

  if (!data.version) errors.push('Falta campo "version"');
  if (!Array.isArray(data.profiles)) errors.push('Falta o inválido: "profiles"');
  if (!Array.isArray(data.days)) errors.push('Falta o inválido: "days"');
  if (!Array.isArray(data.ledger)) errors.push('Falta o inválido: "ledger"');
  if (!Array.isArray(data.services)) errors.push('Falta o inválido: "services"');
  if (!Array.isArray(data.config)) errors.push('Falta o inválido: "config"');

  // Validate profiles have required fields
  if (data.profiles) {
    for (const p of data.profiles) {
      if (!p.id || !p.name) {
        errors.push(`Perfil sin id o nombre: ${JSON.stringify(p)}`);
      }
    }
  }

  // Validate days have required fields
  if (data.days) {
    for (const d of data.days) {
      if (!d.profileId || !d.dateISO) {
        errors.push(`Día sin profileId o dateISO: ${JSON.stringify(d).slice(0, 80)}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Import backup data
 * @param {string} jsonStr - JSON string (or encrypted envelope)
 * @param {string} [passphrase] - Required if backup is encrypted
 * @param {'replace'|'merge'|'new_profile'} mode
 * @returns {Promise<{success: boolean, errors: string[], counts: object}>}
 */
export async function importBackup(jsonStr, passphrase, mode = 'replace') {
  const result = { success: false, errors: [], counts: {} };

  try {
    let parsed = JSON.parse(jsonStr);

    // Handle encrypted backup
    if (parsed.encrypted) {
      if (!passphrase) {
        result.errors.push('Este backup está cifrado. Se requiere contraseña.');
        return result;
      }
      try {
        const decrypted = await decrypt(parsed.data, passphrase);
        parsed = JSON.parse(decrypted);
      } catch {
        result.errors.push('Contraseña incorrecta o backup corrupto.');
        return result;
      }
    }

    // Validate
    const validation = validateBackup(parsed);
    if (!validation.valid) {
      result.errors = validation.errors;
      return result;
    }

    if (mode === 'replace') {
      // Clear all stores first
      for (const store of [STORES.PROFILES, STORES.DAYS, STORES.LEDGER, STORES.SERVICES, STORES.AUDIT]) {
        await clearStore(store);
      }
    }

    // Import each store
    const stores = [
      { name: STORES.PROFILES, data: parsed.profiles || [] },
      { name: STORES.DAYS, data: parsed.days || [] },
      { name: STORES.LEDGER, data: parsed.ledger || [] },
      { name: STORES.SERVICES, data: parsed.services || [] },
      { name: STORES.CONFIG, data: (parsed.config || []).filter(c => !c.key?.startsWith('__')) },
      { name: STORES.AUDIT, data: parsed.audit || [] }
    ];

    for (const { name, data } of stores) {
      let count = 0;
      for (const record of data) {
        try {
          await put(name, record);
          count++;
        } catch (err) {
          result.errors.push(`Error en ${name}: ${err.message}`);
        }
      }
      result.counts[name] = count;
    }

    result.success = true;
  } catch (err) {
    result.errors.push('Error al procesar backup: ' + err.message);
  }

  return result;
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
