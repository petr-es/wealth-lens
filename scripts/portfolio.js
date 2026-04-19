// ── Formatting helpers ──────────────────────────────────────────────────────
const NBSP = '\u00a0';
const _loc     = () => LANG.locale === 'cs' ? 'cs-CZ' : 'en-US';
const _dateLoc = () => LANG.locale === 'cs' ? 'cs-CZ' : 'en-GB';

function fmtCzk(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = Math.round(n).toLocaleString(_loc());
  return LANG.locale === 'cs' ? s.replace(/\s/g, NBSP) : s;
}
function fmtPct(n, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = n.toFixed(digits);
  return (LANG.locale === 'cs' ? s.replace('.', ',') : s) + '%';
}
function fmtNum(n, dec = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = n.toFixed(dec);
  return LANG.locale === 'cs' ? s.replace('.', ',') : s;
}
function fmtShares(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = n.toLocaleString(_loc());
  return LANG.locale === 'cs' ? s.replace(/\s/g, NBSP) : s;
}

// ── Number animation ────────────────────────────────────────────────────────
const _animHandles = new WeakMap();

function animateNumber(el, from, to, duration, formatter, { html = false } = {}) {
  if (!el) return;
  const prev = _animHandles.get(el);
  if (prev) cancelAnimationFrame(prev);
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - start) / duration);
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
  const size = 160, thickness = 26, gap = 3;
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
    ring.style.filter = `drop-shadow(0 0 8px ${seg.color}70)`;
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
    const duration = 1100;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
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
function buildSparkline(data, color, { width = 90, height = 22, strokeWidth = 1.3 } = {}) {
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
  if (assetKey === 'spyy') return (entry.prices.SPYY_EUR || 0) * eur;
  if (assetKey === 's')    return (entry.prices.S_USD    || 0) * usd;
  if (assetKey === 'alpha') {
    const a = entry.assets && entry.assets.alpha;
    return a ? (a.fixedCzk || 0) : 0;
  }
  return 0;
}

// Get last N entries' per-unit price series for an asset.
// Returns { series: number[], deltaPct: number|null } — deltaPct is the
// full-window change (first vs last); used for sparkline color.
function priceSeriesForAsset(assetKey, windowDays = 30, anchorTs = null) {
  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) return { series: [], deltaPct: null };
  let sorted = [...PRICE_HISTORY].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  if (anchorTs != null) {
    const cutoff = new Date(anchorTs).getTime();
    sorted = sorted.filter(e => new Date(e.ts).getTime() <= cutoff);
  }
  const slice = sorted.slice(-windowDays);
  const series = slice.map(e => _pricePerUnit(e, assetKey)).filter(v => Number.isFinite(v));
  if (series.length < 2) return { series, deltaPct: null };
  const first = series[0], last = series[series.length - 1];
  const deltaPct = first > 0 ? ((last - first) / first) * 100 : null;
  return { series, deltaPct };
}

// ── Portfolio value calc ────────────────────────────────────────────────────
function _calcPortfolioValue(entry) {
  const EUR = entry.rates.EUR_CZK || 0;
  const USD = entry.rates.USD_CZK || 0;
  const F = (entry.prices.FWRA_EUR || 0) * EUR;
  const P = (entry.prices.SPYY_EUR || 0) * EUR;
  const S = (entry.prices.S_USD    || 0) * USD;
  const a = entry.assets || {};
  const fh = a.fwra || {}, ph = a.spyy || {}, sh = a.s || {};
  const alpha = a.alpha ? (a.alpha.fixedCzk || 0) : 0;
  return ((fh.t212||0)+(fh.ibkr||0)+(fh.rev||0)) * F / 1000
       + (ph.t212||0) * P / 1000
       + ((sh.ibkr||0)+(sh.etrade||0)) * S / 1000
       + alpha;
}

