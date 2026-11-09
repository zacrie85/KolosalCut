"""Render halaman uji KolosalCut v1.4.3 -> screenshot (bingkai + posisi)."""
import functools
import http.server
import pathlib
import sys
import threading
from playwright.sync_api import sync_playwright

BASE = pathlib.Path("/home/z/my-project/kolosalcut/scripts/titleframe-test")
page = sys.argv[1] if len(sys.argv) > 1 else "test.html"
OUT = BASE / ("result.png" if page == "test.html" else "result-pos.png")

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(BASE))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1420, "height": 1600})
    errs = []
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    pg.goto(f"http://127.0.0.1:{port}/{page}")
    try:
        pg.wait_for_function("document.title === 'DONE'", timeout=8000)
    except Exception:
        pass
    pg.screenshot(path=str(OUT), full_page=True)
    b.close()
    srv.shutdown()
    if errs:
        print("console errors:", *errs[:12], sep="\n  ")
print("OK ->", OUT)
