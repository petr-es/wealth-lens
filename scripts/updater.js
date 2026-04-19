const API_URL = '/api/prices';

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
    setTimeout(() => setBtnState(null), 4000);
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
  const existing = document.getElementById('update-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.innerHTML =
    `<span class="toast-msg">${message}</span>` +
    `<button class="toast-retry" onclick="dismissToast();triggerUpdate()">${LANG.toastRetry}</button>` +
    `<button class="toast-close" onclick="dismissToast()">×</button>`;
  document.body.appendChild(toast);
}

function dismissToast() {
  const t = document.getElementById('update-toast');
  if (t) t.remove();
}

const OVERLAYS = ['overlay-assets', 'overlay-brokers', 'overlay-prices', 'overlay-history'];
const CONTENTS = ['content-assets', 'content-brokers', 'content-prices', 'content-history'];

function showOverlay(state, msgHtml = '') {
  OVERLAYS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `card-overlay ${state ? 'is-' + state : ''}`;
    el.innerHTML = state === 'error'
      ? `<div class="overlay-error-icon">!</div><div class="overlay-error-msg">${msgHtml}</div>`
      : '';
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

async function fetchPrices() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function triggerUpdate() {
  dismissToast();
  setBtnState('loading');
  setLoadingState();
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
    setBtnState('success');
  } catch (e) {
    console.error('fetchPrices:', e);
    setBtnState(null);
    showOverlay('error', LANG.overlayError);
    showToast(LANG.toastUpdateFailed);
  }
}

// Fetch live prices on page load
setLoadingState();
fetchPrices().then(prices => {
  window.PRICES = decorateLivePrices(prices);
  showOverlay(null);
  render(window.PRICES, ASSETS, { animate: true, isLive: true });
  initHistoryChart();
}).catch(e => {
  console.error('fetchPrices on load:', e);
  showOverlay('error', LANG.overlayError);
  showToast(LANG.toastUpdateFailed);
});
