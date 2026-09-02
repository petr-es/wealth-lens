// Manuálně spravováno — počty kusů a identifikace assetů.
const ASSETS = {
  fwra: {
    ticker:   'FWRA.MI',
    priceKey: 'FWRA_EUR',
    name:     'Invesco FTSE All-World',
    yahooUrl: 'https://finance.yahoo.com/quote/FWRA.MI',
    currency: 'EUR',
    holdings: { t212: 0, ibkr: 12283, rev: 0 },
  },
  allw: {
    ticker:   'ALLW.DE',
    priceKey: 'ALLW_EUR',
    name:     'Xtrackers FTSE All-World',
    yahooUrl: 'https://finance.yahoo.com/quote/ALLW.DE',
    currency: 'EUR',
    holdings: { t212: 299, ibkr: 0 },
  },
  avws: {
    ticker:   'AVWS.DE',
    priceKey: 'AVWS_EUR',
    name:     'Avantis Global Small Cap Value',
    yahooUrl: 'https://finance.yahoo.com/quote/AVWS.DE',
    currency: 'EUR',
    holdings: { t212: 19, ibkr: 680.5 },
  },
  spyy: {
    ticker:   'SPYY.DE',
    priceKey: 'SPYY_EUR',
    name:     'SPDR MSCI All-Country World',
    yahooUrl: 'https://finance.yahoo.com/quote/SPYY.DE',
    currency: 'EUR',
    holdings: { t212: 0, ibkr: 0 },   // sold in full 1.7.2026, replaced by AVWS; kept for history
  },
  s: {
    ticker:   'S.NYSE',
    priceKey: 'S_USD',
    name:     'SentinelOne, Inc.',
    yahooUrl: 'https://finance.yahoo.com/quote/S',
    currency: 'USD',
    holdings: { ibkr: 0, etrade: 1 },
  },
  alpha: {
    ticker:   'STOCKS',
    name:     'Stock picks',
    yahooUrl: null,
    currency: 'CZK',
    fixedCzk: 140,   // fixní odhad v tis. Kč
    holdings: {},
  },
  ib1t: {
    ticker:   'IB1T.DE',
    priceKey: 'IB1T_EUR',
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
      ibkr_czk: 0,      ibkr_eur: 0,    ibkr_usd: 0,
      t212_czk: 0,      t212_eur: 0,    t212_usd: 0,
      rev_czk:  0,      rev_eur:  0,    rev_usd:  0,
    },
  },
};
