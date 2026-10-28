#!/bin/bash
# Uji A: ffmpeg MASTER (seperti bundel Windows) — graph penuh dengan alpha
set -e
WORK=/home/z/my-project/scripts/cover-repro
FONTS=/home/z/my-project/resources/fonts
OV=/home/z/my-project/resources/overlays/neon-emas
FF=/tmp/ffmpeg-master-latest-linux64-gpl/bin/ffmpeg
cd "$WORK"

FONT_TITLE="$FONTS/anton.ttf"
FONT_LABEL="$FONTS/montserrat.ttf"

TP="drawtext=fontfile='$FONT_TITLE':textfile='$WORK/txt_title_p1.txt':fontsize=58:line_spacing=19:fontcolor=white:borderw=3:bordercolor=black@0.85:shadowx=2:shadowy=3:shadowcolor=black@0.45:x='clip(0.5000*w-text_w/2,18,w-text_w-18)':y='clip(0.0550*h,18,h-text_h-18)'"
LP="drawtext=fontfile='$FONT_LABEL':textfile='$WORK/txt_label_p1.txt':fontsize=44:line_spacing=14:fontcolor=0xF2C14E:borderw=2:bordercolor=black@0.9:shadowx=2:shadowy=3:shadowcolor=black@0.5:x='clip(0.5000*w-text_w/2,18,w-text_w-18)':y='clip(0.1400*h,18,h-text_h-18)'"
TC="drawtext=fontfile='$FONT_TITLE':textfile='$WORK/txt_title_c1.txt':fontsize=58:line_spacing=19:fontcolor=white:borderw=3:bordercolor=black@0.85:shadowx=2:shadowy=3:shadowcolor=black@0.45:x='clip(0.5000*w-text_w/2,18,w-text_w-18)':y='clip(0.0550*h,18,h-text_h-18)':alpha='min(1,t/0.6)'"
LC="drawtext=fontfile='$FONT_LABEL':textfile='$WORK/txt_label_c1.txt':fontsize=44:line_spacing=14:fontcolor=0xF2C14E:borderw=2:bordercolor=black@0.9:shadowx=2:shadowy=3:shadowcolor=black@0.5:x='clip(0.5000*w-text_w/2,18,w-text_w-18)':y='clip(0.1400*h,18,h-text_h-18)':alpha='min(1,t/0.6)'"
BAR=",drawbox=x=0:y=0:w=1080:h=235:color=black@1.0:t=fill,drawbox=x=0:y=1920-235:w=1080:h=235:color=black@1.0:t=fill"

FILTER="[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920:x=(in_w-1080)*0.5000:y=(in_h-1920)/2,fps=30,setsar=1${BAR}[pv0];[pv0][4:v]overlay=0:0[pv1];[pv1]null,${TP},${LP}[pv];[1:v]scale=2160:3840:force_original_aspect_ratio=increase:flags=lanczos,crop=2160:3840,zoompan=z='1+0.12*on/60':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=60:s=1080x1920:fps=30,setsar=1${BAR}[cv0];[cv0][3:v]overlay=0:0[cv1];[cv1]null,${TC},${LC}[cv];[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[pa];[2:a]aformat=sample_fmts=fltp:channel_layouts=stereo[sa];[cv][sa][pv][pa]concat=n=2:v=1:a=1[vout][aout]"

$FF -y -hide_banner -loglevel error -nostdin \
  -ss 0.000 -t 8.000 -i test.mp4 \
  -i frame_1.png \
  -f lavfi -t 2.00 -i "anullsrc=r=44100:cl=stereo" \
  -loop 1 -framerate 24 -t 3.00 -i "$OV/frame_%04d.png" \
  -loop 1 -framerate 24 -t 9.00 -i "$OV/frame_%04d.png" \
  -filter_complex "$FILTER" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart \
  -max_muxing_queue_size 1024 \
  out_master.mp4

echo -n "durasi video (master): "; ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 out_master.mp4
$FF -y -loglevel error -ss 1.5 -i out_master.mp4 -frames:v 1 -q:v 3 master_cover.png
$FF -y -loglevel error -ss 6.0 -i out_master.mp4 -frames:v 1 -q:v 3 master_part.png
echo "selesai: master_cover.png, master_part.png"
