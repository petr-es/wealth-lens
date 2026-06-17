// Manuálně spravováno — počty kusů a identifikace assetů.
const ASSETS = {
  fwra: {
    ticker:   'FWRA.MI',
    name:     'Invesco FTSE All-World',
    yahooUrl: 'https://finance.yahoo.com/quote/FWRA.MI',
    currency: 'EUR',
    holdings: { t212: 0, ibkr: 8884.5, rev: 0 },
  },
  spyy: {
    ticker:   'SPYY.DE',
    name:     'SPDR MSCI All-Country World',
    yahooUrl: 'https://finance.yahoo.com/quote/SPYY.DE',
    currency: 'EUR',
    holdings: { t212: 0, ibkr: 81 },
  },
  s: {
    ticker:   'S.NYSE',
    name:     'SentinelOne',
    yahooUrl: 'https://finance.yahoo.com/quote/S',
    currency: 'USD',
    holdings: { ibkr: 800, etrade: 0 },
  },
  alpha: {
    ticker:   'STOCKS',
    name:     'Stock Picks',
    yahooUrl: null,
    currency: 'CZK',
    fixedCzk: 250,   // fixní odhad v tis. Kč
    holdings: {},
  },
  ib1t: {
    ticker:   'IB1T.DE',
    name:     'iShares Bitcoin ETP',
    yahooUrl: 'https://finance.yahoo.com/quote/IB1T.DE',
    currency: 'EUR',
    holdings: { ibkr: 0 },
  },
  cash: {
    ticker:   'CASH',
    name:     'Cash aggregated',
    yahooUrl: null,
    currency: null,   // multi-currency: value derived from holdings + FX rates
    // Amounts in each native currency, all held at IBKR.
    holdings: {
      ibkr_czk: 0,      ibkr_eur: 20,    ibkr_usd: 0,
      t212_czk: 0,      t212_eur: 0,    t212_usd: 0,
      rev_czk:  0,      rev_eur:  0,    rev_usd:  0,
    },
  },
};
