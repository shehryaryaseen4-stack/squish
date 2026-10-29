#!/bin/sh
# Copies every gym's data (and the licence signing key) to a dated archive in ./backups.
# Run it daily from cron:  0 3 * * * /path/to/gym-app/deploy/vps/backup.sh
set -e
cd "$(dirname "$0")"
mkdir -p backups
docker compose exec -T app tar -czf - -C /data . > "backups/gyms-$(date +%F).tar.gz"
find backups -name 'gyms-*.tar.gz' -mtime +30 -delete
