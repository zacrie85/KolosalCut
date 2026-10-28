#!/usr/bin/env python3
"""
Generate overlay frame untuk KolosalCut:
- 3 frame neon BERPUTAR (animasi 48 frame @24fps = loop 2 detik, 1080x1920 RGBA)
- 4 frame minimalis statis
Output:
  resources/overlays/<key>/frame_%04d.png  (animasi, untuk ffmpeg)
  resources/overlays/<key>.png             (statis)
  public/overlays/<key>.webp|png           (pratinjau browser)
"""
import math
import os
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1920
SS = 2  # super-sampling: render di setengah resolusi lalu diperbesar 2x
FRAMES = 48
FPS = 24
MARGIN = 44
RADIUS = 64
STROKE = 10
N_POINTS = 800  # resolusi sampling perimeter
COMET_FRAC = 0.30  # panjang ekor sebagai fraksi perimeter

OUT_RES = "/home/z/my-project/resources/overlays"
OUT_PUB = "/home/z/my-project/public/overlays"
os.makedirs(OUT_PUB, exist_ok=True)


def rounded_rect_path(m, r, n):
    """Titik-titik sepanjang perimeter rounded-rect pada koordinat SETENGAH resolusi."""
    m, r = m / SS, r / SS
    x0, y0, x1, y1 = m, m, W / SS - m, H / SS - m
    segs = []
    # garis lurus + sudut kuadran (pusat sudut, sudut awal, sudut akhir)
    cw = x1 - x0 - 2 * r
    chh = y1 - y0 - 2 * r
    corners = [
        (x1 - r, y0 + r, -math.pi / 2, 0),          # kanan-atas
        (x1 - r, y1 - r, 0, math.pi / 2),           # kanan-bawah
        (x0 + r, y1 - r, math.pi / 2, math.pi),     # kiri-bawah
        (x0 + r, y0 + r, math.pi, 3 * math.pi / 2), # kiri-atas
    ]
    # mulai dari titik tengah sisi atas (x0+r+cw/2, y0) -> kanan -> bawah -> kiri -> atas
    pts = []
    pts.append((x0 + r + cw / 2, y0))
    pts.append((x1 - r, y0))
    for (cx, cy, a0, a1) in corners[:1]:
        pts += [(cx + r * math.cos(a0 + (a1 - a0) * i / 40), cy + r * math.sin(a0 + (a1 - a0) * i / 40)) for i in range(1, 41)]
    pts.append((x1, y1 - r))
    for (cx, cy, a0, a1) in corners[1:2]:
        pts += [(cx + r * math.cos(a0 + (a1 - a0) * i / 40), cy + r * math.sin(a0 + (a1 - a0) * i / 40)) for i in range(1, 41)]
    pts.append((x0 + r, y1))
    for (cx, cy, a0, a1) in corners[2:3]:
        pts += [(cx + r * math.cos(a0 + (a1 - a0) * i / 40), cy + r * math.sin(a0 + (a1 - a0) * i / 40)) for i in range(1, 41)]
    pts.append((x0, y0 + r))
    for (cx, cy, a0, a1) in corners[3:4]:
        pts += [(cx + r * math.cos(a0 + (a1 - a0) * i / 40), cy + r * math.sin(a0 + (a1 - a0) * i / 40)) for i in range(1, 41)]
    pts.append((x0 + r + cw / 2, y0))
    # resample jadi n titik berjarak seragam
    dists = [0.0]
    for i in range(1, len(pts)):
        dx = pts[i][0] - pts[i - 1][0]
        dy = pts[i][1] - pts[i - 1][1]
        dists.append(dists[-1] + math.hypot(dx, dy))
    total = dists[-1]
    out = []
    for i in range(n):
        t = i / n * total
        # cari segmen
        lo, hi = 0, len(pts) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if dists[mid] < t:
                lo = mid + 1
            else:
                hi = mid
        idx = max(1, lo)
        t0, t1 = dists[idx - 1], dists[idx]
        f = 0 if t1 == t0 else (t - t0) / (t1 - t0)
        x = pts[idx - 1][0] + (pts[idx][0] - pts[idx - 1][0]) * f
        y = pts[idx - 1][1] + (pts[idx][1] - pts[idx - 1][1]) * f
        out.append((x, y))
    return out, total


PATH, PERIM = rounded_rect_path(MARGIN, RADIUS, N_POINTS)


def draw_comet(layer_draw, pts, head_idx, tail_len, width, color_head, color_mid, color_tail):
    """Gambar ekor komet sepanjang path pts: kepala terang -> memudar (koordinat setengah)."""
    n = len(pts)
    seg = max(8, int(n * tail_len))
    for k in range(seg):
        i = (head_idx - k) % n
        f = 1.0 - k / seg  # 1 di kepala -> 0 di ekor
        a = f ** 1.7
        w = max(1.0, width * (0.25 + 0.75 * f ** 1.4)) / SS
        x0, y0 = pts[i]
        j = (i - 1) % n
        x1, y1 = pts[j]
        if f > 0.86:
            col = color_head
        else:
            fm = f / 0.86
            col = tuple(
                int(color_mid[c] * fm + color_tail[c] * (1 - fm)) for c in range(3)
            )
        alpha = int(255 * a)
        layer_draw.line([(x0, y0), (x1, y1)], fill=col + (alpha,), width=int(round(w * 2)))


