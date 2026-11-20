"""Serve the local site and refresh Steam figures via official sources."""

import argparse
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import re
from time import time
from urllib.parse import urlsplit

from refresh_shooter_games import DATA, ROOT, current_online, read_snapshot, steam_chart, tracked_online


@lru_cache(maxsize=2)
def chart_for_minute(_minute):
    try:
        return steam_chart()
    except (OSError, ValueError, KeyError):
        return {}


@lru_cache(maxsize=128)
def online_for_minute(app_id, minute):
    chart = chart_for_minute(minute)
    if app_id in chart:
        return chart[app_id]
    try:
        return current_online(app_id)
    except (OSError, ValueError, KeyError):
        try:
            return tracked_online(app_id)
        except (OSError, ValueError, KeyError):
            return None


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if not path.startswith('/api/shooter-games/steam/'):
            super().do_GET()
            return
        match = re.fullmatch(r'/api/shooter-games/steam/(\d{1,9})', path)
        if not match or int(match[1]) not in self.server.steam_ids:
            self.send_error(404)
            return
        online = online_for_minute(int(match[1]), int(time() // 60))
        if online is None:
            self.send_response(204)
            self.end_headers()
            return
        body = json.dumps(online).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    records = read_snapshot(DATA / 'shooter-game-metrics.json')
    with ThreadingHTTPServer(('127.0.0.1', args.port), PreviewHandler) as server:
        server.steam_ids = {r['steamAppId'] for r in records.values() if 'steamAppId' in r}
        print(f'http://127.0.0.1:{server.server_port}/index.html#games', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
