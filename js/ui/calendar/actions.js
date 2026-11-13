/**
 * @module ui/calendar/actions
 * Lo que se apunta en el calendario: etiquetas de un día, guardias de una
 * semana, borrar, eventos, libres concedidos y las peticiones de días (libres,
 * asuntos propios y vacaciones) con su mensaje y «Deshacer». No pinta pantallas;
 * los cálculos son los de js/domain/*.
 */

import { getState, Actions, effectiveConfig } from '../../state/store.js';
import { todayISO, isWeekend, getWeekDates, formatDMY, countWorkingDays, detectConflict, formatDM } from '../../domain/rules.js';
import { planFreeDayRequest, isWithinYearAfter } from '../../domain/reconcile.js';
import { guardsOfYear } from '../../domain/balances.js';
import { commitDayChanges, newMovement } from '../../domain/changes.js';
import { eventTitle, withEventItems } from '../../domain/events.js';
import { updateActiveProfile } from '../../domain/profiles.js';
import { syncNow } from '../flows.js';
import { dayName } from '../labels.js';
import { showSharePopup } from './share.js';
import { rangeDates, keepCompatible } from './grid.js';

const undoOpts = (undo) => (typeof undo === 'function' ? { onAction: undo } : {});
const dayOf = (iso) => getState().days.find(d => d.dateISO === iso);

/** Día con una etiqueta añadida (sustituye la del mismo tipo). */
function withTag(dateISO, tag) {
  const prev = dayOf(dateISO);
  const tags = keepCompatible(prev?.tags || [], tag.type);
  return { ...(prev || { dateISO }), tags: [...tags, tag] };
}


/**
 * Add a tag to a day (atomic, audited). Shows the conflict and returns false
 * when the tag is not compatible with the day.
 * @param {string} dateISO
 * @param {Object} tag
 * @returns {Promise<Function|boolean>} la función de deshacer, o false si no se pudo
 */
export async function addDayTag(dateISO, tag) {
  const prev = getState().days.find(d => d.dateISO === dateISO);
  const conflict = detectConflict(prev?.tags || [], tag.type);
  if (conflict) {
    Actions.showToast(conflict);
    return false;
  }
  const undo = await commitDayChanges({
    dayPuts: [withTag(dateISO, tag)],
    audit: { action: 'DAY_TAG_ADD', detail: `${dateISO}: ${tag.type}` }
  });
  return undo || true;
}

/**
 * Add many tags in ONE transaction and ONE render.
 * @param {Array<{dateISO: string, tag: Object}>} items
 * @param {Object} [options]
 * @param {boolean} [options.skipIfHasProtectedTags] - skip days with non-shift tags
 * @returns {Promise<{imported: number, skipped: number, undo: Function|null}>}
 */
export async function addDayTagBatch(items, options = {}) {
  const work = new Map(getState().days.map(d => [d.dateISO, { ...d, tags: [...(d.tags || [])] }]));
  const touched = new Set();
  let imported = 0, skipped = 0;

  for (const { dateISO, tag } of items) {
    const day = work.get(dateISO) || { dateISO, tags: [] };
    if (options.skipIfHasProtectedTags && day.tags.some(t => !['TURNO_M', 'TURNO_T', 'TURNO_N'].includes(t.type))) {
      skipped++;
      continue;
    }
    if (detectConflict(day.tags, tag.type)) { skipped++; continue; }
    day.tags = [...keepCompatible(day.tags, tag.type), tag];
    work.set(dateISO, day);
    touched.add(dateISO);
    imported++;
  }

  if (touched.size === 0) return { imported, skipped, undo: null };
  const undo = await commitDayChanges({
    dayPuts: [...touched].map(iso => work.get(iso)),
    audit: { action: 'DAY_TAG_BATCH', detail: `${imported} etiquetas` }
  });
  return { imported, skipped, undo };
}

/**
 * Remove a specific tag from a day
 * @param {string} dateISO
 * @param {string} tagType
 */
