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
  if (persist) safeStorage.set(THEME_KEY, theme);
}

// Initialize: saved > OS preference > dark
(function initTheme() {
  const saved = safeStorage.get(THEME_KEY);
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
    if (!safeStorage.get(THEME_KEY)) applyTheme(e.matches ? 'light' : 'dark');
  };
  if (mq.addEventListener) mq.addEventListener('change', handler);
  else if (mq.addListener) mq.addListener(handler);
}

document.querySelectorAll('.theme-toggle').forEach(el => {
  const toggle = () => {
    const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setTheme(cur === 'light' ? 'dark' : 'light');
  };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
});

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
  safeStorage.set('lang', val);
  applyLang();
  document.dispatchEvent(new CustomEvent('wl:locale-change', { detail: { locale: val } }));
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
  const saved = safeStorage.get('lang');
  if (saved && LANGS[saved]) LANG = LANGS[saved];
  applyLang();
})();

// Locale toggle buttons
document.querySelectorAll('#locale-toggle button').forEach(b => {
  b.addEventListener('click', () => setLang(b.dataset.locale));
});

// ── Scope-wrap overflow detection ────────────────────────────────────────────
// Wraps the scope selector to row 2 when brand + hero-min-content + scope
// would exceed the header width. Measured from intrinsic element widths so
// it adapts to any label length ("NYNÍ" vs a full date+time string).
(function initScopeWrap() {
  const header    = document.querySelector('.header');
  const scopeWrap = document.querySelector('.scope-wrap');
  const brandMark = document.querySelector('.brand-mark');
  const heroEl    = document.querySelector('.hero');
  if (!header || !scopeWrap || !brandMark || !heroEl) return;

  function check() {
    const gap     = parseFloat(getComputedStyle(header).columnGap) || 16;
    const headerW = header.getBoundingClientRect().width;
    const brandW  = brandMark.getBoundingClientRect().width;
    // Use the button itself — scopeWrap may span full width when on row 2
    const scopeBtnEl = scopeWrap.querySelector('.scope-dropdown');
    const scopeW  = (scopeBtnEl || scopeWrap).getBoundingClientRect().width;

    // Hero min-content = sum of visible children's natural widths + gaps between them.
    // scrollWidth gives intrinsic size regardless of how much space the flex item got.
    const heroKids = Array.from(heroEl.children)
      .filter(c => getComputedStyle(c).display !== 'none');
    const heroMinW = heroKids.reduce((s, c) => s + c.scrollWidth, 0)
      + gap * Math.max(0, heroKids.length - 1);

    // 3 row-1 items → 2 inter-item gaps
    const required = brandW + heroMinW + scopeW + gap * 2;
    header.classList.toggle('scope-overflow', required > headerW - 8);
  }

  // Fire on viewport resize
  const ro = new ResizeObserver(check);
  ro.observe(document.documentElement);

  // Fire when scope label text changes (e.g. "NYNÍ" ↔ date) — scopeWrap stays
  // full-width on row 2 so ResizeObserver wouldn't catch the content change
  const scopeBtn = scopeWrap.querySelector('.scope-dropdown');
  if (scopeBtn) {
    new MutationObserver(check).observe(scopeBtn, { childList: true, subtree: true, characterData: true });
  }

  requestAnimationFrame(check); // initial layout pass
})();
