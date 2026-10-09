#!/usr/bin/env bash
# Flipit Free: one-command setup on a fresh Ubuntu 24.04 server (Contabo, Hetzner, DigitalOcean...).
#
#   curl -fsSL https://raw.githubusercontent.com/shehryaryaseen4-stack/squish/claude/cloudconvert-project-design-qzccpw/deploy/setup.sh -o setup.sh
#   sudo bash setup.sh yourdomain.com contact@yourdomain.com
#
# What it does (safe to run again; a second run updates the site):
#   1. installs Docker, Caddy, git and a firewall, and adds swap memory if the server has none
#   2. downloads the site from GitHub and builds the Docker image (10-20 minutes the first time)
#   3. writes the settings (.env) and starts the site; it restarts by itself after a reboot
#   4. Caddy serves HTTPS and passes requests to the site; use Cloudflare SSL mode "Full"
#   5. the firewall only lets Cloudflare reach the website ports (SSH stays open)
#
# Options (environment variables): SITE_NAME (default Flipit Free), MAX_JOBS (default: CPU count - 1,
# at least 1), NO_CF_FIREWALL=1 to leave ports 80/443 open to everyone (for testing without Cloudflare).
set -euo pipefail

DOMAIN="${1:-}"
CONTACT="${2:-}"
REPO="https://github.com/shehryaryaseen4-stack/squish.git"
BRANCH="claude/cloudconvert-project-design-qzccpw"
APP_DIR="/opt/flipfree"
IMAGE="flipfree"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash setup.sh yourdomain.com contact@yourdomain.com"
[ -n "$DOMAIN" ] || die "give your domain: sudo bash setup.sh yourdomain.com contact@yourdomain.com"
DOMAIN="$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*$##; s#^www\.##')"
printf '%s' "$DOMAIN" | grep -Eq '^[a-z0-9-]+(\.[a-z0-9-]+)+$' || die "\"$DOMAIN\" does not look like a domain name"
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || echo "Warning: this script is tested on Ubuntu 24.04; you have ${PRETTY_NAME:-unknown}."

export DEBIAN_FRONTEND=noninteractive

say "1/6 Installing Docker, Caddy, git and the firewall"
apt-get update -y
apt-get install -y ca-certificates curl git ufw docker.io
if ! apt-get install -y caddy; then
  # Caddy's own repository, in case the Ubuntu one is not enabled
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
systemctl enable --now docker

if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  say "Adding 4 GB of swap memory (helps LibreOffice and video conversions)"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "2/6 Downloading the site"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

