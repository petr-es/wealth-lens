function drawDonut(groupId, segments) {
  const g = document.getElementById(groupId);
  const cx = 80, cy = 80, r = 60, sw = 22;
  const tot = segments.reduce((a, s) => a + s.value, 0);
  let angle = -Math.PI / 2;
  const paths = [];
  const junctions = [];

  segments.forEach(seg => {
    const span = seg.value / tot * 2 * Math.PI;
    const endAngle = angle + span;
    junctions.push(angle);
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const large = span > Math.PI ? 1 : 0;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', seg.color);
    path.setAttribute('stroke-width', sw);
    path.setAttribute('stroke-linecap', 'butt');
    path.style.transition = 'opacity 0.15s';
    g.appendChild(path);
    paths.push(path);
    angle = endAngle;
  });

  // Radial gap lines — uniform width, perpendicular to the ring
  const inner = r - sw / 2, outer = r + sw / 2;
  junctions.forEach(a => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', cx + inner * Math.cos(a));
    line.setAttribute('y1', cy + inner * Math.sin(a));
    line.setAttribute('x2', cx + outer * Math.cos(a));
    line.setAttribute('y2', cy + outer * Math.sin(a));
    line.setAttribute('stroke', 'var(--bg)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('pointer-events', 'none');
    g.appendChild(line);
  });

  return paths;
}

function linkDonutTable(paths, tbodyId) {
  const rows = Array.from(document.querySelectorAll(`#${tbodyId} tr`));

  // Segment hover: dim other segments + dim other rows
  paths.forEach((path, i) => {
    path.addEventListener('mouseenter', () => {
      paths.forEach((p, j) => { p.style.opacity = j === i ? '1' : '0.25'; });
      rows.forEach((r, j)  => { r.classList.toggle('row-dim', j !== i); });
    });
    path.addEventListener('mouseleave', () => {
      paths.forEach(p => { p.style.opacity = '1'; });
      rows.forEach(r  => { r.classList.remove('row-dim'); });
    });
  });

  // Row hover: CSS :hover handles the row highlight; dim other segments
  rows.forEach((row, i) => {
    row.addEventListener('mouseenter', () => {
      paths.forEach((p, j) => { p.style.opacity = j === i ? '1' : '0.25'; });
    });
    row.addEventListener('mouseleave', () => {
      paths.forEach(p => { p.style.opacity = '1'; });
    });
  });
}

function fillTable(tbodyId, rows, {unitsFirst = false} = {}) {
  const tb = document.getElementById(tbodyId);
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = unitsFirst
      ? `<td><span class="dot" style="background:${r.color}"></span>${r.label}</td>
         <td class="pct">${r.pct}%</td>
         <td class="units">${r.units}</td>
         <td class="val">${r.val}</td>`
      : `<td><span class="dot" style="background:${r.color}"></span>${r.label}</td>
         <td class="pct">${r.pct}%</td>
         <td class="val">${r.val}</td>
         <td class="units">${r.units}</td>`;
    tb.appendChild(tr);
  });
}

function fillPricesTable(rows) {
  const tb = document.getElementById('tbl-prices');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const priceCell = r.url
      ? `<a href="${r.url}" target="_blank">${r.price}</a>`
      : r.price;
    tr.innerHTML = `
      <td><span class="dot" style="background:${r.color}"></span>${r.label}</td>
      <td class="val">${priceCell}</td>
      <td class="units col-pxczk">${r.pxczk}</td>
      <td class="units">${r.units}</td>
      <td class="val">${r.val}</td>
    `;
    tb.appendChild(tr);
  });
}

function fmt(n, dec = 2) {
  const s = n.toFixed(dec);
  return LANG.locale === 'cs' ? s.replace('.', ',') : s;
}

