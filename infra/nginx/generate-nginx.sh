#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# generate-nginx.sh — Auto-generate nginx config from ~/sites/
# ═══════════════════════════════════════════════════════════════
# Convention: ~/sites/{domain}/  → served at that domain
#   - Put files directly in the domain folder (index.html, etc.)
#   - Or use a public/ subfolder (auto-detected)
#
# Usage:
#   ./generate-nginx.sh           # Generate + reload
#   ./generate-nginx.sh --dry-run # Print config, don't apply
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SITES_DIR="$HOME/sites"
CONF_FILE="$SITES_DIR/.nginx/nginx.conf"
DRY_RUN=false

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

mkdir -p "$SITES_DIR/.nginx"

# ── Build nginx.conf ──────────────────────────────────────────
cat > /tmp/nginx.conf.tmp << 'HEADER'
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Logging — structured for parsing
    log_format json escape=json
        '{"time":"$time_iso8601",'
        '"domain":"$host",'
        '"method":"$request_method",'
        '"path":"$uri",'
        '"status":$status,'
        '"size":$body_bytes_sent,'
        '"referer":"$http_referer",'
        '"ua":"$http_user_agent",'
        '"latency":"$request_time"}';

    access_log /var/log/nginx/access.log json;
    error_log /var/log/nginx/error.log warn;

    # Security headers (all sites)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

HEADER

# Generate a server block for each site directory
site_count=0
for site_dir in "$SITES_DIR"/*/; do
    [[ ! -d "$site_dir" ]] && continue
    domain=$(basename "$site_dir")

    # Skip hidden dirs and .nginx config dir
    [[ "$domain" == .* ]] && continue

    # Determine document root (prefer public/ subfolder)
    if [[ -d "$site_dir/public" ]]; then
        root="/usr/share/nginx/sites/$domain/public"
    else
        root="/usr/share/nginx/sites/$domain"
    fi

    # Check for site-specific config overrides
    extra=""
    if [[ -f "$site_dir/.headers" ]]; then
        extra=$(cat "$site_dir/.headers")
    fi

    cat >> /tmp/nginx.conf.tmp << SITE

    # ── $domain ──
    server {
        listen 80;
        server_name $domain www.$domain;
        root $root;
        index index.html index.htm;

        # No caching for easy updates
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        $extra
        location / {
            try_files \$uri \$uri/ \$uri.html /index.html =404;
        }

        # Block dotfiles
        location ~ /\. {
            deny all;
            return 404;
        }
    }
SITE

    site_count=$((site_count + 1))
done

# Default server — catch-all returns 444
cat >> /tmp/nginx.conf.tmp << 'FOOTER'

    # ── Catch-all ──
    server {
        listen 80 default_server;
        server_name _;
        return 444;
    }
}
FOOTER

if [ "$DRY_RUN" = true ]; then
    echo "# Generated nginx.conf — $site_count sites"
    cat /tmp/nginx.conf.tmp
    rm /tmp/nginx.conf.tmp
    exit 0
fi

# ── Deploy ────────────────────────────────────────────────────
mv /tmp/nginx.conf.tmp "$CONF_FILE"
echo "✓ Generated nginx.conf with $site_count sites"

# Reload nginx if container is running
if docker ps --format '{{.Names}}' | grep -q '^websites$'; then
    docker exec websites nginx -t 2>&1 && docker exec websites nginx -s reload
    echo "✓ Nginx reloaded"
else
    echo "⚠ Container 'websites' not running — start it with: cd ~/sites && docker compose up -d"
fi
