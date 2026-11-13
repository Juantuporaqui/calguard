/**
 * @module ui/labels
 * Única fuente de nombres, abreviaturas y clases CSS de cada tipo de día.
 * Si un tipo cambia de nombre o de letra, se cambia aquí y en ningún otro sitio.
 *
 * Campos:
 *  - name: nombre completo (solo inicial mayúscula).
 *  - short: una letra (o un símbolo) para insignias, leyendas y puntos.
 *  - cls: clase de las píldoras, leyendas y cronología del inicio.
 *  - iconCls: clase del icono redondo del menú de día.
 *  - cellCls: clase que pinta el día entero en el calendario (null si no lo pinta).
 *  - cqCls: clase de la casilla en la tabla del cuadrante del grupo.
 */

export const DAY_TYPES = Object.freeze({
  GUARDIA_REAL: { name: 'Guardia', short: 'G', cls: 'guardia', iconCls: 'guardia-icon', cellCls: 'guardia', cqCls: 'cq-guardia' },
  GUARDIA_PLAN: { name: 'Guardia prevista', short: 'P', cls: 'plan', iconCls: 'plan-icon', cellCls: 'proxima-guardia', cqCls: 'cq-plan' },
  LIBRE: { name: 'Libre', short: 'L', cls: 'libre', iconCls: 'libre-icon', cellCls: 'libre', cqCls: 'cq-libre' },
  AP: { name: 'Asunto propio', short: 'A', cls: 'ap', iconCls: 'ap-icon', cellCls: 'asunto', cqCls: 'cq-asunto' },
  VACACIONES: { name: 'Vacaciones', short: 'V', cls: 'vacaciones', iconCls: 'vac-icon', cellCls: 'vacaciones', cqCls: 'cq-vacaciones' },
  TURNO_M: { name: 'Mañana', short: 'M', cls: 'turno-m', iconCls: 'turno-icon', cellCls: null, cqCls: 'cq-turno-m' },
  TURNO_T: { name: 'Tarde', short: 'T', cls: 'turno-t', iconCls: 'turno-icon', cellCls: null, cqCls: 'cq-turno-t' },
  TURNO_N: { name: 'Noche', short: 'N', cls: 'turno-n', iconCls: 'turno-icon', cellCls: null, cqCls: 'cq-turno-n' },
  FORMACION: { name: 'Formación', short: 'F', cls: 'formacion', iconCls: 'form-icon', cellCls: 'formacion', cqCls: 'cq-formacion' },
  JUICIO: { name: 'Juicio', short: 'J', cls: 'juicio', iconCls: 'juicio-icon', cellCls: 'juicio', cqCls: 'cq-juicio' },
  BAJA: { name: 'Baja', short: 'B', cls: 'baja', iconCls: 'baja-icon', cellCls: 'baja', cqCls: 'cq-baja' },
  OTRO: { name: 'Otro', short: '+', cls: 'otro', iconCls: 'otros-icon', cellCls: null, cqCls: '' },
  EVENTO: { name: 'Evento', short: '💬', cls: 'evento', iconCls: 'evento-icon', cellCls: null, cqCls: '' }
});

/** Tipos que llevan insignia en la celda del calendario, en este orden. */
export const BADGE_TYPES = Object.freeze([
  'GUARDIA_REAL', 'GUARDIA_PLAN', 'LIBRE', 'VACACIONES', 'AP', 'FORMACION', 'JUICIO', 'BAJA'
]);

/** Tipos que salen en la leyenda del calendario, en este orden. */
export const LEGEND_TYPES = Object.freeze([
  'GUARDIA_REAL', 'GUARDIA_PLAN', 'LIBRE', 'VACACIONES', 'AP', 'BAJA', 'TURNO_M', 'TURNO_T', 'TURNO_N', 'JUICIO', 'FORMACION', 'OTRO', 'EVENTO'
]);

const FALLBACK = Object.freeze({ name: '', short: '?', cls: 'otro', iconCls: 'otros-icon', cellCls: null, cqCls: '' });

/** Ficha del tipo; si no existe, devuelve una neutra que usa el propio código como nombre. */
export function dayInfo(type) {
  return DAY_TYPES[type] || { ...FALLBACK, name: String(type ?? '') };
}

/** Nombre completo: «Guardia prevista». */
export const dayName = (type) => dayInfo(type).name;

/** Letra o símbolo: «P». */
export const dayShort = (type) => dayInfo(type).short;

/** Clase de píldoras, leyendas y cronología. */
export const dayClass = (type) => dayInfo(type).cls;

/** Clase del icono redondo del menú. */
export const dayIconClass = (type) => dayInfo(type).iconCls;

/** Clase de la casilla en la tabla del cuadrante. */
export const dayCqClass = (type) => dayInfo(type).cqCls;

/** Clase que pinta el día entero en el calendario, o null. */
export const dayCellClass = (type) => dayInfo(type).cellCls;

/** Identificador para clases por tipo (`day-badge-X`, `week-chip-X`): GUARDIA_PLAN → guardia-plan. */
export const daySlug = (type) => String(type).toLowerCase().replace(/_/g, '-');

/**
 * Orden en que se enseñan las letras de un día: primero la guardia o la
 * ausencia, luego el turno y después lo demás.
 */
export const CODE_ORDER = Object.freeze([
  'GUARDIA_REAL', 'GUARDIA_PLAN', 'VACACIONES', 'LIBRE', 'AP', 'BAJA',
  'TURNO_M', 'TURNO_T', 'TURNO_N', 'JUICIO', 'FORMACION', 'OTRO', 'EVENTO'
]);

/**
 * Tipos de un día que se enseñan como letra, en el orden de CODE_ORDER.
 * @param {Array<{type: string}>} tags
 * @param {number} [max] - cuántos como mucho
 * @returns {{shown: string[], more: number}} los que se ven y cuántos quedan fuera
 */
export function dayCodeTypes(tags = [], max = 2) {
  const present = new Set(tags.map(t => t.type));
  const all = CODE_ORDER.filter(t => present.has(t));
  return { shown: all.slice(0, max), more: Math.max(0, all.length - max) };
}
