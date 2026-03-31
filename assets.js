// Manuálně spravováno — počty kusů a identifikace assetů.
const ASSETS = {
  fwra: {
    ticker:   'FWRA.MI',
    yahooUrl: 'https://finance.yahoo.com/quote/FWRA.MI',
    currency: 'EUR',
    holdings: { t212: 3124, ibkr: 2203, rev: 1416 },
  },
  spyy: {
    ticker:   'SPYY.DE',
    yahooUrl: 'https://finance.yahoo.com/quote/SPYY.DE',
    currency: 'EUR',
    holdings: { t212: 81.5 },
  },
  s: {
    ticker:   'S',
    yahooUrl: 'https://finance.yahoo.com/quote/S',
    currency: 'USD',
    holdings: { ibkr: 1257, etrade: 586 },
  },
  alpha: {
    ticker:   null,
    yahooUrl: null,
    currency: 'CZK',
    fixedCzk: 200,   // fixní odhad v tis. Kč
    holdings: {},
  },
};
