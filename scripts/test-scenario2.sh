#!/bin/bash
# Test skenario 2 (versi cepat): fit+blur, zoom 1.6, cover sama 3s, preset hollywood, bar besar
set -e
BASE="http://localhost:3000"

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=16" \
  -f lavfi -i "sine=frequency=330:duration=16" \
  -c:v libx264 -preset ultrafast -crf 30 -pix_fmt yuv420p \
  -c:a aac -b:a 96k -shortest \
  /tmp/test_short.mp4

UP=$(curl -s -X POST "$BASE/api/upload" -F "file=@/tmp/test_short.mp4;type=video/mp4;filename=Pertempuran Badar 313 [1080p].mp4")
UPID=$(echo "$UP" | python3 -c "import sys,json;print(json.load(sys.stdin)['uploadId'])")
echo "uploadId=$UPID"

PR=$(curl -s -X POST "$BASE/api/process" -H "Content-Type: application/json" -d @- <<EOF
{
  "uploadId": "$UPID",
  "originalName": "Pertempuran Badar 313 [1080p].mp4",
  "settings": {
    "splitMode": "parts",
    "splitParts": 2,
    "coverEnabled": true,
    "coverSame": true,
    "coverDuration": 3,
    "coverPos": "awal",
    "title": {"enabled": true, "text": "Pertempuran Badar 313", "zone": "top", "relX": 0.5, "relY": 0.06, "size": 52},
    "label": {"enabled": true, "format": "part", "prefix": "", "zone": "top", "relX": 0.5, "relY": 0.14, "size": 40},
    "desc": {"enabled": false, "text": "", "zone": "bottom", "relX": 0.5, "relY": 0.86, "size": 38},
    "preset": "hollywood",
    "bars": true,
    "barSize": "besar",
    "ratio": "fit",
    "zoom": 1.6,
    "quality": "fast"
  }
}
EOF
)
JOBID=$(echo "$PR" | python3 -c "import sys,json;print(json.load(sys.stdin)['jobId'])")
echo "jobId=$JOBID"

for i in $(seq 1 60); do
  ST=$(curl -s "$BASE/api/job?id=$JOBID" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['status'],'|',round(d['progress']*100),'%','|',d['phase'],'|',d.get('error',''))")
  echo "[$i] $ST"
  if echo "$ST" | rg -q "done\||error\|"; then break; fi
  sleep 5
done
curl -s "$BASE/api/job?id=$JOBID" | python3 -m json.tool
