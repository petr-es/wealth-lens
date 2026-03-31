const LANG_EN = {
  // Card headings
  assetsByAsset:  'Composition by asset',
  assetsByBroker: 'Composition by broker',
  assets:         'Assets',

  // Table headers
  colAsset:       'Asset',
  colShare:       'Share',
  colThousands:   'thous. CZK',
  colQty:         'Qty',
  colBroker:      'Broker',
  colPrice:       'Price',
  colRate:        'Rate',
  colCzkPerUnit:  'CZK / unit',
  colTotalQty:    'Total qty',
  colValue:       'Value',

  // Currency and units
  currency:       'CZK',
  million:        'mil.',
  thousands:      'thous.',
  unitsSuffix:    'pcs',
  fixed:          'fixed',
  locale:         'en',

  // Update button
  btnUpdate:    'Update',
  btnUpdating:  'Updating…',
  btnDone:      'Done',
  btnError:     'Error',

  // Footnote
  footnote: (date, eurCzk, usdCzk) =>
    `Exchange rates from Yahoo Finance, ${date} &nbsp;·&nbsp; <a href="https://finance.yahoo.com/quote/EURCZK=X" target="_blank">EUR/CZK ${eurCzk}</a> &nbsp;·&nbsp; <a href="https://finance.yahoo.com/quote/USDCZK=X" target="_blank">USD/CZK ${usdCzk}</a>`,
};
