#!/bin/bash
set -e
cd /home/z/my-project/resources
echo "[1/3] unduh whisper-cli Linux (untuk tes lokal)..."
curl -sL --retry 3 -o /tmp/whisper-ubuntu.tar.gz "https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-ubuntu-x64.tar.gz"
tar -xzf /tmp/whisper-ubuntu.tar.gz -C /tmp/whisper-ubuntu-extract 2>/dev/null || (mkdir -p /tmp/whisper-ubuntu-extract && tar -xzf /tmp/whisper-ubuntu.tar.gz -C /tmp/whisper-ubuntu-extract)
find /tmp/whisper-ubuntu-extract -type f | head -20
CLI=$(find /tmp/whisper-ubuntu-extract -name "whisper-cli" -type f | head -1)
cp "$CLI" bin/whisper-cli && chmod +x bin/whisper-cli
echo "[2/3] unduh model tiny + base + small (q5_1)..."
for m in tiny base small; do
  f="ggml-$m-q5_1.bin"
  [ -s "models/$f" ] || curl -sL --retry 3 -o "models/$f" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$f"
  echo "$f: $(du -m models/$f | cut -f1) MB"
done
echo "[3/3] SELESAI"
