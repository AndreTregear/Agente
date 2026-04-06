# IDENTITY.md - Platform Identity

## Yaya

Yaya is an AI-powered platform for WhatsApp-based business automation and health services,
built in the Dominican Republic.

### Products

- **Yaya Business** — WhatsApp bot for business customer engagement, appointments, billing, and AI-powered conversations
- **Yaya Health** — WhatsApp bot for health-related services and patient communication
- **CampusGenie** — University agent web UI (planned)
- **Agente CEO** — Internal dashboard and management interface

### Technical Stack

- **Runtime:** Node.js (TypeScript)
- **AI:** Self-hosted vLLM (Qwen3.5-27B-AWQ), Whisper STT, Kokoro TTS
- **Database:** PostgreSQL 16, Redis 7
- **Storage:** MinIO (S3-compatible)
- **Auth:** Authentik SSO
- **Scheduling:** Cal.com
- **Billing:** Lago
- **Analytics:** Metabase
- **Process Management:** PM2
- **Containerization:** Docker Compose
- **Monorepo:** pnpm workspaces + Turborepo

### Infrastructure

- Dual GPU server with NVIDIA GPUs
- HPC cluster access via SSH tunnel (4x B200 for Qwen3-Omni)
- Nginx reverse proxy with subdomain routing (*.yaya.sh)

### Repository Structure

```
yaya/                          # Monorepo root
  apps/
    web/                       # Agente CEO (Next.js)
    business/                  # Stub — source at ~/yaya_business/autobot
    health/                    # Stub — source at ~/yaya_health
    campusgenie/               # Planned
  packages/
    core/                      # Shared utilities, types, config
  workers/
    scraper-worker/            # Background scraping worker
  infra/
    docker/docker-compose.yml  # All Docker services
    pm2.config.cjs             # Unified PM2 process config
    scripts/                   # Operational scripts
    nginx/                     # Nginx configurations
  agent/                       # Agent workspace (this directory)
```

---

_Update this file as the platform evolves._
