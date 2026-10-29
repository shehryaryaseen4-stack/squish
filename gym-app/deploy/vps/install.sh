#!/usr/bin/env bash
# Puts the gym platform on a server that already hosts other sites.
#
#   sudo ./install.sh yourgymdomain.com
#
# 1. Buy the domain and point its DNS (A record, and www) at this server's IP first.
# 2. Run this from gym-app/deploy/vps. It asks for the owner login once and saves it in .env.
# The app runs in Docker on 127.0.0.1:WEB_PORT; nginx or Apache (whichever this server
# uses) gets a new site for the domain with a free Let's Encrypt certificate.
# Other sites on the server are not touched. DRY_RUN=1 shows what it would do.
set -euo pipefail

DOMAIN="${1:-}"
DRY="${DRY_RUN:-0}"
cd "$(dirname "$0")"
say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then echo "[dry run] $*"; else "$@"; fi; }
write() { # write FILE (content on stdin)
  if [ "$DRY" = 1 ]; then echo "[dry run] write $1:"; sed 's/^/    /'; else cat > "$1"; fi
}

if [ -z "$DOMAIN" ] || ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Usage: sudo ./install.sh yourgymdomain.com"; exit 1
fi
DOMAIN="${DOMAIN,,}"; DOMAIN="${DOMAIN#www.}"
if [ "$DRY" != 1 ] && [ "$(id -u)" != 0 ]; then echo "Run it with sudo."; exit 1; fi

# Hosting panels manage the web server themselves; editing their files breaks them.
for panel in /usr/local/CyberCP /www/server/panel /usr/local/hestia /usr/local/vesta /usr/local/psa /usr/local/cpanel; do
  if [ -d "$panel" ]; then
    echo "This server is managed by a hosting panel ($panel)."
    echo "Run:  WEB_ONLY=1 sudo ./install.sh $DOMAIN   to start the app only, then in the panel add a website"
    echo "for $DOMAIN with a reverse proxy to http://127.0.0.1:\${WEB_PORT:-3100} and turn on SSL."
    [ "${WEB_ONLY:-0}" = 1 ] || exit 1
  fi
done

say "Settings (.env)"
if [ ! -f .env ]; then
  read -rp "Owner panel email: " OWNER_EMAIL
  read -rsp "Owner panel password (8+ characters): " OWNER_PASSWORD; echo
  [ ${#OWNER_PASSWORD} -ge 8 ] || { echo "The password needs 8 or more characters."; exit 1; }
  WEB_PORT=3100
  while ss -ltn 2>/dev/null | grep -q ":$WEB_PORT "; do WEB_PORT=$((WEB_PORT + 1)); done
  MACHINE_PORT=8081
  while ss -ltn 2>/dev/null | grep -q ":$MACHINE_PORT "; do MACHINE_PORT=$((MACHINE_PORT + 1)); done
  printf 'DOMAIN=%s\nOWNER_EMAIL=%s\nOWNER_PASSWORD=%s\nWEB_PORT=%s\nMACHINE_PORT=%s\n' "$DOMAIN" "$OWNER_EMAIL" "$OWNER_PASSWORD" "$WEB_PORT" "$MACHINE_PORT" | write .env
  [ "$DRY" = 1 ] || chmod 600 .env
else
  echo "Using the existing .env"
fi
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
WEB_PORT="${WEB_PORT:-3100}"; MACHINE_PORT="${MACHINE_PORT:-8081}"

say "Docker"
if ! command -v docker >/dev/null 2>&1; then run sh -c 'curl -fsSL https://get.docker.com | sh'; else docker --version; fi

say "Starting the app on 127.0.0.1:$WEB_PORT (machines on port $MACHINE_PORT)"
run docker compose up -d --build

[ "${WEB_ONLY:-0}" = 1 ] && { say "App started. Add the site in your panel as described above."; exit 0; }

say "Checking that $DOMAIN points at this server"
MY_IP="$(curl -fsS4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DNS_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')"
echo "This server: $MY_IP   $DOMAIN: ${DNS_IP:-not found}"
DNS_OK=1
[ "$DNS_IP" = "$MY_IP" ] || { DNS_OK=0; echo "The domain doesn't point here yet: HTTPS is skipped. Set the A record, wait, and run this again."; }

if systemctl is-active --quiet nginx; then
  say "nginx: adding a site for $DOMAIN"
  CONF=/etc/nginx/conf.d/gym-$DOMAIN.conf
  [ -d /etc/nginx/sites-enabled ] && CONF=/etc/nginx/sites-available/gym-$DOMAIN
  write "$CONF" <<NGINX
# Gym platform for $DOMAIN (added by gym-app/deploy/vps/install.sh)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 50m;  # exercise videos are up to 40 MB

    location / {
        proxy_pass http://127.0.0.1:$WEB_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
NGINX
  [ -d /etc/nginx/sites-enabled ] && run ln -sf "$CONF" "/etc/nginx/sites-enabled/gym-$DOMAIN"
  run nginx -t
  run systemctl reload nginx
  if [ "$DNS_OK" = 1 ]; then
    command -v certbot >/dev/null || run apt-get install -y certbot python3-certbot-nginx
    run certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --non-interactive --agree-tos -m "$OWNER_EMAIL" || \
      run certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos -m "$OWNER_EMAIL"
  fi
elif systemctl is-active --quiet apache2; then
  say "Apache: adding a site for $DOMAIN"
  run a2enmod proxy proxy_http headers rewrite
  write "/etc/apache2/sites-available/gym-$DOMAIN.conf" <<APACHE
# Gym platform for $DOMAIN (added by gym-app/deploy/vps/install.sh)
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:$WEB_PORT/
    ProxyPassReverse / http://127.0.0.1:$WEB_PORT/
    LimitRequestBody 52428800
</VirtualHost>
APACHE
  run a2ensite "gym-$DOMAIN"
  run apachectl configtest
  run systemctl reload apache2
  if [ "$DNS_OK" = 1 ]; then
    command -v certbot >/dev/null || run apt-get install -y certbot python3-certbot-apache
    run certbot --apache -d "$DOMAIN" -d "www.$DOMAIN" --redirect --non-interactive --agree-tos -m "$OWNER_EMAIL" || \
      run certbot --apache -d "$DOMAIN" --redirect --non-interactive --agree-tos -m "$OWNER_EMAIL"
  fi
else
  echo "Neither nginx nor Apache is running, so nothing serves ports 80/443 here."
  echo "Use the all-in-one setup instead:  cd ../ && cp .env.example .env && docker compose up -d --build"
  exit 1
fi

say "Firewall"
if command -v ufw >/dev/null && ufw status | grep -q active; then run ufw allow "$MACHINE_PORT/tcp"; else echo "No ufw firewall active; port $MACHINE_PORT is open."; fi

say "Done"
echo "Website and owner panel:  https://$DOMAIN   (owner panel: https://$DOMAIN/owner)"
echo "Attendance machines:      server $DOMAIN, port $MACHINE_PORT, HTTPS off"
echo "Update later:             sudo ./update.sh   (in this folder; shows what changed first)"
echo "Daily backup:             add to crontab:  0 3 * * * $(pwd)/backup.sh"
