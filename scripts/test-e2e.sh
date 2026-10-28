#!/bin/bash
# ============================================================
# KolosalCut — test end-to-end API
# ============================================================
set -e
BASE="http://localhost:3000"

echo "=== [1] Membuat video uji 70 detik 1920x1080 (landscape + audio) ==="
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=70" \
  -f lavfi -i "sine=frequency=440:duration=70" \
  -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p \
  -c:a aac -b:a 96k -shortest \
  /home/z/my-project/uploads/test_source.mp4
echo "OK: $(du -h /home/z/my-project/uploads/test_source.mp4 | cut -f1)"

echo "=== [2] Upload ==="
UPLOAD=$(curl -s -X POST "$BASE/api/upload" -F "file=@/home/z/my-project/uploads/test_source.mp4;type=video/mp4;filename=Film Kolosal Nabi - Episode Uji.mp4")
echo "$UPLOAD"
UPID=$(echo "$UPLOAD" | python3 -c "import sys,json;print(json.load(sys.stdin)['uploadId'])")
echo "uploadId=$UPID"

echo "=== [3] Proses: split per 25 detik, cover beda 2s, judul+label+deskripsi, preset kolosal, 9:16 full ==="
PROCESS=$(curl -s -X POST "$BASE/api/process" -H "Content-Type: application/json" -d @- <<EOF
{
  "uploadId": "$UPID",
  "originalName": "Film Kolosal Nabi - Episode Uji.mp4",
  "title": "Film Kolosal Nabi - Episode Uji",
  "settings": {
    "splitMode": "duration",
    "splitSeconds": 25,
    "coverEnabled": true,
    "coverSame": false,
    "coverDuration": 2,
    "coverPos": "tengah",
    "title": {"enabled": true, "text": "Film Kolosal Nabi", "zone": "top", "relX": 0.5, "relY": 0.055, "size": 58},
    "label": {"enabled": true, "format": "episode", "prefix": "", "zone": "top", "relX": 0.5, "relY": 0.14, "size": 44},
    "desc": {"enabled": true, "text": "Kisah heroik yang menginspirasi jutaan umat. Simak sampai akhir!", "zone": "bottom", "relX": 0.5, "relY": 0.86, "size": 38},
    "preset": "kolosal",
    "bars": true,
    "barSize": "sedang",
    "ratio": "full",
    "zoom": 1,
    "quality": "fast"
  }
}
EOF
)
echo "$PROCESS"
JOBID=$(echo "$PROCESS" | python3 -c "import sys,json;print(json.load(sys.stdin)['jobId'])")
echo "jobId=$JOBID"

echo "=== [4] Polling status ==="
for i in $(seq 1 120); do
  STATUS=$(curl -s "$BASE/api/job?id=$JOBID")
  ST=$(echo "$STATUS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['status'], round(d['progress']*100), d['phase'], sep='|')")
  echo "  [$i] $ST"
  if echo "$ST" | rg -q "done|error"; then break; fi
  sleep 3
done

echo "$STATUS" > /tmp/job_status.json
echo "=== SELESAI ==="
cat /tmp/job_status.json | python3 -m json.tool
