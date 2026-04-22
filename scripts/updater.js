const API_URL = '/api/prices';
const FETCH_TIMEOUT_MS = 15000;
const SUCCESS_RESET_MS = 4000;

const btn   = document.getElementById('update-btn');
const label = document.getElementById('update-label');

function setBtnState(state) {
  btn.className = 'refresh-btn' + (state ? ' state-' + state : '');
  btn.disabled  = state === 'loading';
  const icon = document.getElementById('update-icon');
  if (state === 'loading') {
    label.textContent = LANG.btnUpdating;
  } else if (state === 'success') {
    icon.innerHTML = '<polyline points="13 4 6 11 3 8" stroke-linecap="round" stroke-linejoin="round"/>';
    label.textContent = LANG.btnDone;
    setTimeout(() => setBtnState(null), SUCCESS_RESET_MS);
  } else {
    resetIcon();
    label.textContent = LANG.btnUpdate;
  }
}

function resetIcon() {
  document.getElementById('update-icon').innerHTML =
    '<path d="M14 2v4h-4"/><path d="M2 14v-4h4"/><path d="M2.5 10a5.5 5.5 0 0 0 9.2 2.2L14 10"/><path d="M13.5 6a5.5 5.5 0 0 0-9.2-2.2L2 6"/>';
}

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

async function triggerUpdate() {
  dismissToast();
  setBtnState('loading');
  setLoadingState();
  _showPageLoader();
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
    _hidePageLoader();
    setBtnState('success');
  } catch (e) {
    _hidePageLoader();
    setBtnState(null);
    showOverlay('error', LANG.overlayError);
    showToast(LANG.toastUpdateFailed);
  }
}

btn.addEventListener('click', triggerUpdate);

// Keep the button's native tooltip in sync with the current locale.
function _syncBtnTitle() {
  btn.setAttribute('title', LANG.btnUpdateTitle || LANG.btnUpdate);
  btn.setAttribute('aria-label', LANG.btnUpdateTitle || LANG.btnUpdate);
}
_syncBtnTitle();
document.addEventListener('wl:locale-change', _syncBtnTitle);

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

// Fetch live prices on page load
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