export async function removeDayTag(dateISO, tagType) {
  const prev = getState().days.find(d => d.dateISO === dateISO);
  if (!prev) return;
  await commitDayChanges({ dayPuts: [{ ...prev, tags: prev.tags.filter(t => t.type !== tagType) }] });
}

/**
 * Mark entire week as guard duty (worked). Credits its free days once —
 * marking the same week again never credits twice.
 * @param {string} dateISO - any day in the week
 */
export async function markWeekGuardia(dateISO) {
  const s = getState();
  const weekDates = getWeekDates(dateISO);
  const conflicts = weekDates.filter(wd => detectConflict(dayOf(wd)?.tags || [], 'GUARDIA_REAL'));
  if (conflicts.length) {
    Actions.showToast(`No se puede: hay vacaciones el ${formatDM(conflicts[0])}`);
    return;
  }
  const perGuard = effectiveConfig(s).diasPorGuardia ?? 5;
  const alreadyCredited = s.ledger.some(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && m.dateISO === weekDates[0]);
  const undo = await commitDayChanges({
    dayPuts: weekDates.map(wd => {
      const d = withTag(wd, { type: 'GUARDIA_REAL' });
      return { ...d, tags: d.tags.filter(t => t.type !== 'GUARDIA_PLAN') };
    }),
    movPuts: alreadyCredited ? [] : [newMovement({
      dateISO: weekDates[0], kind: 'CREDIT', category: 'GUARDIA', amount: perGuard,
      sourceRef: `G.${formatDM(weekDates[0])}`,
      note: `Guardia semana del ${formatDM(weekDates[0])}: +${perGuard} días libres`
    })],
    audit: { action: 'GUARDIA', detail: `Semana ${weekDates[0]}` }
  });
  const future = weekDates[0] > todayISO();
  Actions.showToast(
    alreadyCredited ? 'La guardia ya estaba registrada'
      : future ? `Guardia prevista: generará ${perGuard} libres el ${formatDM(weekDates[0])}`
      : `Guardia registrada: +${perGuard} días libres`,
    { onAction: undo }
  );
}

/**
 * Mark entire week as planned guard duty
 * @param {string} dateISO
 */
export async function markWeekGuardiaPlan(dateISO) {
  const weekDates = getWeekDates(dateISO);
  const { undo } = await addDayTagBatch(weekDates.map(wd => ({ dateISO: wd, tag: { type: 'GUARDIA_PLAN' } })));
  Actions.showToast('Guardia prevista marcada', undo ? { onAction: undo } : {});
}

/**
 * Mark as personal matter (asunto propio)
 * @param {string} dateISO
 */
export async function markAsuntoPropio(dateISO) {
  const state = getState();
  if (state.counters.asuntosPropios <= 0) {
    Actions.showToast('Sin asuntos propios disponibles');
    return;
  }
  const undo = await addDayTag(dateISO, { type: 'AP' });
  if (undo) Actions.showToast(`${dayName('AP')} registrado`, undoOpts(undo));
}

/**
 * Mark shift (morning/afternoon/night)
 * @param {string} dateISO
 * @param {'TURNO_M'|'TURNO_T'|'TURNO_N'} shift
 */
export async function markShift(dateISO, shift) {
  const undo = await addDayTag(dateISO, { type: shift });
  if (undo) Actions.showToast(`${dayName(shift)} el ${formatDM(dateISO)}`, undoOpts(undo));
}

/**
 * Mark formation/training
 * @param {string} dateISO
 */
export async function markFormacion(dateISO) {
  const undo = await addDayTag(dateISO, { type: 'FORMACION' });
  if (undo) Actions.showToast(`${dayName('FORMACION')} registrada`, undoOpts(undo));
}

/**
 * Mark sick leave / family matters
 * @param {string} dateISO
 */
