import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolveDashboard, readDashboard, effectiveDashboard, applyDashboard, DASHBOARD_KEY } from '../js/ui/dashboardMode.js';
import { instrumentScale, dialSVG, quotaSVG, guardCountdown } from '../js/ui/instruments.js';
import { natureTerrain, natureQuota } from '../js/ui/natureInstruments.js';

test('panel: values are strict and unsupported themes fall back without modifying preference', () => {
  for (const value of ['', null, {}, '__proto__', 'Instrumental']) assert.equal(resolveDashboard(value), 'clasico');
  assert.equal(resolveDashboard('instrumental'), 'instrumental');
  for (const theme of ['original','cientifica',null]) assert.equal(effectiveDashboard('instrumental',theme),'clasico');
  for (const theme of ['f1','avion','naturaleza']) assert.equal(effectiveDashboard('instrumental',theme),'instrumental');
  assert.equal(readDashboard({getItem:()=>{throw Error('blocked');}}),'clasico');
});

test('boot and runtime agree for every theme and preference; no colour or font changes', () => {
  const code = readFileSync('js/ui/visualThemeBoot.js','utf8');
  for (const theme of ['f1','avion','original','cientifica','naturaleza','bad']) {
    for (const preference of ['clasico','instrumental','bad',null]) {
      const attrs = new Map([['class','dark'],['data-text-size','muy-grande']]);
      const root = {setAttribute:(k,v)=>attrs.set(k,v)};
      const storage = {getItem:k=>k===DASHBOARD_KEY ? preference : theme};
      vm.runInNewContext(code,{window:{localStorage:storage},document:{documentElement:root}});
      const expected = effectiveDashboard(preference,theme);
      assert.equal(attrs.get('data-dashboard'),expected);
      assert.equal(applyDashboard(theme,root,preference),expected);
      assert.equal(attrs.get('class'),'dark');
      assert.equal(attrs.get('data-text-size'),'muy-grande');
    }
  }
  const attrs = new Map();
  vm.runInNewContext(code,{window:{get localStorage(){throw Error('SecurityError');}},document:{documentElement:{setAttribute:(k,v)=>attrs.set(k,v)}}});
  assert.equal(attrs.get('data-dashboard'),'clasico');
});

test('scale includes debts, fractions, zero and balances above earned credit', () => {
  assert.deepEqual(instrumentScale(-3,10),{min:-3,max:10,ratio:0,valid:true});
  assert.equal(instrumentScale(12.5,10).max,12.5);
  assert.equal(instrumentScale(0,0).ratio,0);
  assert.equal(instrumentScale(2.5,5).ratio,.5);
  assert.equal(instrumentScale(NaN,NaN).valid,false);
  for (const value of [-999, -0.5, 0, 1, 10, 1000, NaN, Infinity]) {
    for (const theme of ['f1','avion']) {
      const svg = dialSVG(value,10,theme);
      assert.doesNotMatch(svg, /NaN|Infinity|\sstyle=/);
      assert.match(svg,/aria-hidden="true"/);
    }
  }
});

test('quota geometry handles overdrawn and empty balances without invalid SVG', () => {
  for (const q of [{cupo:0,arrastreRestante:0,asignados:0,disfrutados:0,planificados:0}, {cupo:8,arrastreRestante:0,asignados:12,disfrutados:10,planificados:2}]) {
    const svg = quotaSVG(q,'f1');
    assert.doesNotMatch(svg,/NaN|Infinity|\sstyle=/);
  }
});

test('guard countdown is based on calendar days across DST and year boundaries', () => {
  assert.equal(guardCountdown('2026-03-30','2026-03-28'),2);
  assert.equal(guardCountdown('2026-10-26','2026-10-24'),2);
  assert.equal(guardCountdown('2027-01-01','2026-12-31'),1);
  assert.equal(guardCountdown('2026-11-15','2026-11-15'),0);
  assert.equal(guardCountdown(undefined,'2026-11-15'),null);
});

test('Nature terrain fills only the available part of the balance, without hiding debt or exceeding its bounds', () => {
  const width = (available, earned) => Number(natureTerrain(available, earned)
    .match(/id="nature-balance-fill"><rect width="([^"]+)"/)[1]);
  assert.equal(width(-3, 12), 0);
  assert.equal(width(0, 0), 0);
  assert.equal(width(2.5, 10), 90);
  assert.equal(width(12, 10), 360);
});

test('Nature quotas keep partial fill and bound the combined allocations to the plot', () => {
  const svg = natureQuota('ap', '12.50%', '12.50%');
  assert.match(svg, /id="nature-quota-ap-used"><rect width="22.5"/);
  assert.match(svg, /id="nature-quota-ap-assigned"><rect width="45"/);
  assert.match(natureQuota('vac', '91%', '20%'), /id="nature-quota-vac-assigned"><rect width="180"/);
});
