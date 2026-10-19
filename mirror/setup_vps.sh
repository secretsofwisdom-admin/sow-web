#!/bin/bash
# One-time setup of the Russia mirror on a fresh Debian 12 / Ubuntu 24.04
# VPS. Run as root on the server:
#
#   scp mirror/Caddyfile mirror/setup_vps.sh root@<server-ip>:/root/
#   ssh root@<server-ip> bash /root/setup_vps.sh
#
# Before running it, create the DNS record ru.secretsofwisdom.org -> <server-ip>
# as "DNS only" in Cloudflare: Caddy obtains the HTTPS certificate on first
# start and needs the name to resolve to this server already.

set -euo pipefail

if [ ! -f /root/Caddyfile ]; then
  echo "Copy mirror/Caddyfile to /root/Caddyfile first." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

# Security updates install themselves; this server is meant to be left alone.
apt-get install -y unattended-upgrades ufw
dpkg-reconfigure -f noninteractive unattended-upgrades

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Caddy from its official repository (https://caddyserver.com/docs/install).
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

install -m 644 /root/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl restart caddy

echo "Done. Check: curl -sI https://ru.secretsofwisdom.org/"