export async function markBaja(dateISO) {
  const undo = await addDayTag(dateISO, { type: 'BAJA' });
  if (undo) Actions.showToast(`${dayName('BAJA')} registrada`, undoOpts(undo));
}

/**
 * Remove all events from a day (with "Deshacer").
 * A guardia is removed for its whole week, unless free days were already
 * charged to it.
 * @param {string} dateISO
 */
export async function removeAllDayEvents(dateISO, { onlyGuard = false } = {}) {
  const s = getState();
  const dayData = s.days.find(d => d.dateISO === dateISO);
  if (!dayData || dayData.tags.length === 0) {
    Actions.showToast('No hay nada que eliminar');
    return;
  }

  const isGuard = onlyGuard || dayData.tags.some(t => t.type === 'GUARDIA_REAL' || t.type === 'GUARDIA_PLAN');
  if (isGuard) {
    const weekDates = getWeekDates(dateISO);
    const credits = s.ledger.filter(m => m.kind === 'CREDIT' && m.category === 'GUARDIA' && m.dateISO === weekDates[0]);
    const charged = s.ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE'
      && credits.some(c => c.sourceRef === m.sourceRef && isWithinYearAfter(c.dateISO, m.dateISO)));
    if (charged.length > 0) {
      Actions.showToast(`No se puede borrar: esta guardia ya tiene ${charged.length} libre(s) cargado(s)`);
      return;
    }
    const dayPuts = weekDates
      .map(wd => s.days.find(d => d.dateISO === wd))
      .filter(Boolean)
      .map(d => ({ ...d, tags: d.tags.filter(t => t.type !== 'GUARDIA_REAL' && t.type !== 'GUARDIA_PLAN') }));
    const undo = await commitDayChanges({
      dayPuts,
      movDeleteIds: credits.map(c => c.id),
      audit: { action: 'GUARDIA_DELETE', detail: `Semana ${weekDates[0]}` }
    });
    Actions.showToast('Guardia eliminada de la semana', { onAction: undo });
    return;
  }

  // Ledger effects of this day: its free-day debit and "otros" adjustments
  const otroLabels = new Set(dayData.tags.filter(t => t.type === 'OTRO' && t.meta?.label).map(t => t.meta.label));
  const movDeleteIds = s.ledger.filter(m => m.dateISO === dateISO && (
    (m.kind === 'DEBIT' && m.category === 'LIBRE' && dayData.tags.some(t => t.type === 'LIBRE')) ||
    (m.category === 'OTROS' && otroLabels.has(m.sourceRef))
  )).map(m => m.id);

  const undo = await commitDayChanges({
    dayPuts: [{ ...dayData, tags: [] }],
    movDeleteIds,
    audit: { action: 'DAY_CLEAR', detail: dateISO }
  });
  Actions.showToast(`Eventos del ${formatDM(dateISO)} eliminados`, { onAction: undo });
}

/**
 * Mark "otros eventos" with concept and days impact
 * @param {string} dateISO
 * @param {string} concept
 * @param {number} daysImpact
 */
/**
 * Quita una sola cosa de un día (el libre, la mañana, un evento…) y deja lo
 * demás. Con sus efectos en la cuenta: el libre deja de gastar, «otros» deja
 * de sumar o restar; una guardia se quita de toda su semana. Con «Deshacer».
 * @param {string} dateISO
 * @param {string} type
 */
export async function removeOneTag(dateISO, type) {
  const s = getState();
  const day = dayOf(dateISO);
  const tag = day?.tags.find(t => t.type === type);
  if (!tag) return;
  if (type === 'GUARDIA_REAL' || type === 'GUARDIA_PLAN') { await removeAllDayEvents(dateISO, { onlyGuard: true }); return; }
  const movDeleteIds = s.ledger.filter(m => m.dateISO === dateISO && (
    (type === 'LIBRE' && m.kind === 'DEBIT' && m.category === 'LIBRE') ||
    (type === 'OTRO' && m.category === 'OTROS' && m.sourceRef === tag.meta?.label)
  )).map(m => m.id);
  const undo = await commitDayChanges({
    dayPuts: [{ ...day, tags: day.tags.filter(t => t.type !== type) }],
    movDeleteIds,
    audit: { action: 'DAY_TAG_REMOVE', detail: `${dateISO}: ${type}` }
  });
  const name = type === 'OTRO' && tag.meta?.label ? tag.meta.label : dayName(type);
  Actions.showToast(`Quitado: ${name} del ${formatDM(dateISO)}`, undoOpts(undo));
}