// ── Delta tag: latest vs most recent entry on a different calendar date ─────
function _entryDate(entry) {
  const d = new Date(entry.ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Compute delta of now (live value in tis. Kč) vs the most recent history
// entry on a calendar day strictly before today's (Europe/Prague) date.
// On weekends the latest history entry is typically Friday; walking back to
// a different calendar day naturally lands on Thursday, matching the spec.
function computeDelta(vNowTis) {
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
  const vPrev = _calcPortfolioValue(prev);
  if (!vPrev) return null;
  const abs = (vNowTis - vPrev) * 1000;
  const pct = ((vNowTis - vPrev) / vPrev) * 100;
  return { pct, abs };
}

function renderDelta(isLive, vNowTis, anchorTs) {
  const el = document.getElementById('delta-tag');
  if (!el) return;
  let d;
  if (isLive) {
    d = computeDelta(vNowTis);
  } else {
    if (!window.PRICE_HISTORY || !anchorTs) { el.hidden = true; return; }
    const cutoff = new Date(anchorTs).getTime();
    const sorted = [...PRICE_HISTORY].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    let prev = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (new Date(sorted[i].ts).getTime() < cutoff) { prev = sorted[i]; break; }
    }
    if (!prev) { el.hidden = true; return; }
    const vPrev = _calcPortfolioValue(prev);
    if (!vPrev) { el.hidden = true; return; }
    const abs = (vNowTis - vPrev) * 1000;
    const pct = ((vNowTis - vPrev) / vPrev) * 100;
    d = { pct, abs };
  }
  if (!d) { el.hidden = true; return; }
  const pos = d.pct >= 0;
  const arrow = pos
    ? `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 10V2M6 2L2.5 5.5M6 2l3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2V10M6 10L2.5 6.5M6 10l3.5-3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const pctStr = (pos ? '+' : '') + fmtPct(d.pct, 2);
  const absStr = (pos ? '+' : '') + fmtCzk(d.abs) + ' ' + LANG.currency;
  el.innerHTML = `${arrow}<span>${pctStr}</span><span class="delta-abs">· ${absStr}</span>`;
  el.className = 'delta ' + (pos ? 'pos' : 'neg');
  el.hidden = false;
}

// ── Render ──────────────────────────────────────────────────────────────────
let _lastRenderTotal = 0;
let _lastDonutAssetTotal = 0;
let _lastDonutBrokerTotal = 0;

function render(p, a, { animate = true, isLive = true, anchorTs = null } = {}) {
  const EUR_CZK = p.rates.EUR_CZK;
  const USD_CZK = p.rates.USD_CZK;
  const FWRA_PX = (p.prices.FWRA_EUR || 0) * EUR_CZK;
  const SPYY_PX = (p.prices.SPYY_EUR || 0) * EUR_CZK;
  const S_PX    = (p.prices.S_USD    || 0) * USD_CZK;

  const fwra_total = (a.fwra.holdings.t212 || 0) + (a.fwra.holdings.ibkr || 0) + (a.fwra.holdings.rev || 0);
  const spyy_total =  a.spyy.holdings.t212 || 0;
  const s_ibkr     =  a.s.holdings.ibkr    || 0;
  const s_etrade   =  a.s.holdings.etrade  || 0;
  const s_total    =  s_ibkr + s_etrade;

  const vFWRA  = fwra_total * FWRA_PX / 1000;
  const vSPYY  = spyy_total * SPYY_PX / 1000;
  const vS     = s_total    * S_PX    / 1000;
  const vAlpha = a.alpha.fixedCzk;
  const totalTis = vFWRA + vSPYY + vS + vAlpha;
  const totalCzk = totalTis * 1000;

  const bT212   = (a.fwra.holdings.t212 || 0) * FWRA_PX / 1000 + vSPYY + vAlpha;
  const bIBKR   = (a.fwra.holdings.ibkr || 0) * FWRA_PX / 1000 + s_ibkr * S_PX / 1000;
  const bRev    = (a.fwra.holdings.rev  || 0) * FWRA_PX / 1000;
  const bEtrade = s_etrade * S_PX / 1000;

  document.title = 'Wealth Lens';

  // ── Header total ──────────────────────────────────────────────────────────
  const totalEl = document.getElementById('total-value');
  if (animate) {
    animateNumber(totalEl, _lastRenderTotal, totalCzk, 1200, (v) => fmtCzk(v));
  } else {
    totalEl.textContent = fmtCzk(totalCzk);
  }
  _lastRenderTotal = totalCzk;

  // Header delta tag
  renderDelta(isLive, totalTis, anchorTs);

  // ── Donut: assets ─────────────────────────────────────────────────────────
  const assetItems = [
    { key: 'fwra',  value: vFWRA,  color: 'var(--fwra)',  label: 'FWRA',  shares: fwra_total },
    { key: 'spyy',  value: vSPYY,  color: 'var(--spyy)',  label: 'SPYY',  shares: spyy_total },
    { key: 'alpha', value: vAlpha, color: 'var(--alpha)', label: 'Alpha', shares: null },
    { key: 's',     value: vS,     color: 'var(--s)',     label: 'S',     shares: s_total },
  ].sort((x, y) => y.value - x.value);

  const donutAssets = document.getElementById('donut-assets');
  const assetPaths = drawDonut(donutAssets, assetItems, { animate });

  const listAssets = document.getElementById('list-assets');
  listAssets.innerHTML = '';
  const assetRows = assetItems.map((i) => {
    const row = document.createElement('div');
    row.className = 'alloc-row';
    const pct = (i.value / totalTis * 100).toFixed(1);
    const pcs = i.shares != null ? fmtShares(i.shares) : '—';
    row.innerHTML = `
      <span class="dot" style="background:${i.color}; box-shadow: 0 0 8px ${i.color}"></span>
      <span class="name">${i.label}</span>
      <span class="pct">${fmtPct(parseFloat(pct), 1)}</span>
      <span class="pcs">${pcs}</span>
      <span class="val">${fmtCzk(Math.round(i.value))}</span>
    `;
    listAssets.appendChild(row);
    return row;
  });
  linkDonutLegend(assetPaths, assetRows);

  // Donut center (assets) — animate to M value
  const centerAssets = document.getElementById('center-assets');
  const targetM = totalTis / 1000;
  if (animate) {
    animateNumber(centerAssets, _lastDonutAssetTotal, targetM, 1100, (v) => {
      const s = v.toLocaleString(_loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${s}<span class="donut-suffix">${LANG.million}</span>`;
    }, { html: true });
  } else {
    const s = targetM.toLocaleString(_loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    centerAssets.innerHTML = `${s}<span class="donut-suffix">${LANG.million}</span>`;
  }
  _lastDonutAssetTotal = targetM;

  // ── Donut: brokers ────────────────────────────────────────────────────────
  const brokerItems = [
    { value: bT212,   color: 'var(--t212)',   label: 'T212' },
    { value: bIBKR,   color: 'var(--ibkr)',   label: 'IBKR' },
    { value: bRev,    color: 'var(--rev)',    label: 'Revolut' },
    { value: bEtrade, color: 'var(--etrade)', label: 'Etrade' },
  ].sort((x, y) => y.value - x.value);

  const donutBrokers = document.getElementById('donut-brokers');
  const brokerPaths = drawDonut(donutBrokers, brokerItems, { animate });

  const listBrokers = document.getElementById('list-brokers');
  listBrokers.innerHTML = '';
  const brokerRows = brokerItems.map((i) => {
    const row = document.createElement('div');
    row.className = 'alloc-row';
    const pct = (i.value / totalTis * 100).toFixed(1);
    row.innerHTML = `
      <span class="dot" style="background:${i.color}; box-shadow: 0 0 8px ${i.color}"></span>
      <span class="name">${i.label}</span>
      <span class="pct">${fmtPct(parseFloat(pct), 1)}</span>
      <span class="pcs"></span>
      <span class="val">${fmtCzk(Math.round(i.value))}</span>
    `;
    listBrokers.appendChild(row);
    return row;
  });
  linkDonutLegend(brokerPaths, brokerRows);

  const centerBrokers = document.getElementById('center-brokers');
  if (animate) {
    animateNumber(centerBrokers, _lastDonutBrokerTotal, targetM, 1100, (v) => {
      const s = v.toLocaleString(_loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${s}<span class="donut-suffix">${LANG.million}</span>`;
    }, { html: true });
  } else {
    const s = targetM.toLocaleString(_loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    centerBrokers.innerHTML = `${s}<span class="donut-suffix">${LANG.million}</span>`;
  }
  _lastDonutBrokerTotal = targetM;

  // ── Assets table ──────────────────────────────────────────────────────────
  const priceRows = [
    { _v: vFWRA,  key: 'fwra',  color: 'var(--fwra)',
      ticker: a.fwra.ticker, name: a.fwra.name, url: a.fwra.yahooUrl,
      price: p.prices.FWRA_EUR ? `€${fmtNum(p.prices.FWRA_EUR, 2)}` : '—',
      qty: fmtShares(fwra_total),
      valCzk: vFWRA * 1000 },
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
    { _v: vAlpha, key: 'alpha', color: 'var(--alpha)',
      ticker: a.alpha.ticker, name: a.alpha.name, url: a.alpha.yahooUrl,
      price: LANG.fixed, qty: '—',
      valCzk: vAlpha * 1000 },
  ].sort((x, y) => y._v - x._v);

  const tb = document.getElementById('tbl-prices');
  tb.innerHTML = '';
  const POS = 'oklch(0.82 0.18 150)';
  const NEG = 'oklch(0.72 0.2 25)';
  const NEUTRAL = 'oklch(0.55 0.01 260)';
  priceRows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'trow';
    const tickerContent = r.url
      ? `<a href="${r.url}" target="_blank" rel="noopener"><span class="tick">${r.ticker}</span></a>`
      : `<span class="tick">${r.ticker}</span>`;
    const nameContent = r.name ? `<span class="asset-name">${r.name}</span>` : '';

    const tickCell = document.createElement('div');
    tickCell.className = 'tick-cell';
    tickCell.innerHTML = `<span class="dot" style="background:${r.color}; box-shadow: 0 0 8px ${r.color}"></span>${tickerContent}${nameContent}`;
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
    const series = priceSeriesForAsset(r.key, 30, anchorTs);
    const color = series.deltaPct == null
      ? NEUTRAL
      : (series.deltaPct >= 0 ? POS : NEG);
    sparkCell.appendChild(buildSparkline(series.series, color));
    row.appendChild(sparkCell);

    const valCell = document.createElement('div');
    valCell.className = 'num';
    valCell.innerHTML =
      `<span class="val-full">${fmtCzk(r.valCzk)} ${LANG.currency}</span>` +
      `<span class="val-tis">${fmtCzk(Math.round(r.valCzk / 1000))}</span>`;
    row.appendChild(valCell);

    tb.appendChild(row);
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = document.getElementById('footer-info');
  if (footer) {
    const eur = fmtNum(EUR_CZK, 2);
    const usd = fmtNum(USD_CZK, 2);
    let updatedStr = '—';
    if (p._rawTs) {
      const d = new Date(p._rawTs);
      const loc = _dateLoc();
      const tz = { timeZone: 'Europe/Prague' };
      const date = d.toLocaleDateString(loc, { ...tz, day: 'numeric', month: 'numeric', year: 'numeric' });
      const time = d.toLocaleTimeString(loc, { ...tz, hour: '2-digit', minute: '2-digit' });
      updatedStr = `${date} ${time}`;
    }
    footer.innerHTML = `
      <span>${LANG.updated} · ${updatedStr}</span>
      <span class="sep">·</span>
      <span class="rate">EUR/CZK ${eur}</span>
      <span class="sep">·</span>
      <span class="rate">USD/CZK ${usd}</span>
    `;
  }
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
  _TF_LIST.forEach(tf => {
    const btn = document.createElement('button');
    btn.className = (tf === _currentTf ? 'active' : '');
    btn.textContent = tf;
    btn.dataset.tf = tf;
    btn.addEventListener('click', () => {
      _currentTf = tf;
      document.querySelectorAll('#timeframe-btns button').forEach(b => b.classList.toggle('active', b.dataset.tf === tf));
      drawHistoryChart(tf, { animate: true });
    });
    btnsEl.appendChild(btn);
  });
  drawHistoryChart(_currentTf, { animate: true });

  if (window.ResizeObserver) {
    new ResizeObserver(() => drawHistoryChart(_currentTf, { animate: false }))
      .observe(document.getElementById('chart-wrap'));
  }
}

function drawHistoryChart(tf, { animate = true } = {}) {
  const svgEl = document.getElementById('chart-history');
  if (!svgEl) return;
  svgEl.innerHTML = '';

  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) return;

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

  const wrap = document.getElementById('chart-wrap');
  const W = wrap.offsetWidth || 800;
  const H = wrap.offsetHeight || 240;
  const pL = 4, pR = 38, pT = 18, pB = 28;
  const cW = W - pL - pR, cH = H - pT - pB;
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

  if (pts.length < 2) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', (W / 2).toString()); t.setAttribute('y', (H / 2).toString());
    t.setAttribute('dominant-baseline', 'middle'); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', 'var(--text-2)'); t.setAttribute('font-size', '12');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.textContent = LANG.noData;
    svgEl.appendChild(t);
    return;
  }

  const data = pts
    .map(e => ({ ts: new Date(e.ts).getTime(), value: _calcPortfolioValue(e) }))
    .filter(d => { const dow = new Date(d.ts).getDay(); return dow !== 0 && dow !== 6; });

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
  const sp = data.map(d => ({ x: sxBd(d.ts), y: sy(d.value), ts: d.ts, value: d.value }));

  // ── Defs: gradient + glow ────────────────────────────────────────────────
  const defs = document.createElementNS(SVG_NS, 'defs');
  const gradId = 'hchart-grad-' + Math.random().toString(36).slice(2, 7);
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', pT.toString());
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', (pT + cH).toString());
  const s1 = document.createElementNS(SVG_NS, 'stop');
  s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', 'var(--accent)'); s1.setAttribute('stop-opacity', '0.28');
  const s2 = document.createElementNS(SVG_NS, 'stop');
  s2.setAttribute('offset', '60%'); s2.setAttribute('stop-color', 'var(--accent)'); s2.setAttribute('stop-opacity', '0.06');
  const s3 = document.createElementNS(SVG_NS, 'stop');
  s3.setAttribute('offset', '100%'); s3.setAttribute('stop-color', 'var(--accent)'); s3.setAttribute('stop-opacity', '0');
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
  lineEl.setAttribute('stroke', 'var(--accent)'); lineEl.setAttribute('stroke-width', '1.8');
  lineEl.setAttribute('stroke-linecap', 'round'); lineEl.setAttribute('stroke-linejoin', 'round');
  lineEl.setAttribute('filter', `url(#${filterId})`);
  lineEl.setAttribute('stroke-dasharray', pathLen);
  svgEl.appendChild(lineEl);

  // ── End-dot (will appear after line draw) ────────────────────────────────
  const lastSp = sp[sp.length - 1];
  const endRing = document.createElementNS(SVG_NS, 'circle');
  endRing.setAttribute('cx', lastSp.x.toFixed(1));
  endRing.setAttribute('cy', lastSp.y.toFixed(1));
  endRing.setAttribute('r', '5'); endRing.setAttribute('fill', 'var(--accent)');
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
  endDot.setAttribute('r', '3'); endDot.setAttribute('fill', 'var(--accent)');
  endDot.style.opacity = '0';
  svgEl.appendChild(endDot);

  // Animate
  if (_chartAnimRaf) cancelAnimationFrame(_chartAnimRaf);
  const duration = 1300;
  const startT = performance.now();
  const drawTick = (t) => {
    const p = animate ? Math.min(1, (t - startT) / duration) : 1;
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
  xhair.setAttribute('stroke', 'var(--accent)'); xhair.setAttribute('stroke-opacity', '0.3');
  xhair.setAttribute('stroke-dasharray', '3 3'); xhair.style.display = 'none';
  svgEl.appendChild(xhair);

  const hDot = document.createElementNS(SVG_NS, 'circle');
  hDot.setAttribute('r', '5'); hDot.setAttribute('fill', 'var(--accent)');
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
    tooltip.innerHTML = `<div class="tip-date">${dateStr} ${timeStr}</div>`
      + `<div class="tip-val">${Math.round(closest.value * 1000).toLocaleString(_loc())} ${LANG.currency}</div>`;

    const wrapW = wrap.offsetWidth;
    const tipW = tooltip.offsetWidth;
    let leftPx = (closest.x / W) * rect.width;
    leftPx = Math.max(tipW / 2, Math.min(wrapW - tipW / 2, leftPx));
    tooltip.style.left = leftPx + 'px';
    tooltip.style.top = ((closest.y / H) * rect.height - 12) + 'px';
    tooltip.classList.add('visible');
  });

  overlay.addEventListener('mouseleave', () => {
    xhair.style.display = 'none';
    hDot.style.display = 'none';
    hDotInner.style.display = 'none';
    tooltip.classList.remove('visible');
  });
}
