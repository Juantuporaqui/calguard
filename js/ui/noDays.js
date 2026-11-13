/**
 * @module ui/noDays
 * Los botones de pedir días nunca están apagados: si no te quedan, en vez de
 * no hacer nada explican por qué y cuándo tendrás más. Solo presenta los
 * saldos ya calculados (state.balances); no calcula nada nuevo.
 */

import { getState, effectiveConfig } from '../state/store.js';
import { openSheet } from './sheet.js';
import { esc } from './utils.js';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmt = (iso) => { const x = new Date(iso + 'T12:00:00'); return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`; };
const n = (v, one, many) => `${v} ${v === 1 ? one : many}`;

/** ¿Quedan días de ese tipo para pedir? kind: 'libres' | 'ap' | 'vac' */
export function hasDaysLeft(kind) {
  const b = getState().balances;
  if (!b) return true;
  const q = kind === 'ap' ? b.ap : kind === 'vac' ? b.vacaciones : b.libres;
  return q.disponibles >= 1;
}

/**
 * Si quedan días, ejecuta `go`; si no, abre la explicación.
 * @param {'libres'|'ap'|'vac'} kind
 * @param {Function} go
 */
export function pedirOExplicar(kind, go) {
  if (hasDaysLeft(kind)) go();
  else explainNoDays(kind);
}

/** Hoja «No te quedan…»: qué has gastado y cuándo llegan los siguientes. */
export function explainNoDays(kind) {
  const s = getState();
  const b = s.balances;
  const year = b.year;
  let title, why, next;

  if (kind === 'libres') {
    const L = b.libres;
    const perGuard = effectiveConfig(s).diasPorGuardia ?? 5;
    title = 'No te quedan libres para pedir';
    const total = L.generados + (L.arrastreRestante || 0);
    why = `${total === 1 ? 'Te ha salido' : 'Te han salido'} ${n(total, 'libre', 'libres')}${L.arrastreRestante ? ` (contando ${L.arrastreRestante} de ${year - 1})` : ''}: ${n(L.disfrutados, 'disfrutado', 'disfrutados')} y ${n(L.reservados || 0, 'pedido', 'pedidos')}.`;
    const nextGuard = b.guardias?.proximas?.[0];
    const parts = [];
    if (L.porGenerarLibres && nextGuard) parts.push(`Con tu próxima guardia, la semana del ${fmt(nextGuard)}, te llegan ${n(L.porGenerarLibres, 'libre', 'libres')} más: se suman el lunes de esa semana.`);
    if (L.compPrevistos) parts.push(`Además tienes ${L.compPrevistos} por compensaciones con fecha más adelante.`);
    if (!parts.length) parts.push(`Cada guardia que hagas te da ${perGuard} libres, que se suman el lunes de la semana de guardia.`);
    next = parts.join(' ');
  } else {
    const isAP = kind === 'ap';
    const q = isAP ? b.ap : b.vacaciones;
    const unit = isAP ? ['asunto propio', 'asuntos propios'] : ['día de vacaciones', 'días de vacaciones'];
    title = isAP ? 'No te quedan asuntos propios' : 'No te quedan días de vacaciones';
    why = `Tu cupo de ${year} es de ${n(q.cupo + (q.arrastreRestante || 0), ...unit)}${q.arrastreRestante ? ` (contando ${q.arrastreRestante} de ${year - 1})` : ''}: ${n(q.disfrutados, 'disfrutado', 'disfrutados')} y ${n(q.planificados || 0, 'pedido', 'pedidos')}.`;
    next = `El 1 de enero de ${year + 1} empieza el cupo nuevo.`;
  }

  openSheet({
    title,
    variant: 'dialog',
    body: `<p class="dialog-message">${esc(why)}</p><p class="dialog-message">${esc(next)}</p>`,
    footer: '<button type="button" class="btn btn-primary" data-act="ok">Entendido</button>',
    onMount(root, close) { root.querySelector('[data-act="ok"]').addEventListener('click', close); }
  });
}