export async function markOtros(dateISO, concept, daysImpact) {
  const movPuts = daysImpact !== 0 ? [newMovement({
    dateISO, kind: daysImpact >= 0 ? 'CREDIT' : 'DEBIT', category: 'OTROS', amount: daysImpact,
    sourceRef: concept, note: `${concept}: ${daysImpact >= 0 ? '+' : ''}${daysImpact} días`
  })] : [];
  const undo = await commitDayChanges({
    dayPuts: [withTag(dateISO, { type: 'OTRO', meta: { label: concept, diasAfectados: daysImpact } })],
    movPuts,
    audit: { action: 'OTRO', detail: `${dateISO}: ${concept} (${daysImpact})` }
  });
  Actions.showToast(`${concept}: ${daysImpact >= 0 ? '+' : ''}${daysImpact} días`, { onAction: undo });
}

export async function saveDayEvents(dateISO, items, message) {
  const prev = getState().days.find(d => d.dateISO === dateISO);
  const tags = withEventItems(prev?.tags || [], items);
  const undo = await commitDayChanges({
    dayPuts: [{ ...(prev || {}), dateISO, tags }],
    audit: { action: 'EVENTOS_DIA', detail: `${dateISO}: ${items.map(eventTitle).join(', ')}` }
  });
  Actions.showToast(message, { onAction: undo });
}

/**
 * Varios libres a la vez como concedidos (no descuentan): lo mismo que
 * «No computa: día concedido» del menú del día, de una sola vez (lo usa el aviso de Inicio).
 * @param {string[]} dates
 */
export async function markLibresConcedidos(dates) {
  const s = getState();
  const set = new Set(effectiveConfig(s).libresExentos || []);
  const nuevos = dates.filter(d => !set.has(d));
  if (!nuevos.length) return;
  nuevos.forEach(d => set.add(d));
  await updateActiveProfile({ settings: { libresExentos: [...set].sort() } });
  const ids = getState().ledger
    .filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && nuevos.includes(m.dateISO))
    .map(m => m.id);
  if (ids.length) await commitDayChanges({ movDeleteIds: ids, audit: { action: 'LIBRE_CONCEDIDO', detail: nuevos.join(', ') } });
  if (s.activeProfile?.cuadranteName) await syncNow({ quiet: true });
  Actions.showToast(nuevos.length === 1
    ? `🎁 El libre del ${formatDMY(nuevos[0])} queda como concedido: no descuenta`
    : `🎁 ${nuevos.length} libres quedan como concedidos: no descuentan`);
}

export async function toggleLibreExento(dateISO) {
  const s = getState();
  const set = new Set(effectiveConfig(s).libresExentos || []);
  const making = !set.has(dateISO);
  if (making) set.add(dateISO); else set.delete(dateISO);
  await updateActiveProfile({ settings: { libresExentos: [...set].sort() } });

  if (making) {
    const ids = getState().ledger
      .filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE' && m.dateISO === dateISO)
      .map(m => m.id);
    if (ids.length) await commitDayChanges({ movDeleteIds: ids, audit: { action: 'LIBRE_CONCEDIDO', detail: dateISO } });
  }
  if (s.activeProfile?.cuadranteName) {
    await syncNow();
  } else if (!making) {
    await commitDayChanges({
      movPuts: [newMovement({ dateISO, kind: 'DEBIT', category: 'LIBRE', amount: -1, sourceRef: '', note: `Libre ${formatDM(dateISO)}` })],
      audit: { action: 'LIBRE_COMPUTA', detail: dateISO }
    });
  }
  Actions.showToast(making
    ? `🎁 El libre del ${formatDMY(dateISO)} queda como concedido: no computa`
    : `El libre del ${formatDMY(dateISO)} vuelve a computar`);
}

