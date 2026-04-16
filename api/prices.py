from http.server import BaseHTTPRequestHandler
from datetime import datetime
import json
import os
import pytz
import yfinance as yf

TICKERS = {
    'FWRA_EUR': 'FWRA.MI',
    'SPYY_EUR': 'SPYY.DE',
    'S_USD':    'S',
    'EUR_CZK':  'EURCZK=X',
    'USD_CZK':  'USDCZK=X',
}

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
        missing = [k for k, v in prices.items() if v is None]

        if missing:
            body = json.dumps({'error': f'Failed to fetch: {", ".join(missing)}'}).encode()
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
            return

        body = json.dumps({
            'date':    date,
            'updated': updated,
            'rates':   {'EUR_CZK': prices['EUR_CZK'], 'USD_CZK': prices['USD_CZK']},
            'prices':  {'FWRA_EUR': prices['FWRA_EUR'], 'SPYY_EUR': prices['SPYY_EUR'], 'S_USD': prices['S_USD']},
        }).encode()

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)
