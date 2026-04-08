#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Yaya Salud — Start Script
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   ./start.sh              # Start all services (detached)
#   ./start.sh --dev        # Start in foreground (dev mode)
#   ./start.sh --status     # Show service health
#   ./start.sh --stop       # Stop everything
#   ./start.sh --restart    # Restart all services
#   ./start.sh --reset-db   # WARNING: Wipes all data
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
cd "$(dirname "$0")"

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[yaya-health]${NC} $*"; }
warn() { echo -e "${YELLOW}[yaya-health]${NC} $*"; }
err()  { echo -e "${RED}[yaya-health]${NC} $*" >&2; }

# ── Parse flags ──────────────────────────────────────────────
ACTION="start"
DEV_MODE=false
PROD_MODE=false

for arg in "$@"; do
  case "$arg" in
    --status)    ACTION="status" ;;
    --stop)      ACTION="stop" ;;
    --restart)   ACTION="restart" ;;
    --reset-db)  ACTION="reset-db" ;;
    --dev)       DEV_MODE=true ;;
    --prod)      PROD_MODE=true ;;
    --help|-h)
      echo "Usage: ./start.sh [--status|--stop|--restart|--reset-db|--dev|--prod]"
      exit 0 ;;
  esac
done

# ── Compose command builder ──────────────────────────────────
compose_cmd() {
  local cmd="docker compose"
  if [ "$PROD_MODE" = true ]; then
    cmd="$cmd -f docker-compose.yml -f docker-compose.prod.yml"
  fi
  echo "$cmd"
}

COMPOSE="$(compose_cmd)"

# ── Status ───────────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  🏥  Yaya Salud — Service Status${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
  echo ""

  local fails=0

  # Check each service
  for svc in postgres redis minio yaya-health backup; do
    local container
    container=$(docker compose ps -q "$svc" 2>/dev/null || true)
    if [ -z "$container" ]; then
      echo -e "  ${RED}✗${NC} $svc (not running)"
      fails=$((fails + 1))
      continue
    fi
    local health
    health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$container" 2>/dev/null || echo "unknown")
    case "$health" in
      healthy)  echo -e "  ${GREEN}✓${NC} $svc" ;;
      running)  echo -e "  ${GREEN}✓${NC} $svc (no healthcheck)" ;;
      starting) echo -e "  ${YELLOW}~${NC} $svc (starting...)" ; fails=$((fails + 1)) ;;
      *)        echo -e "  ${RED}✗${NC} $svc ($health)" ; fails=$((fails + 1)) ;;
    esac
  done

  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
  echo -e "  Endpoints:"
  echo -e "    Health API:     ${CYAN}http://localhost:${APP_PORT:-3000}/api/v1/health${NC}"
  echo -e "    PostgreSQL:     ${CYAN}localhost:${POSTGRES_PORT:-5432}${NC}"
  echo -e "    Redis:          ${CYAN}localhost:${REDIS_PORT:-6379}${NC}"
  echo -e "    MinIO Console:  ${CYAN}http://localhost:${MINIO_CONSOLE_PORT:-9001}${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════${NC}"

  if [ $fails -gt 0 ]; then
    echo -e "  ${YELLOW}$fails service(s) not healthy${NC}"
  else
    echo -e "  ${GREEN}All services healthy!${NC}"
  fi
  echo ""
}

# ── Action: status ───────────────────────────────────────────
if [ "$ACTION" = "status" ]; then
  show_status
  exit 0
fi

# ── Action: stop ─────────────────────────────────────────────
if [ "$ACTION" = "stop" ]; then
  log "Stopping Yaya Salud..."
  $COMPOSE down
  log "All services stopped."
  exit 0
fi

# ── Action: restart ──────────────────────────────────────────
if [ "$ACTION" = "restart" ]; then
  log "Restarting Yaya Salud..."
  $COMPOSE down
  exec "$0" $([ "$PROD_MODE" = true ] && echo "--prod")
fi

# ── Action: reset-db ─────────────────────────────────────────
if [ "$ACTION" = "reset-db" ]; then
  warn "⚠️  This will DELETE all health data!"
  read -p "Type 'yes' to confirm: " confirm
  if [ "$confirm" = "yes" ]; then
    $COMPOSE down -v
    log "Database volumes removed. Run ./start.sh to reinitialize."
  else
    log "Cancelled."
  fi
  exit 0
fi

# ── Pre-flight checks ───────────────────────────────────────
log "Yaya Salud — Starting up..."

if ! command -v docker &>/dev/null; then
  err "Docker not found. Install: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  err "Docker Compose V2 not found."
  exit 1
fi

# ── Load environment ─────────────────────────────────────────
if [ -f .env ]; then
  log "Loading .env"
  set -a; source .env; set +a
else
  warn "No .env file found. Using defaults."
  warn "Copy .env.example to .env and configure."
fi

# ── Ensure data directories ─────────────────────────────────
mkdir -p data/backups

# ── Build the app ────────────────────────────────────────────
log "Building yaya-health image..."
$COMPOSE build yaya-health

# ── Start infrastructure first ───────────────────────────────
log "Starting infrastructure (PostgreSQL, Redis, MinIO)..."
$COMPOSE up -d postgres redis minio

# Wait for PostgreSQL
log "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-yaya}" -d "${POSTGRES_DB:-yaya_health}" &>/dev/null; then
    log "PostgreSQL ready."
    break
  fi
  sleep 1
  if [ "$i" = "30" ]; then
    err "PostgreSQL did not start in 30s"
    exit 1
  fi
done

# Wait for Redis
log "Waiting for Redis..."
for i in $(seq 1 15); do
  if docker compose exec -T redis redis-cli ping &>/dev/null; then
    log "Redis ready."
    break
  fi
  sleep 1
done

# ── Start all services ───────────────────────────────────────
if [ "$DEV_MODE" = true ]; then
  log "Starting in dev mode (foreground)..."
  $COMPOSE up --build
else
  log "Starting all services..."
  $COMPOSE up -d
fi

# ── Show status ──────────────────────────────────────────────
if [ "$DEV_MODE" = false ]; then
  # Give services a moment to start
  sleep 3
  show_status
  log "Startup complete!"
  echo -e "  Logs: ${YELLOW}docker compose logs -f yaya-health${NC}"
  echo -e "  Stop: ${YELLOW}./start.sh --stop${NC}"
  echo ""
fi
