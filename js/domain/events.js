/**
 * @module domain/events
 * Eventos especiales de un día (juicio, tiro, curso, reunión…): se guardan en
 * una etiqueta EVENTO con varios elementos, para que un mismo día pueda tener
 * más de uno. No cuentan para ningún saldo; son recordatorios con "bocadillo".
 */

export const EVENT_KINDS = {
  JUICIO: { label: 'Juicio', icon: '⚖️' },
  TIRO: { label: 'Tiro', icon: '🎯' },
  CURSO: { label: 'Curso', icon: '📚' },
  REUNION: { label: 'Reunión', icon: '👥' },
  EVENTO: { label: 'Evento', icon: '📌' },
  OTRO: { label: 'Otro', icon: '💬' }
};

/** Elementos de evento de un día (tag EVENTO), ordenados por hora. */
export function eventItems(tags = []) {
  const tag = tags.find(t => t.type === 'EVENTO');
  const items = Array.isArray(tag?.meta?.items) ? tag.meta.items : [];
  return [...items].sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
}

export function eventIcon(item) {
  return (EVENT_KINDS[item?.kind] || EVENT_KINDS.OTRO).icon;
}

/** "Juicio rápido · 10:00 · Juzgado nº 3" */
export function eventTitle(item) {
  const kind = EVENT_KINDS[item?.kind] || EVENT_KINDS.OTRO;
  return item?.title?.trim() || kind.label;
}

export function eventSummary(item) {
  return [eventTitle(item), item?.hora, item?.lugar].filter(Boolean).join(' · ');
}

/**
 * New tag list for a day with `items` as its events (removes the EVENTO tag
 * when there are none left). Other tags are untouched.
 */
export function withEventItems(tags = [], items = []) {
  const others = tags.filter(t => t.type !== 'EVENTO');
  return items.length ? [...others, { type: 'EVENTO', meta: { items } }] : others;
}

/** Clean, bounded event item from user input. */
export function makeEventItem({ kind, title, hora, lugar, nota }) {
  const clip = (v, n) => String(v || '').trim().slice(0, n);
  return {
    id: (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random())),
    kind: EVENT_KINDS[kind] ? kind : 'EVENTO',
    title: clip(title, 60),
    hora: /^\d{2}:\d{2}$/.test(hora || '') ? hora : '',
    lugar: clip(lugar, 60),
    nota: clip(nota, 140)
  };
}
