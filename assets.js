// Manuálně spravováno — počty kusů a identifikace assetů.
const ASSETS = {
  fwra: {
    ticker:   'FWRA.MI',
    name:     'Invesco FTSE All-World',
    yahooUrl: 'https://finance.yahoo.com/quote/FWRA.MI',
    currency: 'EUR',
    holdings: { t212: 3124, ibkr: 2203, rev: 1416 },
  },
  spyy: {
    ticker:   'SPYY.DE',
    name:     'SPDR MSCI All-Country World',
    yahooUrl: 'https://finance.yahoo.com/quote/SPYY.DE',
    currency: 'EUR',
    holdings: { t212: 81.5 },
  },
  s: {
    ticker:   'S.NYSE',
    name:     'SentinelOne',
    yahooUrl: 'https://finance.yahoo.com/quote/S',
    currency: 'USD',
    holdings: { ibkr: 1257, etrade: 0 },
  },
  alpha: {
    ticker:   'ALPHA',
    name:     'Seeking Alpha Picks',
    yahooUrl: null,
    currency: 'CZK',
    fixedCzk: 215,   // fixní odhad v tis. Kč
    holdings: {},
  },
};