export function generatePedirDiasMsg(assignments) {
  let msg = 'Solicito librar los siguientes días:\n';
  for (const a of assignments) {
    const ref = a.guardRef === 'ARRASTRE' ? 'año anterior' : `${a.ordinal} ${a.guardRef}`;
    msg += `• ${formatDMY(a.date)} (${ref})\n`;
  }
  msg += '\nGracias.';
  return msg;
}

/** Registrar los asuntos propios elegidos y dejar listo el mensaje para pedirlos. */
/** @returns {Promise<boolean>} true si se apuntó algo */
export async function requestAsuntos(dates) {
  const left = Math.max(0, getState().balances.ap.disponibles);
  if (dates.length > left) {
    Actions.showToast(`Solo te quedan ${left} asuntos propios y has elegido ${dates.length}`);
    return false;
  }
  const sorted = [...dates].sort();
  const free = sorted.filter(d => !detectConflict(getState().days.find(x => x.dateISO === d)?.tags || [], 'AP'));
  const { imported, skipped, undo } = await addDayTagBatch(sorted.map(d => ({ dateISO: d, tag: { type: 'AP' } })));
  if (!undo) {
    Actions.showToast('Esos días ya tenían algo apuntado');
    return false;
  }
  let closeSheet = null;
  const undoAll = async () => {
    closeSheet?.();
    if (await undo() !== null) Actions.showToast('Petición deshecha');
  };
  Actions.showToast(`${imported} ${imported === 1 ? 'asunto propio pedido' : 'asuntos propios pedidos'}${skipped ? ` · ${skipped} omitido(s)` : ''}`, { onAction: undoAll });
  const msg = `Solicito los siguientes días de asunto propio:\n${free.map(d => `• ${formatDMY(d)}`).join('\n')}\n\nGracias.`;
  closeSheet = showSharePopup(msg, undoAll);
  return true;
}


/**
 * Pedir días libres: los reparte por orden entre las guardias abiertas
 * (planFreeDayRequest), los apunta y deja el mensaje listo con «Deshacer».
 * Lo usan la selección múltiple y el botón «Libre» de la hoja del día.
 * @param {string[]} dates
 * @returns {Promise<boolean>} true si se apuntó algo
 */
