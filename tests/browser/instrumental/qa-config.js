// Synthetic fixture only, never part of the production manifest or cache.
const qaParams = new URLSearchParams(location.search);
localStorage.setItem('calguard-visual-theme',qaParams.get('theme') || 'f1');
localStorage.setItem('calguard-dashboard',qaParams.get('mode') || 'instrumental');
localStorage.setItem('calguard-theme',qaParams.get('color') || 'dark');
const NativeDate = Date;
window.Date = class extends NativeDate { constructor(...args){super(...(args.length ? args : ['2026-11-15T12:00:00+01:00']));} static now(){return new NativeDate('2026-11-15T12:00:00+01:00').getTime();} };
