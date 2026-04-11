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

- **Runtime:** Node.js (TypeScript 5.5+, ESM)
- **AI:** vLLM — Qwen 3.5 35B (local :8000), Qwen 3.5 122B (HPC :18080)
- **AI Infra:** Whisper STT (:9300), Kokoro TTS (:9400), @yaya/swarm (agent orchestration)
- **Database:** PostgreSQL 16 (pgvector, RLS), Redis 7
- **Storage:** MinIO (S3-compatible)
- **Auth:** Authentik SSO, Better Auth
- **Scheduling:** Cal.com
- **Billing:** Lago
- **Analytics:** Metabase
- **Process Management:** PM2
- **Containerization:** Docker Compose
- **Monorepo:** pnpm workspaces + Turborepo

### Infrastructure

- Dual GPU server with NVIDIA GPUs
- HPC cluster access via SSH tunnel (4x B200 for Qwen 3.5 122B)
- Nginx reverse proxy with subdomain routing (*.yaya.sh)

### Key Architecture

- **@yaya/swarm** — Agent orchestration: 6 specialist agents (router, sales, analytics, support, researcher, knowledge), BullMQ fan-out/fan-in
- **Knowledge Graph** — pgvector embeddings, PageIndex meta-RAG, auto-ingestion from git + conversations
- **14 MCP Servers** — Modular tool layer (payments, CRM, invoicing, voice, etc.)
- **38 AI Skills** — Markdown-defined agent behaviors per business domain
- See `CLAUDE.md` for full repo structure, `agent/KNOWLEDGE.md` for the knowledge system

---

_Update this file as the platform evolves._
