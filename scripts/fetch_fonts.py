#!/usr/bin/env python3
"""Unduh 7 font sinematik (lisensi OFL) dari Google Fonts + siapkan untuk bundel."""
import os
import re
import urllib.request

FONTS = {
    "anton":            "https://fonts.googleapis.com/css2?family=Anton",
    "bebas-neue":       "https://fonts.googleapis.com/css2?family=Bebas+Neue",
    "oswald":           "https://fonts.googleapis.com/css2?family=Oswald:wght@600",
    "montserrat":       "https://fonts.googleapis.com/css2?family=Montserrat:wght@800",
    "playfair-display": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@800",
    "cinzel":           "https://fonts.googleapis.com/css2?family=Cinzel:wght@700",
    "archivo-black":    "https://fonts.googleapis.com/css2?family=Archivo+Black",
}
# Carlito sudah ada di resources/fonts (default lama) — disalin juga ke public/fonts.

OUT_RES = "/home/z/my-project/resources/fonts"
OUT_PUB = "/home/z/my-project/public/fonts"
os.makedirs(OUT_RES, exist_ok=True)
os.makedirs(OUT_PUB, exist_ok=True)

# UA default curl -> Google Fonts mengembalikan TTF statis (bukan woff2)
HDRS = {"User-Agent": "curl/8.5.0"}

def fetch(url):
    req = urllib.request.Request(url, headers=HDRS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

for key, css_url in FONTS.items():
    css = fetch(css_url).decode("utf-8")
    # ambil blok @font-face subset latin (unicode-range memuat U+0000-00FF)
    blocks = re.findall(r"@font-face\s*\{[^}]+\}", css)
    url = None
    for b in blocks:
        if "U+0000-00FF" in b:
            m = re.search(r"url\((https://[^)]+\.ttf)\)", b)
            if m:
                url = m.group(1)
    if not url:  # fallback: ttf pertama yang ditemukan
        m = re.search(r"url\((https://[^)]+\.ttf)\)", css)
        url = m.group(1) if m else None
    if not url:
        raise SystemExit(f"GAGAL: tidak menemukan TTF untuk {key}")
    data = fetch(url)
    for out in (OUT_RES, OUT_PUB):
        with open(os.path.join(out, f"{key}.ttf"), "wb") as f:
            f.write(data)
    print(f"OK {key}.ttf ({len(data)/1024:.0f} KB)")

# salin Carlito ke public/fonts untuk pratinjau @font-face
import shutil
shutil.copy(os.path.join(OUT_RES, "Carlito-Bold.ttf"), os.path.join(OUT_PUB, "carlito.ttf"))
print("OK carlito.ttf (disalin)")