export async function requestLibres(dates) {
  const s = getState();
  if (!dates.length) { Actions.showToast('No has seleccionado ningún día'); return false; }
  const L = s.balances.libres;
  const thisYearUnassigned = s.ledger.filter(m => m.kind === 'DEBIT' && m.category === 'LIBRE'
    && (m.sourceRef === 'ARRASTRE' || !m.sourceRef) && m.dateISO?.startsWith(String(s.balances.year))).length;
  const cfgNow = effectiveConfig(s);
  // por orden: la guardia abierta más antigua (las cerradas ya no deben días);
  // las del año pasado entran cuando el cuadrante da lo que quedó pendiente
  const open = guardsOfYear(s.ledger, s.balances.year, cfgNow.diasPorGuardia ?? 5, todayISO(), cfgNow.libresExentos || [])
    .filter(t => t.worked && !t.cerrada && t.total - t.used > 0);
  const plan = planFreeDayRequest({
    dates,
    days: s.days,
    ledger: s.ledger,
    available: L.disponibles,
    carryFree: L.arrastreAuto ? 0 : Math.max(0, L.arrastreRestante - thisYearUnassigned),
    today: todayISO(),
    daysPerGuard: cfgNow.diasPorGuardia ?? 5,
    slots: open
  });

  if (!plan.ok) {
    Actions.showToast(`Solo tienes ${Math.max(0, plan.available)} libres disponibles hoy y has elegido ${plan.requested}`);
    return false;
  }
  if (plan.assignments.length === 0) {
    Actions.showToast(plan.conflicts.length ? plan.conflicts[0].reason : 'Esos días ya estaban pedidos');
    return false;
  }

  const dayPuts = plan.assignments.map(a => {
    const prev = dayOf(a.date);
    const tags = keepCompatible(prev?.tags || [], 'LIBRE');
    return { ...(prev || { dateISO: a.date }), tags: [...tags, { type: 'LIBRE', meta: { guardRef: a.guardRef, ordinal: a.ordinal } }] };
  });
  const movPuts = plan.assignments.map(a => newMovement({
    dateISO: a.date, kind: 'DEBIT', category: 'LIBRE', amount: -1, sourceRef: a.guardRef, ...(a.guardDate ? { sourceDate: a.guardDate } : {}),
    note: `Libre ${formatDM(a.date)} · ${a.ordinal}${a.guardRef !== 'ARRASTRE' ? ' ' + a.guardRef : ''}`
  }));
  const undo = await commitDayChanges({
    dayPuts, movPuts,
    audit: { action: 'LIBRES_PEDIDOS', detail: plan.assignments.map(a => a.date).join(', ') }
  });

  const skipped = plan.already.length + plan.conflicts.length;
  let closeSheet = null;
  const undoAll = async () => {
    closeSheet?.();
    if (await undo() !== null) Actions.showToast('Petición deshecha');
  };
  const n = plan.assignments.length;
  Actions.showToast(`${n} ${n === 1 ? 'libre pedido' : 'libres pedidos'}${skipped ? ` · ${skipped} omitido(s)` : ''}`, { onAction: undoAll });
  closeSheet = showSharePopup(generatePedirDiasMsg(plan.assignments), undoAll);
  return true;
}

/**
 * Apuntar vacaciones (u otro periodo) de un día a otro, con «Deshacer» y,
 * si se piden desde Inicio, el mensaje listo para enviar.
 * @param {{type: string, start: string, end: string, pedir?: boolean}} o
 * @returns {Promise<boolean>} true si se apuntó algo
 */
export async function requestRange({ type, start, end, pedir = false }) {
  const range = rangeDates(start, end);
  [start, end] = [range[0], range[range.length - 1]];
  const excludeWeekends = getState().config.excludeWeekendsVacation;
  const workDays = excludeWeekends ? countWorkingDays(range) : range.length;
  if (type === 'VACACIONES') {
    const left = getState().balances.vacaciones.disponibles;
    if (workDays > left) {
      Actions.showToast(`Solo te quedan ${Math.max(0, left)} días de vacaciones (has elegido ${workDays})`);
      return false;
    }
  }
  const rangeId = crypto.randomUUID();
  const items = range
    .filter(d => !(excludeWeekends && isWeekend(d) && type === 'VACACIONES'))
    .map(d => ({ dateISO: d, tag: { type, meta: { rangeId } } }));
  const { imported, skipped, undo } = await addDayTagBatch(items);
  if (!undo) { Actions.showToast('Esos días ya tenían algo apuntado'); return false; }

  let closeSheet = null;
  const undoAll = async () => {
    closeSheet?.();
    if (await undo() !== null) Actions.showToast('Petición deshecha');
  };
  Actions.showToast(
    `${type === 'VACACIONES' ? dayName('VACACIONES') : 'Período'}: ${imported} días${skipped ? ` · ${skipped} omitidos por conflicto` : ''}`,
    { onAction: pedir ? undoAll : undo }
  );
  if (pedir) {
    closeSheet = showSharePopup(`Solicito vacaciones del ${formatDMY(start)} al ${formatDMY(end)} (${imported} ${imported === 1 ? 'día' : 'días'}).\n\nGracias.`, undoAll);
  }
  return true;
}
