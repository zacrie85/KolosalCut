#!/bin/bash
# v1.4.8 — video uji 12 scene x 1 dtk (warna solid berbeda), WebM (VP8+Opus)
# -> Turbo PASTI tidak layak ("bukan container MP4") = seluruh batch pakai MESIN KILAT
set -e
OUT=/home/z/my-project/upload/kctest-scenes.webm
COLORS=(0xFF0000 0x00FF00 0x0000FF 0xFFFF00 0xFF00FF 0x00FFFF 0xFF8000 0x8000FF 0xFF69B4 0x008080 0x006400 0x808080)
ARGS=()
FILT=""
for i in "${!COLORS[@]}"; do
  ARGS+=(-f lavfi -i "color=c=0x${COLORS[$i]}:size=640x360:rate=30:duration=1")
  FILT+="[$i:v]"
done
FILT+="concat=n=12:v=1:a=0[outv]"
ffmpeg -y -hide_banner -loglevel error "${ARGS[@]}" -filter_complex "$FILT" -map "[outv]" -c:v libvpx -b:v 1M /tmp/kc-scenes-v.webm
# audio: nada sunyi 12 dtk (opus)
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "anullsrc=r=48000:cl=stereo:duration=12" -c:a libopus -shortest /tmp/kc-scenes-a.webm
ffmpeg -y -hide_banner -loglevel error -i /tmp/kc-scenes-v.webm -i /tmp/kc-scenes-a.webm -c:v copy -c:a copy "$OUT"
echo "OK: $OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
