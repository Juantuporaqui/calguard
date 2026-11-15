/**
 * Script clásico síncrono de arranque en <head> para aplicar `data-theme`
 * antes del primer pintado (antiparpadeo / FOUC) cumpliendo `script-src 'self'`.
 * La gestión completa del tema visual reside en `js/ui/visualTheme.js`.
 */
(function applyInitialVisualTheme() {
  var STORAGE_KEY = 'calguard-visual-theme';
  var DEFAULT_THEME = 'original';
  var ALLOWED = { original: 1, f1: 1, avion: 1, cientifica: 1, naturaleza: 1 };
  var theme = DEFAULT_THEME;
  var panel = 'clasico';
  try {
    var saved = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
    if (typeof saved === 'string' && Object.prototype.hasOwnProperty.call(ALLOWED, saved)) {
      theme = saved;
    }
  } catch (_) {
    /* modo privado o almacenamiento bloqueado */
  }
  try {
    if (window.localStorage.getItem('calguard-dashboard') === 'instrumental' && (theme === 'f1' || theme === 'avion')) panel = 'instrumental';
  } catch (_) { /* almacenamiento bloqueado */ }
  if (document && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-dashboard', panel);
  }
})();
