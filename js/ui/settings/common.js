/**
 * @module ui/settings/common
 * Piezas comunes de Ajustes: secciones plegables, guardado automático por
 * campo (con aviso «Guardado» y el error junto al campo) y la configuración global.
 */

import { getState, Actions } from '../../state/store.js';
import { put, STORES } from '../../persistence/db.js';

/** Secciones abiertas, recordadas entre repintados. */
export const openSections = new Set(['days']);

export function section(id, title, subtitle, body) {
  return `
    <details class="set-section" data-section="${id}" ${openSections.has(id) ? 'open' : ''}>
      <summary><span class="set-title">${title}</span>${subtitle ? `<span class="set-sub">${subtitle}</span>` : ''}</summary>
      <div class="set-body">${body}</div>
    </details>`;
}

/** Guarda en la configuración global del dispositivo (compartida por los perfiles). */
export async function saveGlobalConfig(patch) {
  const newConfig = { ...getState().config, ...patch };
  Actions.setConfig(newConfig);
  // las compensaciones y el orden del grupo viven aparte (llegan con el cuadrante publicado)
  const { groupComps, groupOrden, ...toSave } = newConfig;
  await put(STORES.CONFIG, { key: 'appConfig', value: toSave });
}

/** Enseña (o quita, con msg vacío) el error de un campo, debajo de él. */
export function setFieldError(input, msg) {
  if (!input) return;
  const id = `${input.id || 'campo'}-error`;
  let el = input.parentElement?.querySelector(`#${CSS.escape(id)}`);
  if (!msg) {
    el?.remove();
    input.removeAttribute('aria-invalid');
    const rest = (input.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== id).join(' ');
    if (rest) input.setAttribute('aria-describedby', rest); else input.removeAttribute('aria-describedby');
    return;
  }
  if (!el) {
    el = document.createElement('small');
    el.className = 'field-error';
    el.id = id;
    el.setAttribute('role', 'alert');
    input.insertAdjacentElement('afterend', el);
  }
  el.textContent = msg;
  input.setAttribute('aria-invalid', 'true');
  const ids = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
  ids.add(id);
  input.setAttribute('aria-describedby', [...ids].join(' '));
}

/**
 * Guardado automático de un campo: al cambiarlo se valida y, si está bien, se
 * guarda y sale «Guardado». Si no, el error queda junto al campo.
 * @param {HTMLElement} input
 * @param {{validate?: (value: string, input: HTMLElement) => (string|null), save: (value: string, input: HTMLElement) => Promise<string|void>, event?: string}} o
 *   save puede devolver el texto del aviso (por defecto «Guardado»); devolver false = no avisar
 */
export function autosave(input, { validate, save, event = 'change' }) {
  if (!input) return;
  let busy = false;
  const run = async () => {
    if (busy) return;
    const value = input.type === 'checkbox' ? String(input.checked) : input.value;
    const err = validate ? validate(value, input) : null;
    setFieldError(input, err || '');
    if (err) return;
    busy = true;
    try {
      const msg = await save(value, input);
      if (msg !== false) Actions.showToast(msg || 'Guardado');
    } catch (e) {
      setFieldError(input, e?.message || 'No se pudo guardar');
    } finally {
      busy = false;
    }
  };
  input.addEventListener(event, run);
  // un campo que se quedó con error se vuelve a intentar al salir de él, aunque no cambie
  // (p. ej. el token, tras poner el PIN que faltaba)
  if (event === 'change' && input.type !== 'checkbox') {
    input.addEventListener('blur', () => { if (input.getAttribute('aria-invalid') === 'true') run(); });
  }
}

/** Número entero ≥ 0 de un texto (vacío o malo → null). */
export function intOrNull(v) {
  if (String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

/** Validación de enteros con rango, para autosave. */
export function intRange(min, max, { optional = false } = {}) {
  return (v) => {
    const n = intOrNull(v);
    if (n === null) return optional ? null : 'Escribe un número';
    if (Number.isNaN(n) || n < min || n > max) return `Tiene que ser un número entero de ${min} a ${max}`;
    return null;
  };
}
