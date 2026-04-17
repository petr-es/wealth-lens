// Set this to your Vercel deployment URL once deployed, e.g.:
// const API_URL = 'https://wealth-lens.vercel.app/api/prices';
const API_URL = '/api/prices';

const btn   = document.getElementById('update-btn');
const label = document.getElementById('update-label');

function setBtnState(state) {
  btn.className = state ? 'state-' + state : '';
  btn.disabled  = state === 'loading';
  const icon = document.getElementById('update-icon');
  if (state === 'loading') {
    label.textContent = LANG.btnUpdating;
  } else if (state === 'success') {
    icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
    label.textContent = LANG.btnDone;
    setTimeout(() => setBtnState(null), 4000);
  } else {
    resetIcon();
    label.textContent = LANG.btnUpdate;
  }
}

function resetIcon() {
  document.getElementById('update-icon').innerHTML =
    '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>';
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

const OVERLAYS  = ['overlay-assets', 'overlay-brokers', 'overlay-prices', 'overlay-history'];
const CONTENTS  = ['content-assets', 'content-brokers', 'content-prices', 'content-history'];

function showOverlay(state, msgHtml = '') {
  OVERLAYS.forEach(id => {
    const el = document.getElementById(id);
    el.className = `card-overlay ${state ? 'is-' + state : ''}`;
    el.innerHTML = state === 'error'
      ? `<div class="overlay-error-icon">!</div><div class="overlay-error-msg">${msgHtml}</div>`
      : '';
  });
  CONTENTS.forEach(id => {
    document.getElementById(id).style.display = state ? 'none' : '';
  });
  const loading = state !== null;
  document.getElementById('history-select').style.visibility = loading ? 'hidden' : '';
  document.querySelector('.total').style.visibility          = loading ? 'hidden' : '';
}

function setLoadingState() {
  document.querySelector('.total').textContent = '–';
  document.getElementById('footnote').textContent = '';
  ['tbl-assets', 'tbl-brokers', 'tbl-prices'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  ['donut-assets', 'donut-brokers'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  document.getElementById('chart-history').innerHTML = '';
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
    window.PRICES = prices;
    showOverlay(null);
    render(window.PRICES, ASSETS);
    document.getElementById('history-select').value = 'live';
    drawHistoryChart(_currentTf);
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
  window.PRICES = prices;
  showOverlay(null);
  render(window.PRICES, ASSETS);
  initHistorySelect();
  initHistoryChart();
}).catch(e => {
  console.error('fetchPrices on load:', e);
  showOverlay('error', LANG.overlayError);
  showToast(LANG.toastUpdateFailed);
});
