/** Presentation preference, independent of the operational state and colour mode. */
export const DASHBOARD_KEY = 'calguard-dashboard';
export const INSTRUMENTAL_THEMES = Object.freeze(['f1', 'avion']);
let sessionPreference;
export const resolveDashboard = value => value === 'instrumental' ? value : 'clasico';
export function readDashboard(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    return resolveDashboard(source?.getItem(DASHBOARD_KEY));
  } catch { return 'clasico'; }
}
export function dashboardPreference() {
  return sessionPreference ?? readDashboard();
}
export function effectiveDashboard(preference, theme) {
  return resolveDashboard(preference) === 'instrumental' && INSTRUMENTAL_THEMES.includes(theme) ? 'instrumental' : 'clasico';
}
export function applyDashboard(theme, root = globalThis.document?.documentElement, preference = dashboardPreference()) {
  const mode = effectiveDashboard(preference, theme);
  root?.setAttribute('data-dashboard', mode);
  return mode;
}
export function saveDashboard(value) {
  sessionPreference = resolveDashboard(value);
  try { globalThis.localStorage?.setItem(DASHBOARD_KEY, sessionPreference); } catch { /* usable in this session */ }
  applyDashboard(globalThis.document?.documentElement?.getAttribute('data-theme'));
  return sessionPreference;
}
