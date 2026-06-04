// Manuálně spravováno — počty kusů a identifikace assetů.
const ASSETS = {
  fwra: {
    ticker:   'FWRA.MI',
    name:     'Invesco FTSE All-World',
    yahooUrl: 'https://finance.yahoo.com/quote/FWRA.MI',
    currency: 'EUR',
    holdings: { t212: 3124, ibkr: 4730, rev: 0 },
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
    holdings: { ibkr: 800, etrade: 0 },
  },
  alpha: {
    ticker:   'ALPHA',
    name:     'Seeking Alpha Picks',
    yahooUrl: null,
    currency: 'CZK',
    fixedCzk: 240,   // fixní odhad v tis. Kč
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
      ibkr_czk: 124566, ibkr_eur: 0, ibkr_usd: 3608,
      t212_czk: 0,      t212_eur: 0,    t212_usd: 0,
      rev_czk:  0,      rev_eur:  0,    rev_usd:  0,
    },
  },
};
