/** SVG and layout for the Nature dashboard. Its labels and actions come from Inicio. */
import { esc } from './utils.js';

const TERRAIN = 'M0 132C55 136 70 119 104 124S161 98 195 104S235 77 275 85S306 47 360 43V160H0Z';
const DRAWING_WIDTH = 360;

export function natureTerrain(value, earned) {
  const available = Math.max(0, value);
  const reference = Math.max(available, earned);
  const fill = reference > 0 ? DRAWING_WIDTH * available / reference : 0;
  return `<svg class="nature-terrain" viewBox="0 0 360 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="nature-ridge" x2="0" y2="100%">
        <stop offset="0" class="nature-ridge-top"/>
        <stop offset="1" class="nature-ridge-base"/>
      </linearGradient>
      <clipPath id="nature-balance-fill"><rect width="${esc(fill)}" height="160"/></clipPath>
    </defs>
    <circle class="nature-sun" cx="297" cy="49" r="20"/>
    <g class="nature-contours">
      <path d="M151 160Q154 118 195 103T247 58T306 17T360 -13"/>
      <path d="M168 160Q177 123 214 111T264 64T323 31T360 1"/>
      <path d="M192 160Q201 132 234 121T283 76T338 47T360 15"/>
    </g>
    <path class="nature-terrace" d="M72 160Q118 141 145 143T202 126T249 117T307 92T360 76V160Z"/>
    <path class="nature-ridge-track" d="${TERRAIN}"/>
    <path fill="url(#nature-ridge)" d="${TERRAIN}" clip-path="url(#nature-balance-fill)"/>
  </svg>`;
}

const QUOTA_SHAPES = {
  ap: 'M2 14C1 7 7 4 15 4C15 11 10 17 2 14Z',
  vac: 'M8 2C11 7 14 9 14 13A6 6 0 0 1 2 13C2 9 5 7 8 2Z'
};
const QUOTA_WIDTH = 180;

/** Fill the continuous proportions, including partial leaves/drops. */
export function natureQuota(key, usedPercent, plannedPercent) {
  const used = Math.min(100, Math.max(0, Number.parseFloat(usedPercent) || 0));
  const assigned = Math.min(100, used + Math.max(0, Number.parseFloat(plannedPercent) || 0));
  const name = `nature-quota-${esc(key)}`;
  const marks = Array.from({ length: 10 }, (_, index) =>
    `<path transform="translate(${esc(index * 18)} 0)" d="${QUOTA_SHAPES[key]}"/>`
  ).join('');
  return `<svg class="nature-quota-marks" viewBox="0 0 180 20" aria-hidden="true" focusable="false">
    <defs>
      <g id="${name}">${marks}</g>
      <clipPath id="${name}-assigned"><rect width="${esc(QUOTA_WIDTH * assigned / 100)}" height="20"/></clipPath>
      <clipPath id="${name}-used"><rect width="${esc(QUOTA_WIDTH * used / 100)}" height="20"/></clipPath>
    </defs>
    <use class="nature-quota-free" href="#${name}"/>
    <use class="nature-quota-planned" href="#${name}" clip-path="url(#${name}-assigned)"/>
    <use class="nature-quota-used" href="#${name}" clip-path="url(#${name}-used)"/>
  </svg>`;
}

export function paintNatureInstruments(dash, available, earned) {
  dash.classList.add('inst-nature');
  const gauge = dash.querySelector('.libres-gauge');
  gauge.querySelector('.gauge-label').textContent = 'días libres para pedir';
  gauge.querySelector('.ring').outerHTML = natureTerrain(available, earned);

  for (const key of ['ap', 'vac']) {
    const meter = dash.querySelector(`[data-quota="${key}"] .quota-bar`);
    const used = meter.querySelector('.seg-used').dataset.w;
    const planned = meter.querySelector('.seg-planned').dataset.w;
    meter.innerHTML = natureQuota(key, used, planned);
  }
}
