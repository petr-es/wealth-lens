// ── Glow helpers (shared across donut segments, alloc dots, projector) ───────
function glowShadow(color) {
  return `0 0 8px color-mix(in srgb, ${color} 35%, transparent)`;
}
function glowFilter(color) {
  return `drop-shadow(${glowShadow(color)})`;
}

// ── Constants ───────────────────────────────────────────────────────────────
const DURATIONS = {
  TOTAL:  1200,   // header total count-up
  DONUT:  1100,   // donut sweep + center value
  CHART:  1300,   // history chart stroke
};

const DONUT = {
  SIZE:      160,
  THICKNESS: 26,
  GAP:       2,   // px gap between segments
};

const SPARK = {
  WIDTH:        90,
  HEIGHT:       22,
  STROKE_WIDTH: 1.3,
};

const PRICE_WINDOW_DAYS = 30; // sparkline history window

// ── Formatting helpers ──────────────────────────────────────────────────────
const NBSP = '\u00a0';
const _loc     = () => LANG.locale === 'cs' ? 'cs-CZ' : 'en-US';
const _dateLoc = () => LANG.locale === 'cs' ? 'cs-CZ' : 'en-GB';
function fmtDate(d) {
  const tz = { timeZone: 'Europe/Prague' };
  const raw = d.toLocaleDateString('cs-CZ', { ...tz, day: 'numeric', month: 'numeric', year: 'numeric' });
  const [dd, mm, yyyy] = raw.replace(/\s/g, '').split('.').filter(Boolean);
  return LANG.locale === 'cs' ? `${dd}.${mm}.${yyyy}` : `${parseInt(mm)}/${parseInt(dd)}/${yyyy}`;
}
function fmtDateTime(d) {
  const tz = { timeZone: 'Europe/Prague' };
  const time = LANG.locale === 'cs'
    ? d.toLocaleTimeString('cs-CZ', { ...tz, hour: '2-digit', minute: '2-digit' })
    : d.toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit', hour12: true });
  return `${fmtDate(d)} ${time}`;
}

// Grouped whole number — the shape every money amount ends up in. Currency
// agnostic; see fmtMoney for the CZK → display currency conversion.
function fmtGrouped(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = Math.round(n).toLocaleString(_loc());
  return LANG.locale === 'cs' ? s.replace(/\s/g, NBSP) : s;
}
function fmtPct(n, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  // Anything that rounds away at this precision is just 0 — "0,0%" and "0,00%"
  // are noisier ways of saying the same thing.
  if (Math.abs(n) < 0.5 / Math.pow(10, digits)) return '0%';
  const s = n.toFixed(digits);
  return (LANG.locale === 'cs' ? s.replace('.', ',') : s) + '%';
}
function fmtNum(n, dec = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = n.toFixed(dec);
  return LANG.locale === 'cs' ? s.replace('.', ',') : s;
}
// Formats a value already expressed in thousands. Small holdings would round
// away (e.g. 0.78 = 781 CZK → "1", 0.48 → "0"), so keep one decimal below 10;
// larger amounts stay as rounded whole thousands.
function fmtTis(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n >= 10) return fmtGrouped(Math.round(n));
  // Below the rounding threshold the decimal carries nothing — "0,0" is just a
  // noisier way of writing 0, so drop it.
  return Math.abs(n) < 0.05 ? '0' : fmtNum(n, 1);
}

// ── Money formatters ────────────────────────────────────────────────────────
// Both take CZK (the currency everything is computed in) and render it in the
// selected display currency. `rates` defaults to the snapshot being rendered;
// pass it explicitly when formatting a value from a different snapshot, e.g. a
// history chart point or a delta baseline.
function fmtMoney(czk, rates) {
  return fmtGrouped(toDisplay(czk, rates));
}
// Same, for values already scaled to thousands.
function fmtTisMoney(tisCzk, rates) {
  return fmtTis(toDisplay(tisCzk, rates));
}
// Attaches the currency to a formatted amount on the side that currency is
// written: "€1 234" / "$1 234" but "1 234 Kč", where the non-breaking space
// keeps the trailing unit from wrapping away from its amount.
function withCurrency(amount) {
  return currencyPrefixed()
    ? `${currencyLabel()}${amount}`
    : `${amount}${NBSP}${currencyLabel()}`;
}
function fmtShares(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = n.toLocaleString(_loc());
  return LANG.locale === 'cs' ? s.replace(/\s/g, NBSP) : s;
}

