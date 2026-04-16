#!/usr/bin/env python3
"""Fetch latest prices from Yahoo Finance and append a snapshot to history.js."""

import json
import re
import sys
from datetime import datetime
import pytz
import yfinance as yf


TICKERS = {
    'FWRA_EUR': 'FWRA.MI',
    'SPYY_EUR': 'SPYY.DE',
    'S_USD':    'S',
    'EUR_CZK':  'EURCZK=X',
    'USD_CZK':  'USDCZK=X',
}

REQUIRED = {'FWRA_EUR', 'SPYY_EUR', 'S_USD', 'EUR_CZK', 'USD_CZK'}

HISTORY = 'history.js'
ASSETS  = 'assets.js'


def fetch_price(symbol: str):
    try:
        info = yf.Ticker(symbol).info
        val = info.get('regularMarketPrice') or info.get('previousClose')
        return round(float(val), 2) if val is not None else None
    except Exception as e:
        print(f'  WARNING: failed to fetch {symbol}: {e}', file=sys.stderr)
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
    prague = pytz.timezone('Europe/Prague')
    now = datetime.now(prague)
    print(f'Fetching prices at {now.strftime("%Y-%m-%d %H:%M %Z")} ...')

    prices = {}
    for key, symbol in TICKERS.items():
        price = fetch_price(symbol)
        if price is not None:
            prices[key] = price
            print(f'  {symbol}: {price}')

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
