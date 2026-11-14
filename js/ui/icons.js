/**
 * @module ui/icons
 * Iconos SVG de trazo, del mismo estilo que los de la barra de abajo (nav.js):
 * se ven igual en todos los móviles, a diferencia de los emojis.
 */

const PATHS = {
  shield: '<path d="M12 2.8 4.5 5.6v5.6c0 4.8 3.2 8.6 7.5 10 4.3-1.4 7.5-5.2 7.5-10V5.6L12 2.8Z"/><path d="m8.8 12 2.2 2.2 4.3-4.4"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5M12 8.5V21M12 8.5C10.5 5 7.2 4.2 6.6 6c-.5 1.6 1.9 2.5 5.4 2.5ZM12 8.5c1.5-3.5 4.8-4.3 5.4-2.5.5 1.6-1.9 2.5-5.4 2.5Z"/>',
  chat: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5v-8Z"/>',
  scale: '<path d="M12 3.5v17M6 20.5h12M5 7.5h14M5 7.5l-2.5 6a2.8 2.8 0 0 0 5 0L5 7.5ZM19 7.5l-2.5 6a2.8 2.8 0 0 0 5 0L19 7.5Z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" class="icon-fill"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2v15a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 1 4 17V4.5ZM20 4.5A1.5 1.5 0 0 0 18.5 3H14a2 2 0 0 0-2 2v15a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 17V4.5Z"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.6c2.4-.3 4.4 1.2 4.9 4.4"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  chart: '<path d="M4 20.5h16M7 17v-5M12 17V7M17 17v-8"/>',
  notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8"/><circle cx="12" cy="17" r=".6" class="icon-fill"/>',
  save: '<path d="M5 3.5h11l3.5 3.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z"/><path d="M8 3.5v5h7v-5M8 20.5v-6h8v6"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  addSquare: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  download: '<path d="M12 3v12M8 11l4 4 4-4M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2"/>',
  wifiOff: '<path d="M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.5M14.8 10.4A10 10 0 0 1 19 12.9M2 9.3a15 15 0 0 1 4.3-2.9M10.6 5.6A15 15 0 0 1 22 9.3"/><circle cx="12" cy="20" r=".6" class="icon-fill"/>',
  backspace: '<path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7 6-7Z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'
};

/**
 * @param {keyof PATHS} name
 * @param {string} [cls] - clase extra
 * @returns {string} SVG decorativo (aria-hidden)
 */
export function icon(name, cls = '') {
  return `<svg class="ui-icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PATHS[name] || PATHS.chat}</svg>`;
}

/** Icono de cada clase de evento (juicio, tiro, curso…), en lugar de su emoji. */
const EVENT_ICON = { JUICIO: 'scale', TIRO: 'target', CURSO: 'book', REUNION: 'people', EVENTO: 'pin', OTRO: 'chat' };
export function eventKindIcon(kind, cls = '') {
  return icon(EVENT_ICON[kind] || 'chat', cls);
}
