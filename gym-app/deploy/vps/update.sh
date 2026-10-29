#!/usr/bin/env bash
# Shows what changed since this server was last updated, then (if you say yes)
# pulls it and rebuilds the app. Run from gym-app/deploy/vps:  sudo ./update.sh
set -euo pipefail
cd "$(dirname "$0")"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch --quiet origin "$BRANCH"
NEW="$(git log --oneline HEAD..origin/"$BRANCH")"
if [ -z "$NEW" ]; then echo "Already up to date (branch $BRANCH)."; exit 0; fi
echo "New changes on $BRANCH:"
echo
git log --format='  %h  %ad  %s' --date=short HEAD..origin/"$BRANCH"
echo
echo "Files changed:"
git diff --stat HEAD..origin/"$BRANCH" | tail -n 15
echo
read -rp "Update the app now? [y/N] " ok
[ "${ok,,}" = y ] || { echo "Nothing changed."; exit 0; }
./backup.sh && echo "Backup saved in backups/"
git pull --ff-only origin "$BRANCH"
docker compose up -d --build
echo "Updated. The app restarts in a few seconds."
