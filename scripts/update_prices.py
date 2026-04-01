#!/usr/bin/env python3
"""Fetch latest prices from Yahoo Finance and update scripts/prices.js and scripts/history.js."""

import json
import re
import sys
from datetime import datetime
import pytz
import yfinance as yf


TICKERS = {
    "FWRA_EUR":  "FWRA.MI",
    "SPYY_EUR":  "SPYY.DE",
    "S_USD":     "S",
    "EUR_CZK":   "EURCZK=X",
    "USD_CZK":   "USDCZK=X",
}

OUTPUT  = "scripts/prices.js"
HISTORY = "history.js"
ASSETS  = "assets.js"


def parse_assets() -> dict:
    """Extract holdings from assets.js using regex."""
    with open(ASSETS, "r", encoding="utf-8") as f:
        content = f.read()
    result = {}
    for name in ("fwra", "spyy", "s"):
        m = re.search(rf'(?m)^\s+{name}:\s*\{{.*?holdings:\s*\{{([^}}]+)\}}', content, re.DOTALL)
        if m:
            result[name] = {
                k: float(v)
                for k, v in re.findall(r'(\w+):\s*([\d.]+)', m.group(1))
            }
    alpha_m = re.search(r'fixedCzk:\s*([\d.]+)', content)
    if alpha_m:
        result["alpha"] = {"fixedCzk": float(alpha_m.group(1))}
    return result


def fetch_price(ticker: str) -> float | None:
    try:
        data = yf.Ticker(ticker).history(period="2d")
        if not data.empty:
            return round(float(data["Close"].iloc[-1]), 2)
    except Exception as e:
        print(f"  WARNING: failed to fetch {ticker}: {e}", file=sys.stderr)
    return None


def czech_date(dt: datetime) -> str:
    return f"{dt.day}. {dt.month}. {dt.year}"


def main():
    prague = pytz.timezone("Europe/Prague")
    now = datetime.now(prague)
    date_str    = czech_date(now)
    updated_str = f"{czech_date(now)} {now.strftime('%H:%M')}"

    print(f"Fetching prices at {now.strftime('%Y-%m-%d %H:%M %Z')} ...")

    prices = {}
    for key, ticker in TICKERS.items():
        price = fetch_price(ticker)
        if price is None:
            print(f"  SKIP: could not fetch {ticker}, keeping existing value.")
        else:
            prices[key] = price
            print(f"  {ticker}: {price}")

    with open(OUTPUT, "r", encoding="utf-8") as f:
        content = f.read()

    # Update date and timestamp
    content = re.sub(r'"date":\s*"[^"]*"',    f'"date": "{date_str}"',       content)
    content = re.sub(r'"updated":\s*"[^"]*"', f'"updated": "{updated_str}"', content)

    # Update each price/rate only if successfully fetched
    for key, value in prices.items():
        content = re.sub(
            rf'"{key}":\s*[\d.]+',
            f'"{key}": {value}',
            content,
        )

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"{OUTPUT} updated for {date_str}.")

    # Append to history
    entry = {
        "ts": now.astimezone(pytz.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rates": {k: prices[k] for k in ["EUR_CZK", "USD_CZK"] if k in prices},
        "prices": {k: prices[k] for k in ["FWRA_EUR", "SPYY_EUR", "S_USD"] if k in prices},
        "assets": parse_assets(),
    }
    try:
        with open(HISTORY, "r", encoding="utf-8") as f:
            raw = f.read()
        existing = json.loads(re.search(r"\[.*\]", raw, re.DOTALL).group())
    except Exception:
        existing = []
    existing.append(entry)
    js_array = json.dumps(existing, indent=2)
    with open(HISTORY, "w", encoding="utf-8") as f:
        f.write(f"var PRICE_HISTORY={js_array};\n")
    print(f"{HISTORY} updated ({len(existing)} records).")


if __name__ == "__main__":
    main()
