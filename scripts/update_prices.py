#!/usr/bin/env python3
"""Fetch latest prices from Yahoo Finance and append a snapshot to history.js."""

import json
import re
import sys
from datetime import datetime
import pytz
import yfinance as yf


TICKERS = {
    'FWRA_EUR':  'FWRA.MI',
    'ALLW_EUR':  'ALLW.DE',
    'AVWS_EUR':  'AVWS.DE',
    'SPYY_EUR':  'SPYY.DE',
    'S_USD':     'S',
    'IB1T_EUR':  'IB1T.DE',
    'EUR_CZK':   'EURCZK=X',
    'USD_CZK':   'USDCZK=X',
}

# Every position and cash balance converts through these, so a snapshot
# without them is meaningless — they gate the update unconditionally.
RATE_KEYS = ('EUR_CZK', 'USD_CZK')

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


def parse_price_keys() -> dict:
    """Price key -> asset key, read from the priceKey fields in assets.js.

    assets.js is the single place that declares which price field an asset
    is quoted by, so adding a fund does not mean keeping a parallel list
    here in step by hand. Dict order follows the file, which is the order
    snapshots record prices in.

    The Yahoo symbol still lives in TICKERS: it is not always the asset's
    own ticker (S.NYSE is quoted as plain 'S'), so it cannot be derived.
    """
    with open(ASSETS, 'r', encoding='utf-8') as f:
        content = f.read()
    return {
        m.group(2): m.group(1)
        for m in re.finditer(r"(?m)^\s+(\w+):\s*\{[^}]*?priceKey:\s*'(\w+)'", content)
    }


def parse_assets(priced: dict) -> dict:
    with open(ASSETS, 'r', encoding='utf-8') as f:
        content = f.read()
    result = {}
    for name in tuple(priced.values()) + ('cash',):
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


def required_keys(assets: dict, priced: dict) -> set:
    """Rates, plus a price for each asset actually held.

    Every ticker is still fetched and stored, holdings or not: the history
    is a price record, and an unbroken series is what lets a fund's
    sparkline span a period spent out of the market. But only a held asset
    may *gate* the update. Letting a zero-holding fund do so means one
    Yahoo hiccup on a position worth nothing discards the entire snapshot,
    including the prices of the positions that are worth something.

    An omitted key reads back as MISSING_PRICE in portfolio.js, which drops
    the point from the sparkline rather than charting a fake zero.
    """
    return set(RATE_KEYS) | {
        key for key, name in priced.items()
        if sum(assets.get(name, {}).values()) > 0
    }


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

    priced = parse_price_keys()
    if not priced:
        # Every asset is declared in assets.js; parsing none of them means
        # the file is unreadable, not that the portfolio is empty. Writing
        # a priceless snapshot would silently corrupt the history.
        print('ERROR: no priceKey declarations found in assets.js — history not updated.', file=sys.stderr)
        sys.exit(1)
    assets = parse_assets(priced)

    missing = required_keys(assets, priced) - set(prices.keys())
    if missing:
        print(f'ERROR: missing prices: {", ".join(sorted(missing))} — history not updated.', file=sys.stderr)
        sys.exit(1)

    omitted = [k for k in priced if k not in prices]
    if omitted:
        print(f'  NOTE: no price for unheld {", ".join(omitted)} — omitted from this snapshot.')

    entry = {
        'ts': now.astimezone(pytz.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'rates':  {k: prices[k] for k in RATE_KEYS},
        'prices': {k: prices[k] for k in priced if k in prices},
        'assets': assets,
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
