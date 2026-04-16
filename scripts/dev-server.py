#!/usr/bin/env python3
"""Local dev server — serves static files and /api/prices."""

import http.server
import json
import mimetypes
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

MIME = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
}

# Import the API handler
sys.path.insert(0, str(ROOT))
from api.prices import fetch_price, czech_date, TICKERS
from datetime import datetime
import pytz


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f'  {self.path} {args[1]}')

    def do_GET(self):
        if self.path == '/api/prices':
            self._handle_api()
        else:
            self._handle_static()

    def _handle_api(self):
        prague = pytz.timezone('Europe/Prague')
        now = datetime.now(prague)
        date    = czech_date(now)
        updated = f'{date} {now.strftime("%H:%M")}'

        prices = {key: fetch_price(symbol) for key, symbol in TICKERS.items()}
        missing = [k for k, v in prices.items() if v is None]

        if missing:
            body = json.dumps({'error': f'Failed to fetch: {", ".join(missing)}'}).encode()
            self._respond(502, 'application/json', body)
            return

        body = json.dumps({
            'date':    date,
            'updated': updated,
            'rates':   {'EUR_CZK': prices['EUR_CZK'], 'USD_CZK': prices['USD_CZK']},
            'prices':  {'FWRA_EUR': prices['FWRA_EUR'], 'SPYY_EUR': prices['SPYY_EUR'], 'S_USD': prices['S_USD']},
        }).encode()
        self._respond(200, 'application/json', body)

    def _handle_static(self):
        path = self.path.split('?')[0]
        file_path = ROOT / (path.lstrip('/') or 'index.html')
        if not file_path.exists():
            self._respond(404, 'text/plain', b'Not found')
            return
        ext  = file_path.suffix
        mime = MIME.get(ext, 'application/octet-stream')
        self._respond(200, mime, file_path.read_bytes())

    def _respond(self, code, content_type, body):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    port = 3000
    print(f'Dev server running at http://localhost:{port}')
    http.server.HTTPServer(('', port), Handler).serve_forever()
