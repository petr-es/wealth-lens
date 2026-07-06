// Manuálně spravováno — počty kusů a identifikace assetů.
const ASSETS = {
  fwra: {
    ticker:   'FWRA.MI',
    name:     'Invesco FTSE All-World',
    yahooUrl: 'https://finance.yahoo.com/quote/FWRA.MI',
    currency: 'EUR',
    holdings: { t212: 0, ibkr: 10373, rev: 0 },
  },
  avws: {
    ticker:   'AVWS.DE',
    name:     'Avantis Global Small Cap Value',
    yahooUrl: 'https://finance.yahoo.com/quote/AVWS.DE',
    currency: 'EUR',
    holdings: { t212: 0, ibkr: 901 },
  },
  spyy: {
    ticker:   'SPYY.DE',
    name:     'SPDR MSCI All-Country World',
    yahooUrl: 'https://finance.yahoo.com/quote/SPYY.DE',
    currency: 'EUR',
    holdings: { t212: 0, ibkr: 0 },   // sold in full 1.7.2026, replaced by AVWS; kept for history
  },
  s: {
    ticker:   'S.NYSE',
    name:     'SentinelOne',
    yahooUrl: 'https://finance.yahoo.com/quote/S',
    currency: 'USD',
    holdings: { ibkr: 0, etrade: 389 },
  },
  alpha: {
    ticker:   'STOCKS',
    name:     'Stock picks',
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
