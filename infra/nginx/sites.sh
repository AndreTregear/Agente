#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# sites.sh — Manage static sites
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./sites.sh                  # List all sites
#   ./sites.sh add <domain>     # Create new site scaffold
#   ./sites.sh remove <domain>  # Remove a site
#   ./sites.sh deploy           # Regenerate nginx + reload
#   ./sites.sh logs [domain]    # Tail access logs (optionally filtered)
#   ./sites.sh status           # Show container + site health
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SITES_DIR="$HOME/sites"
cd "$SITES_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

ACTION="${1:-list}"
DOMAIN="${2:-}"

case "$ACTION" in
    list|ls)
        echo ""
        echo -e "${CYAN}═══ Sites ═══════════════════════════════════════${NC}"
        echo ""
        for d in */; do
            [[ "$d" == ".nginx/" || "$d" == "logs/" ]] && continue
            domain="${d%/}"
            files=$(find "$d" -type f -not -path '*/\.*' | wc -l)
            size=$(du -sh "$d" 2>/dev/null | cut -f1)
            has_index="✗"
            [[ -f "$d/index.html" || -f "$d/public/index.html" ]] && has_index="✓"
            echo -e "  ${BOLD}$domain${NC}  ${DIM}($files files, $size)${NC}  index: $has_index"
        done
        echo ""
        local_count=$(ls -d */ 2>/dev/null | grep -cv '^\.\|^logs' || echo 0)
        echo -e "  ${DIM}$local_count sites total${NC}"
        echo ""
        ;;

    add|new|create)
        [[ -z "$DOMAIN" ]] && echo "Usage: $0 add <domain>" && exit 1
        if [[ -d "$DOMAIN" ]]; then
            echo -e "${YELLOW}Site $DOMAIN already exists${NC}"
            exit 1
        fi
        mkdir -p "$DOMAIN"
        cat > "$DOMAIN/index.html" << HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$DOMAIN</title>
<style>
body{font-family:system-ui;background:#0a0a0f;color:#e8e6e3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
h1{font-size:3rem;font-weight:800;letter-spacing:-.03em}
</style>
</head>
<body><h1>$DOMAIN</h1></body>
</html>
HTML
        echo -e "${GREEN}✓${NC} Created ~/sites/$DOMAIN/"
        echo -e "  Edit: ${CYAN}~/sites/$DOMAIN/index.html${NC}"
        echo -e "  Deploy: ${CYAN}./sites.sh deploy${NC}"
        echo -e "  Then add Cloudflare tunnel: ${CYAN}$DOMAIN → http://localhost:80${NC}"
        ;;

    remove|rm|delete)
        [[ -z "$DOMAIN" ]] && echo "Usage: $0 remove <domain>" && exit 1
        [[ ! -d "$DOMAIN" ]] && echo "Site $DOMAIN not found" && exit 1
        read -rp "Remove $DOMAIN? [y/N] " confirm
        [[ "$confirm" != "y" && "$confirm" != "Y" ]] && echo "Cancelled" && exit 0
        rm -rf "$DOMAIN"
        echo -e "${GREEN}✓${NC} Removed $DOMAIN"
        echo -e "  Run ${CYAN}./sites.sh deploy${NC} to update nginx"
        ;;

    deploy|reload|regen)
        bash "$SITES_DIR/generate-nginx.sh"
        ;;

    logs)
        if [[ -n "$DOMAIN" ]]; then
            tail -f "$SITES_DIR/logs/access.log" | grep --line-buffered "\"domain\":\"$DOMAIN\""
        else
            tail -f "$SITES_DIR/logs/access.log"
        fi
        ;;

    status)
        echo ""
        echo -e "${CYAN}═══ Sites Status ═══════════════════════════════${NC}"
        echo ""

        # Container
        if docker ps --format '{{.Names}}' | grep -q '^websites$'; then
            local_status=$(docker inspect websites --format '{{.State.Status}}' 2>/dev/null)
            echo -e "  Container: ${GREEN}$local_status${NC}"
        else
            echo -e "  Container: ${RED}not running${NC}"
        fi

        # Check each site
        echo ""
        for d in */; do
            [[ "$d" == ".nginx/" || "$d" == "logs/" ]] && continue
            domain="${d%/}"
            code=$(curl -sf -o /dev/null -w '%{http_code}' -H "Host: $domain" http://localhost:4400/ 2>/dev/null || echo "000")
            if [[ "$code" == "200" ]]; then
                echo -e "  ${GREEN}✓${NC} $domain ($code)"
            elif [[ "$code" == "000" ]]; then
                echo -e "  ${RED}✗${NC} $domain (unreachable)"
            else
                echo -e "  ${YELLOW}~${NC} $domain ($code)"
            fi
        done

        # Log stats
        echo ""
        if [[ -f "$SITES_DIR/logs/access.log" ]]; then
            log_size=$(du -sh "$SITES_DIR/logs/access.log" | cut -f1)
            echo -e "  ${DIM}Access log: $log_size${NC}"
        fi
        echo ""
        ;;

    *)
        echo "Usage: $0 {list|add|remove|deploy|logs|status} [domain]"
        exit 1
        ;;
esac
