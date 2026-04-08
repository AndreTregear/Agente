# Migration to @yaya/core

> This document maps which parts of yaya_health will be replaced by `@yaya/core` imports and which remain domain-specific.

## Overview

`@yaya/core` extracts the shared infrastructure that both `yaya_platform` and `yaya_health` need: bot connectivity, AI bridging, queue management, crypto, database pooling, and shared utilities. After migration, `yaya_health` becomes a **domain-focused package** that depends on core for all infrastructure.

---

## Files REPLACED by @yaya/core

These files have equivalents in `@yaya/core` and should be replaced with imports:

### `src/bot/` → `@yaya/core/bot`

| File | Core replacement | Notes |
|------|-----------------|-------|
| `handler.ts` | `@yaya/core/bot/handler` | Message routing, media handling |
| `health-check.ts` | `@yaya/core/bot/health-check` | Bot connection health monitoring |
| `providers/` | `@yaya/core/bot/providers` | WhatsApp provider abstraction (Baileys, etc.) |
| `tenant-manager.ts` | `@yaya/core/bot/tenant-manager` | Multi-tenant bot instance management |
| `worker-bridge.ts` | `@yaya/core/bot/worker-bridge` | Worker thread communication |
| `worker.ts` | `@yaya/core/bot/worker` | Bot worker process |

### `src/ai/` → `@yaya/core/ai`

| File | Core replacement | Notes |
|------|-----------------|-------|
| `openclaw-bridge.ts` | `@yaya/core/ai/openclaw-bridge` | OpenClaw agent CLI bridge |

> **Keep locally:** `pii-scrubber.ts` — health-specific PII rules (medical terms, DNI patterns). May contribute upstream later.

### `src/queue/` → `@yaya/core/queue`

| File | Core replacement | Notes |
|------|-----------------|-------|
| `ai-queue.ts` | `@yaya/core/queue/ai-queue` | AI request queuing |
| `queue-factory.ts` | `@yaya/core/queue/queue-factory` | BullMQ queue creation |
| `rate-limiter.ts` | `@yaya/core/queue/rate-limiter` | Per-tenant rate limiting |
| `redis.ts` | `@yaya/core/queue/redis` | Redis connection management |
| `types.ts` | `@yaya/core/queue/types` | Shared queue types |

> **Keep locally:** `health-queue.ts`, `reminder-scheduler.ts` — domain-specific health job processing.

### `src/crypto/` → `@yaya/core/crypto`

| File | Core replacement | Notes |
|------|-----------------|-------|
| `envelope.ts` | `@yaya/core/crypto/envelope` | Encrypted message envelopes |
| `field-crypto.ts` | `@yaya/core/crypto/field-crypto` | Field-level encryption for PII |
| `middleware.ts` | `@yaya/core/crypto/middleware` | Express middleware for encrypted routes |

> Core provides the **full crypto stack** including post-quantum (ML-KEM), which yaya_health doesn't have yet.

### `src/shared/` → `@yaya/core/shared`

| File | Core replacement | Notes |
|------|-----------------|-------|
| `events.ts` | `@yaya/core/shared/events` | Event bus / emitter |
| `logger.ts` | `@yaya/core/shared/logger` | Pino logger with tenant context |
| `types.ts` | `@yaya/core/shared/types` | Shared TypeScript types |

### `src/db/` → `@yaya/core/db`

| File | Core replacement | Notes |
|------|-----------------|-------|
| `pool.ts` | `@yaya/core/db/pool` | PostgreSQL connection pool |
| `migrate.ts` | `@yaya/core/db/migrate` | Schema migration runner |

> **Keep locally:** `repos/` — all health-specific repositories (health readings, growth data, medication, etc.)

### Root files

| File | Core replacement | Notes |
|------|-----------------|-------|
| `src/platform.ts` | `@yaya/core/platform` | Platform bootstrap & lifecycle |
| `src/config.ts` | Extend `@yaya/core/config` | Core config + health-specific env vars |

---

## Files that STAY in yaya_health (domain-specific)

These are the heart of yaya_health and have no equivalent in core:

### `src/health/` — Clinical domain logic
- `clinical.ts` — Clinical assessment logic
- `growth-tracker.ts` — WHO growth standards z-score calculations
- `health-readings.ts` — Vital signs classification (BP, glucose, BMI)
- `maternal.ts` — Maternal health (pregnancy, postpartum, trimester tracking)
- `medication-reminder.ts` — DOTS adherence, medication scheduling
- `nutrition-analyzer.ts` — Peruvian food nutrition analysis
- `peruvian-foods.ts` — Local food database (sangrecita, cushuro, etc.)
- `quechua.ts` — Quechua medical vocabulary and translation
- `triage.ts` — Symptom screening and risk scoring
- `tuberculosis.ts` — TB-specific protocols and tracking
- `who-standards.ts` — WHO growth reference data

