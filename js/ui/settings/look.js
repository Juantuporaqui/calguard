/**
 * @module ui/settings/look
 * «Apariencia»: tema y tamaño del texto (escala todo: html{font-size}).
 */

import { Actions } from '../../state/store.js';
import { saveTheme, saveTextSize, TEXT_SIZES } from '../theme.js';
import { section } from './common.js';

export function lookHTML(state) {
  const size = state.config.textSize || 'normal';
  return section('look', 'Apariencia', 'Tema y tamaño del texto', `
    <span class="field-label" id="lbl-theme">Tema</span>
    <div class="segmented" role="radiogroup" aria-labelledby="lbl-theme">
      ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `
        <label class="seg-opt"><input type="radio" name="theme" value="${v}" ${state.themePreference === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
    </div>
    <span class="field-label" id="lbl-size">Tamaño del texto</span>
    <div class="segmented" role="radiogroup" aria-labelledby="lbl-size">
      ${Object.entries(TEXT_SIZES).map(([v, { label }]) => `
        <label class="seg-opt"><input type="radio" name="text-size" value="${v}" ${size === v ? 'checked' : ''}><span>${label}</span></label>`).join('')}
    </div>`);
}

export function bindLook(root) {
  root.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', async () => { await saveTheme(r.value); Actions.showToast('Guardado'); }));
  root.querySelectorAll('input[name="text-size"]').forEach(r => r.addEventListener('change', async () => { await saveTextSize(r.value); Actions.showToast('Guardado'); }));
}
