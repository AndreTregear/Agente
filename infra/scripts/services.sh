#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Yaya Services — Unified Management & Observability
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./services.sh                    # Full status dashboard
#   ./services.sh start              # Start all services
#   ./services.sh stop               # Stop all services
#   ./services.sh restart [svc]      # Restart all or one
#   ./services.sh logs [svc]         # Tail logs (business|health|all)
#   ./services.sh health             # Deep health check
#   ./services.sh errors [svc] [N]   # Last N errors (default 20)
#   ./services.sh crashes [svc]      # Show crash/restart history
#   ./services.sh audit              # Full infrastructure audit
#   ./services.sh update [svc]       # Git pull + rebuild + restart
#   ./services.sh db                 # Database stats
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
export PATH="$PATH:$HOME/.npm-global/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ECOSYSTEM="$MONOREPO_DIR/infra/pm2.config.cjs"
LOG_DIR="$HOME/logs"

log()  { echo -e "${GREEN}[yaya]${NC} $*"; }
warn() { echo -e "${YELLOW}[yaya]${NC} $*"; }
err()  { echo -e "${RED}[yaya]${NC} $*" >&2; }
dim()  { echo -e "${DIM}$*${NC}"; }

# ── Status Dashboard ──────────────────────────────────────────
show_status() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Yaya Services — Status Dashboard  $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    # PM2 status
    pm2 list 2>/dev/null

    echo ""
    echo -e "${CYAN}--- Docker Infrastructure ------------------------------------------${NC}"
    docker ps --format "  {{.Names}}\t{{.Status}}" 2>/dev/null | grep yaya_business | sort | column -t -s$'\t'

    echo ""
    echo -e "${CYAN}--- Endpoints ------------------------------------------------------${NC}"
    echo -e "  ${BOLD}Business${NC}:  http://localhost:3000  (cx.yaya.sh)"
    echo -e "  ${BOLD}Health${NC}:    http://localhost:3100"
    echo -e "  ${BOLD}Agente CEO${NC}: http://localhost:3005"
    echo -e "  ${DIM}vLLM:      http://localhost:8000  |  Whisper: http://localhost:9300${NC}"
    echo -e "  ${DIM}TTS:       http://localhost:9400  |  MinIO:   http://localhost:9001${NC}"
    echo -e "  ${DIM}Cal.com:   http://localhost:3002  |  Lago:    http://localhost:3010${NC}"
    echo -e "  ${DIM}Metabase:  http://localhost:3003${NC}"

    echo ""
    echo -e "${CYAN}--- Logs -----------------------------------------------------------${NC}"
    for svc in business health; do
        local out="$LOG_DIR/yaya-${svc}-out.log"
        local err_log="$LOG_DIR/yaya-${svc}-error.log"
        local out_size=$(du -sh "$out" 2>/dev/null | cut -f1 || echo "0")
        local err_size=$(du -sh "$err_log" 2>/dev/null | cut -f1 || echo "0")
        local err_count=$(wc -l < "$err_log" 2>/dev/null || echo "0")
        echo -e "  ${BOLD}${svc}${NC}: out=${out_size} err=${err_size} (${err_count} lines)"
    done
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ── Deep Health Check ─────────────────────────────────────────
check_health() {
    echo ""
    echo -e "${CYAN}=== Deep Health Check ==============================================${NC}"
    echo ""
    local failures=0

    # App services
    for svc_name in "Business:3000" "Health:3100"; do
        local name="${svc_name%%:*}"
        local port="${svc_name##*:}"
        echo -n "  $name (port $port): "
        local start_ms=$(date +%s%N)
        if result=$(curl -sf --max-time 5 "http://localhost:$port/api/v1/health" 2>/dev/null); then
            local end_ms=$(date +%s%N)
            local latency_ms=$(( (end_ms - start_ms) / 1000000 ))
            local status=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
            if [ "$status" = "healthy" ]; then
                echo -e "${GREEN}OK healthy${NC} ${DIM}(${latency_ms}ms)${NC}"
                # Show sub-checks
                echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin).get('checks', {})
for k, v in d.items():
    s = v.get('status', '?')
    l = v.get('latencyMs', '?')
    icon = 'OK' if s == 'ok' else 'FAIL'
    print(f'    {icon} {k}: {s} ({l}ms)')
