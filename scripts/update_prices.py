#!/usr/bin/env python3
"""Fetch latest prices from Yahoo Finance and append a snapshot to history.js."""

import json
import re
import sys
from datetime import datetime
from pathlib import Path
import pytz
import yfinance as yf

# Which symbols to fetch, and which of them are the FX rates, are shared with
# the live price endpoint rather than restated here — two copies could drift,
# and then the recorded history and the dashboard would disagree about which
# funds exist. Same import route the dev server uses.
sys.path.insert(0, str(Path(__file__).parent.parent))
from api.prices import TICKERS, RATE_KEYS

HISTORY = 'history.js'
ASSETS  = 'assets.js'


def fetch_price(symbol: str):
    """Deliberately not shared with api.prices.fetch_price.

    This one names the failure on stderr so a symbol Yahoo would not serve is
    visible in the Actions log of a run that recorded nothing. The endpoint
    stays silent and reports through its JSON response instead.
    """
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


def read_history() -> list:
    """Snapshots already recorded. An unreadable or absent file reads as empty,
    which is what lets the very first run create it."""
    try:
        with open(HISTORY, 'r', encoding='utf-8') as f:
            raw = f.read()
        return json.loads(re.search(r'\[.*\]', raw, re.DOTALL).group())
    except Exception:
        return []


def _prague_day(ts: str, prague):
    """Calendar day a snapshot belongs to, in the timezone the app renders."""
    return datetime.strptime(ts, '%Y-%m-%dT%H:%M:%SZ') \
        .replace(tzinfo=pytz.utc).astimezone(prague).date()


def main():
    prague = pytz.timezone('Europe/Prague')
    now = datetime.now(prague)

    # --only-if-missing marks a backup run: it exists solely to cover a primary
    # run GitHub never dispatched, so on a day that already has a snapshot it
    # must do nothing. Without this it would overwrite the noon entry (newest
    # wins, below) and quietly turn every day into a late-afternoon reading.
    # Checked before the fetch — a no-op run should not call Yahoo at all.
    if '--only-if-missing' in sys.argv[1:]:
        if any(_prague_day(e['ts'], prague) == now.date() for e in read_history()):
            print(f'{now.date()} is already recorded — backup run has nothing to do.')
            return
        print(f'No snapshot for {now.date()} yet — backup run taking over.')

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

    existing = read_history()

    # One snapshot per Prague day, and the newest wins: a run that lands
    # after the day already has an entry — a delayed schedule, or a manual
    # dispatch — replaces it rather than appending. Two entries for one day
    # would otherwise cost the sparkline a day of history, since it plots
    # the last 30 *entries* rather than the last 30 days.
    kept = [e for e in existing if _prague_day(e['ts'], prague) != now.date()]
    if len(kept) != len(existing):
        print(f'  replacing the existing entry for {now.date()} with this one.')
    existing = kept
    existing.append(entry)
    with open(HISTORY, 'w', encoding='utf-8') as f:
        f.write(f'var PRICE_HISTORY={json.dumps(existing, indent=2)};\n')
    print(f'{HISTORY} updated ({len(existing)} records).')


if __name__ == '__main__':
    main()