def render_anim_frame(t, comets):
    """t = fase global 0..1. comets = list of (offset, width, c_head, c_mid, c_tail)."""
    hw, hh = W // SS, H // SS
    base = Image.new("RGBA", (hw, hh), (0, 0, 0, 0))
    crisp = Image.new("RGBA", (hw, hh), (0, 0, 0, 0))
    d = ImageDraw.Draw(crisp)
    n = len(PATH)
    for (offset, width, ch, cm, ct) in comets:
        head = int(((t + offset) % 1.0) * n)
        draw_comet(d, PATH, head, COMET_FRAC, width, ch, cm, ct)
    glow1 = crisp.filter(ImageFilter.GaussianBlur(6))
    glow2 = crisp.filter(ImageFilter.GaussianBlur(16))
    base.alpha_composite(glow2)
    base.alpha_composite(glow1)
    base.alpha_composite(crisp)
    return base.resize((W, H), Image.LANCZOS)


def hexc(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


DESIGNS = {
    "neon-emas": [
        (0.0, 11, hexc("FFF8E1"), hexc("F2C14E"), hexc("7C4A03")),
    ],
    "neon-ganda": [
        (0.0, 10, hexc("F0FDFF"), hexc("22D3EE"), hexc("155E75")),
        (0.5, 10, hexc("FFF5FD"), hexc("E879F9"), hexc("86198F")),
    ],
    "neon-pelangi": [],  # warna dihitung per-frame (hue berputar)
}


def rainbow_comet(t):
    hue0 = (t * 360 * 2) % 360
    import colorsys
    ch = tuple(int(c * 255) for c in colorsys.hsv_to_rgb((hue0 % 360) / 360, 0.25, 1.0))
    cm = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(((hue0 - 40) % 360) / 360, 0.85, 0.95))
    ct = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(((hue0 - 110) % 360) / 360, 0.9, 0.55))
    return [(0.0, 11, ch, cm, ct)]


for key, comets in DESIGNS.items():
    outdir = os.path.join(OUT_RES, key)
    shutil.rmtree(outdir, ignore_errors=True)
    os.makedirs(outdir, exist_ok=True)
    for f in range(FRAMES):
        t = f / FRAMES
        cset = comets if comets else rainbow_comet(t)
        img = render_anim_frame(t, cset)
        img.save(os.path.join(outdir, f"frame_{f:04d}.png"), optimize=False)
        if f % 12 == 0:
            print(f"  {key} frame {f}/{FRAMES}")
    print(f"OK {key}: {FRAMES} frame")

# ---- webp animasi untuk pratinjau ----
for key in DESIGNS:
    src = os.path.join(OUT_RES, key, "frame_%04d.png")
    dst = os.path.join(OUT_PUB, f"{key}.webp")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", src,
         "-loop", "0", "-q:v", "72", dst],
        check=True,
    )
    print(f"OK preview {key}.webp")

# ---- frame minimalis statis ----
def rounded_border(stroke, color, m, r):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([m, m, W - m, H - m], radius=r, outline=color, width=stroke)
    return img


def corner_brackets(stroke, color, m, arm):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = m, m, W - m, H - m
    for (cx, cy, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x1, y1, -1, -1), (x0, y1, 1, -1)]:
        d.line([(cx, cy), (cx + dx * arm, cy)], fill=color, width=stroke)
        d.line([(cx, cy), (cx, cy + dy * arm)], fill=color, width=stroke)
        rad = stroke  # ujung membulat
        d.ellipse([cx - rad / 2, cy - rad / 2, cx + rad / 2, cy + rad / 2], fill=color)
    return img


def double_lines(stroke, color, m, inset_y):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in (inset_y, H - inset_y):
        d.rounded_rectangle([m, y - stroke / 2, W - m, y + stroke / 2], radius=stroke / 2, fill=color)
    return img


WHITE = (255, 255, 255, 235)
AMBER = (242, 193, 78, 245)

statics = {
    "min-putih": rounded_border(4, WHITE, 56, 44),
    "min-emas": rounded_border(5, AMBER, 56, 44),
    "min-sudut": corner_brackets(9, WHITE, 58, 120),
    "min-garis": double_lines(4, WHITE, 60, 130),
}

for key, img in statics.items():
    img.save(os.path.join(OUT_RES, f"{key}.png"), optimize=True)
    img.save(os.path.join(OUT_PUB, f"{key}.png"), optimize=True)
    print(f"OK {key}.png")

print("SELESAI — semua overlay dibuat.")
