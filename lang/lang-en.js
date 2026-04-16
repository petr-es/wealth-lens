const LANG_EN = {
  // Card headings
  assetsByAsset:  'Composition by asset',
  assetsByBroker: 'Composition by broker',
  assets:         'Assets',

  // Table headers
  colAsset:       'Asset',
  colShare:       'Share',
  colThousands:   'th. CZK',
  colQty:         'Pieces',
  colBroker:      'Broker',
  colPrice:       'Price',
  colRate:        'Rate',
  colCzkPerUnit:  'CZK / unit',
  colTotalQty:    'Total qty',
  colValue:       'Value',

  // Currency and units
  currency:       'CZK',
  million:        'mil.',
  thousands:      'th.',
  unitsSuffix:    'pcs',
  fixed:          'fixed',
  locale:         'en',

  // History selector
  selectNow: 'Now',

  // Update button
  btnUpdate:    'Update',
  btnUpdating:  'Updating…',
  btnDone:      'Done',
  btnError:     'Error',

  // Error toaster
  toastRetry:        'Try again',
  toastUpdateFailed: 'Update failed — could not fetch all prices.',
  toastTokenError:   'Invalid token — update failed.',
  overlayError:      'Could not fetch prices.',

  // Footnote
  footnote: (date, eurCzk, usdCzk) =>
    `Exchange rates from Yahoo Finance, ${date} &nbsp;·&nbsp; <a href="https://finance.yahoo.com/quote/EURCZK=X" target="_blank">EUR/CZK ${eurCzk}</a> &nbsp;·&nbsp; <a href="https://finance.yahoo.com/quote/USDCZK=X" target="_blank">USD/CZK ${usdCzk}</a>`,
};
