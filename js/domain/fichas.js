/**
 * @module domain/fichas
 * Ficha de cada policía: cupos (AP, vacaciones), días libres por guardia,
 * arrastre del año anterior, caducidad de los AP y libres concedidos.
 *
 * El administrador las rellena y viajan CIFRADAS con el cuadrante publicado,
 * de modo que al instalar la app cada uno ya la tiene configurada. Después
 * cada uno puede cambiar la suya: por cada dato manda el cambio MÁS RECIENTE
 * (el del administrador o el propio). Cada perfil guarda en `settingsMeta`
 * cuándo se cambió cada dato.
 */

export const EPOCH = '1970-01-01T00:00:00.000Z';
const SCALARS = ['asuntosAnuales', 'vacacionesAnuales', 'diasPorGuardia', 'diasPorFestivo', 'libresExentos'];
const CARRY_FIELDS = ['libres', 'ap', 'vacaciones', 'primerLibre', 'primerAP', 'primerVac', 'caducaAP'];

/** settings → { 'asuntosAnuales': 8, 'carry.2026.ap': 3, … } */
export function flattenSettings(settings = {}) {
  const out = {};
  for (const k of SCALARS) if (settings[k] !== undefined) out[k] = settings[k];
  for (const [y, c] of Object.entries(settings.carryovers || {})) {
    for (const f of CARRY_FIELDS) if (c && c[f] !== undefined) out[`carry.${y}.${f}`] = c[f];
  }
  return out;
}

/** Write flat values back into a settings object (returns a new object). */
export function unflattenSettings(base = {}, flat = {}) {
  const s = { ...base, carryovers: { ...(base.carryovers || {}) } };
  for (const [path, v] of Object.entries(flat)) {
    if (path.startsWith('carry.')) {
      const [, y, f] = path.split('.');
      s.carryovers[y] = { ...(s.carryovers[y] || {}), [f]: v };
    } else {
      s[path] = v;
    }
  }
  return s;
}

/**
 * The value as it actually counts: an absent value equals the default it
 * falls back to (so saving a form with untouched defaults is not a "change").
 * @param {Object} defaults - {asuntosAnuales, vacacionesAnuales, diasPorGuardia, apPlazo} of the group
 */
export function normalizeField(path, v, defaults = {}) {
  if (path === 'libresExentos') return JSON.stringify([...(v || [])].sort());
  if (path.startsWith('carry.')) {
    const [, y, f] = path.split('.');
    if (f === 'libres' || f === 'ap' || f === 'vacaciones') return Number(v) || 0;
    if (f === 'caducaAP') return v || `${y}-${defaults.apPlazo || '03-25'}`;
    return v || null;
  }
  if (path === 'diasPorGuardia') {
    if (v === undefined || v === null || v === '') return null;
    return Number(v) === Number(defaults.diasPorGuardia ?? 5) ? null : Number(v);
  }
  if (path === 'diasPorFestivo') return v === undefined || v === null || v === '' ? null : Number(v);
  if (path === 'asuntosAnuales') return v === undefined || v === null ? Number(defaults.asuntosAnuales ?? 8) : Number(v);
  if (path === 'vacacionesAnuales') return v === undefined || v === null ? Number(defaults.vacacionesAnuales ?? 25) : Number(v);
  return v ?? null;
}

const same = (path, a, b, defaults) =>
  JSON.stringify(normalizeField(path, a, defaults)) === JSON.stringify(normalizeField(path, b, defaults));

/** Stamp `at` on every field whose effective value changed. */
export function stampChanges(oldSettings = {}, newSettings = {}, meta = {}, at = new Date().toISOString(), defaults = {}) {
  const a = flattenSettings(oldSettings);
  const b = flattenSettings(newSettings);
  const out = { ...meta };
  for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!same(path, a[path], b[path], defaults)) out[path] = at;
  }
  return out;
}

/** A profile's ficha for publishing: its values and when each one changed. */
export function buildFicha(profile) {
  const values = flattenSettings(profile?.settings || {});
  const meta = {};
  for (const p of Object.keys(values)) meta[p] = profile?.settingsMeta?.[p] || EPOCH;
  return { values, meta };
}

/** Fichas of every profile linked to someone in the cuadrante, by canonical name. */
export function buildFichas(profiles = []) {
  const out = {};
  for (const p of profiles) {
    if (!p?.cuadranteName) continue;
    out[String(p.cuadranteName).toUpperCase()] = buildFicha(p);
  }
  return out;
}

/**
 * Merge a published ficha into a profile's settings: per field, the most
 * recent change wins. A value nobody ever stamped (EPOCH) only fills gaps.
 * @returns {{settings: Object, meta: Object, changed: string[], latest: string|null}}
 */
export function mergeFicha(settings = {}, meta = {}, ficha, defaults = {}) {
  if (!ficha?.values) return { settings, meta, changed: [], latest: null };
  const local = flattenSettings(settings);
  const apply = {};
  const newMeta = { ...meta };
  const changed = [];
  let latest = null;
  for (const [path, v] of Object.entries(ficha.values)) {
    const remoteAt = ficha.meta?.[path] || EPOCH;
    const localAt = meta[path] || null;
    if (same(path, local[path], v, defaults)) continue;
    if (localAt && localAt >= remoteAt) continue;                       // my change is newer
    if (!localAt && remoteAt === EPOCH && local[path] !== undefined) continue; // nobody dated it: keep mine
    apply[path] = v;
    newMeta[path] = remoteAt;
    changed.push(path);
    if (remoteAt !== EPOCH && (!latest || remoteAt > latest)) latest = remoteAt;
  }
  return {
    settings: changed.length ? unflattenSettings(settings, apply) : settings,
    meta: newMeta,
    changed,
    latest
  };
}

/** Group defaults used to compare values. */
export function fichaDefaults(config = {}) {
  return {
    asuntosAnuales: config.asuntosAnuales ?? 8,
    vacacionesAnuales: config.vacacionesAnuales ?? 25,
    diasPorGuardia: config.diasPorGuardia ?? 5,
    apPlazo: config.apPlazo || '03-25'
  };
}
