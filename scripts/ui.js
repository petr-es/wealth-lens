// ── Theme (dark / light) ────────────────────────────────────────────────────
const THEME_KEY = 'wl.theme';

function _prefersLight() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function setTheme(theme, { persist = true } = {}) {
  applyTheme(theme);
  if (persist) localStorage.setItem(THEME_KEY, theme);
}

// Initialize: saved > OS preference > dark
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved);
  } else {
    applyTheme(_prefersLight() ? 'light' : 'dark');
  }
})();

// Follow OS changes until the user explicitly chooses.
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const handler = (e) => {
    if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'light' : 'dark');
  };
  if (mq.addEventListener) mq.addEventListener('change', handler);
  else if (mq.addListener) mq.addListener(handler);
}

const themeToggleEl = document.getElementById('theme-toggle');
if (themeToggleEl) {
  const toggle = () => {
    const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setTheme(cur === 'light' ? 'dark' : 'light');
  };
  themeToggleEl.addEventListener('click', toggle);
  themeToggleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
}

// ── Locale ──────────────────────────────────────────────────────────────────
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (LANG[key] !== undefined) el.textContent = LANG[key];
  });
  document.documentElement.lang = LANG.locale;
  // Update locale toggle active state
  document.querySelectorAll('#locale-toggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.locale === LANG.locale);
  });
}

function setLang(val) {
  LANG = LANGS[val];
  localStorage.setItem('lang', val);
  applyLang();
  if (window.CalendarPicker) {
    window.CalendarPicker.refresh();
    window.CalendarPicker.rerender({ animate: false });
  } else if (window.PRICES) {
    render(decorateLivePrices(window.PRICES), ASSETS, { animate: false, isLive: true });
  }
  if (typeof drawHistoryChart === 'function') drawHistoryChart(_currentTf, { animate: false });
}

// Restore saved locale
(function initLang() {
  const saved = localStorage.getItem('lang');
  if (saved && LANGS[saved]) LANG = LANGS[saved];
  applyLang();
})();

// Locale toggle buttons
document.querySelectorAll('#locale-toggle button').forEach(b => {
  b.addEventListener('click', () => setLang(b.dataset.locale));
});
