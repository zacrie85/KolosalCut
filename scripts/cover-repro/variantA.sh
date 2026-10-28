#!/bin/bash
# Binary search: varian graph untuk menemukan penyebab durasi membengkak
set -e
cd /home/z/my-project/scripts/cover-repro
WORK=/home/z/my-project/scripts/cover-repro
FONTS=/home/z/my-project/resources/fonts
FONT_TITLE="$FONTS/anton.ttf"
FONT_LABEL="$FONTS/montserrat.ttf"

TC="drawtext=fontfile='$FONT_TITLE':textfile='$WORK/txt_title_c1.txt':fontsize=58:line_spacing=19:fontcolor=white:borderw=3:bordercolor=black@0.85:shadowx=2:shadowy=3:shadowcolor=black@0.45:x='clip(0.5000*w-text_w/2,18,w-text_w-18)':y='clip(0.0550*h,18,h-text_h-18)':alpha='min(1,t/0.6)'"
LC="drawtext=fontfile='$FONT_LABEL':textfile='$WORK/txt_label_c1.txt':fontsize=44:line_spacing=14:fontcolor=0xF2C14E:borderw=2:bordercolor=black@0.9:shadowx=2:shadowy=3:shadowcolor=black@0.5:x='clip(0.5000*w-text_w/2,18,w-text_w-18)':y='clip(0.1400*h,18,h-text_h-18)':alpha='min(1,t/0.6)'"
BAR=",drawbox=x=0:y=0:w=1080:h=235:color=black@1.0:t=fill,drawbox=x=0:y=1920-235:w=1080:h=235:color=black@1.0:t=fill"

# ===== VARIAN A: tanpa overlay input (frame style none), cover + part via concat =====
FA="[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920:x=(in_w-1080)*0.5000:y=(in_h-1920)/2,fps=30,setsar=1${BAR}[pv0];[pv0]null[pv];[1:v]scale=2160:3840:force_original_aspect_ratio=increase:flags=lanczos,crop=2160:3840,zoompan=z='1+0.12*on/60':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=60:s=1080x1920:fps=30,setsar=1${BAR}[cv0];[cv0]null,${TC},${LC}[cv];[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[pa];[2:a]aformat=sample_fmts=fltp:channel_layouts=stereo[sa];[cv][sa][pv][pa]concat=n=2:v=1:a=1[vout][aout]"

echo "=== VARIAN A (tanpa overlay) ==="
ffmpeg -y -hide_banner -nostdin -loglevel error \
  -ss 0.000 -t 8.000 -i test.mp4 \
  -i frame_1.png \
  -f lavfi -t 2.00 -i "anullsrc=r=44100:cl=stereo" \
  -filter_complex "$FA" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart \
  outA.mp4 2>&1 | grep -Ei "frame=|duration|error" | tail -2 || true
echo -n "outA video: "; ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 outA.mp4
echo -n "outA audio: "; ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 outA.mp4
