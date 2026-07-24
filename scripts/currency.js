// ── Display currency ────────────────────────────────────────────────────────
// All portfolio math runs in CZK (see _computePortfolio in portfolio.js): EUR
// and USD prices are multiplied by the snapshot's FX rates to get CZK, and the
// history file stores only EUR_CZK / USD_CZK. The display currency is therefore
// applied as a final division at the formatting layer, never in the math.
//
// The rate used is always the one belonging to the snapshot being shown — live
// rates for "Now", the entry's own rates for a history date, and each point's
// own rates along the history chart — so past values keep the FX of their day.
//
// Depends on: safeStorage (lang-init.js), LANG (lang-init.js).

const CURRENCY_KEY = 'wl.currency';
const CURRENCIES = ['CZK', 'EUR', 'USD'];

// CZK has no fixed glyph across locales ("Kč" / "CZK"), so it reuses the
// existing LANG.currency token rather than introducing a second spelling.
const CURRENCY_SYMBOLS = { EUR: '€', USD: '$' };

// Where the symbol goes relative to the amount: €1 234 and $1 234, but
// 1 234 Kč. Consumed by withCurrency() (portfolio.js) for formatted strings
// and by the layouts that place the label as its own element.
const CURRENCY_PREFIXED = { EUR: true, USD: true };

let DISPLAY_CCY = (function initCurrency() {
  const saved = safeStorage.get(CURRENCY_KEY);
  return CURRENCIES.includes(saved) ? saved : 'CZK';
})();

// Rates of the snapshot currently on screen. Set by render() before anything
// is formatted, so toDisplay() can default to "whatever is being shown".
let _activeRates = null;

function getCurrency() { return DISPLAY_CCY; }
function setActiveRates(rates) { _activeRates = rates || null; }

function currencyLabel(ccy = DISPLAY_CCY) {
  return CURRENCY_SYMBOLS[ccy] || LANG.currency;
}

function currencyPrefixed(ccy = DISPLAY_CCY) {
  return !!CURRENCY_PREFIXED[ccy];
}

// Spelled-out unit, for places where a bare glyph reads poorly as a standalone
// annotation rather than as part of an amount — the projector's settings fields
// label their inputs "EUR" / "USD" instead of "€" / "$". CZK keeps its locale
// spelling, which is already a word.
function currencyCode(ccy = DISPLAY_CCY) {
  return CURRENCY_SYMBOLS[ccy] ? ccy : LANG.currency;
}

// CZK per 1 unit of `ccy`, from a rates block. Returns null when the snapshot
// has no usable rate — callers surface that as "—" rather than a wrong number.
function czkPer(ccy, rates = _activeRates) {
  if (ccy === 'CZK') return 1;
  const r = rates && rates[`${ccy}_CZK`];
  return Number.isFinite(r) && r > 0 ? r : null;
}

// CZK amount → display currency. Scale-agnostic: works on raw CZK and on the
// thousands-scaled values used across the app, since both are linear in CZK.
function toDisplay(czk, rates = _activeRates) {
  if (DISPLAY_CCY === 'CZK') return czk;
  const per = czkPer(DISPLAY_CCY, rates);
  return per ? czk / per : null;
}

// Display currency → CZK. Used for values the user types (projector inputs),
// which are persisted in CZK so the stored plan is currency-independent.
function fromDisplay(amount, rates = _activeRates) {
  if (DISPLAY_CCY === 'CZK') return amount;
  const per = czkPer(DISPLAY_CCY, rates);
  return per ? amount * per : null;
}

// The FX pairs behind the numbers on screen, quoted in the display currency
// (e.g. in EUR mode: USD/EUR, CZK/EUR). Order keeps CZK last unless it is the
// display currency, matching the original "EUR/CZK · USD/CZK" footer.
function fxPairs(rates = _activeRates) {
  return ['EUR', 'USD', 'CZK']
    .filter(base => base !== DISPLAY_CCY)
    .map(base => {
      const baseCzk = czkPer(base, rates);
      const quoteCzk = czkPer(DISPLAY_CCY, rates);
      return {
        base,
        quote: DISPLAY_CCY,
        value: baseCzk && quoteCzk ? baseCzk / quoteCzk : null,
      };
    });
}

// Fill every currency-label slot in the static markup. Called on both currency
// and locale switches — the CZK label is locale-dependent.
function applyCurrencyLabels() {
  const label = currencyLabel();
  document.querySelectorAll('[data-ccy-label]').forEach(el => { el.textContent = label; });
  // Lets CSS flip label slots that sit in static markup (the header total) to
  // the front for symbol-first currencies.
  document.documentElement.dataset.ccyPosition = currencyPrefixed() ? 'prefix' : 'suffix';
  document.querySelectorAll('#currency-toggle button').forEach(b => {
    const on = b.dataset.currency === DISPLAY_CCY;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function setCurrency(ccy) {
  if (!CURRENCIES.includes(ccy) || ccy === DISPLAY_CCY) return;
  DISPLAY_CCY = ccy;
  safeStorage.set(CURRENCY_KEY, ccy);
  applyCurrencyLabels();
  document.dispatchEvent(new CustomEvent('wl:currency-change', { detail: { currency: ccy } }));
}
