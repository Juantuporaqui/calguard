/**
 * @module ui/calendar/share
 * Tras pedir días: el mensaje listo para enviar, con Copiar, Compartir y Deshacer.
 */

import { Actions } from '../../state/store.js';
import { openSheet } from '../sheet.js';
import { esc } from '../utils.js';

/**
 * After asking for days: the ready-to-send request, with copy / share and
 * an undo that stays at hand while the sheet is open.
 */
export function showSharePopup(msg, undo) {
  return openSheet({
    title: 'Días pedidos',
    body: `
      <p class="sheet-hint">Ya están descontados de tu saldo. Envía la solicitud a tu responsable:</p>
      <textarea class="message-box" readonly rows="7">${esc(msg)}</textarea>`,
    footer: `
      ${undo ? '<button type="button" class="btn" data-act="undo">Deshacer</button>' : ''}
      <button type="button" class="btn" data-act="copy">Copiar</button>
      <button type="button" class="btn btn-primary" data-act="share">Compartir</button>`,
    onMount(root, close) {
      root.querySelector('[data-act="copy"]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(msg);
          Actions.showToast('Copiado al portapapeles');
        } catch {
          root.querySelector('textarea').select();
          Actions.showToast('Selecciona el texto y cópialo');
        }
      });
      root.querySelector('[data-act="share"]').addEventListener('click', async () => {
        if (navigator.share) {
          try { await navigator.share({ text: msg }); } catch { /* cancelled */ }
        } else {
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        }
      });
      root.querySelector('[data-act="undo"]')?.addEventListener('click', () => undo());
    }
  });
}