function render(p, a) {
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
  const total  = vFWRA + vSPYY + vS + vAlpha;

  const bT212   = (a.fwra.holdings.t212 || 0) * FWRA_PX / 1000 + vSPYY + vAlpha;
  const bIBKR   = (a.fwra.holdings.ibkr || 0) * FWRA_PX / 1000 + s_ibkr * S_PX / 1000;
  const bRev    = (a.fwra.holdings.rev  || 0) * FWRA_PX / 1000;
  const bEtrade = s_etrade * S_PX / 1000;

  // ── Header ──────────────────────────────────────────────────────────────────
  document.title = 'Wealth Lens';

  // ── Donut: aktiva ────────────────────────────────────────────────────────────
  const assetItems = [
    { value: vFWRA,  color:'var(--fwra)',  label:'FWRA',  units:fwra_total.toLocaleString(LANG.locale)+' '+LANG.unitsSuffix },
    { value: vSPYY,  color:'var(--spyy)',  label:'SPYY',  units:spyy_total+' '+LANG.unitsSuffix },
    { value: vAlpha, color:'var(--alpha)', label:'Alpha', units:'–' },
    { value: vS,     color:'var(--s)',     label:'S',     units:s_total.toLocaleString(LANG.locale)+' '+LANG.unitsSuffix },
  ].sort((a, b) => b.value - a.value);

  const assetPaths = drawDonut('donut-assets', assetItems);
  fillTable('tbl-assets', assetItems.map(i => ({
    color: i.color, label: i.label, units: i.units,
    pct: (i.value / total * 100).toFixed(1),
    val: Math.round(i.value).toLocaleString(LANG.locale),
  })), {unitsFirst: true});
  linkDonutTable(assetPaths, 'tbl-assets');

  // ── Donut: brokeři ───────────────────────────────────────────────────────────
  const brokerItems = [
    { value: bT212,   color:'var(--t212)',   label:'T212',    units:'' },
    { value: bIBKR,   color:'var(--ibkr)',   label:'IBKR',    units:'' },
    { value: bRev,    color:'var(--rev)',    label:'Revolut', units:'' },
    { value: bEtrade, color:'var(--etrade)', label:'E-Trade', units:'' },
  ].sort((a, b) => b.value - a.value);

  const brokerPaths = drawDonut('donut-brokers', brokerItems);
  fillTable('tbl-brokers', brokerItems.map(i => ({
    color: i.color, label: i.label, units: i.units,
    pct: (i.value / total * 100).toFixed(1),
    val: Math.round(i.value).toLocaleString(LANG.locale),
  })));
  linkDonutTable(brokerPaths, 'tbl-brokers');

  // ── Tabulka vstupních hodnot ─────────────────────────────────────────────────
  fillPricesTable([
    { _v: vFWRA,  color:'var(--fwra)',  label:a.fwra.ticker,  url:a.fwra.yahooUrl,
      price: p.prices.FWRA_EUR ? `€${fmt(p.prices.FWRA_EUR)}` : '–',
      pxczk: p.prices.FWRA_EUR ? `${fmt(FWRA_PX, 1)} ${LANG.currency}` : '–',
      units:fwra_total.toLocaleString(LANG.locale),
      val:Math.round(vFWRA * 1000).toLocaleString(LANG.locale) + ' ' + LANG.currency },
    { _v: vSPYY,  color:'var(--spyy)',  label:a.spyy.ticker,  url:a.spyy.yahooUrl,
      price: p.prices.SPYY_EUR ? `€${fmt(p.prices.SPYY_EUR)}` : '–',
      pxczk: p.prices.SPYY_EUR ? `${fmt(SPYY_PX, 0)} ${LANG.currency}` : '–',
      units:spyy_total.toLocaleString(LANG.locale),
      val:Math.round(vSPYY * 1000).toLocaleString(LANG.locale) + ' ' + LANG.currency },
    { _v: vS,     color:'var(--s)',     label:a.s.ticker,     url:a.s.yahooUrl,
      price: p.prices.S_USD ? `$${fmt(p.prices.S_USD)}` : '–',
      pxczk: p.prices.S_USD ? `${fmt(S_PX, 1)} ${LANG.currency}` : '–',
      units:s_total.toLocaleString(LANG.locale),
      val:Math.round(vS * 1000).toLocaleString(LANG.locale) + ' ' + LANG.currency },
    { _v: vAlpha, color:'var(--alpha)', label:'Alpha Picks',   url:null,
      price:LANG.fixed, pxczk:'–', units:'–',
      val:Math.round(vAlpha * 1000).toLocaleString(LANG.locale) + ' ' + LANG.currency },
  ].sort((a, b) => b._v - a._v));

  // ── Totály ───────────────────────────────────────────────────────────────────
  const totalMil = (total / 1000).toLocaleString(LANG.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalKc  = Math.round(total * 1000).toLocaleString(LANG.locale);
  document.getElementById('center-assets').textContent  = totalMil + ' ' + LANG.million;
  document.getElementById('center-brokers').textContent = totalMil + ' ' + LANG.million;
  document.querySelector('.total').textContent = totalKc + ' ' + LANG.currency;

  // ── Footnote ─────────────────────────────────────────────────────────────────
  document.getElementById('footnote').innerHTML = LANG.footnote(p.date, fmt(EUR_CZK), fmt(USD_CZK));
}

function _historyFormatTs(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function buildPricesFromEntry(entry) {
  const d = new Date(entry.ts);
  const date = d.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' });
  return { date, updated: `${date} ${time}`, rates: entry.rates, prices: entry.prices };
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

function syncSelectWidth(sel) {
  const sizer = document.getElementById('history-select-sizer');
  sizer.textContent = sel.options[sel.selectedIndex]?.textContent || '';
  sel.style.width = (sizer.offsetWidth + 22) + 'px'; // +22 for chevron
}

function initHistorySelect() {
  const sel = document.getElementById('history-select');
  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) return;
  window._historyEntries = [...PRICE_HISTORY].reverse();
  sel.innerHTML = '';
  const nowOpt = document.createElement('option');
  nowOpt.value = 'live';
  nowOpt.textContent = LANG.selectNow;
  sel.appendChild(nowOpt);
  _historyEntries.forEach((entry, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = _historyFormatTs(entry.ts);
    sel.appendChild(opt);
  });
  sel.value = 'live';
  syncSelectWidth(sel);
}

document.getElementById('history-select').addEventListener('change', function () {
  syncSelectWidth(this);
  ['tbl-assets', 'tbl-brokers', 'tbl-prices'].forEach(id => { document.getElementById(id).innerHTML = ''; });
  ['donut-assets', 'donut-brokers'].forEach(id => { document.getElementById(id).innerHTML = ''; });
  if (this.value === 'live') {
    render(window.PRICES, ASSETS);
    return;
  }
  if (!window._historyEntries) return;
  const entry = _historyEntries[parseInt(this.value)];
  if (!entry) return;
  render(buildPricesFromEntry(entry), buildAssetsFromEntry(entry));
});

// Initial render is triggered by updater.js after live prices are fetched.

// ── Portfolio history chart ──────────────────────────────────────────────────

const _TF_LIST = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'MAX'];
let _currentTf = 'MAX';

function _calcPortfolioValue(entry) {
  const EUR_CZK = entry.rates.EUR_CZK || 0;
  const USD_CZK = entry.rates.USD_CZK || 0;
  const FWRA_PX = (entry.prices.FWRA_EUR || 0) * EUR_CZK;
  const SPYY_PX = (entry.prices.SPYY_EUR || 0) * EUR_CZK;
  const S_PX    = (entry.prices.S_USD    || 0) * USD_CZK;
  const a = entry.assets || {};
  const fh = a.fwra || {}, sh = a.spyy || {}, sxh = a.s || {};
  const alpha = a.alpha ? (a.alpha.fixedCzk || 0) : 0;
  return ((fh.t212||0)+(fh.ibkr||0)+(fh.rev||0)) * FWRA_PX / 1000
       + (sh.t212||0) * SPYY_PX / 1000
       + ((sxh.ibkr||0)+(sxh.etrade||0)) * S_PX / 1000
       + alpha;
}

function _niceYTicks(min, max) {
  const range = max - min || 1;
  const rough = range / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice = [1, 2, 2.5, 5, 10].find(f => f * pow >= rough) * pow;
  const niceMin = Math.floor(min / nice) * nice;
  const niceMax = Math.ceil(max  / nice) * nice;
  const ticks = [];
  for (let t = niceMin; t <= niceMax + nice * 0.01; t += nice)
    ticks.push(parseFloat(t.toFixed(10)));
  return ticks;
}

function _xLabel(ts, rangeDays) {
  const d = new Date(ts);
  const tz = { timeZone: 'Europe/Prague' };
  if (rangeDays <= 60) {
    // Use cs-CZ to reliably get "DD. MM." then reformat — avoids en-US MM/DD ambiguity
    const raw = d.toLocaleDateString('cs-CZ', { ...tz, day: 'numeric', month: 'numeric' });
    const [day, mon] = raw.replace(/\s/g, '').split('.').filter(Boolean);
    return LANG.locale === 'cs' ? `${day}.${mon}.` : `${mon}/${day}`;
  }
  const loc = LANG.locale === 'cs' ? 'cs-CZ' : 'en-GB';
  if (rangeDays <= 200)
    return d.toLocaleDateString(loc, { ...tz, month: 'short' });
  return d.toLocaleDateString(loc, { ...tz, month: 'short', year: '2-digit' });
}

// Returns an array of midnight timestamps for every Mon–Fri between minTs and maxTs.
function _businessDaysList(minTs, maxTs) {
  const bds = [];
  const d = new Date(minTs);
  d.setHours(0, 0, 0, 0);
  const endMidnight = new Date(maxTs);
  endMidnight.setHours(23, 59, 59, 999);
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
    btn.className = 'tf-btn' + (tf === _currentTf ? ' active' : '');
    btn.textContent = tf;
    btn.dataset.tf = tf;
    btn.addEventListener('click', () => {
      _currentTf = tf;
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.dataset.tf === tf));
      drawHistoryChart(tf);
    });
    btnsEl.appendChild(btn);
  });
  drawHistoryChart(_currentTf);

  if (window.ResizeObserver) {
    new ResizeObserver(() => drawHistoryChart(_currentTf))
      .observe(document.getElementById('chart-history').closest('.chart-history-wrap'));
  }
}

