# Membuat ikon aplikasi KolosalCut (icon.ico + icon.png)
# Desain: kotak gelap rounded, film-strip amber kiri, segitiga play dengan glow.
from PIL import Image, ImageDraw, ImageFilter

S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# --- latar gradasi vertikal (#1c1c22 -> #0a0a0d) dalam rounded rect ---
top, bot = (30, 30, 36), (10, 10, 14)
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bgd = ImageDraw.Draw(bg)
for y in range(S):
    t = y / S
    c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
    bgd.line([(0, y), (S, y)], fill=c)

mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([16, 16, S - 16, S - 16], radius=96, fill=255)
img.paste(bg, (0, 0), mask)

AMBER = (242, 193, 78, 255)

# --- film strip vertikal di sisi kiri ---
d = ImageDraw.Draw(img)
sx = 92
d.rounded_rectangle([sx, 120, sx + 58, S - 120], radius=22, fill=AMBER)
for i in range(6):
    y0 = 150 + i * 50
    d.rounded_rectangle([sx + 16, y0, sx + 42, y0 + 24], radius=7, fill=(22, 20, 16, 255))

# --- segitiga play dengan glow ---
cx, cy = 316, 256
tri = [(cx - 48, cy - 88), (cx - 48, cy + 88), (cx + 92, cy)]
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).polygon(tri, fill=AMBER)
img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(20)))
d = ImageDraw.Draw(img)
d.polygon(tri, fill=AMBER)

img.save("/home/z/my-project/build/icon.png")
img.save(
    "/home/z/my-project/build/icon.ico",
    sizes=[(256, 256), (128, 128), (96, 96), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)],
)
print("icon OK:", img.size)
