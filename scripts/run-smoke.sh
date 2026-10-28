#!/bin/bash
# Runner smoke test: nyalakan server, jalankan tes, matikan server.
set -u
cd /home/z/my-project/.next/standalone
rm -rf /tmp/kc-data
export PORT=3955 HOSTNAME=127.0.0.1 NODE_ENV=production KOLOSAL_DATA_DIR=/tmp/kc-data
node server.js > /tmp/kc-server.log 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT

for i in $(seq 1 30); do
  if curl -s -o /dev/null http://127.0.0.1:3955/; then break; fi
  sleep 1
done
curl -s -o /dev/null -w "server HTTP %{http_code}\n" http://127.0.0.1:3955/

cd /home/z/my-project
node scripts/smoke-v120.mjs
RC=$?
exit $RC