function drawHistoryChart(tf) {
  const svgEl = document.getElementById('chart-history');
  svgEl.innerHTML = '';

  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) return;

  // Sort oldest → newest
  const all = [...PRICE_HISTORY].sort((a, b) => new Date(a.ts) - new Date(b.ts));

  // Filter by timeframe
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
    // If cutoff lands on a weekend, roll back to the preceding Friday so a
    // full business week is always visible (e.g. viewing on Saturday).
    const dow = cutoffDate.getDay();
    if (dow === 6) cutoffDate.setDate(cutoffDate.getDate() - 1); // Sat → Fri
    if (dow === 0) cutoffDate.setDate(cutoffDate.getDate() - 2); // Sun → Fri
    pts = all.filter(e => new Date(e.ts).getTime() >= cutoffDate.getTime());
  }

  const svgNS = 'http://www.w3.org/2000/svg';

  if (pts.length < 2) {
    svgEl.setAttribute('viewBox', '0 0 800 160');
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', '400'); t.setAttribute('y', '80');
    t.setAttribute('dominant-baseline', 'middle'); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', 'var(--muted)'); t.setAttribute('font-size', '12');
    t.setAttribute('font-family', 'DM Mono, monospace');
    t.textContent = LANG.noData;
    svgEl.appendChild(t);
    return;
  }

  const data = pts
    .map(e => ({ ts: new Date(e.ts).getTime(), value: _calcPortfolioValue(e) }))
    .filter(d => { const dow = new Date(d.ts).getDay(); return dow !== 0 && dow !== 6; });

  // SVG layout — W matches actual container width for horizontal-only scaling
  const wrap = svgEl.closest('.chart-history-wrap');
  const W = wrap.offsetWidth || 800;
  const H = 160;
  const pL = 4, pR = 54, pT = 14, pB = 26;
  const cW = W - pL - pR, cH = H - pT - pB;

  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const minTs = data[0].ts, maxTs = data[data.length - 1].ts;
  const vals = data.map(d => d.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const yTicks = _niceYTicks(minV, maxV);
  const yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
  const yRange = yMax - yMin || 1;

  const hPadR = 18;
  // Business-day-based X mapping: weekends are excluded so gaps don't appear.
  const bdList = _businessDaysList(minTs, maxTs);
  const bdSpan = Math.max(bdList.length - 1, 1);
  const sxBd = ts => {
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    const idx = bdList.indexOf(d.getTime());
    return pL + (idx >= 0 ? idx : 0) / bdSpan * (cW - hPadR);
  };
  const sy = v => pT + cH - (v - yMin) / yRange * cH;

  const sp = data.map(d => ({ x: sxBd(d.ts), y: sy(d.value), ts: d.ts, value: d.value }));

  // ── Defs: area gradient ────────────────────────────────────────────────────
  const defs = document.createElementNS(svgNS, 'defs');
  const grad = document.createElementNS(svgNS, 'linearGradient');
  grad.setAttribute('id', 'hchart-grad');
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', pT.toString());
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', (pT + cH).toString());
  const s1 = document.createElementNS(svgNS, 'stop');
  s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', 'var(--accent)'); s1.setAttribute('stop-opacity', '0.2');
  const s2 = document.createElementNS(svgNS, 'stop');
  s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', 'var(--accent)'); s2.setAttribute('stop-opacity', '0.02');
  grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);
  svgEl.appendChild(defs);

  // ── Grid lines ─────────────────────────────────────────────────────────────
  yTicks.forEach(tick => {
    const y = sy(tick);
    if (y < pT - 2 || y > pT + cH + 2) return;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', pL); line.setAttribute('y1', y.toFixed(1));
    line.setAttribute('x2', pL + cW); line.setAttribute('y2', y.toFixed(1));
    line.setAttribute('stroke', 'var(--border)'); line.setAttribute('stroke-width', '1');
    svgEl.appendChild(line);
  });

  // ── Area fill ──────────────────────────────────────────────────────────────
  const baseY = pT + cH;
  const linePts = sp.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = linePts + ` L ${sp[sp.length-1].x.toFixed(1)} ${baseY} L ${sp[0].x.toFixed(1)} ${baseY} Z`;
  const area = document.createElementNS(svgNS, 'path');
  area.setAttribute('d', areaD); area.setAttribute('fill', 'url(#hchart-grad)');
  svgEl.appendChild(area);

  // ── Line ───────────────────────────────────────────────────────────────────
  const lineEl = document.createElementNS(svgNS, 'path');
  lineEl.setAttribute('d', linePts); lineEl.setAttribute('fill', 'none');
  lineEl.setAttribute('stroke', 'var(--accent)'); lineEl.setAttribute('stroke-width', '1.5');
  lineEl.setAttribute('stroke-linecap', 'round'); lineEl.setAttribute('stroke-linejoin', 'round');
  svgEl.appendChild(lineEl);

  // ── End dot ────────────────────────────────────────────────────────────────
  const lastSp = sp[sp.length - 1];
  const endDot = document.createElementNS(svgNS, 'circle');
  endDot.setAttribute('cx', lastSp.x.toFixed(1));
  endDot.setAttribute('cy', lastSp.y.toFixed(1));
  endDot.setAttribute('r', '4.5');
  endDot.setAttribute('fill', 'var(--accent)');
  endDot.setAttribute('stroke', 'var(--bg)');
  endDot.setAttribute('stroke-width', '2');
  svgEl.appendChild(endDot);

  // ── Y axis labels ──────────────────────────────────────────────────────────
  yTicks.forEach(tick => {
    const y = sy(tick);
    if (y < pT - 2 || y > pT + cH + 2) return;
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', (pL + cW + 5).toString()); t.setAttribute('y', y.toFixed(1));
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', 'var(--muted)'); t.setAttribute('font-size', '9');
    t.setAttribute('font-family', 'DM Mono, monospace');
    t.textContent = Math.round(tick).toLocaleString(LANG.locale);
    svgEl.appendChild(t);
  });

  // ── X axis labels — pixel positions evenly spaced, label text from nearest bd ─
  const rangeDays = (maxTs - minTs) / 86400000;
  const tickCount = Math.max(2, Math.min(8, Math.floor(cW / 90), bdList.length));
  for (let i = 0; i < tickCount; i++) {
    const frac = i / (tickCount - 1);
    const x = pL + frac * (cW - hPadR);           // evenly spaced pixels
    const bdIdx = Math.min(Math.round(frac * bdSpan), bdList.length - 1);
    const ts = bdList[bdIdx];                       // nearest business day for text
    const anchor = i === 0 ? 'start' : (i === tickCount - 1 ? 'end' : 'middle');
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', (pT + cH + 17).toString());
    t.setAttribute('text-anchor', anchor);
    t.setAttribute('fill', 'var(--muted)'); t.setAttribute('font-size', '10');
    t.setAttribute('font-family', 'DM Mono, monospace');
    t.textContent = _xLabel(ts, rangeDays);
    svgEl.appendChild(t);
  }

  // ── Hover snap points: only real recorded data points ─────────────────────
  const snaps = sp;

  // ── Hover interaction ──────────────────────────────────────────────────────
  const overlay = document.createElementNS(svgNS, 'rect');
  overlay.setAttribute('x', pL); overlay.setAttribute('y', pT);
  overlay.setAttribute('width', cW); overlay.setAttribute('height', cH);
  overlay.setAttribute('fill', 'transparent'); overlay.style.cursor = 'crosshair';
  svgEl.appendChild(overlay);

  const xhair = document.createElementNS(svgNS, 'line');
  xhair.setAttribute('y1', pT); xhair.setAttribute('y2', pT + cH);
  xhair.setAttribute('stroke', 'var(--muted)'); xhair.setAttribute('stroke-width', '1');
  xhair.setAttribute('stroke-dasharray', '3,3'); xhair.style.display = 'none';
  svgEl.appendChild(xhair);

  const dot = document.createElementNS(svgNS, 'circle');
  dot.setAttribute('r', '3.5'); dot.setAttribute('fill', 'var(--accent)');
  dot.setAttribute('stroke', 'var(--bg)'); dot.setAttribute('stroke-width', '2');
  dot.style.display = 'none';
  svgEl.appendChild(dot);

  const tooltip = document.getElementById('chart-tooltip');

  overlay.addEventListener('mousemove', e => {
    const rect = svgEl.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (W / rect.width);
    let closest = snaps[0], minD = Infinity;
    snaps.forEach(p => { const d = Math.abs(p.x - mouseX); if (d < minD) { minD = d; closest = p; } });

    xhair.setAttribute('x1', closest.x); xhair.setAttribute('x2', closest.x);
    xhair.style.display = '';
    dot.setAttribute('cx', closest.x); dot.setAttribute('cy', closest.y);
    dot.style.display = '';

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
    tooltip.innerHTML = `<div class="tooltip-date">${dateStr} ${timeStr}</div>`
      + `<div class="tooltip-val">${Math.round(closest.value * 1000).toLocaleString(LANG.locale)} ${LANG.currency}</div>`;

    // Position tooltip horizontally, clamp to wrap bounds
    const wrapW = wrap.offsetWidth;
    const tipW  = tooltip.offsetWidth;
    let leftPx = (closest.x / W) * rect.width;
    leftPx = Math.max(tipW / 2, Math.min(wrapW - tipW / 2, leftPx));
    tooltip.style.left = leftPx + 'px';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.classList.add('visible');
  });

  overlay.addEventListener('mouseleave', () => {
    xhair.style.display = 'none';
    dot.style.display = 'none';
    tooltip.classList.remove('visible');
  });
}
