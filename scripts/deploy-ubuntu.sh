#!/usr/bin/env bash
set -Eeuo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "Run with sudo on the Ubuntu VM."
[[ -r /etc/os-release ]] || die "Ubuntu is required."
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || die "This script supports Ubuntu only."
command -v systemctl >/dev/null || die "systemd is required."
if ! command -v curl >/dev/null || ! command -v openssl >/dev/null; then
  apt-get update
  apt-get install -y curl ca-certificates openssl
fi

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"
origin=${1:-}
[[ $origin =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]] || die "Usage: sudo bash scripts/deploy-ubuntu.sh https://quiz.example.com"

if [[ ! -f .env ]]; then
  [[ -r /dev/tty ]] || die "A terminal is needed to enter the initial admin password."
  echo "First deployment: enter a strong initial admin password (at least 12 characters)."
  read -r -s -p 'Admin password: ' admin_password </dev/tty
  echo
  [[ ${#admin_password} -ge 12 ]] || die "Admin password is too short."
  [[ $admin_password =~ ^[a-zA-Z0-9._@%+-]+$ ]] || die "Use letters, digits, or . _ @ % + - in the password."
  umask 077
  postgres_password=$(openssl rand -hex 32)
  session_secret=$(openssl rand -hex 48)
  {
    printf 'POSTGRES_DB=quiz\nPOSTGRES_USER=quiz\nPOSTGRES_PASSWORD=%s\n' "$postgres_password"
    printf 'SESSION_SECRET=%s\nCOOKIE_SECURE=true\nWEB_ORIGIN=%s\n' "$session_secret" "$origin"
    printf 'ADMIN_USERNAME=admin\nADMIN_INITIAL_PASSWORD=%s\n' "$admin_password"
  } > .env
  unset admin_password postgres_password session_secret
else
  chmod 600 .env
  grep -Fxq "WEB_ORIGIN=$origin" .env || die ".env exists but WEB_ORIGIN differs; edit .env before retrying."
  grep -Fxq 'COOKIE_SECURE=true' .env || die "Set COOKIE_SECURE=true in .env."
fi

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

if ! command -v cloudflared >/dev/null; then
  arch=$(dpkg --print-architecture)
  [[ $arch == amd64 || $arch == arm64 ]] || die "Unsupported cloudflared architecture: $arch"
  package=$(mktemp --suffix=.deb)
  trap 'rm -f "$package"' EXIT
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}.deb" -o "$package"
  apt-get install -y "$package"
fi

docker compose config --quiet
docker compose up -d --build

ready=false
for attempt in $(seq 1 30); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
if [[ $ready != true ]]; then
  docker compose logs api proxy --tail=80 >&2
  die "Local health check failed."
fi
docker compose exec -T api node dist/db/seed-admin.js

if ! systemctl is-active --quiet cloudflared; then
  [[ -r /dev/tty ]] || die "Enter a Cloudflare Tunnel token from an interactive terminal."
  echo "Paste the remotely managed Cloudflare Tunnel token (input hidden)."
  read -r -s -p 'Tunnel token: ' tunnel_token </dev/tty
  echo
  [[ -n $tunnel_token ]] || die "Tunnel token is required."
  cloudflared service install "$tunnel_token"
  unset tunnel_token
fi
systemctl enable --now cloudflared

curl -fsS http://localhost:8080/api/health
echo
docker compose ps
echo "Local deployment ready. Configure the Cloudflare public hostname $origin -> http://localhost:8080, then test $origin/api/health."
