/**
 * @module ui/diagnostics
 * Internal diagnostics screen - tests integrity without manual testing
 */

import { getState, Actions } from '../state/store.js';
import { openDB, getAll, testReadWrite, STORES, DB_NAME, DB_VERSION } from '../persistence/db.js';
import { calculateCounters } from '../domain/rules.js';
import { getGuardDetails } from '../domain/ledger.js';
import { downloadFile } from '../persistence/backup.js';

/**
 * @param {HTMLElement} container
 */
export function renderDiagnostics(container) {
  container.innerHTML = `
    <div class="diagnostics-view">
      <h2>Diagnóstico Interno</h2>
      <p>Ejecuta comprobaciones de integridad del sistema.</p>

      <button class="btn btn-primary" id="run-diag">Ejecutar Diagnóstico Completo</button>
      <button class="btn btn-sm" id="back-settings">Volver a Ajustes</button>

      <div id="diag-results" class="diag-results"></div>
      <button class="btn btn-secondary" id="download-report" hidden>Descargar Informe</button>
    </div>
  `;

  document.getElementById('back-settings')?.addEventListener('click', () => {
    Actions.setScreen('settings');
  });

  document.getElementById('run-diag')?.addEventListener('click', async () => {
    const resultsDiv = document.getElementById('diag-results');
    const downloadBtn = document.getElementById('download-report');
    resultsDiv.innerHTML = '<p>Ejecutando pruebas...</p>';

    const results = await runAllDiagnostics();

    let html = '';
    let reportText = `INFORME DE DIAGNÓSTICO - CalGuard\nFecha: ${new Date().toISOString()}\n${'═'.repeat(50)}\n\n`;

    for (const test of results) {
      const icon = test.ok ? '&#10004;' : '&#10008;';
      const cls = test.ok ? 'diag-pass' : 'diag-fail';
      html += `<div class="diag-item ${cls}">
        <span class="diag-icon">${icon}</span>
        <div>
          <strong>${test.name}</strong>
          <p>${test.detail}</p>
        </div>
      </div>`;

      reportText += `[${test.ok ? 'OK' : 'FALLO'}] ${test.name}\n  ${test.detail}\n\n`;
    }

    const allOk = results.every(r => r.ok);
    const summary = allOk
      ? '<div class="diag-summary diag-pass">Todos los tests pasaron correctamente</div>'
      : '<div class="diag-summary diag-fail">Algunos tests fallaron - revisa los detalles</div>';

    resultsDiv.innerHTML = summary + html;
    downloadBtn.hidden = false;

    reportText += `${'═'.repeat(50)}\nResultado: ${allOk ? 'TODO OK' : 'HAY FALLOS'}\n`;

    downloadBtn.onclick = () => {
      downloadFile(reportText, `calguard-diagnostico-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
    };
  });
}

/**
 * Run all diagnostic tests
 * @returns {Promise<Array<{name: string, ok: boolean, detail: string}>>}
 */
async function runAllDiagnostics() {
  const results = [];

  // 1. IndexedDB read/write
  try {
    const rwTest = await testReadWrite();
    results.push({
      name: 'IndexedDB lectura/escritura',
      ok: rwTest.ok,
      detail: rwTest.ok ? 'Lectura y escritura correctas' : `Error: ${rwTest.error}`
    });
  } catch (err) {
    results.push({ name: 'IndexedDB lectura/escritura', ok: false, detail: err.message });
  }

  // 2. Database version
  results.push({
    name: 'Versión de base de datos',
    ok: true,
    detail: `${DB_NAME} v${DB_VERSION}`
  });

  // 3. Store integrity
  try {
    for (const storeName of Object.values(STORES)) {
      const data = await getAll(storeName);
      results.push({
        name: `Store: ${storeName}`,
        ok: true,
        detail: `${data.length} registros`
      });
    }
  } catch (err) {
    results.push({ name: 'Store integrity', ok: false, detail: err.message });
  }

  // 4. Ledger consistency
  try {
    const state = getState();
    const guardDetails = getGuardDetails();
    let ledgerOk = true;
    let ledgerDetail = '';

    for (const g of guardDetails) {
      if (g.used > g.total) {
        ledgerOk = false;
        ledgerDetail += `Guardia ${g.ref}: ${g.used} usados > ${g.total} total. `;
      }
      if (g.remaining < 0) {
        ledgerOk = false;
        ledgerDetail += `Guardia ${g.ref}: saldo negativo (${g.remaining}). `;
      }
    }

    results.push({
      name: 'Consistencia del ledger',
      ok: ledgerOk,
      detail: ledgerOk ? `${guardDetails.length} guardias verificadas` : ledgerDetail
    });
  } catch (err) {
    results.push({ name: 'Consistencia del ledger', ok: false, detail: err.message });
  }

  // 5. Counter consistency
  try {
    const state = getState();
    const recalculated = calculateCounters(state.days, state.ledger, state.config);
    const countersMatch =
      recalculated.libresAcumulados === state.counters.libresAcumulados &&
      recalculated.libresGastados === state.counters.libresGastados;

    results.push({
      name: 'Consistencia de contadores',
      ok: countersMatch,
      detail: countersMatch
        ? 'Contadores coinciden con datos calculados'
        : `Discrepancia: calculado=${JSON.stringify(recalculated)} vs mostrado=${JSON.stringify(state.counters)}`
    });
  } catch (err) {
    results.push({ name: 'Consistencia de contadores', ok: false, detail: err.message });
  }

  // 6. No duplicate dates
  try {
    const state = getState();
    const dateMap = new Map();
    let dups = 0;
    for (const d of state.days) {
      const key = `${d.profileId}-${d.dateISO}`;
      if (dateMap.has(key)) dups++;
      dateMap.set(key, true);
    }

    results.push({
      name: 'Fechas sin duplicados',
      ok: dups === 0,
      detail: dups === 0 ? 'Sin duplicados' : `${dups} fechas duplicadas encontradas`
    });
  } catch (err) {
    results.push({ name: 'Fechas sin duplicados', ok: false, detail: err.message });
  }

  // 7. Service Worker
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const swActive = regs.length > 0 && regs.some(r => r.active);
    results.push({
      name: 'Service Worker',
      ok: swActive,
      detail: swActive ? 'SW registrado y activo' : 'SW no activo'
    });
  } catch (err) {
    results.push({ name: 'Service Worker', ok: false, detail: err.message });
  }

  // 8. Cache integrity
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      const hasCache = keys.length > 0;
      let cachedCount = 0;
      for (const key of keys) {
        const cache = await caches.open(key);
        const cacheKeys = await cache.keys();
        cachedCount += cacheKeys.length;
      }
      results.push({
        name: 'Cache PWA',
        ok: hasCache,
        detail: hasCache ? `${keys.length} cache(s), ${cachedCount} assets` : 'Sin cache'
      });
    } else {
      results.push({ name: 'Cache PWA', ok: false, detail: 'API Cache no disponible' });
    }
  } catch (err) {
    results.push({ name: 'Cache PWA', ok: false, detail: err.message });
  }

  // 9. Profile integrity
  try {
    const profiles = await getAll(STORES.PROFILES);
    const hasProfile = profiles.length > 0;
    const state = getState();
    const activeExists = profiles.some(p => p.id === state.activeProfileId);

    results.push({
      name: 'Perfiles',
      ok: hasProfile && activeExists,
      detail: `${profiles.length} perfil(es). Perfil activo: ${activeExists ? 'OK' : 'NO ENCONTRADO'}`
    });
  } catch (err) {
    results.push({ name: 'Perfiles', ok: false, detail: err.message });
  }

  // 10. Days tag validity
  try {
    const validTypes = ['GUARDIA_REAL', 'GUARDIA_PLAN', 'LIBRE', 'VACACIONES', 'AP',
      'TURNO_M', 'TURNO_T', 'TURNO_N', 'FORMACION', 'JUICIO', 'OTRO'];
    const state = getState();
    let invalidTags = 0;

    for (const d of state.days) {
      for (const t of (d.tags || [])) {
        if (!validTypes.includes(t.type)) invalidTags++;
      }
    }

    results.push({
      name: 'Validez de tags',
      ok: invalidTags === 0,
      detail: invalidTags === 0 ? 'Todos los tags son válidos' : `${invalidTags} tags inválidos`
    });
  } catch (err) {
    results.push({ name: 'Validez de tags', ok: false, detail: err.message });
  }

  return results;
}