// Compact thousands formatter for cash holdings (e.g. "Kč 160K", "€1,9K", "$3,6K").
// Uses 0 decimals for ≥100 K, 1 decimal otherwise, with locale-aware separators.
function fmtCashK(amount, currency) {
  const k = amount / 1000;
  const dec = k >= 100 ? 0 : 1;
  const num = k.toLocaleString(_loc(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (currency === 'CZK') return LANG.locale === 'cs' ? `Kč${NBSP}${num}K` : `CZK${NBSP}${num}K`;
  if (currency === 'EUR') return `€${num}K`;
  return `$${num}K`;
}

// ── Number animation ────────────────────────────────────────────────────────
const _animHandles = new WeakMap();

function animateNumber(el, from, to, duration, formatter, { html = false } = {}) {
  if (!el) return;
  const prev = _animHandles.get(el);
  if (prev) cancelAnimationFrame(prev);
  const start = performance.now();
  const tick = (t) => {
    // A frame that began before this animation was scheduled reports a
    // timestamp earlier than `start`. Left unclamped, the easing below turns
    // that negative progress into a wildly out-of-range number for one frame.
    const p = Math.min(1, Math.max(0, (t - start) / duration));
    const e = 1 - Math.pow(1 - p, 5); // easeOutQuint
    const v = from + (to - from) * e;
    if (html) el.innerHTML = formatter(v);
    else el.textContent = formatter(v);
    if (p < 1) _animHandles.set(el, requestAnimationFrame(tick));
    else _animHandles.delete(el);
  };
  _animHandles.set(el, requestAnimationFrame(tick));
}

// ── Donut ───────────────────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function drawDonut(svgEl, segments, { animate = true } = {}) {
  svgEl.innerHTML = '';
  const size = DONUT.SIZE, thickness = DONUT.THICKNESS, gap = DONUT.GAP;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;

  const bg = document.createElementNS(SVG_NS, 'circle');
  bg.setAttribute('cx', c); bg.setAttribute('cy', c); bg.setAttribute('r', r);
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'oklch(1 0 0 / 0.04)');
  bg.setAttribute('stroke-width', thickness);
  svgEl.appendChild(bg);

  let offset = 0;
  const paths = segments.map((seg) => {
    const frac = seg.value / total;
    const fullLen = Math.max(0, frac * circ - gap);
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', c); ring.setAttribute('cy', c); ring.setAttribute('r', r);
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', seg.color);
    ring.setAttribute('stroke-width', thickness);
    ring.setAttribute('stroke-linecap', 'butt');
    ring.classList.add('donut-seg');
    ring.style.filter = glowFilter(seg.color);
    ring.setAttribute('stroke-dasharray', `0 ${circ}`);
    ring.setAttribute('stroke-dashoffset', '0');
    ring.dataset.segStart = offset;
    ring.dataset.segLen = fullLen;
    ring.style.transition = 'opacity 0.15s';
    svgEl.appendChild(ring);
    offset += frac * circ;
    return ring;
  });

  if (animate) {
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / DURATIONS.DONUT);
      const e = 1 - Math.pow(1 - p, 3);
      paths.forEach((path) => {
        const segStart = parseFloat(path.dataset.segStart);
        const segLen = parseFloat(path.dataset.segLen);
        const len = segLen * e;
        path.setAttribute('stroke-dasharray', `${len} ${circ - len}`);
        path.setAttribute('stroke-dashoffset', String(-segStart * e));
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else {
    paths.forEach((path) => {
      const segStart = parseFloat(path.dataset.segStart);
      const segLen = parseFloat(path.dataset.segLen);
      path.setAttribute('stroke-dasharray', `${segLen} ${circ - segLen}`);
      path.setAttribute('stroke-dashoffset', String(-segStart));
    });
  }

  return paths;
}

function linkDonutLegend(paths, rowEls) {
  paths.forEach((path, i) => {
    path.addEventListener('mouseenter', () => {
      paths.forEach((p, j) => { p.style.opacity = j === i ? '1' : '0.25'; });
      rowEls.forEach((r, j) => { r.classList.toggle('row-dim', j !== i); });
    });
    path.addEventListener('mouseleave', () => {
      paths.forEach(p => { p.style.opacity = '1'; });
      rowEls.forEach(r => { r.classList.remove('row-dim'); });
    });
  });
  rowEls.forEach((row, i) => {
    row.addEventListener('mouseenter', () => {
      paths.forEach((p, j) => { p.style.opacity = j === i ? '1' : '0.25'; });
      rowEls.forEach((r, j) => { r.classList.toggle('row-dim', j !== i); });
    });
    row.addEventListener('mouseleave', () => {
      paths.forEach(p => { p.style.opacity = '1'; });
      rowEls.forEach(r => { r.classList.remove('row-dim'); });
    });
  });
}

// ── Sparkline ───────────────────────────────────────────────────────────────
function buildSparkline(data, color, { width = SPARK.WIDTH, height = SPARK.HEIGHT, strokeWidth = SPARK.STROKE_WIDTH } = {}) {
  if (!data || data.length < 2) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width); svg.setAttribute('height', height);
    svg.classList.add('sparkline');
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', 0); line.setAttribute('y1', height / 2);
    line.setAttribute('x2', width); line.setAttribute('y2', height / 2);
    line.setAttribute('stroke', color); line.setAttribute('stroke-opacity', '0.5');
    line.setAttribute('stroke-width', strokeWidth);
    svg.appendChild(line);
    return svg;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const d = points.map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`)).join(' ');
  const area = d + ` L${width},${height} L0,${height} Z`;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width); svg.setAttribute('height', height);
  svg.classList.add('sparkline');

  const gradId = 'sg-' + Math.random().toString(36).slice(2, 8);
  const defs = document.createElementNS(SVG_NS, 'defs');
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('x1', '0'); grad.setAttribute('x2', '0');
  grad.setAttribute('y1', '0'); grad.setAttribute('y2', '1');
  const stop1 = document.createElementNS(SVG_NS, 'stop');
  stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', color); stop1.setAttribute('stop-opacity', '0.35');
  const stop2 = document.createElementNS(SVG_NS, 'stop');
  stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', color); stop2.setAttribute('stop-opacity', '0');
  grad.appendChild(stop1); grad.appendChild(stop2); defs.appendChild(grad);
  svg.appendChild(defs);

  const areaPath = document.createElementNS(SVG_NS, 'path');
  areaPath.setAttribute('d', area); areaPath.setAttribute('fill', `url(#${gradId})`);
  svg.appendChild(areaPath);

  const linePath = document.createElementNS(SVG_NS, 'path');
  linePath.setAttribute('d', d); linePath.setAttribute('fill', 'none');
  linePath.setAttribute('stroke', color); linePath.setAttribute('stroke-width', strokeWidth);
  linePath.setAttribute('stroke-linecap', 'round'); linePath.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(linePath);
  return svg;
}

// ── Per-asset 30D price history ─────────────────────────────────────────────
function _pricePerUnit(entry, assetKey) {
  const eur = entry.rates.EUR_CZK || 0;
  const usd = entry.rates.USD_CZK || 0;
  if (assetKey === 'fwra') return (entry.prices.FWRA_EUR || 0) * eur;
  if (assetKey === 'avws') return (entry.prices.AVWS_EUR || 0) * eur;
  if (assetKey === 'spyy') return (entry.prices.SPYY_EUR || 0) * eur;
  if (assetKey === 's')    return (entry.prices.S_USD    || 0) * usd;
  if (assetKey === 'ib1t') return (entry.prices.IB1T_EUR || 0) * eur;
  if (assetKey === 'alpha') {
    const a = entry.assets && entry.assets.alpha;
    return a ? (a.fixedCzk || 0) : 0;
  }
  if (assetKey === 'cash') {
    const ch = (entry.assets && entry.assets.cash) || {};
    const czk = (ch.ibkr_czk||0) + (ch.t212_czk||0) + (ch.rev_czk||0);
    const eur_ = (ch.ibkr_eur||0) + (ch.t212_eur||0) + (ch.rev_eur||0);
    const usd_ = (ch.ibkr_usd||0) + (ch.t212_usd||0) + (ch.rev_usd||0);
    return czk + eur_ * eur + usd_ * usd;
  }
  return 0;
}

// Get last N entries' per-unit price series for an asset.
// Returns { series: number[], deltaPct: number|null } — deltaPct is the
// full-window change (first vs last); used for sparkline color.
function priceSeriesForAsset(assetKey, windowDays = PRICE_WINDOW_DAYS, anchorTs = null) {
  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) return { series: [], deltaPct: null };
  let sorted = [...PRICE_HISTORY].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  if (anchorTs != null) {
    const cutoff = new Date(anchorTs).getTime();
    sorted = sorted.filter(e => new Date(e.ts).getTime() <= cutoff);
  }
  const slice = sorted.slice(-windowDays);
  // Each point converts with its own day's rates, so in EUR/USD the sparkline
  // shows the price as it actually moved in that currency, FX included.
  const series = slice
    .map(e => toDisplay(_pricePerUnit(e, assetKey), e.rates))
    .filter(v => Number.isFinite(v));
  if (series.length < 2) return { series, deltaPct: null };
  const first = series[0], last = series[series.length - 1];
  const deltaPct = first > 0 ? ((last - first) / first) * 100 : null;
  return { series, deltaPct };
}

// ── Portfolio value calc ────────────────────────────────────────────────────
function _calcPortfolioValue(entry) {
  const EUR = entry.rates.EUR_CZK || 0;
  const USD = entry.rates.USD_CZK || 0;
  const F    = (entry.prices.FWRA_EUR  || 0) * EUR;
  const AV   = (entry.prices.AVWS_EUR  || 0) * EUR;
  const P    = (entry.prices.SPYY_EUR  || 0) * EUR;
  const S    = (entry.prices.S_USD     || 0) * USD;
  const IB1T = (entry.prices.IB1T_EUR  || 0) * EUR;
  const a = entry.assets || {};
  const fh = a.fwra || {}, vh = a.avws || {}, ph = a.spyy || {}, sh = a.s || {}, bh = a.ib1t || {};
  const alpha = a.alpha ? (a.alpha.fixedCzk || 0) : 0;
  const ch = a.cash || {};
  const cashTis = (
    ((ch.ibkr_czk||0) + (ch.t212_czk||0) + (ch.rev_czk||0)) +
    ((ch.ibkr_eur||0) + (ch.t212_eur||0) + (ch.rev_eur||0)) * EUR +
    ((ch.ibkr_usd||0) + (ch.t212_usd||0) + (ch.rev_usd||0)) * USD
  ) / 1000;
  return ((fh.t212||0)+(fh.ibkr||0)+(fh.rev||0)) * F / 1000
       + ((vh.t212||0)+(vh.ibkr||0)) * AV / 1000
       + ((ph.t212||0)+(ph.ibkr||0)) * P / 1000
       + ((sh.ibkr||0)+(sh.etrade||0)) * S / 1000
       + (bh.ibkr||0) * IB1T / 1000
       + alpha
       + cashTis;
}

// ── Delta tag: latest vs most recent entry on a different calendar date ─────
// Local midnight of a timestamp — the unit both the delta walk-back and the
// history chart compare days in.
function _dayStart(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function _entryDate(entry) {
  return _dayStart(entry.ts);
}

// Difference between two snapshots, expressed in the display currency. Each
// side converts with its own rates, so the delta reflects what the portfolio
// actually did in that currency rather than re-pricing the past at today's FX.
function _deltaBetween(vNowTis, nowRates, prevEntry) {
  const now  = toDisplay(vNowTis, nowRates);
  const prev = toDisplay(_calcPortfolioValue(prevEntry), prevEntry.rates);
  if (!Number.isFinite(now) || !Number.isFinite(prev) || !prev) return null;
  return { pct: ((now - prev) / prev) * 100, abs: (now - prev) * 1000 };
}

// Compute delta of now (live value in tis. Kč) vs the most recent history
// entry on a calendar day strictly before today's (Europe/Prague) date.
// On weekends the latest history entry is typically Friday; walking back to
// a different calendar day naturally lands on Thursday, matching the spec.
function computeDelta(vNowTis, nowRates) {
  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) return null;
  if (!Number.isFinite(vNowTis) || vNowTis === 0) return null;
  const sorted = [...PRICE_HISTORY].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // On weekends, skip Friday too — weekend prices equal Friday's market close,
  // so the meaningful comparison is vs Thursday.
  const dow = today.getDay(); // 0=Sun, 6=Sat
  let skipDay = null;
  if (dow === 6) {
    const fri = new Date(today); fri.setDate(fri.getDate() - 1);
    skipDay = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate()).getTime();
  } else if (dow === 0) {
    const fri = new Date(today); fri.setDate(fri.getDate() - 2);
    skipDay = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate()).getTime();
  }

  let prev = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = _entryDate(sorted[i]);
    if (d < todayDay && d !== skipDay) { prev = sorted[i]; break; }
  }
  if (!prev) return null;
  return _deltaBetween(vNowTis, nowRates, prev);
}

