/**
 * @module ui/emptyStates
 * Pantallas sin datos: una frase y un único botón que dice qué hacer.
 * emptyStateFor es pura (tests/onboarding.test.js); emptyHTML la pinta.
 */

import { esc } from './utils.js';

/**
 * @param {'dashboard'|'cuadrante'|'biblioteca'|'registry'} screen
 * @param {{hasPassword?: boolean, hasCuadrante?: boolean, linked?: boolean,
 *          error?: string|null, docs?: number, services?: number, shown?: number}} ctx
 * @returns {{text: string, action: string, label: string}|null}
 */
export function emptyStateFor(screen, ctx = {}) {
  const { hasPassword = false, hasCuadrante = false, linked = false } = ctx;
  switch (screen) {
    case 'dashboard':
      if (!hasCuadrante && !hasPassword) return { text: 'Aún no tienes el cuadrante del grupo. Con la contraseña del grupo, tu calendario se rellena solo.', action: 'password', label: 'Poner la contraseña del grupo' };
      if (!hasCuadrante) return { text: 'Todavía no te ha llegado el cuadrante del grupo.', action: 'check', label: 'Comprobar ahora' };
      if (!linked) return { text: 'Elige tu nombre del cuadrante y tu calendario se rellenará solo.', action: 'who', label: 'Elegir mi nombre' };
      return null;
    case 'cuadrante':
      if (hasCuadrante) return null;
      if (!hasPassword) return { text: 'Aún no tienes el cuadrante del grupo. Pon la contraseña del grupo para recibirlo.', action: 'password', label: 'Poner la contraseña del grupo' };
      return { text: 'Todavía no hay cuadrante publicado. Si eres quien lo prepara, carga el Excel.', action: 'file', label: 'Cargar el Excel' };
    case 'biblioteca':
      if (ctx.error === 'NO_PASSWORD') return { text: 'Para ver la biblioteca hace falta la contraseña del grupo.', action: 'password', label: 'Poner la contraseña del grupo' };
      if (ctx.error === 'BAD_PASSWORD') return { text: 'La contraseña del grupo de este móvil no abre la biblioteca.', action: 'password', label: 'Cambiar la contraseña' };
      if (ctx.error) return { text: 'No se pudo cargar la biblioteca.', action: 'retry', label: 'Reintentar' };
      if (!ctx.docs) return { text: 'Aún no hay documentos en la biblioteca.', action: 'retry', label: 'Comprobar de nuevo' };
      return null;
    case 'registry':
      if (!ctx.services) return { text: 'Aún no has apuntado ningún servicio.', action: 'new', label: 'Apuntar un servicio' };
      if (!ctx.shown) return { text: 'Ningún servicio coincide con el filtro.', action: 'clear', label: 'Quitar el filtro' };
      return null;
    default:
      return null;
  }
}

/** Bloque vacío. Con action 'file', el botón es un selector de archivo. */
export function emptyHTML(e, { accept = '.xlsx,.xls,.csv,.txt,.pdf,.json', fileId = '' } = {}) {
  if (!e) return '';
  const btn = e.action === 'file'
    ? `<label class="btn btn-primary">${esc(e.label)}<input type="file"${fileId ? ` id="${esc(fileId)}"` : ' data-empty-file'} accept="${esc(accept)}" hidden></label>`
    : `<button type="button" class="btn btn-primary" data-empty-act="${esc(e.action)}">${esc(e.label)}</button>`;
  return `<div class="empty-block" role="status"><p>${esc(e.text)}</p>${btn}</div>`;
}

/** Une el botón del bloque vacío con lo que hace cada acción. */
export function bindEmpty(root, handlers) {
  root.querySelectorAll('[data-empty-act]').forEach(b => b.addEventListener('click', () => handlers[b.dataset.emptyAct]?.()));
  root.querySelector('[data-empty-file]')?.addEventListener('change', (ev) => handlers.file?.(ev));
}
