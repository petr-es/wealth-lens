const API_URL = '/api/prices';
const FETCH_TIMEOUT_MS = 15000;

function showToast(message) {
  dismissToast();
  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.setAttribute('role', 'alert');

  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = message;

  const retry = document.createElement('button');
  retry.className = 'toast-retry';
  retry.type = 'button';
  retry.textContent = LANG.toastRetry;
  retry.addEventListener('click', () => { dismissToast(); triggerUpdate(); });

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.type = 'button';
  close.setAttribute('aria-label', LANG.toastClose || 'Close');
  close.textContent = '×';
  close.addEventListener('click', dismissToast);

  toast.append(msg, retry, close);
  document.body.appendChild(toast);
}

function dismissToast() {
  const t = document.getElementById('update-toast');
  if (t) t.remove();
}

const OVERLAYS = ['overlay-assets', 'overlay-brokers', 'overlay-prices', 'overlay-history'];
const CONTENTS = ['content-assets', 'content-brokers', 'content-prices', 'content-history'];

function showOverlay(state, msgText = '') {
  OVERLAYS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `card-overlay ${state ? 'is-' + state : ''}`;
    if (state === 'error') {
      el.innerHTML = '';
      const icon = document.createElement('div');
      icon.className = 'overlay-error-icon';
      icon.textContent = '!';
      const msg = document.createElement('div');
      msg.className = 'overlay-error-msg';
      msg.textContent = msgText;
      el.append(icon, msg);
    } else {
      el.innerHTML = '';
    }
  });
  CONTENTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = state ? 'none' : '';
  });
  document.getElementById('app').classList.toggle('is-loading-root', state === 'loading');
}

function setLoadingState() {
  showOverlay('loading');
}

function _isValidPricesShape(data) {
  return data
    && typeof data === 'object'
    && data.rates && typeof data.rates === 'object'
    && data.prices && typeof data.prices === 'object';
}

async function fetchPrices() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!_isValidPricesShape(data)) throw new Error('Invalid response shape');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function triggerUpdate({ silent = false } = {}) {
  dismissToast();
  if (!silent) setLoadingState();
  try {
    const prices = await fetchPrices();
    window.PRICES = decorateLivePrices(prices);
    showOverlay(null);
    if (window.CalendarPicker) {
      window.CalendarPicker.reset();
      window.CalendarPicker.refresh();
    }
    _lastRenderTotal = 0;
    _lastDonutAssetTotal = 0;
    _lastDonutBrokerTotal = 0;
    render(window.PRICES, ASSETS, { animate: true, isLive: true });
    drawHistoryChart(_currentTf, { animate: true });
  } catch (e) {
    showOverlay('error', LANG.overlayError);
    showToast(LANG.toastUpdateFailed);
  }
}

function _showPageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  loader.classList.remove('is-hidden');
}

function _hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  loader.classList.add('is-hidden');
}

// Fetch live prices on page load (shows full logo overlay)
setLoadingState();
fetchPrices().then(prices => {
  window.PRICES = decorateLivePrices(prices);
  showOverlay(null);
  render(window.PRICES, ASSETS, { animate: true, isLive: true });
  initHistoryChart();
  _hidePageLoader();
}).catch(() => {
  _hidePageLoader();
  showOverlay('error', LANG.overlayError);
  showToast(LANG.toastUpdateFailed);
});

// Pull-to-refresh
(function () {
  const PTR_THRESHOLD = 72;   // px of drag before triggering refresh
  const PTR_MAX = 130;        // rubberband ceiling for visual drag distance
  const PTR_REST = 64;        // bar height while loading
  const PTR_CIRC = 75.4;      // SVG arc circumference (2π × r12)
  const PTR_SPIN_DASH = 20;   // spinner arc length during loading (~96°)

  const bar    = document.getElementById('ptr-bar');
  const arc    = bar.querySelector('.ptr-arc');
  const appEl  = document.getElementById('app');
  let startY = 0;
  let lastDelta = 0;
  let pulling = false;
  let refreshing = false;

  function _setH(px) {
    bar.style.setProperty('--ptr-h', px + 'px');
  }

  function _setArcProgress(ratio) {
    arc.setAttribute('stroke-dasharray', `${Math.min(ratio, 1) * PTR_CIRC} ${PTR_CIRC}`);
  }

  // Zero out the app's top padding so bar and header stay flush (no gap).
  // Restores with a matching transition when the bar collapses.
  function _removePad() {
    appEl.style.paddingTop = '0';
  }

  function _restorePad(dur) {
    appEl.style.transition = `padding-top ${dur}`;
    appEl.style.paddingTop = ''; // falls back to CSS --card-pad value
    setTimeout(() => { appEl.style.transition = ''; }, 320);
  }

  function _snapIn() {
    bar.classList.remove('is-ready');
    bar.style.transition = 'height 0.3s cubic-bezier(0.34, 1.4, 0.64, 1)';
    _setH(PTR_REST);
    _removePad();
    arc.setAttribute('stroke-dasharray', `${PTR_SPIN_DASH} ${PTR_CIRC}`);
    bar.classList.add('is-spinning');
    refreshing = true;
    setTimeout(() => { bar.style.transition = ''; }, 320);
  }

  function _snapOut() {
    bar.classList.remove('is-spinning', 'is-ready');
    const dur = '0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    bar.style.transition = `height ${dur}`;
    _setH(0);
    _restorePad(dur);
    setTimeout(() => {
      _setArcProgress(0);
      bar.style.transition = '';
      refreshing = false;
    }, 320);
  }

  async function _doRefresh() {
    _snapIn();
    try {
      await triggerUpdate({ silent: true });
    } finally {
      _snapOut();
    }
  }

  document.addEventListener('touchstart', function (e) {
    startY = e.touches[0].clientY;
    if (refreshing || window.scrollY > 0) return;
    lastDelta = 0;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    // Block Safari's native pull-to-refresh before any other logic
    const atTop = (window.pageYOffset || document.documentElement.scrollTop) <= 0;
    if (atTop && e.cancelable && e.touches[0].clientY > startY) {
      e.preventDefault();
    }

    if (!pulling || refreshing) return;
    if (window.scrollY > 0) {
      pulling = false;
      lastDelta = 0;
      _setH(0);
      return;
    }
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) { lastDelta = 0; return; }
    lastDelta = delta;
    // Remove top padding immediately on first drag so bar and content stay flush
    _removePad();
    // Rubberband resistance — visual travel compresses logarithmically
    const visual = PTR_MAX * (1 - Math.exp(-delta / PTR_MAX));
    _setH(visual);
    const ratio = Math.min(delta / PTR_THRESHOLD, 1);
    _setArcProgress(ratio);
    bar.classList.toggle('is-ready', ratio >= 1);
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!pulling) return;
    pulling = false;
    if (refreshing) return;
    if (lastDelta >= PTR_THRESHOLD) {
      _doRefresh();
    } else {
      bar.classList.remove('is-ready');
      const dur = '0.22s cubic-bezier(0.4, 0, 0.2, 1)';
      bar.style.transition = `height ${dur}`;
      _setArcProgress(0);
      _setH(0);
      _restorePad(dur);
      setTimeout(() => { bar.style.transition = ''; }, 240);
    }
    lastDelta = 0;
  }, { passive: true });
})();
