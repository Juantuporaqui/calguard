/**
 * @module ui/glossary
 * Palabras de la app que pueden no entenderse a la primera. Junto a cada una
 * hay un «ⓘ» que abre su explicación en dos líneas. También salen en la Ayuda.
 */

import { openSheet } from './sheet.js';
import { esc } from './utils.js';

export const GLOSSARY = {
  'anio-pasado': {
    term: 'Días del año pasado',
    text: 'Los libres, asuntos propios o vacaciones que te quedaron sin disfrutar el año anterior. Se gastan antes que los del año nuevo.'
  },
  compensacion: {
    term: 'Compensación',
    text: 'Días que te deben por algo que no es una guardia: un juicio fuera de tu turno, las elecciones, un servicio… Suman a tus libres.'
  },
  'guardia-cerrada': {
    term: 'Guardia cerrada',
    text: 'Una guardia cuyos días ya no cuentan porque después te compensaron entera otra más nueva. Los días se gastan por orden, de la más antigua a la más reciente.'
  },
  'no-computa': {
    term: 'No computa',
    text: 'Un libre que te han concedido aparte (por ejemplo, un día de regalo): lo disfrutas, pero no descuenta de tus días.'
  }
};

/** Botón «ⓘ» para poner junto a un término. */
export function infoBtn(key) {
  const g = GLOSSARY[key];
  if (!g) return '';
  return `<button type="button" class="info-btn" data-info="${esc(key)}" aria-label="Qué significa «${esc(g.term)}»">ⓘ</button>`;
}

export function openInfo(key) {
  const g = GLOSSARY[key];
  if (!g) return;
  openSheet({
    title: g.term,
    variant: 'dialog',
    body: `<p class="dialog-message">${esc(g.text)}</p>`,
    footer: '<button type="button" class="btn btn-primary" data-act="ok">Entendido</button>',
    onMount(root, close) { root.querySelector('[data-act="ok"]').addEventListener('click', close); }
  });
}

let installed = false;
/** Un solo escuchador para todos los «ⓘ» de la app (también los de las hojas). */
export function installInfoButtons() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-info]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openInfo(btn.dataset.info);
  }, true);
}
