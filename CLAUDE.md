# Yaya Platform — Agent Conventions

## What is this?
A Turborepo monorepo containing the Yaya/Agente platform — privacy-first AI agents for Latin America, delivered over WhatsApp and web dashboards.

## Repository Structure
- `apps/web` — Unified Next.js 16 app (marketing + CEO dashboard + health dashboard)
- `apps/business` — yaya-business WhatsApp bot backend (PM2, port 3000)
- `apps/health` — yaya-health WhatsApp bot backend (PM2, port 3100)
- `packages/core` — @yaya/core shared library (WhatsApp, AI, queues, crypto, DB)
- `packages/config` — @yaya/config centralized env vars, models, ports
- `packages/ui` — @yaya/ui shared React components (Radix, TailwindCSS)
- `packages/tokens` — @yaya/tokens design system (colors, gradients, spacing)
- `agent/` — Agent workspace (SOUL.md, AGENTS.md, memory/)
- `infra/` — Docker Compose, Nginx, PM2, shell scripts

## Key Commands
```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages and apps (dependency-ordered)
pnpm dev              # Start all apps in dev mode
pnpm test             # Run all tests
pnpm typecheck        # Type-check all packages
```

## Infrastructure
- Docker Compose runs: PostgreSQL, Redis, MinIO, vLLM, Whisper, Kokoro TTS, Authentik
- PM2 manages: yaya-business (:3000), yaya-health (:3100)
- Nginx reverse proxies: biz.yaya.sh, health.yaya.sh, auth.yaya.sh, etc.
- Start everything: `./infra/scripts/start.sh`
- Monitor: `./infra/scripts/services.sh status`

## Conventions
- All configuration via environment variables (never hardcode secrets)
- Shared types and utilities go in @yaya/core or @yaya/config
- UI components go in @yaya/ui — apps import, never duplicate
- Spanish is the primary UI language (LATAM market)
- Dark mode is the default theme
- All AI endpoints use OpenAI-compatible API format

## Tech Stack
- TypeScript 5.5, Node.js, ESM
- Next.js 16, React 19, TailwindCSS 4
- Baileys (WhatsApp), BullMQ (queues), PostgreSQL, Redis
- vLLM + Qwen (local LLM), Whisper (STT), Kokoro (TTS)
- Radix UI, Framer Motion, Lucide icons, Recharts
