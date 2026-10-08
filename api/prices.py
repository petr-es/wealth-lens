from http.server import BaseHTTPRequestHandler
from datetime import datetime
import json
import os
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

# Every position and cash balance converts through these, so a response
# without them is useless — they alone gate the endpoint. A missing asset
# price is omitted instead: the client knows the holdings and decides
# whether it matters (see _missingHeldPrices in scripts/updater.js).
RATE_KEYS = ('EUR_CZK', 'USD_CZK')

def fetch_price(symbol: str):
    try:
        info = yf.Ticker(symbol).info
        val = info.get('regularMarketPrice') or info.get('previousClose')
        return round(float(val), 2) if val is not None else None
    except Exception:
        return None

def czech_date(d: datetime) -> str:
    return f'{d.day}. {d.month}. {d.year}'

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        prague = pytz.timezone('Europe/Prague')
        now = datetime.now(prague)
        date    = czech_date(now)
        updated = f'{date} {now.strftime("%H:%M")}'

        prices = {key: fetch_price(symbol) for key, symbol in TICKERS.items()}
        missing_rates = [k for k in RATE_KEYS if prices[k] is None]

        if missing_rates:
            body = json.dumps({'error': f'Failed to fetch: {", ".join(missing_rates)}'}).encode()
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
            return

        body = json.dumps({
            'date':    date,
            'updated': updated,
            'rates':   {k: prices[k] for k in RATE_KEYS},
            'prices':  {k: v for k, v in prices.items() if k not in RATE_KEYS and v is not None},
        }).encode()

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)
