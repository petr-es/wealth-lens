#!/usr/bin/env python3
"""Fetch latest prices from Yahoo Finance and update data.js."""

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

    with open("data.js", "r", encoding="utf-8") as f:
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

    with open("data.js", "w", encoding="utf-8") as f:
        f.write(content)

    print(f"data.js updated for {date_str}.")


if __name__ == "__main__":
    main()