" 2>/dev/null
            else
                echo -e "${RED}FAIL $status${NC}"
                failures=$((failures + 1))
            fi
        else
            echo -e "${RED}FAIL unreachable${NC}"
            failures=$((failures + 1))
        fi
    done

    # Infrastructure services
    echo ""
    echo -e "  ${BOLD}Infrastructure:${NC}"

    echo -n "    vLLM:     "
    if curl -sf --max-time 5 http://localhost:8000/v1/models -H "Authorization: Bearer megustalaia" >/dev/null 2>&1; then
        echo -e "${GREEN}OK serving${NC}"
    else
        echo -e "${RED}FAIL down${NC}"; failures=$((failures + 1))
    fi

    echo -n "    Postgres: "
    if docker exec yaya_business-postgres-1 pg_isready -U yaya_prod >/dev/null 2>&1; then
        local db_size=$(docker exec yaya_business-postgres-1 psql -U yaya_prod -d postgres -t -c "
            SELECT pg_size_pretty(sum(pg_database_size(datname)))
            FROM pg_database
            WHERE datname IN ('yaya_business','yaya_health');" 2>/dev/null | xargs)
        echo -e "${GREEN}OK ready${NC} ${DIM}(data: $db_size)${NC}"
    else
        echo -e "${RED}FAIL down${NC}"; failures=$((failures + 1))
    fi

    echo -n "    Redis:    "
    if docker exec yaya_business-redis-1 redis-cli ping >/dev/null 2>&1; then
        local redis_mem=$(docker exec yaya_business-redis-1 redis-cli info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        echo -e "${GREEN}OK${NC} ${DIM}(mem: $redis_mem)${NC}"
    else
        echo -e "${RED}FAIL down${NC}"; failures=$((failures + 1))
    fi

    echo -n "    Whisper:  "
    if curl -sf --max-time 5 http://localhost:9300/ >/dev/null 2>&1; then
        echo -e "${GREEN}OK ready${NC}"
    else
        echo -e "${YELLOW}~ check manually${NC}"
    fi

    echo -n "    MinIO:    "
    if docker exec yaya_business-minio-1 mc ready local >/dev/null 2>&1; then
        echo -e "${GREEN}OK ready${NC}"
    else
        echo -e "${YELLOW}~ check manually${NC}"
    fi

    echo ""
    if [ $failures -gt 0 ]; then
        echo -e "  ${RED}WARNING: $failures service(s) failing!${NC}"
    else
        echo -e "  ${GREEN}All systems operational${NC}"
    fi
    echo ""
}

# ── Error Log Viewer ──────────────────────────────────────────
show_errors() {
    local svc="${1:-all}"
    local count="${2:-20}"

    echo ""
    echo -e "${CYAN}=== Recent Errors (last $count) ====================================${NC}"
    echo ""

    if [ "$svc" = "all" ] || [ "$svc" = "business" ]; then
        echo -e "  ${BOLD}-- yaya-business --${NC}"
        local err_file="$LOG_DIR/yaya-business-error.log"
        local out_file="$LOG_DIR/yaya-business-out.log"
        if [ -s "$err_file" ]; then
            tail -n "$count" "$err_file" | while read -r line; do
                echo -e "  ${RED}$line${NC}"
            done
        else
            # Search stdout for ERROR level
            grep -i '"level":50\|"level":"error"\|ERROR' "$out_file" 2>/dev/null | tail -n "$count" | while read -r line; do
                echo -e "  ${RED}$(echo "$line" | cut -c1-200)${NC}"
            done || echo -e "  ${GREEN}No errors found${NC}"
        fi
        echo ""
    fi

    if [ "$svc" = "all" ] || [ "$svc" = "health" ]; then
        echo -e "  ${BOLD}-- yaya-health --${NC}"
        local err_file="$LOG_DIR/yaya-health-error.log"
        local out_file="$LOG_DIR/yaya-health-out.log"
        if [ -s "$err_file" ]; then
            tail -n "$count" "$err_file" | while read -r line; do
                echo -e "  ${RED}$line${NC}"
            done
        else
            grep -i '"level":50\|"level":"error"\|ERROR' "$out_file" 2>/dev/null | tail -n "$count" | while read -r line; do
                echo -e "  ${RED}$(echo "$line" | cut -c1-200)${NC}"
            done || echo -e "  ${GREEN}No errors found${NC}"
        fi
        echo ""
    fi
}

# ── Crash / Restart History ───────────────────────────────────
show_crashes() {
    local svc="${1:-all}"

    echo ""
    echo -e "${CYAN}=== Crash & Restart History ========================================${NC}"
    echo ""

    # PM2 restart counts and metadata
    pm2 jlist 2>/dev/null | python3 -c "
import sys, json
from datetime import datetime

apps = json.load(sys.stdin)
for app in apps:
    name = app.get('name', '?')
    if name == 'pm2-logrotate':
        continue
    pm2_env = app.get('pm2_env', {})
    restarts = pm2_env.get('restart_time', 0)
    unstable = pm2_env.get('unstable_restarts', 0)
    status = pm2_env.get('status', '?')
    uptime = pm2_env.get('pm_uptime', 0)
    created = pm2_env.get('created_at', 0)
    pid = app.get('pid', '?')

    up_str = datetime.fromtimestamp(uptime/1000).strftime('%Y-%m-%d %H:%M:%S') if uptime else '?'
    created_str = datetime.fromtimestamp(created/1000).strftime('%Y-%m-%d %H:%M:%S') if created else '?'

    print(f'  {name}:')
    print(f'    Status:           {status} (PID {pid})')
    print(f'    Created:          {created_str}')
    print(f'    Last start:       {up_str}')
    print(f'    Total restarts:   {restarts}')
    print(f'    Unstable restarts: {unstable}')
    if restarts > 0:
        print(f'    WARNING: Has restarted {restarts} time(s)')
    print()
" 2>/dev/null

    # Check for OOM kills in dmesg (needs sudo)
    echo -e "  ${DIM}Docker container restarts:${NC}"
    docker ps --format "  {{.Names}}\t{{.Status}}" 2>/dev/null | grep yaya_business | while read -r line; do
        echo "  $line"
    done
    echo ""
}

# ── Full Infrastructure Audit ─────────────────────────────────
run_audit() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Full Infrastructure Audit  $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

    # 1. System resources
    echo ""
    echo -e "  ${BOLD}System Resources${NC}"
    echo -e "  ---------------"
    echo "  CPU:    $(nproc) cores, load: $(cat /proc/loadavg | cut -d' ' -f1-3)"
    echo "  Memory: $(free -h | awk '/^Mem:/{print $3"/"$2" used ("$7" available)"}')"
    echo "  Disk:   $(df -h / | awk 'NR==2{print $3"/"$2" used ("$5")"}')"
    echo "  Swap:   $(free -h | awk '/^Swap:/{print $3"/"$2" used"}')"

    # 2. GPU
    echo ""
    echo -e "  ${BOLD}GPU Status${NC}"
    echo -e "  ----------"
    nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu \
        --format=csv,noheader,nounits 2>/dev/null | while IFS=, read -r idx name mem_used mem_total util temp; do
        echo "  GPU $idx: $name -- ${mem_used}MB/${mem_total}MB (${util}% util, ${temp}C)"
    done || echo "  No GPUs detected"

    # 3. Database sizes & connection counts
    echo ""
    echo -e "  ${BOLD}Databases${NC}"
    echo -e "  ---------"
    docker exec yaya_business-postgres-1 psql -U yaya_prod -d postgres -t -c "
        SELECT datname, pg_size_pretty(pg_database_size(datname)) as size,
               numbackends as connections
        FROM pg_stat_database
        WHERE datname IN ('yaya_business', 'yaya_health', 'calcom_db', 'lago_db', 'metabase_db')
        ORDER BY pg_database_size(datname) DESC;" 2>/dev/null | while read -r line; do
        [ -n "$line" ] && echo "  $line"
    done

    # 4. Redis stats
    echo ""
    echo -e "  ${BOLD}Redis${NC}"
    echo -e "  -----"
    docker exec yaya_business-redis-1 redis-cli info stats 2>/dev/null | grep -E "total_commands|connected_clients|rejected_connections|keyspace_hits|keyspace_misses" | while read -r line; do
        echo "    $line"
    done
    docker exec yaya_business-redis-1 redis-cli info keyspace 2>/dev/null | grep -v "^#" | while read -r line; do
        [ -n "$line" ] && echo "    $line"
    done

    # 5. Log analysis
    echo ""
    echo -e "  ${BOLD}Log Analysis (last 24h)${NC}"
    echo -e "  ----------------------"
    for svc in business health; do
        local log_file="$LOG_DIR/yaya-${svc}-out.log"
        local err_file="$LOG_DIR/yaya-${svc}-error.log"
        if [ -f "$log_file" ]; then
            local total=$(wc -l < "$log_file" 2>/dev/null || echo 0)
            local errors=$(grep -ci '"level":50\|ERROR' "$log_file" 2>/dev/null || echo 0)
            local warns=$(grep -ci '"level":40\|WARN' "$log_file" 2>/dev/null || echo 0)
            local stderr_lines=$(wc -l < "$err_file" 2>/dev/null || echo 0)
            echo "  yaya-${svc}: ${total} total, ${errors} errors, ${warns} warnings, ${stderr_lines} stderr"
        else
            echo "  yaya-${svc}: no log file"
        fi
    done

    # 6. Docker container health
    echo ""
    echo -e "  ${BOLD}Container Health${NC}"
    echo -e "  ----------------"
    docker ps --format "{{.Names}}\t{{.Status}}\t{{.Size}}" 2>/dev/null | grep yaya_business | sort | while IFS=$'\t' read -r name status size; do
        local icon="OK"
        [[ "$status" == *"unhealthy"* ]] && icon="FAIL"
        [[ "$status" == *"starting"* ]] && icon="~"
        echo "  $icon $name: $status"
    done

    # 7. Network ports
    echo ""
    echo -e "  ${BOLD}Listening Ports${NC}"
    echo -e "  ---------------"
    ss -tlnp 2>/dev/null | grep -E ":(3000|3100|3005|5432|6379|8000|9[0-9]{3}) " | awk '{print "  " $4}' | sort -t: -k2 -n | uniq

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ── Database Stats ────────────────────────────────────────────
show_db_stats() {
    echo ""
    echo -e "${CYAN}=== Database Statistics ============================================${NC}"
    echo ""

    for db in yaya_business yaya_health; do
        echo -e "  ${BOLD}$db${NC}"
        echo -e "  ------------"
        docker exec yaya_business-postgres-1 psql -U yaya_prod -d "$db" -c "
            SELECT schemaname || '.' || relname AS table,
                   n_live_tup AS rows,
                   pg_size_pretty(pg_total_relation_size(relid)) AS size
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 15;" 2>/dev/null
        echo ""
    done
}

# ── Update Service ────────────────────────────────────────────
do_update() {
    local svc="${1:-all}"

    if [ "$svc" = "all" ] || [ "$svc" = "business" ]; then
        log "Updating yaya-business..."
        cd ~/yaya_business && git pull --ff-only
        cd ~/yaya_business/autobot && npm ci && npm run build
        pm2 restart yaya-business
    fi

    if [ "$svc" = "all" ] || [ "$svc" = "health" ]; then
        log "Updating yaya-health..."
        cd ~/yaya_health && git pull --ff-only
        cd ~/yaya_health && npm ci && npm run build
        pm2 restart yaya-health
    fi

    sleep 3
    show_status
    check_health
}

# ── Main ──────────────────────────────────────────────────────
ACTION="${1:-status}"
TARGET="${2:-all}"
COUNT="${3:-20}"

case "$ACTION" in
    status)     show_status ;;
    start)      pm2 start "$ECOSYSTEM" && sleep 5 && show_status ;;
    stop)       pm2 stop all && show_status ;;
    restart)
        if [ "$TARGET" = "all" ]; then
            pm2 restart all
        else
            pm2 restart "yaya-$TARGET"
        fi
        sleep 3 && show_status
        ;;
    logs)
        case "$TARGET" in
            health)   pm2 logs yaya-health --lines 50 ;;
            business) pm2 logs yaya-business --lines 50 ;;
            *)        pm2 logs --lines 30 ;;
        esac
        ;;
    health|check)   check_health ;;
    errors|err)     show_errors "$TARGET" "$COUNT" ;;
    crashes)        show_crashes "$TARGET" ;;
    audit)          run_audit ;;
    db)             show_db_stats ;;
    update)         do_update "$TARGET" ;;
    *)
        echo "Usage: $0 {status|start|stop|restart|logs|health|errors|crashes|audit|db|update} [business|health|all] [count]"
        exit 1
        ;;
esac
