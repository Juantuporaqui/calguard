/** Enrich existing presentation before its single listener-binding pass. No domain imports. */
import { dialSVG, instrumentScale, quotaSVG, guardCountdown } from './instruments.js';
import { esc } from './utils.js';
export function enhanceDashboard(container, { theme, libres, earned, ap, vacaciones, nextGuard, today, guardLabel, guards }) {
  const dash = container.querySelector('.dash');
  dash.classList.add('dash-instrumental', theme === 'avion' ? 'inst-avion' : 'inst-f1');
  const gauge = dash.querySelector('.libres-gauge');
  const scale = instrumentScale(libres.disponibles, earned);
  if (theme === 'avion') gauge.querySelector('.gauge-label').textContent = 'libres para pedir';
  gauge.querySelector('.ring').outerHTML = dialSVG(libres.disponibles, earned, theme);
  gauge.insertAdjacentHTML('beforeend', `<div class="inst-scale"><span>${esc(scale.min)}</span><span>Escala · días</span><span>${esc(scale.max)}</span></div>`);
  const title = document.createElement('p');
  title.className = 'inst-caption';
  title.textContent = theme === 'avion' ? 'Panel de instrumentos' : 'Panel de telemetría';
  dash.querySelector('.dash-hero').prepend(title);
  for (const [key, q] of [['ap', ap], ['vac', vacaciones]]) {
    const card = dash.querySelector(`[data-quota="${key}"]`);
    card.querySelector('header').insertAdjacentHTML('afterend', quotaSVG(q, theme));
  }
  const count = guardCountdown(nextGuard, today);
  const next = document.createElement('section');
  next.className = 'inst-next panel';
  next.setAttribute('aria-label', 'Próxima guardia');
  const known = guards.some(g => g.dateISO === nextGuard);
  next.innerHTML = `<div class="inst-next-copy"><h2>Próxima guardia</h2><p>${nextGuard ? esc(guardLabel) : 'Sin guardias previstas'}</p><span>${nextGuard ? 'Según tu cuadrante' : 'Se mostrará cuando figure en el cuadrante'}</span></div>
    ${count !== null ? `<div class="inst-count"><strong>${esc(count)}</strong><span>${count === 0 ? 'hoy' : count === 1 ? 'día restante' : 'días restantes'}</span></div>` : '<div class="inst-count"><strong>—</strong><span>Sin fecha</span></div>'}
    ${known ? `<button type="button" class="link-btn inst-next-detail" data-guard="${esc(nextGuard)}">Ver detalle</button>` : ''}`;
  // Move the same nodes, retaining every operational field and identifier.
  const cols = dash.querySelector('.dash-cols');
  const modules = ['.dash-o3', '.quota-grid', '.dash-o1', '.dash-o2', '.dash-o4'].map(s => dash.querySelector(s)).filter(Boolean);
  cols.replaceChildren(modules[0], next, ...modules.slice(1));
}
