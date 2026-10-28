#!/usr/bin/env python3
"""Ukur kemiripan frame out.mp4 tiap 0.5s terhadap frame cover diam."""
import subprocess, tempfile, os
from PIL import Image

WORK = "/home/z/my-project/scripts/cover-repro"
still = Image.open(f"{WORK}/frame_1.png").convert("RGB").resize((48, 85))
sd = list(still.getdata())

def mae_at(t: float) -> float:
    fp = os.path.join(tempfile.gettempdir(), f"probe_{t}.png")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t), "-i", f"{WORK}/out.mp4",
         "-frames:v", "1", "-q:v", "5", fp],
        check=True,
    )
    im = Image.open(fp).convert("RGB").resize((48, 85))
    d = list(im.getdata())
    os.remove(fp)
    return sum(abs(a - b) for p, q in zip(sd, d) for a, b in zip(p, q)) / len(d)

for t in [0.5, 1.5, 2.5, 3.0, 3.5, 3.9, 4.0, 4.1, 4.5, 5.0, 6.0, 8.0, 11.0]:
    print(f"t={t:>5}: MAE vs cover-still = {mae_at(t):7.2f}")
