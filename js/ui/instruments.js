/** Stateless SVG geometry. No business calculations, listeners or inline styles. */
import { esc } from './utils.js';
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function instrumentScale(value, reference) {
  const valid = finite(value);
  const min = valid ? Math.min(0, value) : 0;
  const max = Math.max(1, finite(reference) ? reference : 0, valid ? value : 0);
  return { min, max, ratio: valid ? (value - min) / (max - min) : 0, valid };
}
const point = (r, a) => [130 + r * Math.cos(a * Math.PI / 180), 130 + r * Math.sin(a * Math.PI / 180)];
const xy = p => p.map(n => n.toFixed(3)).join(' ');
function arc(r, start, end) {
  return `M ${xy(point(r, start))} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${xy(point(r, end))}`;
}
const dialNumbers = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
function aviationGraduation(min, max, start, sweep) {
  const span = max - min;
  const target = span / 4;
  const unit = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].find(n => n * unit >= target) * unit;
  const values = [min];
  for (let offset = 0; offset < 5; offset++) {
    const value = (Math.ceil(min / step) + offset) * step;
    if (value - min >= span * .13 && max - value >= span * .13) values.push(value);
  }
  values.push(max);
  const angles = values.map(value => start + sweep * (value - min) / span);

  return angles.map((angle, index) => {
    const main = `<path class="inst-tick" d="M ${xy(point(97, angle))} L ${xy(point(108, angle))}"/>`;
    const label = `<text class="inst-dial-number" x="${esc(point(80, angle)[0])}" y="${esc(point(80, angle)[1])}">${esc(dialNumbers.format(values[index]))}</text>`;
    if (index === angles.length - 1) return main + label;
    const minor = Array.from({ length: 4 }, (_, n) => {
      const position = angle + (angles[index + 1] - angle) * (n + 1) / 5;
      return `<path class="inst-tick inst-tick-minor" d="M ${xy(point(103, position))} L ${xy(point(108, position))}"/>`;
    }).join('');
    return main + label + minor;
  }).join('');
}
export function dialSVG(value, reference, theme) {
  const { min, max, ratio, valid } = instrumentScale(value, reference);
  const aviation = theme === 'avion';
  const start = aviation ? 120 : 135, sweep = aviation ? 300 : 270;
  const angle = start + sweep * ratio;
  const ticks = aviation ? aviationGraduation(min, max, start, sweep) : Array.from({ length: 41 }, (_, i) => {
    const a = start + sweep * i / 40;
    const p = point(i % 5 ? 101 : 96, a), q = point(108, a);
    return `<path class="inst-tick ${i % 5 ? 'inst-tick-minor' : ''}" d="M ${xy(p)} L ${xy(q)}"/>`;
  }).join('');
  return `<svg class="inst-dial ${value < 0 ? 'inst-negative' : ''}" viewBox="0 0 260 260" aria-hidden="true" focusable="false">
    <circle class="inst-rim" cx="130" cy="130" r="125"/>
    <circle class="inst-face" cx="130" cy="130" r="117"/>
    <path class="inst-track" d="${esc(arc(88, start, start + sweep))}"/>
    ${ticks}
    ${valid && ratio > 0 ? `<path class="inst-progress" d="${esc(arc(88, start, angle))}"/>` : ''}
    ${aviation && valid ? `<g transform="rotate(${esc(angle - 270)} 130 130)"><path class="inst-needle" d="M 127 141 L 130 62 L 133 141 Z"/><circle class="inst-hub" cx="130" cy="130" r="8"/></g>` : '<circle class="inst-inner" cx="130" cy="130" r="73"/>'}
    ${aviation ? '<text class="inst-dial-unit" x="130" y="164">DÍAS</text>' : ''}
    ${aviation ? [45,135,225,315].map(a => { const p = point(120,a); return `<circle class="inst-screw" cx="${esc(p[0])}" cy="${esc(p[1])}" r="2"/>`; }).join('') : ''}
  </svg>`;
}
export function quotaSVG(q, theme) {
  const total = Math.max(1, ...[q.cupo + q.arrastreRestante, q.asignados, q.disfrutados + q.planificados].filter(finite));
  const used = Math.max(0, finite(q.disfrutados) ? q.disfrutados : 0) / total;
  const planned = Math.max(0, finite(q.planificados) ? q.planificados : 0) / total;
  if (theme === 'avion') {
    return `<svg class="inst-quota" viewBox="0 0 260 70" aria-hidden="true" focusable="false">
      <path class="inst-reference" d="M 10 52 H 250"/>
      ${Array.from({ length: 24 }, (_, i) => `<rect class="${i / 24 < used ? 'inst-block-used' : i / 24 < used + planned ? 'inst-block-planned' : 'inst-block-free'}" x="${esc(10 + i * 10)}" y="12" width="7" height="28" rx="1"/>`).join('')}
      ${Array.from({ length: 13 }, (_, i) => `<path class="inst-tick ${i % 3 ? 'inst-tick-minor' : ''}" d="M ${esc(10+i*20)} 48 V ${i % 3 ? '55' : '61'}"/>`).join('')}
    </svg>`;
  }
  // Same cumulative proportions as the existing quota bar; all numerical labels remain in its DOM.
  return `<svg class="inst-quota" viewBox="0 0 260 150" aria-hidden="true" focusable="false">
    <path class="inst-track" d="${esc(arc(105,180,360))}"/>
    ${used > 0 ? `<path class="inst-quota-used" d="${esc(arc(105,180,180 + 180*used))}"/>` : ''}
    ${planned > 0 ? `<path class="inst-quota-planned" d="${esc(arc(105,180 + 180*used,180 + 180*(used + planned)))}"/>` : ''}
    ${Array.from({length: 21}, (_,i) => `<path class="inst-tick ${i%5 ? 'inst-tick-minor' : ''}" d="M ${xy(point(i%5 ? 119 : 115,180+i*9))} L ${xy(point(124,180+i*9))}"/>`).join('')}
    ${theme === 'avion' ? `<path class="inst-reference" d="M 30 143 H 230"/>` : ''}
  </svg>`;
}
/** Calendar-day distance, unaffected by DST (the domain supplies ISO dates). */
export function guardCountdown(date, today) {
  const parse = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? Date.parse(iso + 'T00:00:00Z') : NaN;
  const distance = (parse(date) - parse(today)) / 86400000;
  return Number.isFinite(distance) ? Math.round(distance) : null;
}
