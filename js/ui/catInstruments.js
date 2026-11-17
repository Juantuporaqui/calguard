/** Gatitos («Neko Café») presentation. Stateless SVG geometry, no domain imports and no inline styles. */
import { instrumentScale } from './instruments.js';
import { esc } from './utils.js';

const CX = 130;
const CY = 136;
const n = v => Number(v.toFixed(2));
const point = (r, a) => [CX + r * Math.cos(a * Math.PI / 180), CY + r * Math.sin(a * Math.PI / 180)];
const xy = p => p.map(v => v.toFixed(2)).join(' ');

function arc(r, start, end) {
  return `M ${xy(point(r, start))} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${xy(point(r, end))}`;
}

/**
 * Esfera «ronroneo»: cabeza de gato con orejas, bigotes de referencia y una cola que
 * recorre 270° en proporción al saldo de días libres respecto a los generados.
 */
export function catPurrDial(value, reference) {
  const { ratio, valid } = instrumentScale(value, reference);
  const start = 135;
  const sweep = 270;
  const angle = start + sweep * ratio;
  const bell = point(86, angle);

  const beads = Array.from({ length: 11 }, (_, i) => {
    const p = point(99, start + (sweep * i) / 10);
    return `<circle class="cat-bead ${i % 5 === 0 ? 'cat-bead-major' : ''}" cx="${esc(n(p[0]))}" cy="${esc(n(p[1]))}" r="${i % 5 === 0 ? 2.6 : 1.6}"/>`;
  }).join('');

  return `<svg class="inst-dial cat-dial ${value < 0 ? 'inst-negative' : ''}" viewBox="0 0 260 260" aria-hidden="true" focusable="false">
    <g class="cat-dial-ears">
      <path class="cat-ears-outer" d="M 38 86 L 41 24 Q 43 13 53 17 L 100 38 Z M 222 86 L 219 24 Q 217 13 207 17 L 160 38 Z"/>
      <path class="cat-ears-inner" d="M 52 72 L 54 34 L 86 47 Z M 208 72 L 206 34 L 174 47 Z"/>
    </g>
    <circle class="cat-dial-rim" cx="${CX}" cy="${CY}" r="108"/>
    <circle class="cat-dial-face" cx="${CX}" cy="${CY}" r="100"/>
    <g class="cat-paw-watermark">
      <ellipse cx="130" cy="150" rx="27" ry="21"/>
      <ellipse cx="101" cy="117" rx="8" ry="10.5"/>
      <ellipse cx="119" cy="102" rx="8.5" ry="11"/>
      <ellipse cx="141" cy="102" rx="8.5" ry="11"/>
      <ellipse cx="159" cy="117" rx="8" ry="10.5"/>
    </g>
    <path class="cat-tail-track" stroke-linecap="round" d="${esc(arc(86, start, start + sweep))}"/>
    ${valid && ratio > 0 ? `<path class="cat-tail-progress" stroke-linecap="round" d="${esc(arc(86, start, Math.max(start + 0.5, angle)))}"/>` : ''}
    ${beads}
    <g class="cat-whiskers">
      <path d="M 2 124 Q 24 125 50 133 M 0 141 Q 25 140 50 143 M 4 160 Q 26 155 50 152"/>
      <path d="M 258 124 Q 236 125 210 133 M 260 141 Q 235 140 210 143 M 256 160 Q 234 155 210 152"/>
    </g>
    <path class="cat-nose" d="M 123 202 Q 130 197 137 202 Q 131 211 130 211 Q 129 211 123 202 Z"/>
    <path class="cat-mouth" d="M 130 211 V 214 M 119 213 Q 124.5 220 130 214 Q 135.5 220 141 213"/>
    ${valid ? `<g class="cat-bell-group"><circle class="cat-bell" cx="${esc(n(bell[0]))}" cy="${esc(n(bell[1]))}" r="6"/><path class="cat-bell-slit" d="M ${esc(n(bell[0] - 2.5))} ${esc(n(bell[1] + 1.5))} H ${esc(n(bell[0] + 2.5))}"/></g>` : ''}
  </svg>`;
}

/** Diez huellas (asuntos propios) o diez pececitos (vacaciones) que se rellenan con el reparto del cupo. */
function silhouettes(key) {
  return Array.from({ length: 10 }, (_, i) => {
    const x = i * 18;
    if (key === 'vac') {
      return `<ellipse cx="${esc(n(x + 7.5))}" cy="18" rx="6.5" ry="5"/><path d="M ${esc(n(x + 12.5))} 18 L ${esc(n(x + 17.5))} 12.5 L ${esc(n(x + 17.5))} 23.5 Z"/>`;
    }
    return `<ellipse cx="${esc(n(x + 9))}" cy="24" rx="6" ry="5"/><circle cx="${esc(n(x + 3.6))}" cy="14.5" r="2.4"/><circle cx="${esc(n(x + 9))}" cy="10.5" r="2.7"/><circle cx="${esc(n(x + 14.4))}" cy="14.5" r="2.4"/>`;
  }).join('');
}

/** Reads the original meter percentages, retaining fractional and overdrawn quotas on a 180-unit plot. */
export function catQuota(key, used, planned) {
  const width = 180;
  const usedPercent = Math.min(100, Math.max(0, Number.parseFloat(used) || 0));
  const plannedPercent = Math.min(100 - usedPercent, Math.max(0, Number.parseFloat(planned) || 0));
  const usedW = n(width * usedPercent / 100);
  const plannedW = n(width * plannedPercent / 100);
  const clip = `cat-quota-${esc(key)}`;
  return `<svg class="cat-quota" viewBox="0 0 180 36" aria-hidden="true" focusable="false">
    <defs><clipPath id="${clip}">${silhouettes(key)}</clipPath></defs>
    <g clip-path="url(#${clip})">
      <rect class="cat-quota-free" width="180" height="36"/>
      <rect class="cat-quota-used" width="${esc(usedW)}" height="36"/>
      <rect class="cat-quota-planned" x="${esc(usedW)}" width="${esc(plannedW)}" height="36"/>
    </g>
  </svg>`;
}

export function paintCatInstruments(dash, { libres, earned }) {
  dash.classList.add('inst-cat');
  const caption = dash.ownerDocument.createElement('p');
  caption.className = 'inst-caption cat-caption';
  caption.textContent = 'Rincón Felino · Descanso y Guardias';
  dash.querySelector('.dash-hero').prepend(caption);

  const gauge = dash.querySelector('.libres-gauge');
  const scale = instrumentScale(libres.disponibles, earned);
  gauge.querySelector('.gauge-label').textContent = 'libres para pedir';
  gauge.querySelector('.ring').outerHTML = catPurrDial(libres.disponibles, earned);
  gauge.insertAdjacentHTML('beforeend',
    `<div class="inst-scale cat-scale"><span>MIN ${esc(scale.min)}</span><span>RONRONEO · DÍAS</span><span>MAX ${esc(scale.max)}</span></div>`);

  for (const key of ['ap', 'vac']) {
    const card = dash.querySelector(`[data-quota="${key}"]`);
    const meter = card.querySelector('.quota-bar');
    meter.innerHTML = catQuota(key, meter.querySelector('.seg-used').dataset.w, meter.querySelector('.seg-planned').dataset.w);
    card.querySelector('.quota-big small').textContent = 'disp.';
  }
}
