const FMP_KEY = process.env.FMP_API_KEY;
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

// FMP ticker symbols for each asset
const TICKERS = {
  FWRA_EUR: 'FWRA.MI',
  SPYY_EUR: 'SPYY.DE',
  S_USD:    'S',
};

const FX_PAIRS = {
  EUR_CZK: 'EURCZK',
  USD_CZK: 'USDCZK',
};

async function fetchQuote(symbol) {
  const res = await fetch(`${FMP_BASE}/quote/${symbol}?apikey=${FMP_KEY}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const data = await res.json();
  if (!data || !data[0] || data[0].price == null) throw new Error(`No price for ${symbol}`);
  return Math.round(data[0].price * 100) / 100;
}

async function fetchFx(pair) {
  const res = await fetch(`${FMP_BASE}/fx/${pair}?apikey=${FMP_KEY}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${pair}`);
  const data = await res.json();
  if (!data || !data[0] || data[0].ask == null) throw new Error(`No rate for ${pair}`);
  return Math.round(((data[0].ask + data[0].bid) / 2) * 100) / 100;
}

function czechDate(d) {
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!FMP_KEY) {
    return res.status(500).json({ error: 'FMP_API_KEY not configured' });
  }

  const now = new Date();
  const pragueDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  const date    = czechDate(pragueDate);
  const hh      = String(pragueDate.getHours()).padStart(2, '0');
  const mm      = String(pragueDate.getMinutes()).padStart(2, '0');
  const updated = `${date} ${hh}:${mm}`;

  try {
    const [FWRA_EUR, SPYY_EUR, S_USD, EUR_CZK, USD_CZK] = await Promise.all([
      fetchQuote(TICKERS.FWRA_EUR),
      fetchQuote(TICKERS.SPYY_EUR),
      fetchQuote(TICKERS.S_USD),
      fetchFx(FX_PAIRS.EUR_CZK),
      fetchFx(FX_PAIRS.USD_CZK),
    ]);

    res.status(200).json({
      date,
      updated,
      rates:  { EUR_CZK, USD_CZK },
      prices: { FWRA_EUR, SPYY_EUR, S_USD },
    });
  } catch (e) {
    console.error('FMP fetch error:', e.message);
    res.status(502).json({ error: e.message });
  }
}
