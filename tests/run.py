"""Menjalankan tests/index.html di Chromium headless dan keluar dengan kode 1 kalau ada uji
yang gagal. Dipakai CI; di komputer sendiri cukup buka /tests/ lewat server lokal.

    pip install playwright && python -m playwright install chromium
    python tests/run.py

Dependensi ini hanya untuk menjalankan uji. Pengguna CrootJS tetap tanpa npm/pip.
"""
import functools
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

LIB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    handler = functools.partial(QuietHandler, directory=LIB)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/tests/"

    with sync_playwright() as playwright:
        # SwiftShader memberi WebGL tanpa GPU, untuk uji model3d.js.
        browser = playwright.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page()
        page.on("console", lambda message: print(message.text) if not message.text.startswith("PASSED ") or "FAILED" in message.text else None)
        page.on("pageerror", lambda error: print("PAGEERROR:", error))
        page.goto(url)
        page.wait_for_function("document.body.dataset.status !== 'running'", timeout=120000)
        status = page.evaluate("document.body.dataset.status")
        browser.close()
    server.shutdown()
    return 0 if status == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
