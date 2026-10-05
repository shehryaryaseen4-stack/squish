#!/usr/bin/env bash
# FlipFree: get the latest code from GitHub, rebuild and restart, keeping the settings in .env.
#   sudo bash /opt/flipfree/deploy/update.sh
set -euo pipefail
APP_DIR="/opt/flipfree"
BRANCH="claude/cloudconvert-project-design-qzccpw"
IMAGE="flipfree"
[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash $0"; exit 1; }

git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
git -C "$APP_DIR" reset --hard FETCH_HEAD
docker build -t "$IMAGE" "$APP_DIR"
docker rm -f "$IMAGE" >/dev/null 2>&1 || true
docker run -d --name "$IMAGE" --restart unless-stopped --env-file "$APP_DIR/.env" \
  -p 127.0.0.1:3000:3000 "$IMAGE"
docker image prune -f >/dev/null
sleep 5
docker logs --tail 5 "$IMAGE"
echo "Updated."
