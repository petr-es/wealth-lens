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

function fillTable(tbodyId, rows) {
  const tb = document.getElementById(tbodyId);
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="dot" style="background:${r.color}"></span>${r.label}</td>
      <td class="pct">${r.pct}%</td>
      <td class="val">${r.val}</td>
      <td class="units">${r.units}</td>
    `;
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
  })));
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

function initHistorySelect() {
  const sel = document.getElementById('history-select');
  if (!window.PRICE_HISTORY || !PRICE_HISTORY.length) return;
  const prev = sel.value;
  window._historyEntries = [...PRICE_HISTORY].reverse();
  sel.innerHTML = '';
  _historyEntries.forEach((entry, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = _historyFormatTs(entry.ts);
    sel.appendChild(opt);
  });
  sel.value = (prev && parseInt(prev) < _historyEntries.length) ? prev : '0';
}

document.getElementById('history-select').addEventListener('change', function () {
  if (!window._historyEntries) return;
  const entry = _historyEntries[parseInt(this.value)];
  if (!entry) return;
  ['tbl-assets', 'tbl-brokers', 'tbl-prices'].forEach(id => { document.getElementById(id).innerHTML = ''; });
  ['donut-assets', 'donut-brokers'].forEach(id => { document.getElementById(id).innerHTML = ''; });
  render(buildPricesFromEntry(entry), buildAssetsFromEntry(entry));
});

// Initial render is triggered by updater.js after live prices are fetched.
