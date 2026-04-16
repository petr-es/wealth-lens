const LANG_CS = {
  // Nadpisy karet
  assetsByAsset:  'Složení dle aktiva',
  assetsByBroker: 'Složení dle brokera',
  assets:         'Aktiva',

  // Záhlaví tabulek
  colAsset:       'Aktívum',
  colShare:       'Podíl',
  colThousands:   'tis. Kč',
  colQty:         'Ks',
  colBroker:      'Broker',
  colPrice:       'Cena',
  colRate:        'Kurz',
  colCzkPerUnit:  'Kč / ks',
  colTotalQty:    'Ks celkem',
  colValue:       'Hodnota',

  // Měna a jednotky
  currency:       'Kč',
  million:        'mil.',
  thousands:      'tis.',
  unitsSuffix:    'ks',
  fixed:          'fixní',
  locale:         'cs',

  // Update tlačítko
  btnUpdate:    'Aktualizovat',
  btnUpdating:  'Aktualizuji…',
  btnDone:      'Hotovo',
  btnError:     'Chyba',

  // Toaster chyby
  toastRetry:        'Zkusit znova',
  toastUpdateFailed: 'Aktualizace selhala — nepodařilo se načíst všechny ceny.',
  toastTokenError:   'Neplatný token — aktualizace selhala.',
  overlayError:      'Nepodařilo se načíst ceny.',

  // Poznámka pod čarou
  footnote: (date, eurCzk, usdCzk) =>
    `Kurzy dle Yahoo Finance, ${date} &nbsp;·&nbsp; <a href="https://finance.yahoo.com/quote/EURCZK=X" target="_blank">EUR/CZK ${eurCzk}</a> &nbsp;·&nbsp; <a href="https://finance.yahoo.com/quote/USDCZK=X" target="_blank">USD/CZK ${usdCzk}</a>`,
};