// Direction arrow for a delta tag — shared by the header tag and the chart's
// timeframe change pill.
function _deltaArrow(up) {
  return up
    ? `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 10V2M6 2L2.5 5.5M6 2l3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2V10M6 10L2.5 6.5M6 10l3.5-3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderDelta(isLive, vNowTis, nowRates, anchorTs, animate) {
  const el = document.getElementById('delta-tag');
  if (!el) return;
  let d;
  if (isLive) {
    d = computeDelta(vNowTis, nowRates);
  } else {
    if (!window.PRICE_HISTORY || !anchorTs) { el.hidden = true; return; }
    const cutoff = new Date(anchorTs).getTime();
    const sorted = [...PRICE_HISTORY].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    let prev = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (new Date(sorted[i].ts).getTime() < cutoff) { prev = sorted[i]; break; }
    }
    if (!prev) { el.hidden = true; return; }
    d = _deltaBetween(vNowTis, nowRates, prev);
  }
  if (!d) { el.hidden = true; return; }
  const pos = d.pct >= 0;

  el.innerHTML = _deltaArrow(pos);
  const pctEl = document.createElement('span');
  const absEl = document.createElement('span');
  absEl.className = 'delta-abs';
  el.append(pctEl, absEl);
  el.className = 'delta ' + (pos ? 'pos' : 'neg');
  el.hidden = false;

  const sign = pos ? '+' : '-';
  // d.abs is already in the display currency — _deltaBetween converted both
  // sides. The sign leads, so the symbol goes inside it: "+€1 234".
  const signed = (v) => sign + withCurrency(fmtGrouped(v));
  if (animate) {
    animateNumber(pctEl, 0, Math.abs(d.pct), DURATIONS.TOTAL, v => sign + fmtPct(v, 2));
    animateNumber(absEl, 0, Math.abs(d.abs), DURATIONS.TOTAL, v => '· ' + signed(v));
  } else {
    pctEl.textContent = sign + fmtPct(Math.abs(d.pct), 2);
    absEl.textContent = '· ' + signed(Math.abs(d.abs));
  }
}

// ── Render ──────────────────────────────────────────────────────────────────
// Animation anchors, held in display-currency units so a re-render animates
// from what is on screen rather than from a value in the previous currency.
let _lastRenderTotal = 0;
let _lastDonutAssetTis = 0;
let _lastDonutBrokerTis = 0;

// The value the header is currently showing, kept so the history chart can end
// on it instead of on the last saved snapshot. Null while a past date is
// anchored — that view is history, and it has no "now" to plot.
let _liveSnapshot = null;

// Derive all portfolio values from raw prices + assets. Pure — no DOM.
function _computePortfolio(p, a) {
  const EUR_CZK = p.rates.EUR_CZK;
  const USD_CZK = p.rates.USD_CZK;
  const FWRA_PX  = (p.prices.FWRA_EUR  || 0) * EUR_CZK;
  const AVWS_PX  = (p.prices.AVWS_EUR  || 0) * EUR_CZK;
  const SPYY_PX  = (p.prices.SPYY_EUR  || 0) * EUR_CZK;
  const S_PX     = (p.prices.S_USD     || 0) * USD_CZK;
  const IB1T_PX  = (p.prices.IB1T_EUR  || 0) * EUR_CZK;

  const fwra_total  = (a.fwra.holdings.t212 || 0) + (a.fwra.holdings.ibkr || 0) + (a.fwra.holdings.rev || 0);
  const avws_total  = (a.avws.holdings.t212 || 0) + (a.avws.holdings.ibkr || 0);
  const spyy_total  = (a.spyy.holdings.t212 || 0) + (a.spyy.holdings.ibkr || 0);
  const s_ibkr      =  a.s.holdings.ibkr    || 0;
  const s_etrade    =  a.s.holdings.etrade  || 0;
  const s_total     =  s_ibkr + s_etrade;
  const ib1t_total  =  a.ib1t.holdings.ibkr || 0;

  const ch = a.cash.holdings;
  const cashIBKR = ((ch.ibkr_czk||0) + (ch.ibkr_eur||0) * EUR_CZK + (ch.ibkr_usd||0) * USD_CZK) / 1000;
  const cashT212 = ((ch.t212_czk||0) + (ch.t212_eur||0) * EUR_CZK + (ch.t212_usd||0) * USD_CZK) / 1000;
  const cashRev  = ((ch.rev_czk||0)  + (ch.rev_eur||0)  * EUR_CZK + (ch.rev_usd||0)  * USD_CZK) / 1000;

  const vFWRA  = fwra_total  * FWRA_PX  / 1000;
  const vAVWS  = avws_total  * AVWS_PX  / 1000;
  const vSPYY  = spyy_total  * SPYY_PX  / 1000;
  const vS     = s_total     * S_PX     / 1000;
  const vIB1T  = ib1t_total  * IB1T_PX  / 1000;
  const vAlpha = a.alpha.fixedCzk;
  const vCash  = cashIBKR + cashT212 + cashRev;
  const totalTis = vFWRA + vAVWS + vSPYY + vS + vIB1T + vAlpha + vCash;

  const avws_t212 = (a.avws.holdings.t212 || 0) * AVWS_PX / 1000;
  const avws_ibkr = (a.avws.holdings.ibkr || 0) * AVWS_PX / 1000;
  const spyy_t212 = (a.spyy.holdings.t212 || 0) * SPYY_PX / 1000;
  const spyy_ibkr = (a.spyy.holdings.ibkr || 0) * SPYY_PX / 1000;
  const bT212   = (a.fwra.holdings.t212 || 0) * FWRA_PX / 1000 + avws_t212 + spyy_t212 + vAlpha + cashT212;
  const bIBKR   = (a.fwra.holdings.ibkr || 0) * FWRA_PX / 1000 + avws_ibkr + spyy_ibkr + s_ibkr * S_PX / 1000 + vIB1T + cashIBKR;
  const bRev    = (a.fwra.holdings.rev  || 0) * FWRA_PX / 1000 + cashRev;
  const bEtrade = s_etrade * S_PX / 1000;

  return {
    EUR_CZK, USD_CZK, FWRA_PX, AVWS_PX, SPYY_PX, S_PX, IB1T_PX,
    fwra_total, avws_total, spyy_total, s_total, ib1t_total,
    vFWRA, vAVWS, vSPYY, vS, vIB1T, vAlpha, vCash,
    totalTis, totalCzk: totalTis * 1000,
    bT212, bIBKR, bRev, bEtrade,
  };
}

function _renderHeaderTotal(totalCzk, animate) {
  const totalEl = document.getElementById('total-value');
  const total = toDisplay(totalCzk);
  if (animate) {
    animateNumber(totalEl, _lastRenderTotal, total, DURATIONS.TOTAL, (v) => fmtGrouped(v));
  } else {
    totalEl.textContent = fmtGrouped(total);
  }
  _lastRenderTotal = total;
}

function _buildAllocRow(item, totalTis, includeShares) {
  const row = document.createElement('div');
  row.className = 'alloc-row';
  const pct = (item.value / totalTis * 100).toFixed(1);
  // Assets donut shows a share count; entries without one (Stocks, Cash) get an
  // em-dash, matching the assets table. Brokers donut has no QTY column at all.
  const pcs = includeShares ? (item.shares != null ? fmtShares(item.shares) : '—') : '';
  // Safe DOM — no innerHTML with external values.
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = item.color;
  dot.style.boxShadow = glowShadow(item.color);
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = item.label;
  const pctEl = document.createElement('span');
  pctEl.className = 'pct';
  pctEl.textContent = fmtPct(parseFloat(pct), 1);
  const pcsEl = document.createElement('span');
  pcsEl.className = 'pcs';
  pcsEl.textContent = pcs;
  const val = document.createElement('span');
  val.className = 'val';
  val.textContent = fmtTisMoney(item.value);
  row.append(dot, name, pctEl, pcsEl, val);
  return row;
}

// Donut centre — takes a value in thousands of the display currency and picks
// its own unit: a portfolio worth 5.42M CZK is only ~0.22M EUR, where a fixed
// "M" suffix would read as noise. The unit follows the target value so it stays
// stable for the whole animation.
function _animateDonutCenter(centerEl, fromTis, toTis, animate) {
  const useM = Math.abs(toTis) >= 1000;
  const unit = useM ? LANG.million : LANG.thousand;
  const dec  = useM ? 2 : 0;
  const format = (v) => {
    if (!Number.isFinite(v)) return '—';
    const scaled = useM ? v / 1000 : v;
    const s = scaled.toLocaleString(_loc(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return `${s}<span class="donut-suffix">${unit}</span>`;
  };
  if (animate) {
    animateNumber(centerEl, fromTis, toTis, DURATIONS.DONUT, format, { html: true });
  } else {
    centerEl.innerHTML = format(toTis);
  }
}

function _renderDonut({ svgId, listId, centerId, items, totalTis, includeShares, lastTotalTis, animate, staticCount }) {
  const svg = document.getElementById(svgId);
  const paths = drawDonut(svg, items, { animate });

  const list = document.getElementById(listId);
  list.innerHTML = '';
  const rows = items.map((item) => {
    const row = _buildAllocRow(item, totalTis, includeShares);
    list.appendChild(row);
    return row;
  });
  linkDonutLegend(paths, rows);

  if (staticCount != null) {
    document.getElementById(centerId).textContent = staticCount;
    return 0;
  }

  const targetTis = toDisplay(totalTis);
  _animateDonutCenter(document.getElementById(centerId), lastTotalTis, targetTis, animate);
  return targetTis;
}

function _renderPriceTable(p, a, ctx, anchorTs) {
  const { vFWRA, vAVWS, vSPYY, vS, vIB1T, vAlpha, vCash, fwra_total, avws_total, spyy_total, s_total, ib1t_total } = ctx;
  const ch = a.cash.holdings;
  const totalCashCzk = (ch.ibkr_czk||0) + (ch.t212_czk||0) + (ch.rev_czk||0);
  const totalCashEur = (ch.ibkr_eur||0) + (ch.t212_eur||0) + (ch.rev_eur||0);
  const totalCashUsd = (ch.ibkr_usd||0) + (ch.t212_usd||0) + (ch.rev_usd||0);
  const cashQty = [
    totalCashCzk ? fmtCashK(totalCashCzk, 'CZK') : null,
    totalCashEur ? fmtCashK(totalCashEur, 'EUR') : null,
    totalCashUsd ? fmtCashK(totalCashUsd, 'USD') : null,
  ].filter(Boolean).join(' · ');
  const priceRows = [
    { _v: vFWRA,  key: 'fwra',  color: 'var(--fwra)',
      ticker: a.fwra.ticker, name: a.fwra.name, url: a.fwra.yahooUrl,
      price: p.prices.FWRA_EUR ? `€${fmtNum(p.prices.FWRA_EUR, 2)}` : '—',
      qty: fmtShares(fwra_total),
      valCzk: vFWRA * 1000 },
    { _v: vAVWS,  key: 'avws',  color: 'var(--avws)',
      ticker: a.avws.ticker, name: a.avws.name, url: a.avws.yahooUrl,
      price: p.prices.AVWS_EUR ? `€${fmtNum(p.prices.AVWS_EUR, 2)}` : '—',
      qty: fmtShares(avws_total),
      valCzk: vAVWS * 1000 },
    { _v: vSPYY,  key: 'spyy',  color: 'var(--spyy)',
      ticker: a.spyy.ticker, name: a.spyy.name, url: a.spyy.yahooUrl,
      price: p.prices.SPYY_EUR ? `€${fmtNum(p.prices.SPYY_EUR, 2)}` : '—',
      qty: fmtShares(spyy_total),
      valCzk: vSPYY * 1000 },
    { _v: vS,     key: 's',     color: 'var(--s)',
      ticker: a.s.ticker, name: a.s.name, url: a.s.yahooUrl,
      price: p.prices.S_USD ? `$${fmtNum(p.prices.S_USD, 2)}` : '—',
      qty: fmtShares(s_total),
      valCzk: vS * 1000 },
    { _v: vIB1T,  key: 'ib1t',  color: 'var(--ib1t)',
      ticker: a.ib1t.ticker, name: a.ib1t.name, url: a.ib1t.yahooUrl,
      price: p.prices.IB1T_EUR ? `€${fmtNum(p.prices.IB1T_EUR, 2)}` : '—',
      qty: fmtShares(ib1t_total),
      valCzk: vIB1T * 1000 },
    { _v: vAlpha, key: 'alpha', color: 'var(--alpha)',
      ticker: a.alpha.ticker, name: a.alpha.name, url: a.alpha.yahooUrl,
      price: LANG.fixed, qty: '—',
      valCzk: vAlpha * 1000 },
    ...(vCash > 0 ? [{ _v: vCash, key: 'cash', color: 'var(--cash)',
      ticker: a.cash.ticker, name: a.cash.name, url: null,
      price: '—', qty: cashQty,
      valCzk: vCash * 1000 }] : []),
  ].filter(r => r._v > 0).sort((x, y) => {
    if (x.key === 'cash') return 1;
    if (y.key === 'cash') return -1;
    return y._v - x._v;
  });

  const tb = document.getElementById('tbl-prices');
  tb.innerHTML = '';
  const POS = 'oklch(0.82 0.18 150)';
  const NEG = 'oklch(0.72 0.2 25)';
  const NEUTRAL = 'oklch(0.55 0.01 260)';

  priceRows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'trow';

    // Ticker cell — build with DOM APIs so url/ticker/name can never break out.
    const tickCell = document.createElement('div');
    tickCell.className = 'tick-cell';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = r.color;
    dot.style.boxShadow = glowShadow(r.color);
    tickCell.appendChild(dot);
    const tickSpan = document.createElement('span');
    tickSpan.className = 'tick';
    tickSpan.textContent = r.ticker;
    if (r.url) {
      const link = document.createElement('a');
      link.href = r.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.appendChild(tickSpan);
      tickCell.appendChild(link);
    } else {
      tickCell.appendChild(tickSpan);
    }
    if (r.name) {
      const nameSpan = document.createElement('span');
      nameSpan.className = 'asset-name';
      nameSpan.textContent = r.name;
      tickCell.appendChild(nameSpan);
    }
    row.appendChild(tickCell);

    const priceCell = document.createElement('div');
    priceCell.className = 'num';
    priceCell.textContent = r.price;
    row.appendChild(priceCell);

    const qtyCell = document.createElement('div');
    qtyCell.className = 'num muted';
    qtyCell.textContent = r.qty;
    row.appendChild(qtyCell);

    const sparkCell = document.createElement('div');
    sparkCell.className = 'num spark-cell';
    const series = priceSeriesForAsset(r.key, PRICE_WINDOW_DAYS, anchorTs);
    const color = series.deltaPct == null
      ? NEUTRAL
      : (series.deltaPct >= 0 ? POS : NEG);
    sparkCell.appendChild(buildSparkline(series.series, color));
    row.appendChild(sparkCell);

    const valCell = document.createElement('div');
    valCell.className = 'num';
    const valFull = document.createElement('span');
    valFull.className = 'val-full';
    valFull.textContent = withCurrency(fmtMoney(r.valCzk));
    const valTis = document.createElement('span');
    valTis.className = 'val-tis';
    const _tis = r.valCzk / 1000;
    valTis.textContent = fmtTisMoney(_tis);
    valCell.append(valFull, valTis);
    row.appendChild(valCell);

    tb.appendChild(row);
  });
}

function _renderFooter(p) {
  const footer = document.getElementById('footer-info');
  if (!footer) return;
  let updatedStr = '—';
  if (p._rawTs) {
    const d = new Date(p._rawTs);
    updatedStr = fmtDateTime(d);
  }
  footer.innerHTML = '';
  const mkSpan = (text, cls) => {
    const el = document.createElement('span');
    if (cls) el.className = cls;
    el.textContent = text;
    return el;
  };
  footer.append(mkSpan(`${LANG.updated} · ${updatedStr}`));
  // Quote the rates against the display currency — these are the numbers the
  // values on screen were actually converted with. Small rates carry the same
  // information in fewer significant digits (CZK/EUR 0.0414, EUR/USD 1.1368),
  // so they get more decimals than the ~24 of a CZK pair.
  fxPairs(p.rates).forEach(({ base, quote, value }) => {
    const dec = value != null && Math.abs(value) < 10 ? 4 : 2;
    footer.append(
      mkSpan('·', 'sep'),
      mkSpan(`${base}/${quote} ${fmtNum(value, dec)}`, 'rate'),
    );
  });
}

function render(p, a, { animate = true, isLive = true, anchorTs = null } = {}) {
  document.title = 'Wealth Lens';
  const ctx = _computePortfolio(p, a);

  // Everything below formats CZK through toDisplay(); anchor it to the rates of
  // the snapshot being rendered — live for "Now", the entry's own for history.
  setActiveRates(p.rates);

  _renderHeaderTotal(ctx.totalCzk, animate);
  renderDelta(isLive, ctx.totalTis, p.rates, anchorTs, animate);

  // Read by drawHistoryChart, which every caller runs right after this.
  _liveSnapshot = isLive
    ? { ts: p._rawTs ? new Date(p._rawTs).getTime() : Date.now(), tisCzk: ctx.totalTis, rates: p.rates }
    : null;

  const assetItems = [
    { key: 'fwra',  value: ctx.vFWRA,  color: 'var(--fwra)',  label: 'FWRA',  shares: ctx.fwra_total },
    { key: 'avws',  value: ctx.vAVWS,  color: 'var(--avws)',  label: 'AVWS',  shares: ctx.avws_total },
    { key: 'spyy',  value: ctx.vSPYY,  color: 'var(--spyy)',  label: 'SPYY',  shares: ctx.spyy_total },
    { key: 'alpha', value: ctx.vAlpha, color: 'var(--alpha)', label: 'Stocks', shares: null },
    { key: 's',     value: ctx.vS,     color: 'var(--s)',     label: 'S',     shares: ctx.s_total },
    { key: 'ib1t',  value: ctx.vIB1T,  color: 'var(--ib1t)',  label: 'IB1T',  shares: ctx.ib1t_total },
    ...(ctx.vCash > 0 ? [{ key: 'cash', value: ctx.vCash, color: 'var(--cash)', label: 'Cash', shares: null }] : []),
  ].filter(x => x.value > 0).sort((x, y) => {
    if (x.key === 'cash') return 1;
    if (y.key === 'cash') return -1;
    return y.value - x.value;
  });

  _lastDonutAssetTis = _renderDonut({
    svgId: 'donut-assets', listId: 'list-assets', centerId: 'center-assets',
    items: assetItems, totalTis: ctx.totalTis, includeShares: true,
    lastTotalTis: _lastDonutAssetTis, animate,
  });

  const brokerItems = [
    { value: ctx.bT212,   color: 'var(--t212)',   label: 'T212' },
    { value: ctx.bIBKR,   color: 'var(--ibkr)',   label: 'IBKR' },
    { value: ctx.bRev,    color: 'var(--rev)',    label: 'Revolut' },
    { value: ctx.bEtrade, color: 'var(--etrade)', label: 'Etrade' },
  ].sort((x, y) => y.value - x.value);

  _lastDonutBrokerTis = _renderDonut({
    svgId: 'donut-brokers', listId: 'list-brokers', centerId: 'center-brokers',
    items: brokerItems, totalTis: ctx.totalTis, includeShares: false,
    lastTotalTis: _lastDonutBrokerTis, animate,
    staticCount: brokerItems.filter(b => b.value > 0).length,
  });

  _renderPriceTable(p, a, ctx, anchorTs);
  _renderFooter(p);
  document.dispatchEvent(new CustomEvent('wl:render', { detail: { totalCzk: ctx.totalCzk } }));
}

// ── History entries helpers (used by calendar.js) ───────────────────────────
function buildPricesFromEntry(entry) {
  return { _rawTs: entry.ts, rates: entry.rates, prices: entry.prices };
}

function buildAssetsFromEntry(entry) {
  if (!entry.assets) return ASSETS;
  const result = {};
  for (const key of Object.keys(ASSETS)) {
    result[key] = { ...ASSETS[key] };
    if (entry.assets[key]) {
      if (key === 'alpha') {
        result[key].fixedCzk = entry.assets[key].fixedCzk ?? ASSETS[key].fixedCzk;
      } else {
        result[key].holdings = entry.assets[key];
      }
    } else {
      // Asset missing from this entry means it wasn't held (or tracked) then — show zero.
      // Don't fall back to current holdings; that would project today's state onto past dates.
      if (key === 'alpha') {
        result[key].fixedCzk = 0;
      } else {
        result[key] = { ...ASSETS[key], holdings: {} };
      }
    }
  }
  return result;
}

// Attach live prices timestamp/rates for footer formatting
function decorateLivePrices(prices) {
  if (!prices) return prices;
  if (!prices._rawTs) {
    prices._rawTs = new Date().toISOString();
  }
  return prices;
}

// ── Portfolio history chart ─────────────────────────────────────────────────
const _TF_LIST = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'MAX'];
let _currentTf = 'MAX';
let _chartDrawProgress = 1;
let _chartAnimRaf = null;
let _lastChartDrawTs = 0;

function _niceYTicks(min, max) {
  const range = max - min || 1;
  const rough = range / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice = [1, 2, 2.5, 5, 10].find(f => f * pow >= rough) * pow;
  const niceMin = Math.floor(min / nice) * nice;
  const niceMax = Math.ceil(max / nice) * nice;
  const ticks = [];
  for (let t = niceMin; t <= niceMax + nice * 0.01; t += nice) ticks.push(parseFloat(t.toFixed(10)));
  return ticks;
}

function _xLabel(ts, rangeDays) {
  const d = new Date(ts);
  const tz = { timeZone: 'Europe/Prague' };
  if (rangeDays <= 60) {
    const raw = d.toLocaleDateString('cs-CZ', { ...tz, day: 'numeric', month: 'numeric' });
    const [day, mon] = raw.replace(/\s/g, '').split('.').filter(Boolean);
    return LANG.locale === 'cs' ? `${day}.${mon}.` : `${mon}/${day}`;
  }
  const loc = _dateLoc();
  if (rangeDays <= 200) return d.toLocaleDateString(loc, { ...tz, month: 'short' });
  return d.toLocaleDateString(loc, { ...tz, month: 'short', year: '2-digit' });
}

function _businessDaysList(minTs, maxTs) {
  const bds = [];
  const d = new Date(minTs); d.setHours(0, 0, 0, 0);
  const endMidnight = new Date(maxTs); endMidnight.setHours(23, 59, 59, 999);
  while (d <= endMidnight) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) bds.push(d.getTime());
    d.setDate(d.getDate() + 1);
  }
  return bds;
}

function initHistoryChart() {
  const btnsEl = document.getElementById('timeframe-btns');
  btnsEl.innerHTML = '';
  const buttons = _TF_LIST.map(tf => {
    const btn = document.createElement('button');
    btn.className = (tf === _currentTf ? 'active' : '');
    btn.textContent = tf;
    btn.dataset.tf = tf;
    btn.setAttribute('aria-label', `Timeframe: ${tf}`);
    btnsEl.appendChild(btn);
    return btn;
  });
  // Event delegation + cached button list — no per-click query.
  btnsEl.addEventListener('click', (e) => {
    const target = e.target.closest('button[data-tf]');
    if (!target) return;
    _currentTf = target.dataset.tf;
    buttons.forEach(b => b.classList.toggle('active', b.dataset.tf === _currentTf));
    drawHistoryChart(_currentTf, { animate: true });
  });
  drawHistoryChart(_currentTf, { animate: true });

  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (Date.now() - _lastChartDrawTs < 100) return;
      drawHistoryChart(_currentTf, { animate: false });
    }).observe(document.getElementById('chart-wrap'));
  }
}

// The live header value as a chart point, or null while a past date is anchored
// — that view is history, and it has no "now" to plot.
//
// The x axis is built from business days, so a weekend read is positioned on
// the Friday it actually reflects: markets are shut, so the live value *is*
// Friday's close, and it supersedes that day's mid-session snapshot. `xTs`
// carries that placement while `ts` keeps the real read time for the tooltip.
function _liveChartPoint() {
  if (!_liveSnapshot) return null;
  const value = toDisplay(_liveSnapshot.tisCzk, _liveSnapshot.rates);
  if (!Number.isFinite(value)) return null;
  return { ts: _liveSnapshot.ts, xTs: _lastBusinessDay(_liveSnapshot.ts), value };
}

// Rolls a weekend timestamp back to the Friday whose close it reflects.
function _lastBusinessDay(ts) {
  const d = new Date(ts);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1);
  else if (dow === 0) d.setDate(d.getDate() - 2);
  return d.getTime();
}

// Ends the plotted series on the live value rather than on the last saved
// snapshot. A snapshot from today is superseded rather than drawn alongside —
// two points on one calendar day share an x position, which would show up as a
// vertical spike at the right edge.
function _withLivePoint(data) {
  const live = _liveChartPoint();
  if (!live) return data;
  const last = data[data.length - 1];
  const liveDay = _dayStart(live.xTs);
  // A stored point newer than the live read — clock skew, or a snapshot saved
  // after the last render — wins, rather than drawing the series backwards.
  if (last && last.ts > live.ts && _dayStart(last.ts) !== liveDay) return data;
  return [...data.filter(d => _dayStart(d.ts) !== liveDay), live];
}

// Direction of the change across a plotted range: 'pos' | 'neg' | 'flat'.
// Measured on the rounded amount, so a change that rounds away on screen reads
// as flat rather than as a signed move. Drives both the indicator and the
// curve's color, keeping the two from ever disagreeing.
function _rangeDirection(data) {
  if (!data || data.length < 2) return 'flat';
  const rounded = Math.round((data[data.length - 1].value - data[0].value) * 1000);
  return rounded > 0 ? 'pos' : rounded < 0 ? 'neg' : 'flat';
}

// The curve is the accent green while the range is up or flat, and the loss red
// when it is down — the same red as the indicator and the negative sparklines.
function _rangeColor(dir) {
  return dir === 'neg' ? 'var(--neg)' : 'var(--accent)';
}

// Portfolio value change across the plotted range: the absolute change as the
// headline number, the percentage as a color-coded tag. Endpoints are the first
// and last points actually drawn, so a timeframe reaching past our history
// starts at the earliest entry we have rather than showing nothing.
function _renderChartChange(data, animate) {
  // Tooltip color lives here rather than beside the drawing code so it is set
  // on every path — including the ones that bail out before a chart is drawn,
  // which would otherwise leave the previous range's color behind.
  const tooltip = document.getElementById('chart-tooltip');
  if (tooltip) tooltip.classList.toggle('neg', _rangeDirection(data) === 'neg');

  const el = document.getElementById('chart-change');
  if (!el) return;
  if (!data || data.length < 2) { el.hidden = true; return; }

  const first = data[0].value, last = data[data.length - 1].value;
  // Chart values are in thousands (see _calcPortfolioValue); the headline is a
  // plain amount, like the header total.
  const abs = (last - first) * 1000;
  const pct = first ? ((last - first) / first) * 100 : 0;

  // The sign always matches the digits on screen — a change that rounds away
  // reads as flat, never as "-0".
  const dir = _rangeDirection(data);
  const sign = dir === 'pos' ? '+' : dir === 'neg' ? '-' : '';

  el.className = 'chart-change ' + dir;
  el.hidden = false;

  const valEl = document.getElementById('chart-change-value');
  const tagEl = document.getElementById('chart-change-delta');
  tagEl.className = 'delta ' + dir;
  tagEl.innerHTML = dir === 'flat' ? '' : _deltaArrow(dir === 'pos');
  const pctEl = document.createElement('span');
  tagEl.appendChild(pctEl);

  if (animate) {
    animateNumber(valEl, 0, Math.abs(abs), DURATIONS.TOTAL, v => sign + fmtGrouped(v));
    animateNumber(pctEl, 0, Math.abs(pct), DURATIONS.TOTAL, v => sign + fmtPct(v, 2));
  } else {
    valEl.textContent = sign + fmtGrouped(Math.abs(abs));
    pctEl.textContent = sign + fmtPct(Math.abs(pct), 2);
  }
}

function drawHistoryChart(tf, { animate = true } = {}) {
  _lastChartDrawTs = Date.now();
  const svgEl = document.getElementById('chart-history');
  if (!svgEl) return;
  svgEl.innerHTML = '';

  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) { _renderChartChange(null); return; }

  const all = [...PRICE_HISTORY].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const now = Date.now();
  let pts;
  if (tf === 'MAX') {
    pts = all;
  } else if (tf === 'YTD') {
    const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
    pts = all.filter(e => new Date(e.ts).getTime() >= jan1);
  } else {
    const days = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[tf];
    const cutoffDate = new Date(now - days * 86400000);
    cutoffDate.setHours(0, 0, 0, 0);
    const dow = cutoffDate.getDay();
    if (dow === 6) cutoffDate.setDate(cutoffDate.getDate() - 1);
    if (dow === 0) cutoffDate.setDate(cutoffDate.getDate() - 2);
    pts = all.filter(e => new Date(e.ts).getTime() >= cutoffDate.getTime());
  }

  // Each point converts with the FX rates stored for its own day, so the curve
  // shows what the portfolio was worth in the display currency back then — not
  // the past re-priced at today's rate.
  const stored = pts
    .map(e => ({ ts: new Date(e.ts).getTime(), value: toDisplay(_calcPortfolioValue(e), e.rates) }))
    .filter(d => Number.isFinite(d.value))
    .filter(d => { const dow = new Date(d.ts).getDay(); return dow !== 0 && dow !== 6; });

  // The curve — and so the change indicator, which reads its endpoints — ends
  // on the live header value rather than on the newest stored snapshot.
  const data = _withLivePoint(stored);

  _renderChartChange(data, animate);
  // Every stroke and fill below follows the range direction, so a losing period
  // reads red end to end instead of a red headline over a green curve.
  const rangeColor = _rangeColor(_rangeDirection(data));

  const wrap = document.getElementById('chart-wrap');
  const W = wrap.offsetWidth || 800;
  const H = wrap.offsetHeight || 240;
  const pL = 4, pR = 38, pT = 18, pB = 28;
  const cW = W - pL - pR, cH = H - pT - pB;
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

  if (data.length < 2) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', (W / 2).toString()); t.setAttribute('y', (H / 2).toString());
    t.setAttribute('dominant-baseline', 'middle'); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', 'var(--text-2)'); t.setAttribute('font-size', '12');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.textContent = LANG.noData;
    svgEl.appendChild(t);
    return;
  }

  const minTs = data[0].ts, maxTs = data[data.length - 1].ts;
  const vals = data.map(d => d.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const pad = (maxV - minV) * 0.1 || 10;
  const yTicks = _niceYTicks(minV - pad, maxV + pad);
  const yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
  const yRange = yMax - yMin || 1;

  const hPadR = 18;
  const bdList = _businessDaysList(minTs, maxTs);
  const bdSpan = Math.max(bdList.length - 1, 1);
  const sxBd = ts => {
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    const idx = bdList.indexOf(d.getTime());
    return pL + (idx >= 0 ? idx : 0) / bdSpan * (cW - hPadR);
  };
  const sy = v => pT + cH - (v - yMin) / yRange * cH;
  // Stored points sit on their own day; the live point may carry an `xTs` that
  // places a weekend read on the Friday it reflects.
  const sp = data.map(d => ({ x: sxBd(d.xTs ?? d.ts), y: sy(d.value), ts: d.ts, value: d.value }));

  // ── Defs: gradient + glow ────────────────────────────────────────────────
  const defs = document.createElementNS(SVG_NS, 'defs');
  const gradId = 'hchart-grad-' + Math.random().toString(36).slice(2, 7);
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', pT.toString());
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', (pT + cH).toString());
  const s1 = document.createElementNS(SVG_NS, 'stop');
  s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', rangeColor); s1.setAttribute('stop-opacity', '0.28');
  const s2 = document.createElementNS(SVG_NS, 'stop');
  s2.setAttribute('offset', '60%'); s2.setAttribute('stop-color', rangeColor); s2.setAttribute('stop-opacity', '0.06');
  const s3 = document.createElementNS(SVG_NS, 'stop');
  s3.setAttribute('offset', '100%'); s3.setAttribute('stop-color', rangeColor); s3.setAttribute('stop-opacity', '0');
  grad.appendChild(s1); grad.appendChild(s2); grad.appendChild(s3); defs.appendChild(grad);

  const filterId = 'chart-glow-' + Math.random().toString(36).slice(2, 7);
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', filterId);
  filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('stdDeviation', '2'); blur.setAttribute('result', 'b');
  const merge = document.createElementNS(SVG_NS, 'feMerge');
  const m1 = document.createElementNS(SVG_NS, 'feMergeNode'); m1.setAttribute('in', 'b');
  const m2 = document.createElementNS(SVG_NS, 'feMergeNode'); m2.setAttribute('in', 'SourceGraphic');
  merge.appendChild(m1); merge.appendChild(m2); filter.appendChild(blur); filter.appendChild(merge);
  defs.appendChild(filter);
  svgEl.appendChild(defs);

  // ── Grid ─────────────────────────────────────────────────────────────────
  yTicks.forEach(tick => {
    const y = sy(tick);
    if (y < pT - 2 || y > pT + cH + 2) return;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', pL); line.setAttribute('y1', y.toFixed(1));
    line.setAttribute('x2', W - 2); line.setAttribute('y2', y.toFixed(1));
    line.setAttribute('stroke', 'currentColor'); line.setAttribute('stroke-opacity', '0.06');
    line.setAttribute('stroke-dasharray', '2 4');
    svgEl.appendChild(line);
  });

  // ── Line + area ──────────────────────────────────────────────────────────
  const baseY = pT + cH;
  const linePts = sp.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  const areaD = linePts + ` L ${sp[sp.length - 1].x.toFixed(1)} ${baseY} L ${sp[0].x.toFixed(1)} ${baseY} Z`;

  const area = document.createElementNS(SVG_NS, 'path');
  area.setAttribute('d', areaD); area.setAttribute('fill', `url(#${gradId})`);
  svgEl.appendChild(area);

  // Approximate line length
  let pathLen = 0;
  for (let i = 1; i < sp.length; i++) {
    const dx = sp[i].x - sp[i-1].x, dy = sp[i].y - sp[i-1].y;
    pathLen += Math.sqrt(dx*dx + dy*dy);
  }

  const lineEl = document.createElementNS(SVG_NS, 'path');
  lineEl.setAttribute('d', linePts); lineEl.setAttribute('fill', 'none');
  lineEl.setAttribute('stroke', rangeColor); lineEl.setAttribute('stroke-width', '1.8');
  lineEl.setAttribute('stroke-linecap', 'round'); lineEl.setAttribute('stroke-linejoin', 'round');
  lineEl.setAttribute('filter', `url(#${filterId})`);
  lineEl.setAttribute('stroke-dasharray', pathLen);
  svgEl.appendChild(lineEl);

  // ── End-dot (will appear after line draw) ────────────────────────────────
  const lastSp = sp[sp.length - 1];
  const endRing = document.createElementNS(SVG_NS, 'circle');
  endRing.setAttribute('cx', lastSp.x.toFixed(1));
  endRing.setAttribute('cy', lastSp.y.toFixed(1));
  endRing.setAttribute('r', '5'); endRing.setAttribute('fill', rangeColor);
  endRing.setAttribute('filter', `url(#${filterId})`);
  endRing.style.opacity = '0';
  const anim1 = document.createElementNS(SVG_NS, 'animate');
  anim1.setAttribute('attributeName', 'r'); anim1.setAttribute('values', '5;8;5'); anim1.setAttribute('dur', '2s'); anim1.setAttribute('repeatCount', 'indefinite');
  const anim2 = document.createElementNS(SVG_NS, 'animate');
  anim2.setAttribute('attributeName', 'opacity'); anim2.setAttribute('values', '1;0.3;1'); anim2.setAttribute('dur', '2s'); anim2.setAttribute('repeatCount', 'indefinite');
  endRing.appendChild(anim1); endRing.appendChild(anim2);
  svgEl.appendChild(endRing);

  const endDot = document.createElementNS(SVG_NS, 'circle');
  endDot.setAttribute('cx', lastSp.x.toFixed(1));
  endDot.setAttribute('cy', lastSp.y.toFixed(1));
  endDot.setAttribute('r', '3'); endDot.setAttribute('fill', rangeColor);
  endDot.style.opacity = '0';
  svgEl.appendChild(endDot);

  // Animate
  if (_chartAnimRaf) cancelAnimationFrame(_chartAnimRaf);
  const startT = performance.now();
  const drawTick = (t) => {
    const p = animate ? Math.min(1, (t - startT) / DURATIONS.CHART) : 1;
    const e = 1 - Math.pow(1 - p, 3);
    lineEl.setAttribute('stroke-dashoffset', String(pathLen * (1 - e)));
    area.style.opacity = e;
    if (e >= 0.98) {
      endRing.style.opacity = '1';
      endDot.style.opacity = '1';
    } else {
      endRing.style.opacity = '0';
      endDot.style.opacity = '0';
    }
    if (p < 1) _chartAnimRaf = requestAnimationFrame(drawTick);
  };
  if (animate) {
    area.style.opacity = 0;
    lineEl.setAttribute('stroke-dashoffset', String(pathLen));
    _chartAnimRaf = requestAnimationFrame(drawTick);
  } else {
    lineEl.setAttribute('stroke-dashoffset', '0');
    area.style.opacity = 1;
    endRing.style.opacity = '1';
    endDot.style.opacity = '1';
  }

  // ── Y axis labels ────────────────────────────────────────────────────────
  yTicks.forEach(tick => {
    const y = sy(tick);
    if (y < pT - 2 || y > pT + cH + 2) return;
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', (W - 2).toString()); t.setAttribute('y', y.toFixed(1));
    t.setAttribute('text-anchor', 'end');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', 'currentColor'); t.setAttribute('fill-opacity', '0.4');
    t.setAttribute('font-size', '10');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.textContent = Math.round(tick).toLocaleString(_loc());
    svgEl.appendChild(t);
  });

  // ── X axis labels ────────────────────────────────────────────────────────
  const rangeDays = (maxTs - minTs) / 86400000;
  const tickCount = Math.max(2, Math.min(8, Math.floor(cW / 90), bdList.length));
  for (let i = 0; i < tickCount; i++) {
    const frac = i / (tickCount - 1);
    const x = pL + frac * (cW - hPadR);
    const bdIdx = Math.min(Math.round(frac * bdSpan), bdList.length - 1);
    const ts = bdList[bdIdx];
    const anchor = i === 0 ? 'start' : (i === tickCount - 1 ? 'end' : 'middle');
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', (pT + cH + 17).toString());
    t.setAttribute('text-anchor', anchor);
    t.setAttribute('fill', 'currentColor'); t.setAttribute('fill-opacity', '0.4');
    t.setAttribute('font-size', '10');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.textContent = _xLabel(ts, rangeDays);
    svgEl.appendChild(t);
  }

  // ── Hover ────────────────────────────────────────────────────────────────
  const overlay = document.createElementNS(SVG_NS, 'rect');
  overlay.setAttribute('x', pL); overlay.setAttribute('y', pT);
  overlay.setAttribute('width', cW); overlay.setAttribute('height', cH);
  overlay.setAttribute('fill', 'transparent');
  overlay.style.cursor = 'crosshair';
  svgEl.appendChild(overlay);

  const xhair = document.createElementNS(SVG_NS, 'line');
  xhair.setAttribute('y1', pT); xhair.setAttribute('y2', pT + cH);
  xhair.setAttribute('stroke', rangeColor); xhair.setAttribute('stroke-opacity', '0.3');
  xhair.setAttribute('stroke-dasharray', '3 3'); xhair.style.display = 'none';
  svgEl.appendChild(xhair);

  const hDot = document.createElementNS(SVG_NS, 'circle');
  hDot.setAttribute('r', '5'); hDot.setAttribute('fill', rangeColor);
  hDot.setAttribute('filter', `url(#${filterId})`);
  hDot.style.display = 'none';
  svgEl.appendChild(hDot);

  const hDotInner = document.createElementNS(SVG_NS, 'circle');
  hDotInner.setAttribute('r', '2'); hDotInner.setAttribute('fill', 'var(--bg-0)');
  hDotInner.style.display = 'none';
  svgEl.appendChild(hDotInner);

  const tooltip = document.getElementById('chart-tooltip');

  overlay.addEventListener('mousemove', e => {
    const rect = svgEl.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (W / rect.width);
    let closest = sp[0], minD = Infinity;
    sp.forEach(p => { const d = Math.abs(p.x - mouseX); if (d < minD) { minD = d; closest = p; } });

    xhair.setAttribute('x1', closest.x); xhair.setAttribute('x2', closest.x);
    xhair.style.display = '';
    hDot.setAttribute('cx', closest.x); hDot.setAttribute('cy', closest.y); hDot.style.display = '';
    hDotInner.setAttribute('cx', closest.x); hDotInner.setAttribute('cy', closest.y); hDotInner.style.display = '';

    const d = new Date(closest.ts);
    const tz = { timeZone: 'Europe/Prague' };
    const rawDate = d.toLocaleDateString('cs-CZ', { ...tz, day: 'numeric', month: 'numeric', year: 'numeric' });
    const [dd, mm, yyyy] = rawDate.replace(/\s/g, '').split('.').filter(Boolean);
    let dateStr, timeStr;
    if (LANG.locale === 'cs') {
      dateStr = `${dd}.${mm}.${yyyy}`;
      timeStr = d.toLocaleTimeString('cs-CZ', { ...tz, hour: '2-digit', minute: '2-digit' });
    } else {
      dateStr = `${parseInt(mm)}/${parseInt(dd)}/${yyyy}`;
      timeStr = d.toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit', hour12: true });
    }
    // closest.value is already in the display currency (see `data` above).
    tooltip.innerHTML = `<div class="tip-date">${dateStr} ${timeStr}</div>`
      + `<div class="tip-val">${withCurrency(fmtGrouped(closest.value * 1000))}</div>`;

    const wrapW = wrap.offsetWidth;
    const tipW = tooltip.offsetWidth;
    let leftPx = (closest.x / W) * rect.width;
    leftPx = Math.max(tipW / 2, Math.min(wrapW - tipW / 2, leftPx));
    tooltip.style.left = leftPx + 'px';
    tooltip.style.top = ((closest.y / H) * rect.height - 12) + 'px';
    tooltip.classList.add('visible');
    tooltip.setAttribute('aria-hidden', 'false');
  });

  overlay.addEventListener('mouseleave', () => {
    xhair.style.display = 'none';
    hDot.style.display = 'none';
    hDotInner.style.display = 'none';
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden', 'true');
  });
}
