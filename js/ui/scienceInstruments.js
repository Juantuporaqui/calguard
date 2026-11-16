/** Forensic optical & spectrogram instruments for Policía Científica. Stateless SVG geometry, no inline styles. */
import { instrumentScale } from './instruments.js';
import { esc } from './utils.js';

const point = (r, a) => [130 + r * Math.cos(a * Math.PI / 180), 130 + r * Math.sin(a * Math.PI / 180)];
const xy = p => p.map(n => n.toFixed(2)).join(' ');

function arc(r, start, end) {
  return `M ${xy(point(r, start))} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${xy(point(r, end))}`;
}

/**
 * High-precision forensic optical comparator & biometric reticle dial.
 * Represents available free days against earned reference using a calibrated 270° optical arc.
 */
export function scienceAnalyzer(value, reference) {
  const { ratio, valid } = instrumentScale(value, reference);
  const start = 135;
  const sweep = 270;
  const angle = start + sweep * ratio;
  const tip = point(88, angle);

  const ticks = Array.from({ length: 37 }, (_, i) => {
    const a = start + (sweep * i) / 36;
    const major = i % 6 === 0;
    const p = point(major ? 96 : 101, a);
    const q = point(107, a);
    return `<path class="sci-tick ${major ? 'sci-tick-major' : 'sci-tick-minor'}" d="M ${xy(p)} L ${xy(q)}"/>`;
  }).join('');

  const minutiae = [-42, 38, 158].map(a => {
    const p = point(72, a);
    const q = point(64, a);
    return `<circle cx="${esc(p[0].toFixed(2))}" cy="${esc(p[1].toFixed(2))}" r="2.2"/><path d="M ${xy(p)} L ${xy(q)}"/>`;
  }).join('');

  return `<svg class="inst-dial sci-analyzer ${value < 0 ? 'inst-negative' : ''}" viewBox="0 0 260 260" aria-hidden="true" focusable="false">
    <path class="sci-fiducials" d="M 12 32 V 12 H 32 M 228 12 H 248 V 32 M 12 228 V 248 H 32 M 228 248 H 248 V 228 M 130 6 V 18 M 130 242 V 254 M 6 130 H 18 M 242 130 H 254"/>
    <circle class="sci-bezel" cx="130" cy="130" r="120"/>
    <circle class="sci-chamber" cx="130" cy="130" r="112"/>
    <circle class="sci-grid-ring" cx="130" cy="130" r="107"/>
    <path class="sci-crosshair" d="M 130 22 V 48 M 130 212 V 238 M 22 130 H 48 M 212 130 H 238"/>
    <path class="sci-track" d="${esc(arc(88, start, start + sweep))}"/>
    <path class="sci-track-segments" d="${esc(arc(88, start, start + sweep))}"/>
    ${ticks}
    ${valid && ratio > 0 ? `<path class="sci-progress" d="${esc(arc(88, start, angle))}"/>` : ''}
    <circle class="sci-reticle-outer" cx="130" cy="130" r="72"/>
    <circle class="sci-reticle-inner" cx="130" cy="130" r="60"/>
    <g class="sci-minutiae">${minutiae}</g>
    ${valid ? `<circle class="sci-cursor-halo" cx="${esc(tip[0].toFixed(2))}" cy="${esc(tip[1].toFixed(2))}" r="6.5"/><circle class="sci-cursor-dot" cx="${esc(tip[0].toFixed(2))}" cy="${esc(tip[1].toFixed(2))}" r="2.8"/>` : ''}
  </svg>`;
}

/**
 * Forensic electrophoresis & spectrogram band analyzer for AP and Vacation quotas.
 * Retains 160-unit width calibration for fractional and overdrawn quotas.
 */
export function scienceQuota(key, used, planned) {
  const width = 160;
  const usedPercent = Math.min(100, Math.max(0, Number.parseFloat(used) || 0));
  const plannedPercent = Math.min(100 - usedPercent, Math.max(0, Number.parseFloat(planned) || 0));
  const usedW = width * usedPercent / 100;
  const plannedW = width * plannedPercent / 100;
  const cursorX = Math.min(width, usedW + plannedW);
  const mask = `sci-bands-${esc(key)}`;
  const heights = [22, 16, 26, 14, 24, 18, 28, 15, 23, 19, 27, 16, 25, 17, 24, 15, 26, 18, 22, 16];
  const bands = heights.map((h, i) => {
    const x = i * 8 + 1;
    const y = 33 - h;
    return `<rect x="${esc(x)}" y="3" width="6" height="2" rx="0.5"/><rect x="${esc(x)}" y="${esc(y)}" width="6" height="${esc(h)}" rx="1"/>`;
  }).join('');
  const ruler = Array.from({ length: 17 }, (_, i) => {
    const x = i * 10;
    const major = i % 4 === 0;
    return `<path class="sci-spec-tick ${major ? 'sci-spec-major' : ''}" d="M ${esc(x)} 35 V ${major ? 41 : 38}"/>`;
  }).join('');

  return `<svg class="sci-quota-bands" viewBox="0 0 160 42" aria-hidden="true" focusable="false">
    <defs><clipPath id="${mask}">${bands}</clipPath></defs>
    <rect class="sci-spec-bg" width="160" height="42" rx="3"/>
    <path class="sci-spec-grid" d="M 0 18 H 160 M 0 35 H 160"/>
    <g clip-path="url(#${mask})">
      <rect class="sci-quota-free" width="160" height="34"/>
      <rect class="sci-quota-used" width="${esc(usedW)}" height="34"/>
      <rect class="sci-quota-planned" x="${esc(usedW)}" width="${esc(plannedW)}" height="34"/>
    </g>
    ${ruler}
    ${cursorX > 0 ? `<path class="sci-spec-cursor" d="M ${esc(cursorX)} 2 V 35"/>` : ''}
  </svg>`;
}

export function paintScienceInstruments(dash, { libres, earned }) {
  dash.classList.add('inst-science');
  const caption = dash.ownerDocument.createElement('p');
  caption.className = 'inst-caption sci-caption';
  caption.textContent = 'Laboratorio de Criminalística · Análisis Operativo';
  dash.querySelector('.dash-hero').prepend(caption);

  const gauge = dash.querySelector('.libres-gauge');
  const scale = instrumentScale(libres.disponibles, earned);
  gauge.querySelector('.gauge-label').textContent = 'libres para pedir';
  gauge.querySelector('.ring').outerHTML = scienceAnalyzer(libres.disponibles, earned);
  gauge.insertAdjacentHTML(
    'beforeend',
    `<div class="inst-scale sci-scale"><span>MIN ${esc(scale.min)}</span><span>ÓPTICA · DÍAS</span><span>MAX ${esc(scale.max)}</span></div>`
  );

  for (const key of ['ap', 'vac']) {
    const card = dash.querySelector(`[data-quota="${key}"]`);
    const meter = card.querySelector('.quota-bar');
    meter.innerHTML = scienceQuota(
      key,
      meter.querySelector('.seg-used').dataset.w,
      meter.querySelector('.seg-planned').dataset.w
    );
    card.querySelector('.quota-big small').textContent = 'disp.';
  }
}
