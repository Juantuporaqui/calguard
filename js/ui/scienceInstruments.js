/** Forensic dashboard presentation. The figures and actions are supplied by Inicio. */
import { esc } from './utils.js';

function fingerprint() {
  const ridges = Array.from({ length: 14 }, (_, i) => {
    const left = 70 - i * 4.6;
    const right = 131 + i * 4.25;
    const top = 68 - i * 4.5;
    const bottom = 143 + i * 2.3;
    return `<path d="M ${esc(left + 4)} ${esc(bottom)}
      C ${esc(left - 16)} 106 ${esc(left - 3)} ${esc(top)} 106 ${esc(top)}
      C ${esc(right + 17)} ${esc(top)} ${esc(right + 8)} 99 ${esc(right - 8)} ${esc(bottom - 3)}
      Q ${esc(right - 13)} ${esc(bottom + 10)} ${esc(right - 11)} 189"/>`;
  }).join('');
  return `<svg class="sci-fingerprint" viewBox="0 0 220 190" aria-hidden="true" focusable="false">
    <g class="sci-ridges">${ridges}
      <path d="M78 153C96 144 79 99 97 80C111 65 134 92 118 120Q104 148 109 167"/>
      <path d="M89 160C105 146 92 119 98 97C103 83 117 84 115 103Q111 118 103 132"/>
    </g>
    <path class="sci-register" d="M14 33V18h15m162 0h15v15M14 152v15h15m162 0h15v-15"/>
    <g class="sci-points">
      <circle cx="69" cy="53" r="2.5"/><circle cx="148" cy="43" r="2.5"/><circle cx="125" cy="113" r="2.5"/>
      <path d="M143 43h-10m15 5v10M69 58v10m-5-15H54m71 65v10m5-15h10"/>
    </g>
  </svg>`;
}

/** Read the original meter's percentages, retaining fractional and overdrawn quotas. */
export function scienceQuota(key, used, planned) {
  const width = 160;
  const usedPercent = Math.min(100, Math.max(0, Number.parseFloat(used) || 0));
  const plannedPercent = Math.min(100 - usedPercent, Math.max(0, Number.parseFloat(planned) || 0));
  const mask = `sci-bands-${esc(key)}`;
  const bands = Array.from({ length: 20 }, (_, i) => {
    const height = i % 4 === 0 ? 23 : 16;
    return `<rect x="${esc(i * 8)}" y="${esc(23 - height)}" width="6" height="${esc(height)}" rx="1"/>`;
  }).join('');
  return `<svg class="sci-quota-bands" viewBox="0 0 160 25" aria-hidden="true" focusable="false">
    <defs><clipPath id="${mask}">${bands}</clipPath></defs>
    <g clip-path="url(#${mask})">
      <rect class="sci-quota-free" width="160" height="25"/>
      <rect class="sci-quota-used" width="${esc(width * usedPercent / 100)}" height="25"/>
      <rect class="sci-quota-planned" x="${esc(width * usedPercent / 100)}" width="${esc(width * plannedPercent / 100)}" height="25"/>
    </g>
  </svg>`;
}

export function paintScienceInstruments(dash, ledgerOpen) {
  dash.classList.add('inst-science');
  const gauge = dash.querySelector('.libres-gauge');
  const label = dash.ownerDocument.createElement('h2');
  label.className = 'gauge-label';
  label.id = 'sci-libres-title';
  label.textContent = 'Días libres para pedir';
  gauge.querySelector('.gauge-label').remove();
  gauge.querySelector('.gauge-center').prepend(label);
  gauge.querySelector('.ring').outerHTML = fingerprint();

  const ledger = dash.querySelector('.ledger-lines');
  const title = dash.querySelector('#libres-title');
  const actions = dash.querySelector('#dash-pedir');
  const details = dash.ownerDocument.createElement('details');
  details.className = 'sci-ledger';
  details.open = ledgerOpen;
  details.innerHTML = '<summary id="sci-ledger-toggle">Desglose del saldo</summary>';
  ledger.before(details);
  details.append(title, ledger);
  details.before(actions);
  gauge.closest('.libres-card').setAttribute('aria-labelledby', label.id);

  for (const key of ['ap', 'vac']) {
    const meter = dash.querySelector(`[data-quota="${key}"] .quota-bar`);
    meter.innerHTML = scienceQuota(key, meter.querySelector('.seg-used').dataset.w, meter.querySelector('.seg-planned').dataset.w);
    dash.querySelector(`[data-quota="${key}"] .quota-big small`).textContent = 'disponibles';
  }
}
