'use strict';

// Apply theme to <html> so it works even when script runs in <head>
// before <body> is parsed.

(function () {
  var THEME_KEY = 'img-collector-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('light-mode', theme === 'light');
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.textContent = theme === 'light' ? '☀️' : '🌙';
    btn.dataset.tooltip = theme === 'light' ? 'ライトモード' : 'ダークモード';
  }

  // Apply immediately — documentElement always exists.
  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', function () {
    // Sync button label after DOM is ready.
    applyTheme(getTheme());

    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var isLight = document.documentElement.classList.toggle('light-mode');
      var theme = isLight ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, theme);
      btn.textContent = isLight ? '☀️' : '🌙';
      btn.dataset.tooltip = isLight ? 'ライトモード' : 'ダークモード';
    });
  });
})();
