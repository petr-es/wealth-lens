#!/usr/bin/env python3
"""Fetch latest prices from Financial Modeling Prep and append a snapshot to history.js."""

import json
import os
import re
import sys
from datetime import datetime
from urllib.request import urlopen
from urllib.error import URLError
import pytz


FMP_BASE = 'https://financialmodelingprep.com/api/v3'

QUOTE_TICKERS = {
    'FWRA_EUR': 'FWRA.MI',
    'SPYY_EUR': 'SPYY.DE',
    'S_USD':    'S',
}

FX_PAIRS = {
    'EUR_CZK': 'EURCZK',
    'USD_CZK': 'USDCZK',
}

REQUIRED = {'FWRA_EUR', 'SPYY_EUR', 'S_USD', 'EUR_CZK', 'USD_CZK'}

HISTORY = 'history.js'
ASSETS  = 'assets.js'


def fmp_get(path: str, api_key: str) -> dict | list:
    url = f'{FMP_BASE}/{path}?apikey={api_key}'
    try:
        with urlopen(url, timeout=15) as r:
            return json.loads(r.read().decode())
    except URLError as e:
        raise RuntimeError(f'Request failed for {path}: {e}') from e


def fetch_quote(symbol: str, api_key: str) -> float | None:
    try:
        data = fmp_get(f'quote/{symbol}', api_key)
        if not data or data[0].get('price') is None:
            print(f'  WARNING: no price for {symbol}', file=sys.stderr)
            return None
        return round(float(data[0]['price']), 2)
    except Exception as e:
        print(f'  WARNING: failed to fetch {symbol}: {e}', file=sys.stderr)
        return None


def fetch_fx(pair: str, api_key: str) -> float | None:
    try:
        data = fmp_get(f'fx/{pair}', api_key)
        if not data or data[0].get('ask') is None:
            print(f'  WARNING: no rate for {pair}', file=sys.stderr)
            return None
        rate = (float(data[0]['ask']) + float(data[0]['bid'])) / 2
        return round(rate, 2)
    except Exception as e:
        print(f'  WARNING: failed to fetch {pair}: {e}', file=sys.stderr)
        return None


def parse_assets() -> dict:
    with open(ASSETS, 'r', encoding='utf-8') as f:
        content = f.read()
    result = {}
    for name in ('fwra', 'spyy', 's'):
        m = re.search(rf'(?m)^\s+{name}:\s*\{{.*?holdings:\s*\{{([^}}]+)\}}', content, re.DOTALL)
        if m:
            result[name] = {
                k: float(v)
                for k, v in re.findall(r'(\w+):\s*([\d.]+)', m.group(1))
            }
    alpha_m = re.search(r'fixedCzk:\s*([\d.]+)', content)
    if alpha_m:
        result['alpha'] = {'fixedCzk': float(alpha_m.group(1))}
    return result


def main():
    api_key = os.environ.get('FMP_API_KEY')
    if not api_key:
        print('ERROR: FMP_API_KEY environment variable not set.', file=sys.stderr)
        sys.exit(1)

    prague = pytz.timezone('Europe/Prague')
    now = datetime.now(prague)
    print(f'Fetching prices at {now.strftime("%Y-%m-%d %H:%M %Z")} ...')

    prices = {}

    for key, symbol in QUOTE_TICKERS.items():
        price = fetch_quote(symbol, api_key)
        if price is not None:
            prices[key] = price
            print(f'  {symbol}: {price}')

    for key, pair in FX_PAIRS.items():
        rate = fetch_fx(pair, api_key)
        if rate is not None:
            prices[key] = rate
            print(f'  {pair}: {rate}')

    missing = REQUIRED - set(prices.keys())
    if missing:
        print(f'ERROR: missing prices: {", ".join(sorted(missing))} — history not updated.', file=sys.stderr)
        sys.exit(1)

    entry = {
        'ts': now.astimezone(pytz.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'rates':  {k: prices[k] for k in ['EUR_CZK', 'USD_CZK']},
        'prices': {k: prices[k] for k in ['FWRA_EUR', 'SPYY_EUR', 'S_USD']},
        'assets': parse_assets(),
    }

    try:
        with open(HISTORY, 'r', encoding='utf-8') as f:
            raw = f.read()
        existing = json.loads(re.search(r'\[.*\]', raw, re.DOTALL).group())
    except Exception:
        existing = []

    existing.append(entry)
    with open(HISTORY, 'w', encoding='utf-8') as f:
        f.write(f'var PRICE_HISTORY={json.dumps(existing, indent=2)};\n')
    print(f'{HISTORY} updated ({len(existing)} records).')


if __name__ == '__main__':
    main()
