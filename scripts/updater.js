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
  const PTR_REST = 62;        // where the spinner settles while loading
  const PTR_CIRC = 75.4;      // SVG arc circumference (2π × r12)
  const PTR_SPIN_DASH = 20;   // spinner arc length during loading (~96°)

  const indicator = document.getElementById('ptr-indicator');
  const arc = indicator.querySelector('.ptr-arc');
  let startY = 0;
  let lastDelta = 0;
  let pulling = false;
  let refreshing = false;

  function _setY(px) {
    indicator.style.setProperty('--ptr-y', px + 'px');
  }

  function _setArcProgress(ratio) {
    arc.setAttribute('stroke-dasharray', `${Math.min(ratio, 1) * PTR_CIRC} ${PTR_CIRC}`);
  }

  function _snapIn() {
    indicator.classList.remove('is-ready');
    // Settle to rest position with a spring-like ease
    indicator.style.transition = 'transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.18s ease, border-color var(--duration)';
    _setY(PTR_REST);
    indicator.style.opacity = '1';
    // Switch to fixed-length spinner arc before animation starts
    arc.setAttribute('stroke-dasharray', `${PTR_SPIN_DASH} ${PTR_CIRC}`);
    indicator.classList.add('is-spinning');
    refreshing = true;
    setTimeout(() => { indicator.style.transition = 'border-color var(--duration)'; }, 280);
  }

  function _snapOut() {
    indicator.classList.remove('is-spinning');
    indicator.style.transition = 'opacity 0.22s ease, transform 0.22s ease, border-color var(--duration)';
    indicator.style.opacity = '0';
    setTimeout(() => {
      _setY(0);
      _setArcProgress(0);
      indicator.style.transition = 'border-color var(--duration)';
      refreshing = false;
    }, 250);
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
    // Always record startY so the touchmove Safari guard has a reference point
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
      indicator.style.opacity = '0';
      _setY(0);
      return;
    }
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) { lastDelta = 0; return; }
    lastDelta = delta;
    // Rubberband resistance — visual travel compresses logarithmically
    const visual = PTR_MAX * (1 - Math.exp(-delta / PTR_MAX));
    _setY(visual);
    const ratio = Math.min(delta / PTR_THRESHOLD, 1);
    _setArcProgress(ratio);
    indicator.style.opacity = String(Math.min(visual / (PTR_REST * 0.6), 1));
    indicator.classList.toggle('is-ready', ratio >= 1);
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!pulling) return;
    pulling = false;
    if (refreshing) return;
    if (lastDelta >= PTR_THRESHOLD) {
      _doRefresh();
    } else {
      indicator.classList.remove('is-ready');
      indicator.style.transition = 'opacity 0.18s ease, transform 0.22s ease, border-color var(--duration)';
      indicator.style.opacity = '0';
      _setArcProgress(0);
      _setY(0);
      setTimeout(() => { indicator.style.transition = 'border-color var(--duration)'; }, 230);
    }
    lastDelta = 0;
  }, { passive: true });
})();
