/**
 * @module state/toasts
 * Reglas de los avisos (toasts), sin DOM ni store, para poder probarlas:
 *  - cuánto duran: max(4000 ms, 60 ms por carácter);
 *  - los de error no se cierran solos;
 *  - como mucho MAX_VISIBLE a la vez; los demás esperan su turno.
 */

export const MAX_VISIBLE = 3;
export const MIN_DURATION = 4000;
export const MS_PER_CHAR = 60;

/**
 * Milisegundos que se ve un aviso, o null si no se cierra solo (errores).
 * @param {{text: string, level?: string, duration?: number}} t
 */
export function toastDuration(t) {
  if (t.level === 'error') return null;
  const byLength = Math.max(MIN_DURATION, MS_PER_CHAR * String(t.text || '').length);
  return Math.max(byLength, Number(t.duration) || 0);
}

/**
 * Añade un aviso a la cola.
 * Si ya hay uno visible o esperando con el mismo texto y nivel, no se repite.
 * @param {{visible: Array, waiting: Array}} q
 * @param {Object} toast - con id
 * @returns {{visible: Array, waiting: Array, shown: boolean}} shown: si ha entrado directamente a la vista
 */
export function enqueue(q, toast) {
  const same = (x) => x.text === toast.text && (x.level || 'info') === (toast.level || 'info');
  if (q.visible.some(same) || q.waiting.some(same)) return { ...q, shown: false, duplicate: true };
  if (q.visible.length < MAX_VISIBLE) return { visible: [...q.visible, toast], waiting: q.waiting, shown: true };
  return { visible: q.visible, waiting: [...q.waiting, toast], shown: false };
}

/**
 * Quita un aviso (visible o en espera) y, si se libera hueco, entra el siguiente.
 * @returns {{visible: Array, waiting: Array, promoted: Object|null}}
 */
export function dismiss(q, id) {
  const visible = q.visible.filter(t => t.id !== id);
  let waiting = q.waiting.filter(t => t.id !== id);
  let promoted = null;
  if (visible.length < MAX_VISIBLE && waiting.length) {
    promoted = waiting[0];
    waiting = waiting.slice(1);
    visible.push(promoted);
  }
  return { visible, waiting, promoted };
}
