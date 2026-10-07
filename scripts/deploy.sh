#!/usr/bin/env bash
# Build locally and ship dist/ to the VPS as a new release.
#
# The licensed models in public/models/ are gitignored, so deploys must run
# from a machine that has them; the build is refused if they're missing.
# Usage: scripts/deploy.sh            (DEPLOY_HOST overrides the target)
set -euo pipefail

HOST="${DEPLOY_HOST:-root@13.140.161.193}"
BASE=/var/www/bakeralazzawi.com
KEEP=5

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Working tree has uncommitted changes; commit or stash first." >&2
  exit 1
fi

pnpm build

models=$(find dist/models -name '*.glb' 2>/dev/null | wc -l)
if [ "$models" -lt 21 ]; then
  echo "dist/models has $models .glb files (expected 21); public/models is missing or incomplete." >&2
  exit 1
fi
for f in dist/index.html dist/audio/manifest.json dist/draco/draco_decoder.wasm dist/baker-cv.pdf; do
  [ -f "$f" ] || { echo "Missing $f in the build." >&2; exit 1; }
done

release="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
echo "Uploading release $release to $HOST"

ssh "$HOST" "mkdir -p $BASE/releases"
rsync -az --delete \
  --link-dest="$BASE/current/" \
  dist/ "$HOST:$BASE/releases/$release/"

ssh "$HOST" "set -e
  ln -sfn $BASE/releases/$release $BASE/current.tmp
  mv -Tf $BASE/current.tmp $BASE/current
  cd $BASE/releases && ls -1t | tail -n +$((KEEP + 1)) | xargs -r rm -rf --"

echo "Live: $BASE/current -> releases/$release"
