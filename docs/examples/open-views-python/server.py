"""A fluid Open Views provider in Python, serving GT @gtView views.

Run `python3 server.py [module]` (default `http.client`), then set `http://localhost:8091` as an
Open Views endpoint in fluid. Standard library plus `gtoolkit_bridge`; protocol:
docs/architecture/OPEN-VIEWS.md.
"""

import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

import phlow_adapter as phlow
from domain import Domain

PORT = int(os.environ.get("PORT", "8091"))
DEFAULT_LIMIT = 100
ALLOWED_ORIGINS = {"http://127.0.0.1:5173", "http://localhost:5173"}  # fluid's dev server
DOMAIN = Domain(sys.argv[1] if len(sys.argv) > 1 else "http.client")

# Remote Phlow in Python has no actions yet, so the provider adds two to every view.
ACTIONS = [
    {"id": "refresh", "label": "Refresh", "icon": "reload"},
    {"id": "print", "label": "Print"},
]


class Failure(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def _object(object_id):
    obj = DOMAIN.resolve(object_id)
    if obj is None:
        raise Failure(404, "object-not-found", f"No object {object_id}")
    return obj


def _int(query, name, default, minimum):
    raw = query.get(name, [None])[0]
    if raw is None:
        return default
    if not re.fullmatch(r"\d+", raw) or int(raw) < minimum:
        raise Failure(400, "bad-request", f"Bad {name}: {raw}")
    return int(raw)


def _items(obj, key, query):
    path = query.get("path", [""])[0]
    if not re.fullmatch(r"\d+(\.\d+)*", path):
        raise Failure(400, "bad-request", f"Bad path: {path}")
    offset, limit = _int(query, "offset", 0, 0), _int(query, "limit", DEFAULT_LIMIT, 1)
    try:
        return phlow.items_page(obj, key, path, offset, limit)
    except phlow.BadPath:
        raise Failure(400, "bad-request", f"Nothing to page at {path}")


def answer(method, url):
    """The status and JSON body of one request."""
    parts = urlsplit(url)
    if parts.path == "/.well-known/fluid-views" and method == "GET":
        return 200, {"protocol": "fluid-views", "version": 1, "name": "Python (GT @gtView)", "capabilities": {"actions": True}}
    segments = [unquote(s, errors="strict") for s in parts.path.split("/")[1:]]
    if len(segments) < 3 or segments[0] != "objects" or segments[2] != "views" or not segments[1]:
        raise Failure(404, "object-not-found", f"No route {parts.path}")
    object_id, rest = segments[1], segments[3:]
    obj = _object(object_id)
    try:
        if not rest and method == "GET":
            kind, label = DOMAIN.describe(obj)
            return 200, {"object": {"id": object_id, "type": kind, "label": label}, "views": phlow.declarations(obj)}
        key = rest[0]
        if len(rest) == 1 and method == "GET":
            return 200, {**phlow.view_response(obj, key, DOMAIN), "actions": ACTIONS}
        if len(rest) == 2 and rest[1] == "items" and method == "GET":
            return 200, _items(obj, key, parse_qs(parts.query))
        if len(rest) == 3 and rest[1] == "actions" and method == "POST":
            phlow.view_response(obj, key, DOMAIN)  # 404 when the view does not exist
            if rest[2] == "refresh":
                return 200, {"refresh": True}
            if rest[2] == "print":
                return 200, {"message": str(obj)}
            raise Failure(404, "action-not-found", f"No action {rest[2]}")
    except phlow.ViewNotFound:
        raise Failure(404, "view-not-found", f"No view {rest[0]}")
    raise Failure(404, "object-not-found", f"No route {method} {parts.path}")


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        origin = self.headers.get("Origin")
        self.send_response(status)
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type")
        data = b"" if body is None else json.dumps(body).encode("utf-8")
        if body is not None:
            self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle(self, method):
        try:
            self._send(*answer(method, self.path))
        except Failure as failure:
            self._send(failure.status, {"error": failure.message, "code": failure.code})
        except UnicodeDecodeError:
            self._send(400, {"error": "Bad request", "code": "bad-request"})  # a malformed %-escape
        except Exception as error:
            self._send(500, {"error": str(error), "code": "internal"})

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(length)  # the body is empty or `{}`
        self._handle("POST")

    def do_OPTIONS(self):
        self._send(204, None)


if __name__ == "__main__":
    print(f"Open Views provider on http://localhost:{PORT} ({DOMAIN.default_id})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
