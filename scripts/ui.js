const THEMES = { blue: 'themes/theme-blue.css', grey: 'themes/theme-grey.css', light: 'themes/theme-light.css' };
const sheet    = document.querySelector('link[rel="stylesheet"]');
const selTheme = document.getElementById('theme-select');
const selLang  = document.getElementById('lang-select');

function setTheme(val) {
  sheet.setAttribute('href', THEMES[val]);
  localStorage.setItem('theme', val);
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (LANG[key] !== undefined) el.textContent = LANG[key];
  });
}

function setLang(val) {
  LANG = LANGS[val];
  localStorage.setItem('lang', val);
  document.documentElement.lang = val;
  ['tbl-assets', 'tbl-brokers', 'tbl-prices'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  const sel = document.getElementById('history-select');
  const prevIdx = sel ? parseInt(sel.value) : 0;
  initHistorySelect();
  if (sel) sel.value = prevIdx;
  const entry = window._historyEntries && _historyEntries[prevIdx];
  render(entry ? buildPricesFromEntry(entry) : PRICES, entry ? buildAssetsFromEntry(entry) : ASSETS);
  applyLang();
}

// restore theme
const savedTheme = localStorage.getItem('theme') || 'blue';
selTheme.value = savedTheme;
if (savedTheme !== 'blue') sheet.setAttribute('href', THEMES[savedTheme]);

// restore lang
const savedLang = localStorage.getItem('lang') || 'cs';
selLang.value = savedLang;
document.documentElement.lang = savedLang;
applyLang();
