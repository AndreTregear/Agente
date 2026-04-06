#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Yaya Platform — Unified Start Script (Monorepo Edition)
# One command to rule them all: ./start.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[yaya]${NC} $*"; }
warn() { echo -e "${YELLOW}[yaya]${NC} $*"; }
err()  { echo -e "${RED}[yaya]${NC} $*"; }
info() { echo -e "${CYAN}[yaya]${NC} $*"; }

# ── Paths ──────────────────────────────────────────────────────
CORE_DIR="$HOME/yaya_business"
HEALTH_DIR="$HOME/yaya_health"
SPARKY_DIR="$HOME/sparkyfitness"
LOGS_DIR="$HOME/logs"
DOCKER_DIR="$MONOREPO_DIR/infra/docker"
PM2_CONFIG="$MONOREPO_DIR/infra/pm2.config.cjs"
NPM_BIN="$HOME/.npm-global/bin"
export PATH="$NPM_BIN:$PATH"

mkdir -p "$LOGS_DIR"

# ── Functions ──────────────────────────────────────────────────

check_docker() {
    if ! docker info >/dev/null 2>&1; then
        err "Docker is not running. Start Docker first."
        exit 1
    fi
}

wait_for_service() {
    local name="$1" url="$2" max_wait="${3:-120}"
    local elapsed=0
    while [ $elapsed -lt $max_wait ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            log "$name is ready"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    warn "$name did not become ready within ${max_wait}s"
    return 1
}

start_core_infra() {
    log "Starting core infrastructure (Postgres, Redis, MinIO, vLLM, Whisper, TTS)..."
    cd "$DOCKER_DIR"
    docker compose up -d postgres redis minio vllm whisper kokoro-tts backup
    wait_for_service "Postgres" "http://localhost:5432" 30 || true
    log "Waiting for Postgres health..."
    sleep 5
}

start_authentik() {
    log "Starting Authentik SSO..."
    cd "$DOCKER_DIR"
    docker compose up -d authentik-server authentik-worker
    wait_for_service "Authentik" "http://localhost:9090/-/health/ready/" 60
}

start_oss_services() {
    log "Starting OSS services (Cal.com, Lago, Metabase)..."
    cd "$DOCKER_DIR"
    docker compose up -d calcom lago-api lago-worker lago-front metabase
}

start_sparkyfitness() {
    log "Starting SparkyFitness..."
    cd "$SPARKY_DIR"
    docker compose up -d
    wait_for_service "SparkyFitness" "http://localhost:3004/api/health" 60
}

start_pm2_apps() {
    log "Starting PM2 apps (yaya-business, yaya-health, agente-ceo, scraper-worker, hpc-tunnel)..."

    if command -v pm2 >/dev/null 2>&1; then
        if [ -f "$PM2_CONFIG" ]; then
            pm2 start "$PM2_CONFIG" --env production 2>/dev/null || \
            pm2 restart all 2>/dev/null || true
        else
            # Start individually (fallback)
            if [ -d "$CORE_DIR/autobot/dist" ]; then
                cd "$CORE_DIR/autobot"
                pm2 start dist/index.js --name yaya-business --env production 2>/dev/null || \
                pm2 restart yaya-business 2>/dev/null || true
            fi
            if [ -d "$HEALTH_DIR/dist" ]; then
                cd "$HEALTH_DIR"
                pm2 start dist/index.js --name yaya-health --env production 2>/dev/null || \
                pm2 restart yaya-health 2>/dev/null || true
            fi
        fi
        pm2 save 2>/dev/null || true
    else
        warn "PM2 not found, skipping PM2-managed processes"
    fi

    wait_for_service "yaya-business" "http://localhost:3000/api/v1/health" 30 || true
    wait_for_service "yaya-health" "http://localhost:3100/api/v1/health" 30 || true
}

reload_nginx() {
    log "Reloading nginx..."
    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx
        log "Nginx reloaded"
    else
        err "Nginx config test failed!"
        return 1
    fi
}

show_status() {
    echo ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Yaya Platform Status"
    info "═══════════════════════════════════════════════════════════════"
    echo ""

    local services=(
        "Authentik SSO|http://localhost:9090/-/health/ready/|auth.yaya.sh"
        "yaya-business|http://localhost:3000/api/v1/health|biz.yaya.sh"
        "yaya-health|http://localhost:3100/api/v1/health|health.yaya.sh"
        "SparkyFitness|http://localhost:3004/api/health|health.yaya.sh"
        "Agente CEO|http://localhost:3005|ceo.yaya.sh"
        "Cal.com|http://localhost:3002|cal.yaya.sh"
        "Metabase|http://localhost:3003|analytics.yaya.sh"
        "Lago Billing|http://localhost:8080|billing.yaya.sh"
        "MinIO|http://localhost:9001|storage.yaya.sh"
        "vLLM|http://localhost:8000/v1/models|ai.yaya.sh"
        "Whisper|http://localhost:9300|—"
        "Kokoro TTS|http://localhost:9400|—"
    )

    for svc in "${services[@]}"; do
        IFS='|' read -r name url domain <<< "$svc"
        if curl -sf -H "Authorization: Bearer megustalaia" "$url" >/dev/null 2>&1; then
            echo -e "  ${GREEN}OK${NC} $name  ->  $domain"
        else
            echo -e "  ${RED}FAIL${NC} $name  ->  $domain"
        fi
    done

    echo ""
    info "Docker containers:"
    docker ps --format "  {{.Names}}\t{{.Status}}" | sort
    echo ""

    if command -v pm2 >/dev/null 2>&1; then
        info "PM2 processes:"
        pm2 list 2>/dev/null || true
    fi
}

stop_all() {
    log "Stopping all services..."
    cd "$DOCKER_DIR" && docker compose down 2>/dev/null || true
    cd "$SPARKY_DIR" && docker compose down 2>/dev/null || true
    if command -v pm2 >/dev/null 2>&1; then
        pm2 stop all 2>/dev/null || true
    fi
    log "All services stopped."
}

restart_all() {
    stop_all
    sleep 3
    main_start
}

health_check() {
    local failed=0
    local checks=(
        "Postgres|docker exec yaya_business-postgres-1 pg_isready -U yaya_prod"
        "Redis|docker exec yaya_business-redis-1 redis-cli ping"
        "Authentik|curl -sf http://localhost:9090/-/health/ready/"
        "Business API|curl -sf http://localhost:3000/api/v1/health"
        "Health API|curl -sf http://localhost:3100/api/v1/health"
        "SparkyFitness|curl -sf http://localhost:3004/api/health"
        "Agente CEO|curl -sf http://localhost:3005"
        "vLLM|curl -sf http://localhost:8000/v1/models -H 'Authorization: Bearer megustalaia'"
    )

    for check in "${checks[@]}"; do
        IFS='|' read -r name cmd <<< "$check"
        if eval "$cmd" >/dev/null 2>&1; then
            echo -e "  ${GREEN}OK${NC} $name"
        else
            echo -e "  ${RED}FAIL${NC} $name"
            failed=1
        fi
    done

    return $failed
}

main_start() {
    echo ""
    info "═══════════════════════════════════════════════════════════════"
    info "  Starting Yaya Platform"
    info "═══════════════════════════════════════════════════════════════"
    echo ""

    check_docker
    start_core_infra
    start_authentik
    start_oss_services
    start_sparkyfitness
    start_pm2_apps
    reload_nginx

    echo ""
    log "All services started! Running health checks..."
    echo ""
    sleep 5
    show_status
}

# ── CLI ────────────────────────────────────────────────────────

case "${1:-start}" in
    start)      main_start ;;
    stop)       stop_all ;;
    restart)    restart_all ;;
    status)     show_status ;;
    health)     health_check ;;
    logs)
        shift
        service="${1:-all}"
        if [ "$service" = "all" ]; then
            cd "$DOCKER_DIR" && docker compose logs -f --tail=50
        else
            cd "$DOCKER_DIR" && docker compose logs -f --tail=50 "$service" 2>/dev/null || \
            (cd "$SPARKY_DIR" && docker compose logs -f --tail=50 "$service" 2>/dev/null) || \
            err "Service '$service' not found"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|health|logs [service]}"
        echo ""
        echo "Commands:"
        echo "  start    - Start all services (default)"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart everything"
        echo "  status   - Show service status"
        echo "  health   - Run health checks"
        echo "  logs     - Follow logs (all or specific service)"
        ;;
esac
