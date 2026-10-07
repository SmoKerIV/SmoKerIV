#!/usr/bin/env bash
# Deploy bakeralazzawi.com: the VPS pulls main, builds, and swaps in the
# new release atomically.
#
# The server keeps its own clone in /srv/apps/SmoKerIV. The licensed
# models in public/models/ are gitignored, so they live only in that
# clone; pass --sync-models to copy them up from this machine first.
# Usage: scripts/deploy.sh [--sync-models]   (DEPLOY_HOST overrides the target)
set -euo pipefail

HOST="${DEPLOY_HOST:-root@13.140.161.193}"
APP=/srv/apps/SmoKerIV
BASE=/var/www/bakeralazzawi.com
KEEP=5

cd "$(dirname "$0")/.."

if [ "$(git rev-parse HEAD)" != "$(git rev-parse '@{u}' 2>/dev/null)" ]; then
  echo "Local main differs from origin/main; push first so the server builds what you see." >&2
  exit 1
fi

if [ "${1:-}" = "--sync-models" ]; then
  rsync -az --delete public/models/ "$HOST:$APP/public/models/"
fi

ssh "$HOST" "set -euo pipefail
  cd $APP
  git fetch -q origin main
  git checkout -q main
  git merge -q --ff-only origin/main
  pnpm install --frozen-lockfile --silent
  pnpm build >/tmp/smokeriv-build.log 2>&1 || { tail -30 /tmp/smokeriv-build.log; exit 1; }

  models=\$(find dist/models -name '*.glb' | wc -l)
  [ \"\$models\" -ge 21 ] || { echo \"dist/models has \$models .glb files (expected 21)\" >&2; exit 1; }
  for f in index.html audio/manifest.json draco/draco_decoder.wasm baker-cv.pdf; do
    [ -f dist/\$f ] || { echo \"Missing dist/\$f\" >&2; exit 1; }
  done

  release=\$(date +%Y%m%d-%H%M%S)-\$(git rev-parse --short HEAD)
  mkdir -p $BASE/releases
  cp -a dist $BASE/releases/\$release
  ln -sfn $BASE/releases/\$release $BASE/current.tmp
  mv -Tf $BASE/current.tmp $BASE/current
  cd $BASE/releases && ls -1t | tail -n +$((KEEP + 1)) | xargs -r rm -rf --
  echo \"Live: releases/\$release\""
