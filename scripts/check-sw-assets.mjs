#!/usr/bin/env node
/**
 * Comprueba la coherencia del precache del service worker:
 *  1. Todo archivo listado en ASSETS_TO_CACHE debe existir en el repo.
 *  2. Todo .js/.mjs bajo js/ y vendor/ debe estar listado (si no, la app
 *     rompe offline al desplegar un módulo nuevo).
 * Falla con exit code 1 si hay discrepancias.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swSource = readFileSync(join(root, 'service-worker.js'), 'utf8');

const arrayMatch = swSource.match(/const ASSETS_TO_CACHE = \[([\s\S]*?)\];/);
if (!arrayMatch) {
  console.error('ERROR: no se encontró ASSETS_TO_CACHE en service-worker.js');
  process.exit(1);
}

const listed = [...arrayMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const errors = [];

// 1. Listed assets must exist ('./' is the root document, skip it)
for (const asset of listed) {
  if (asset === './') continue;
  const path = join(root, asset);
  if (!existsSync(path)) {
    errors.push(`Listado en el SW pero no existe: ${asset}`);
  }
}

// 2. Every JS module under js/ and vendor/ must be listed
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const listedSet = new Set(listed.map(a => a.replace(/^\.\//, '')));
for (const dir of ['js', 'vendor']) {
  const full = join(root, dir);
  if (!existsSync(full)) continue;
  for (const file of walk(full)) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (!/\.(js|mjs)$/.test(rel)) continue;
    if (!listedSet.has(rel)) {
      errors.push(`Módulo no listado en ASSETS_TO_CACHE (romperá offline): ${rel}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Precache del service worker incoherente:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`OK: ${listed.length} assets listados, todos existen y ningún módulo queda fuera.`);
