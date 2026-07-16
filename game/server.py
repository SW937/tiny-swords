#!/usr/bin/env python3
import fcntl
import json
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent
CLEARS_FILE = ROOT / "data" / "clears.json"
DEFAULT_PORT = 8765


def local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def ensure_clears_file():
    CLEARS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not CLEARS_FILE.exists():
        CLEARS_FILE.write_text('{"count": 0}\n', encoding="utf-8")


def read_clears():
    ensure_clears_file()
    with CLEARS_FILE.open("r+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            handle.seek(0)
            data = json.load(handle)
            count = int(data.get("count", 0))
            if count < 0:
                count = 0
            return count
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def write_clears(count):
    ensure_clears_file()
    with CLEARS_FILE.open("r+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            handle.seek(0)
            handle.truncate()
            json.dump({"count": count}, handle)
            handle.write("\n")
            handle.flush()
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def increment_clears():
    ensure_clears_file()
    with CLEARS_FILE.open("r+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            handle.seek(0)
            data = json.load(handle)
            count = int(data.get("count", 0)) + 1
            handle.seek(0)
            handle.truncate()
            json.dump({"count": count}, handle)
            handle.write("\n")
            handle.flush()
            return count
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        if args and str(args[0]).startswith("GET /api/"):
            super().log_message(format, *args)
            return
        if args and str(args[0]).startswith("POST /api/"):
            super().log_message(format, *args)

    def do_GET(self):
        if self.path == "/api/clears":
            self._send_json({"count": read_clears()})
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/clears/increment":
            self._send_json({"count": increment_clears()})
            return
        self.send_error(404)

    def _send_json(self, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    ensure_clears_file()
    port = DEFAULT_PORT
    server = HTTPServer(("0.0.0.0", port), GameHandler)
    lan_ip = local_ip()
    print("================================")
    print("       ⚔  Tiny Swords  ⚔")
    print("================================")
    print(f"本机地址: http://127.0.0.1:{port}/")
    print(f"局域网地址: http://{lan_ip}:{port}/")
    print("其他玩家请用局域网地址打开，共享通关次数")
    print("关闭此窗口即可停止游戏服务器")
    print("================================")
    server.serve_forever()


if __name__ == "__main__":
    main()
