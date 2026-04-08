# Yaya Platform — Monorepo

## What is this?
Turborepo monorepo for the Yaya/Agente platform — privacy-first AI agents for Latin America, delivered over WhatsApp and web dashboards.

## Repository Structure

### Apps
- `apps/business` — WhatsApp bot backend (Express, Baileys, Mastra agents, 184 src files, 52 test files). Port 3000
- `apps/health` — Health WhatsApp bot (child growth, nutrition, chronic disease). Port 3100
- `apps/web` — Unified Next.js 16 dashboard (CEO + marketing + health). Port 3005
- `apps/android` — YapeReader Android app (Kotlin, Jetpack Compose) — captures Yape payment notifications
- `apps/campusgenie` — University agent web UI (planned)

### Packages
- `packages/core` — @yaya/core: WhatsApp (Baileys), AI bridge, BullMQ, PostgreSQL, Redis, AES-256-GCM crypto
- `packages/config` — @yaya/config: centralized env vars, model configs, port registry
- `packages/ui` — @yaya/ui: shared React components (Radix UI, TailwindCSS 4)
- `packages/tokens` — @yaya/tokens: design system (colors, gradients, spacing)
- `packages/scraper` — @yaya/scraper: web scraper with caching + robots.txt compliance
- `packages/university` — @yaya/university: course catalog + prerequisite validation
- `packages/wa-voice` — @yaya/wa-voice: WhatsApp Web live voice calls (Playwright + WebRTC)

### MCP Servers (14)
- `mcp-servers/scraper-mcp` — Web scraping tools
- `mcp-servers/university-mcp` — Course catalog tools
- `mcp-servers/perplexity-mcp` — Web search via Perplexity
- `mcp-servers/postgres-mcp` — Direct SQL with guardrails
- `mcp-servers/business-mcp` — Tier 1 business metrics
- `mcp-servers/payments-mcp` — Vision OCR for payment receipts
- `mcp-servers/invoicing-mcp` — Electronic invoicing (SUNAT/DIAN/SEFAZ/SAT)
- `mcp-servers/whatsapp-mcp` — Outbound messaging
- `mcp-servers/voice-mcp` — Whisper STT + Kokoro TTS
- `mcp-servers/appointments-mcp` — Cal.com scheduling
- `mcp-servers/lago-mcp` — Lago billing
- `mcp-servers/crm-mcp` — CRM bridge
- `mcp-servers/erpnext-mcp` — ERPNext bridge
- `mcp-servers/forex-mcp` — Exchange rates

### Skills (38 AI skill definitions)
- `skills/agente-sales`, `skills/agente-inventory`, `skills/agente-payments`, etc.
- Markdown files configuring AI agent behavior per business domain

### Services (OSS wrappers)
- `services/yape-listener` — Yape payment detection backend
- `services/agente-api` — Core API service
- Plus configs for: Lago, Cal.com, Metabase, Whisper, Kokoro TTS, ERPNext, etc.

### Infrastructure
- `infra/docker-compose.business.yml` — Full Docker stack (PG, Redis, MinIO, vLLM, Whisper, TTS, Authentik)
- `infra/nginx/` — Reverse proxy configs for all domains
- `infra/scripts/` — start, stop, deploy, health-check, services, hpc-tunnel, benchmark
- `infra/pm2.ecosystem.cjs` — PM2 process management

### Other
- `agent/` — Agent workspace (SOUL.md, AGENTS.md, memory/)
- `docs/` — Architecture, research (112 docs), knowledge base
- `tools/hpc/` — HPC job management (SSH tunnels, SLURM, mesh)
- `tools/hpc-dashboard/` — HPC monitoring dashboard
- `tests/personas/` — 30+ LATAM business test personas
- `workers/scraper-worker` — BullMQ scrape job worker

## Key Commands
```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages and apps (dependency-ordered)
pnpm dev              # Start all apps in dev mode
pnpm test             # Run all tests
pnpm typecheck        # Type-check all packages
```

## Infrastructure
- Docker Compose: PostgreSQL 16, Redis 7, MinIO, vLLM (Qwen 3.5 35B), Whisper, Kokoro TTS, Authentik
- Local AI: vLLM :8000 (35B), HPC :18080 (122B), Whisper :9300, TTS :9400
- PM2: yaya-business (:3000), yaya-health (:3100)
- Domains: biz.yaya.sh, health.yaya.sh, agente.ceo, auth.yaya.sh

## Conventions
- All configuration via environment variables (never hardcode secrets)
- Shared infra goes in @yaya/core or @yaya/config
- UI components go in @yaya/ui — apps import, never duplicate
- Spanish is the primary UI language (LATAM market)
- Dark mode default theme
- All AI endpoints use OpenAI-compatible API format
- Keep system prompts short for reliable tool calling with Qwen models

## Tech Stack
- TypeScript 5.5+, Node.js, ESM
- Next.js 16, React 19, TailwindCSS 4
- Baileys (WhatsApp), Mastra (agents), BullMQ (queues)
- PostgreSQL 16, Redis 7, MinIO (S3)
- vLLM + Qwen 3.5 (local LLM), Whisper (STT), Kokoro (TTS)
- Kotlin + Jetpack Compose (Android)
