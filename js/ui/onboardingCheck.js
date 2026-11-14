/**
 * @module ui/onboardingCheck
 * Decisiones del asistente de primer uso, sin pantalla (se prueban en
 * tests/onboarding.test.js): cuándo se enseña, qué decir al comprobar la
 * contraseña del grupo y cómo se instala en cada móvil.
 */

/**
 * Solo en una instalación limpia: sin perfiles, sin ningún ajuste guardado y
 * sin datos de la versión antigua. Quien ya tiene datos no lo ve nunca.
 * @param {{profiles: number, configKeys: number, legacyData: boolean}} s
 */
export function shouldOnboard({ profiles = 0, configKeys = 0, legacyData = false } = {}) {
  return profiles === 0 && configKeys === 0 && !legacyData;
}

/**
 * Qué pasa con la contraseña del grupo tras intentar descargar el cuadrante.
 * @param {Object|null} result - lo que devuelve pullPublished({force: true})
 * @param {{online?: boolean}} [env]
 * @returns {{ok: boolean, keep: boolean, message: string}}
 *   ok: se puede seguir; keep: la contraseña se queda guardada
 */
export function passwordOutcome(result, { online = true } = {}) {
  if (result?.updated || result?.localNewer) {
    return { ok: true, keep: true, message: 'Contraseña correcta: ya tienes el cuadrante del grupo.' };
  }
  if (result?.code === 'BAD_PASSWORD') {
    return { ok: false, keep: false, message: 'Esa contraseña no abre el cuadrante del grupo. Revisa mayúsculas, espacios y tildes, o pídesela otra vez al administrador.' };
  }
  if (result?.publishedAt && !result.error) {
    return { ok: true, keep: true, message: 'Contraseña correcta: ya tienes el último cuadrante.' };
  }
  if (!online) {
    return { ok: true, keep: true, message: 'Ahora no hay conexión: la contraseña queda guardada y se comprobará sola cuando vuelva.' };
  }
  if (result && 'code' in result && result.error) {
    return { ok: false, keep: true, message: `No se pudo abrir el cuadrante (${result.error}). La contraseña queda guardada; vuelve a intentarlo más tarde.` };
  }
  return { ok: true, keep: true, message: 'La contraseña queda guardada. Aún no hay cuadrante publicado: te llegará solo cuando el administrador lo publique.' };
}

/** ¿La app ya se abre instalada (desde el icono)? */
export function isStandalone(win = globalThis) {
  try {
    if (win.navigator?.standalone === true) return true;
    return Boolean(win.matchMedia?.('(display-mode: standalone)')?.matches || win.matchMedia?.('(display-mode: fullscreen)')?.matches);
  } catch {
    return false;
  }
}

/**
 * Cómo se instala aquí.
 * @param {{userAgent?: string, maxTouchPoints?: number, standalone?: boolean, canPrompt?: boolean}} env
 * @returns {'installed'|'prompt'|'ios'|'manual'}
 */
export function installMode({ userAgent = '', maxTouchPoints = 0, standalone = false, canPrompt = false } = {}) {
  if (standalone) return 'installed';
  if (canPrompt) return 'prompt';
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios ? 'ios' : 'manual';
}
