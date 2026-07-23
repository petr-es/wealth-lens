// ── Theme (dark / light) ────────────────────────────────────────────────────
const THEME_KEY = 'wl.theme';

function _prefersLight() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  syncThemeControl(theme);
}

// Mark the active segment — also covers themes applied without a click
// (initial load, OS preference change).
function syncThemeControl(theme) {
  document.querySelectorAll('#theme-toggle button').forEach(b => {
    const on = b.dataset.themeSet === theme;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
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

// Theme segmented control
document.querySelectorAll('#theme-toggle button').forEach(b => {
  b.addEventListener('click', () => setTheme(b.dataset.themeSet));
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
    const on = b.dataset.locale === LANG.locale;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
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

// ── Settings modal (theme + language) ───────────────────────────────────────
// Holds the theme and locale controls; opened from the header on desktop and
// from the footer on mobile. The markup is static (see index.html) so the
// listeners registered above stay valid and applyLang() localises it for free.
(function initSettingsModal() {
  const backdrop = document.getElementById('settings-modal-backdrop');
  const closeBtn = document.getElementById('settings-modal-close');
  const triggers = document.querySelectorAll('[data-settings-open]');
  if (!backdrop || !closeBtn) return;

  const escHandler = (e) => { if (e.key === 'Escape') close(); };

  function open() {
    backdrop.style.display = 'flex';
    triggers.forEach(t => t.setAttribute('aria-expanded', 'true'));
    document.addEventListener('keydown', escHandler);
  }

  function close() {
    backdrop.style.display = 'none';
    triggers.forEach(t => t.setAttribute('aria-expanded', 'false'));
    document.removeEventListener('keydown', escHandler);
  }

  triggers.forEach(t => t.addEventListener('click', open));
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
})();

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
