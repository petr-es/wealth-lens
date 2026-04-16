import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

const TICKERS = {
  FWRA_EUR: 'FWRA.MI',
  SPYY_EUR: 'SPYY.DE',
  S_USD:    'S',
  EUR_CZK:  'EURCZK=X',
  USD_CZK:  'USDCZK=X',
};

async function fetchPrice(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    const val = quote.regularMarketPrice ?? quote.previousClose ?? null;
    return val !== null ? Math.round(val * 100) / 100 : null;
  } catch {
    return null;
  }
}

function czechDate(d) {
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const now = new Date();
  const pragueDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  const date    = czechDate(pragueDate);
  const hh      = String(pragueDate.getHours()).padStart(2, '0');
  const mm      = String(pragueDate.getMinutes()).padStart(2, '0');
  const updated = `${date} ${hh}:${mm}`;

  const entries = await Promise.all(
    Object.entries(TICKERS).map(async ([key, symbol]) => [key, await fetchPrice(symbol)])
  );

  const prices = Object.fromEntries(entries);
  const missing = Object.keys(TICKERS).filter(k => prices[k] === null);

  if (missing.length > 0) {
    return res.status(502).json({ error: `Failed to fetch: ${missing.join(', ')}` });
  }

  res.status(200).json({
    date,
    updated,
    rates:  { EUR_CZK: prices.EUR_CZK, USD_CZK: prices.USD_CZK },
    prices: { FWRA_EUR: prices.FWRA_EUR, SPYY_EUR: prices.SPYY_EUR, S_USD: prices.S_USD },
  });
}
