import { dashboardPreference, saveDashboard } from '../dashboardMode.js';
/**
 * @module ui/settings/look
 * «Apariencia»: tema y tamaño del texto (escala todo: html{font-size}).
 */

import { Actions } from '../../state/store.js';
import { saveTheme, saveTextSize, TEXT_SIZES } from '../theme.js';
import { VISUAL_THEMES, getSavedVisualTheme, saveVisualTheme } from '../visualTheme.js';
import { esc } from '../utils.js';
import { section } from './common.js';

export function lookHTML(state) {
  const size = state.config.textSize || 'normal';
  const currentVisualTheme = getSavedVisualTheme();
  return section('look', 'Apariencia', 'Tema y tamaño del texto', `
    <label class="field" for="visual-theme">
      <span class="field-label" id="lbl-visual-theme">Diseño visual</span>
      <select id="visual-theme" aria-labelledby="lbl-visual-theme">
        ${Object.values(VISUAL_THEMES).map(({ id, label }) => `
          <option value="${esc(id)}" ${currentVisualTheme === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}
      </select>
    </label>
    <label class="field" for="dashboard-mode">
      <span class="field-label">Panel de inicio</span>
      <select id="dashboard-mode" aria-describedby="dashboard-mode-hint">
        <option value="clasico" ${dashboardPreference() === 'clasico' ? 'selected' : ''}>Clásico</option>
        <option value="instrumental" ${dashboardPreference() === 'instrumental' ? 'selected' : ''}>Instrumental</option>
      </select>
    </label>
    <p class="sheet-hint" id="dashboard-mode-hint">Instrumental está disponible en Fórmula 1, Aviación, Policía Científica, Naturaleza y Gatitos. Con el diseño Original verás Clásico; tu elección se conserva.</p>
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
  root.querySelector('#dashboard-mode')?.addEventListener('change', event => {
    event.target.value = saveDashboard(event.target.value);
    Actions.showToast('Guardado');
  });
  const visualSelect = root.querySelector('#visual-theme');
  visualSelect?.addEventListener('change', () => {
    const applied = saveVisualTheme(visualSelect.value);
    visualSelect.value = applied;
    Actions.showToast('Guardado');
  });
  root.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', async () => { await saveTheme(r.value); Actions.showToast('Guardado'); }));
  root.querySelectorAll('input[name="text-size"]').forEach(r => r.addEventListener('change', async () => { await saveTextSize(r.value); Actions.showToast('Guardado'); }));
}
