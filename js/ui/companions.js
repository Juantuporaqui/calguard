/**
 * @module ui/companions
 * Con quién compartes turno hoy: la gente de la plantilla que tiene tu mismo
 * turno (mañana, tarde o noche) el mismo día y no está de libre, vacaciones,
 * asunto propio o baja. Funciones puras: salen del cuadrante guardado, así que
 * funcionan sin conexión.
 */

import { canonicalPerson, currentRoster } from '../domain/groupCuadrante.js';

const TURNOS = ['TURNO_M', 'TURNO_T', 'TURNO_N'];
const AUSENCIAS = ['VACACIONES', 'LIBRE', 'AP', 'BAJA'];

/**
 * @param {{entries?: Array<{person: string, date: string, tagType: string}>, names?: string[]}} data - cuadrante del grupo
 * @param {{person: string, date: string, escalafon?: string[]}} opts - tu nombre en el cuadrante y el día
 * @returns {{turno: string|null, mates: string[]}} tu turno ese día y los nombres canónicos de quienes lo comparten
 */
export function turnMates(data, { person, date, escalafon = [] }) {
  if (!data?.entries?.length || !person) return { turno: null, mates: [] };

  const me = canonicalPerson(person, escalafon);
  const typesOf = new Map(); // persona → tipos de ese día
  for (const e of data.entries) {
    if (e.date !== date) continue;
    const who = canonicalPerson(e.person, escalafon);
    if (!typesOf.has(who)) typesOf.set(who, []);
    typesOf.get(who).push(e.tagType);
  }

  const mine = typesOf.get(me) || [];
  if (mine.some(t => AUSENCIAS.includes(t))) return { turno: null, mates: [] };
  const turno = TURNOS.find(t => mine.includes(t)) || null;
  if (!turno) return { turno: null, mates: [] };

  const roster = currentRoster(data.names || [], escalafon);
  const mates = roster.filter(p => {
    if (p === me) return false;
    const types = typesOf.get(p) || [];
    return types.includes(turno) && !types.some(t => AUSENCIAS.includes(t));
  });
  return { turno, mates };
}

/**
 * «con Rafa», «con Rafa y Tesa», «con Rafa, Tesa y Luis», «con Rafa, Tesa, Luis y 2 más».
 * @param {string[]} names - nombres ya listos para enseñar
 * @param {number} [max] - cuántos nombres se escriben antes de contar el resto
 * @returns {string} cadena vacía si no hay nadie
 */
export function matesText(names, max = 3) {
  const list = names.filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return `con ${list[0]}`;
  if (list.length <= max) return `con ${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
  const rest = list.length - max;
  return `con ${list.slice(0, max).join(', ')} y ${rest} más`;
}