### `src/queue/` — Health-specific queues
- `health-queue.ts` — Health assessment job processor
- `reminder-scheduler.ts` — Medication and appointment reminders

### `src/ai/` — Health-specific AI
- `pii-scrubber.ts` — Medical PII scrubbing rules

### `src/db/repos/` — Health repositories
- All health-specific database repositories

### `agent-workspace/` — Agent personality
- `SOUL.md` — Yaya Salud's full personality, medical knowledge, Quechua support

### `mcp-servers/` — Health MCP tools
- All health assessment tools (growth, triage, nutrition, etc.)

### `tests/` — Health test suite
- Persona tests, clinical tests, integration tests

### Schema files
- `schema-health.sql` — Health-specific tables
- (Core provides `schema-tenants.sql` and `schema-rls.sql`)

---

## Migration Steps

### Step 1: Install @yaya/core

```bash
cd yaya_health
npm install @yaya/core
```

### Step 2: Update imports (infrastructure → core)

Replace local imports with core imports throughout the codebase:

```typescript
// BEFORE
import { createPool } from '../db/pool.js';
import { logger } from '../shared/logger.js';
import { processWithOpenClaw } from '../ai/openclaw-bridge.js';
import { createQueueFactory } from '../queue/queue-factory.js';
import { encrypt, decrypt } from '../crypto/field-crypto.js';

// AFTER
import { createPool } from '@yaya/core/db';
import { logger } from '@yaya/core/shared';
import { processWithOpenClaw } from '@yaya/core/ai';
import { createQueueFactory } from '@yaya/core/queue';
import { encrypt, decrypt } from '@yaya/core/crypto';
```

### Step 3: Delete replaced local files

Remove the files listed in "Files REPLACED" above. Keep domain-specific files.

### Step 4: Update entrypoint

```typescript
// src/index.ts
import { bootstrap } from '@yaya/core/platform';
import { registerHealthRoutes } from './health/index.js';
import { registerHealthQueues } from './queue/health-queue.js';
import { registerReminderScheduler } from './queue/reminder-scheduler.js';

// Bootstrap core infrastructure, then register health domain
const app = await bootstrap({
  name: 'yaya-health',
  domain: 'health',
});

registerHealthRoutes(app);
registerHealthQueues(app.queues);
registerReminderScheduler(app.queues);
```

### Step 5: Run tests and verify

```bash
npm test
# Verify all health-specific functionality still works
# Core infrastructure tests are covered by @yaya/core's own test suite
```

---

## What yaya_health GAINS from @yaya/core

| Capability | Current state in yaya_health | After @yaya/core |
|------------|------------------------------|-------------------|
| **Crypto** | Basic field encryption (AES) | Full stack: AES + ML-KEM (post-quantum), key rotation, encrypted envelopes |
| **RL Pipeline** | None | Reinforcement learning for agent response quality scoring |
| **Warehouse / ETL** | None | Data warehouse, ETL pipelines for analytics |
| **Auth middleware** | Basic tenant check | Full auth: JWT, API keys, tenant scoping, RLS provisioning |
| **Bot providers** | Local Baileys wrapper | Abstracted providers (Baileys, Evolution API, future providers) |
| **Multi-tenancy** | Local tenant manager | Battle-tested tenant lifecycle from platform (provisioning, suspension, deletion) |
| **Shared utilities** | Minimal (logger, events, types) | Full utility set: retries, circuit breakers, rate limiters, validators |
| **Database** | Local pool + migrations | Pool + migrations + tenant role provisioning + RLS enforcement |
| **Monitoring** | Basic logging | Structured logging + metrics + health checks + alerting hooks |
| **Skills system** | MCP servers (domain tools) | OpenClaw skills system for agent capabilities (same architecture as platform) |

### Key wins:

1. **Post-quantum crypto** — health data is the most sensitive. ML-KEM future-proofs encryption.
2. **RL pipeline** — score agent health responses and improve over time.
3. **Less code to maintain** — ~60% of yaya_health's current codebase becomes core imports.
4. **Battle-tested infra** — platform's multi-tenant infrastructure handles edge cases yaya_health hasn't hit yet.
5. **Shared evolution** — bug fixes and improvements in core benefit both health and platform automatically.