say "3/6 Writing settings ($APP_DIR/.env)"
CPUS="$(nproc)"
JOBS="${MAX_JOBS:-$(( CPUS > 1 ? CPUS - 1 : 1 ))}"
ENV_FILE="$APP_DIR/.env"
# Keep values you already set (for example ADSENSE_CLIENT) when the script runs again.
old() { [ -f "$ENV_FILE" ] && grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }
[ -n "$CONTACT" ] || CONTACT="$(old CONTACT_EMAIL)"
ADS="$(old ADSENSE_CLIENT)"
cat > "$ENV_FILE" <<EOF
# Flipit Free settings. Edit, then run: sudo bash $APP_DIR/deploy/update.sh
SITE_NAME=${SITE_NAME:-$(old SITE_NAME | grep . || echo "Flipit Free")}
BASE_URL=https://$DOMAIN
FORCE_CANONICAL_HOST=1
CONTACT_EMAIL=$CONTACT
PORT=3000
# Caddy sits in front and passes on the visitor's IP from Cloudflare, so rate limits are per visitor.
TRUST_PROXY=1
MAX_JOBS=$JOBS
# Cloudflare's free plan stops waiting for an answer after 100 seconds.
JOB_TIMEOUT_S=90
# Cloudflare free plan accepts uploads up to 100 MB, so stay just under it.
MAX_FILE_MB=${MAX_FILE_MB:-$(old MAX_FILE_MB | grep . || echo 95)}
# Google AdSense publisher ID (ca-pub-...), once your account is approved.
ADSENSE_CLIENT=$ADS
# IndexNow key: lets Bing and others index new pages within minutes (made once, then kept).
INDEXNOW_KEY=${INDEXNOW_KEY:-$(old INDEXNOW_KEY | grep . || head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')}
EOF
for k in ADSENSE_SLOT_TOP ADSENSE_SLOT_BOTTOM ADSENSE_SLOT_LEFT ADSENSE_SLOT_RIGHT TWITTER_SITE PDF_EDITOR SOCIAL_LINKS ACCOUNTS BREVO_API_KEY RESEND_API_KEY MAIL_FROM ADMIN_EMAIL ADMIN_PASSWORD ADMIN_PATH GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET SESSION_SECRET; do
  v="$(old "$k")"; [ -n "$v" ] && echo "$k=$v" >> "$ENV_FILE"
done
chmod 600 "$ENV_FILE"

say "4/6 Building the site (first time: 10-20 minutes, it installs every conversion engine)"
docker build -t "$IMAGE" "$APP_DIR"
docker rm -f "$IMAGE" >/dev/null 2>&1 || true
# Published on localhost only: the outside world reaches it through Caddy.
docker run -d --name "$IMAGE" --restart unless-stopped -v flipfree-data:/data --env-file "$ENV_FILE" \
  -p 127.0.0.1:3000:3000 "$IMAGE"

say "5/6 Setting up HTTPS (Caddy) and the firewall"
CF_V4="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v4 || true)"
CF_V6="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v6 || true)"
CF_ALL="$(printf '%s\n%s\n' "$CF_V4" "$CF_V6" | grep -E '^[0-9a-f.:]+/[0-9]+$' || true)"
cat > /etc/caddy/Caddyfile <<EOF
{
  auto_https disable_redirects
}

# Cloudflare connects over HTTPS; this certificate is made by Caddy itself, which Cloudflare's
# SSL mode "Full" accepts. Visitors see Cloudflare's own trusted certificate.
https://$DOMAIN, https://www.$DOMAIN {
  tls internal
  encode gzip
  request_body {
    max_size 110MB
  }
  # Cloudflare sends the visitor's IP in CF-Connecting-IP; pass it on so rate limits apply per
  # visitor. Only Cloudflare can reach this port (firewall), so the header can be trusted.
  reverse_proxy 127.0.0.1:3000 {
    header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
  }
}

http://$DOMAIN, http://www.$DOMAIN {
  redir https://$DOMAIN{uri} permanent
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy && systemctl restart caddy

ufw allow OpenSSH >/dev/null
ufw delete allow 80/tcp >/dev/null 2>&1 || true
ufw delete allow 443/tcp >/dev/null 2>&1 || true
if [ "${NO_CF_FIREWALL:-0}" = "1" ] || [ -z "$CF_ALL" ]; then
  [ -z "$CF_ALL" ] && echo "Could not download Cloudflare's IP list; leaving ports 80/443 open to everyone."
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
else
  for ip in $CF_ALL; do ufw allow proto tcp from "$ip" to any port 80,443 >/dev/null; done
fi
ufw --force enable >/dev/null

say "6/6 Checking"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null -H "Host: $DOMAIN" -H 'X-Forwarded-Proto: https' http://127.0.0.1:3000/; then ok=1; break; fi
  sleep 2
done
[ "$ok" -eq 1 ] || { docker logs --tail 50 "$IMAGE"; die "the site did not start (log above)"; }
docker logs "$IMAGE" 2>&1 | grep -E 'listening|live' | tail -2 || true
docker exec "$IMAGE" node scripts/indexnow.js || true
IP="$(curl -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"

cat <<EOF

=====================================================================
  Flipit Free is running.

  In Cloudflare (dash.cloudflare.com -> $DOMAIN):
    DNS:   A record  @    -> $IP   (Proxied, orange cloud)
           A record  www  -> $IP   (Proxied, orange cloud)
    SSL/TLS -> Overview -> encryption mode: Full

  Then open https://$DOMAIN

  Settings: $ENV_FILE   (after editing: sudo bash $APP_DIR/deploy/update.sh)
  Logs:     docker logs -f $IMAGE
=====================================================================
EOF
