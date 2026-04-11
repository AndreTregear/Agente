/**
 * PageIndex Seeder — bootstraps the meta-RAG index.
 *
 * Scans the codebase to build an initial page_index mapping topics
 * to their data sources (files, tables, MCP servers, skills, docs).
 *
 * Run once manually: npx tsx src/ai/tools/seed-page-index.ts
 * After initial seed, the PageIndex Refresh Worker keeps it current.
 */

import fs from 'node:fs';
import path from 'node:path';
import { upsertPageIndex } from '../../db/knowledge-repo.js';
import { generateEmbedding } from '../embedding-client.js';
import { logger } from '../../shared/logger.js';

// ── Topic Definitions ──

interface TopicSeed {
  topic: string;
  description: string;
  sources: Array<{ type: string; [key: string]: unknown }>;
  queryPatterns: string[];
}

/**
 * Build the topic list by scanning the actual codebase.
 */
function buildTopics(repoRoot: string): TopicSeed[] {
  const topics: TopicSeed[] = [];

  // ── Core Business Domain Topics ──

  topics.push({
    topic: 'payment_processing',
    description: 'How payments work: Yape detection, payment matching, order confirmation, payment links, QR codes.',
    sources: [
      { type: 'file', path: 'apps/business/src/payments/yape-matcher.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/services/payment-service.ts', relevance: 0.9 },
      { type: 'file', path: 'apps/business/src/ai/tools/yape-tools.ts', relevance: 0.85 },
      { type: 'file', path: 'apps/business/src/web/routes/api-yape.ts', relevance: 0.8 },
      { type: 'table', name: 'payments', relevance: 0.9 },
      { type: 'table', name: 'yape_notifications', relevance: 0.85 },
      { type: 'mcp_server', name: 'payments-mcp', tools: ['verify_payment', 'confirm_order'], relevance: 0.85 },
      { type: 'skill', name: 'agente-payments', relevance: 0.7 },
      { type: 'doc', path: 'docs/platform/ARCHITECTURE.md', relevance: 0.5 },
    ],
    queryPatterns: [
      'how do payments work', 'como funcionan los pagos', 'yape payment', 'pago yape',
      'payment processing', 'confirmación de pago', 'payment link', 'payment verification',
    ],
  });

  topics.push({
    topic: 'order_management',
    description: 'Order lifecycle: creation, status tracking, payment linking, delivery, cancellation.',
    sources: [
      { type: 'file', path: 'apps/business/src/services/order-service.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/db/orders-repo.ts', relevance: 0.9 },
      { type: 'table', name: 'orders', relevance: 0.95 },
      { type: 'table', name: 'order_items', relevance: 0.9 },
      { type: 'skill', name: 'agente-sales', relevance: 0.8 },
    ],
    queryPatterns: [
      'order lifecycle', 'how orders work', 'crear pedido', 'order status',
      'estado del pedido', 'cancelar pedido', 'order management',
    ],
  });

  topics.push({
    topic: 'whatsapp_integration',
    description: 'WhatsApp connection via Baileys: multi-tenant bot, QR auth, message handling, media processing.',
    sources: [
      { type: 'file', path: 'apps/business/src/bot/connection.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/bot/tenant-manager.ts', relevance: 0.9 },
      { type: 'file', path: 'apps/business/src/bot/providers/baileys.ts', relevance: 0.85 },
      { type: 'mcp_server', name: 'whatsapp-mcp', tools: ['send_message', 'send_media'], relevance: 0.85 },
      { type: 'doc', path: 'docs/platform/ARCHITECTURE.md', relevance: 0.6 },
    ],
    queryPatterns: [
      'whatsapp bot', 'baileys', 'whatsapp connection', 'qr code',
      'bot whatsapp', 'mensajes whatsapp', 'multi-tenant bot',
    ],
  });

  topics.push({
    topic: 'ai_agent_architecture',
    description: 'AI agent system: Mastra agents, model routing, swarm orchestration, specialist agents, tool execution.',
    sources: [
      { type: 'file', path: 'apps/business/src/ai/agents.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/ai/model-router.ts', relevance: 0.9 },
      { type: 'file', path: 'apps/business/src/ai/mastra-bridge.ts', relevance: 0.85 },
      { type: 'file', path: 'packages/swarm/src/orchestrator.ts', relevance: 0.9 },
      { type: 'file', path: 'packages/swarm/src/router.ts', relevance: 0.85 },
      { type: 'file', path: 'apps/business/src/ai/specialists/index.ts', relevance: 0.8 },
      { type: 'doc', path: 'docs/platform/ARCHITECTURE.md', relevance: 0.7 },
      { type: 'doc', path: 'docs/platform/BLUEPRINT.md', relevance: 0.6 },
    ],
    queryPatterns: [
      'ai agent', 'agente ai', 'model routing', 'swarm', 'specialist agent',
      'mastra', 'tool calling', 'llm architecture', 'como funciona el agente',
    ],
  });

  topics.push({
    topic: 'multi_tenant_architecture',
    description: 'Multi-tenancy: tenant isolation, per-tenant encryption, shared infrastructure, cross-tenant security.',
    sources: [
      { type: 'file', path: 'apps/business/src/bot/tenant-manager.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/crypto/key-cache.ts', relevance: 0.85 },
      { type: 'file', path: 'apps/business/src/web/routes/api-tenants.ts', relevance: 0.8 },
      { type: 'table', name: 'tenants', relevance: 0.95 },
      { type: 'doc', path: 'docs/platform/SECURITY.md', relevance: 0.8 },
      { type: 'doc', path: 'docs/platform/BLUEPRINT.md', relevance: 0.7 },
    ],
    queryPatterns: [
      'multi-tenant', 'tenant isolation', 'aislamiento', 'encryption',
      'cross-tenant', 'tenant security', 'multitenant architecture',
    ],
  });

  topics.push({
    topic: 'voice_pipeline',
    description: 'Voice processing: Whisper STT, Kokoro TTS, fast voice pipeline, WhatsApp voice notes.',
    sources: [
      { type: 'file', path: 'apps/business/src/voice/voice-pipeline.ts', relevance: 0.95 },
      { type: 'file', path: 'packages/core/src/voice/fast-voice-pipeline.ts', relevance: 0.9 },
      { type: 'file', path: 'apps/business/src/voice/call-handler.ts', relevance: 0.85 },
      { type: 'mcp_server', name: 'voice-mcp', tools: ['transcribe', 'synthesize'], relevance: 0.85 },
      { type: 'skill', name: 'agente-voice', relevance: 0.7 },
    ],
    queryPatterns: [
      'voice pipeline', 'whisper', 'kokoro', 'tts', 'stt', 'voice notes',
      'notas de voz', 'transcription', 'text to speech', 'speech to text',
    ],
  });

  topics.push({
    topic: 'queue_system',
    description: 'BullMQ job queues: AI processing, voice, media, scheduled jobs, rate limiting, concurrency control.',
    sources: [
      { type: 'file', path: 'apps/business/src/queue/ai-queue.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/queue/queue-factory.ts', relevance: 0.9 },
      { type: 'file', path: 'apps/business/src/queue/rate-limiter.ts', relevance: 0.85 },
      { type: 'file', path: 'packages/queue-core/src/queue-factory.ts', relevance: 0.8 },
      { type: 'file', path: 'apps/business/src/queue/swarm-workers.ts', relevance: 0.85 },
    ],
    queryPatterns: [
      'bullmq', 'job queue', 'worker', 'rate limiting', 'concurrency',
      'cola de trabajo', 'background jobs', 'scheduled jobs',
    ],
  });

  topics.push({
    topic: 'customer_management',
    description: 'Customer data: CRM, customer memories, lookup, segmentation, conversation history.',
    sources: [
      { type: 'file', path: 'apps/business/src/db/customer-memories-repo.ts', relevance: 0.9 },
      { type: 'table', name: 'customers', relevance: 0.95 },
      { type: 'table', name: 'customer_memories', relevance: 0.9 },
      { type: 'table', name: 'conversations', relevance: 0.85 },
      { type: 'mcp_server', name: 'crm-mcp', tools: ['contact_lookup', 'contact_create'], relevance: 0.85 },
      { type: 'skill', name: 'agente-crm', relevance: 0.8 },
    ],
    queryPatterns: [
      'customer data', 'datos de cliente', 'crm', 'customer memory',
      'memoria del cliente', 'conversation history', 'historial',
    ],
  });

  topics.push({
    topic: 'invoicing_compliance',
    description: 'Electronic invoicing for LATAM: SUNAT (Peru), DIAN (Colombia), SEFAZ (Brazil), SAT (Mexico).',
    sources: [
      { type: 'mcp_server', name: 'invoicing-mcp', tools: ['emit_boleta', 'emit_factura'], relevance: 0.95 },
      { type: 'skill', name: 'agente-tax', relevance: 0.85 },
      { type: 'skill', name: 'agente-tax-colombia', relevance: 0.8 },
      { type: 'skill', name: 'agente-tax-brazil', relevance: 0.8 },
      { type: 'skill', name: 'agente-tax-mexico', relevance: 0.8 },
      { type: 'doc', path: 'docs/platform/invoicing-technical-spec.md', relevance: 0.9 },
    ],
    queryPatterns: [
      'invoicing', 'facturación', 'boleta', 'factura', 'sunat', 'dian', 'sefaz', 'sat',
      'electronic invoice', 'factura electrónica', 'tax compliance',
    ],
  });

  topics.push({
    topic: 'analytics_reporting',
    description: 'Business analytics: revenue metrics, order trends, customer insights, daily summaries, A/B testing.',
    sources: [
      { type: 'file', path: 'apps/business/src/warehouse/etl-runner.ts', relevance: 0.9 },
      { type: 'file', path: 'apps/business/src/rl/ab-test.ts', relevance: 0.85 },
      { type: 'file', path: 'apps/business/src/queue/daily-summary-scheduler.ts', relevance: 0.8 },
      { type: 'mcp_server', name: 'business-mcp', tools: ['business_metrics', 'customer_lookup'], relevance: 0.9 },
      { type: 'skill', name: 'agente-analytics', relevance: 0.85 },
      { type: 'doc', path: 'docs/platform/ARCHITECTURE-RL-FLYWHEEL.md', relevance: 0.7 },
    ],
    queryPatterns: [
      'analytics', 'análisis', 'reportes', 'metrics', 'revenue',
      'daily summary', 'resumen diario', 'a/b testing', 'trends',
    ],
  });

  topics.push({
    topic: 'scheduling_appointments',
    description: 'Appointment scheduling via Cal.com: booking, availability, reminders, cancellation.',
    sources: [
      { type: 'mcp_server', name: 'appointments-mcp', tools: ['book_slot', 'list_availability'], relevance: 0.95 },
      { type: 'skill', name: 'agente-appointments', relevance: 0.85 },
      { type: 'doc', path: 'docs/platform/appointments-guide.md', relevance: 0.8 },
    ],
    queryPatterns: [
      'appointments', 'citas', 'scheduling', 'cal.com', 'booking',
      'reservar cita', 'disponibilidad', 'availability',
    ],
  });

  topics.push({
    topic: 'infrastructure_deployment',
    description: 'Infrastructure: Docker Compose, PM2, nginx, PostgreSQL, Redis, MinIO, vLLM, deployment scripts.',
    sources: [
      { type: 'file', path: 'infra/docker-compose.business.yml', relevance: 0.95 },
      { type: 'file', path: 'infra/docker-compose.prod.yml', relevance: 0.9 },
      { type: 'file', path: 'infra/nginx/yaya-platform.conf', relevance: 0.85 },
      { type: 'file', path: 'infra/pm2.ecosystem.cjs', relevance: 0.8 },
      { type: 'doc', path: 'docs/platform/deployment.md', relevance: 0.9 },
      { type: 'doc', path: 'docs/platform/OSS-STACK.md', relevance: 0.7 },
    ],
    queryPatterns: [
      'docker', 'deployment', 'infrastructure', 'nginx', 'pm2',
      'deploy', 'producción', 'docker compose', 'server setup',
    ],
  });

  topics.push({
    topic: 'security_encryption',
    description: 'Security: AES-256-GCM encryption, tenant key derivation, SSRF protection, SQL injection prevention, NemoClaw sandboxing.',
    sources: [
      { type: 'file', path: 'apps/business/src/crypto/key-cache.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/web/middleware/security-headers.ts', relevance: 0.85 },
      { type: 'doc', path: 'docs/platform/SECURITY.md', relevance: 0.95 },
      { type: 'doc', path: 'docs/platform/BLUEPRINT.md', relevance: 0.7 },
    ],
    queryPatterns: [
      'security', 'seguridad', 'encryption', 'encriptación', 'aes',
      'sql injection', 'ssrf', 'authentication', 'autenticación',
    ],
  });

  topics.push({
    topic: 'knowledge_graph',
    description: 'Knowledge system: knowledge graph, PageIndex meta-RAG, AI annotations, wiki generation, embedding search.',
    sources: [
      { type: 'file', path: 'apps/business/src/db/knowledge-repo.ts', relevance: 0.95 },
      { type: 'file', path: 'apps/business/src/ai/tools/knowledge-tools.ts', relevance: 0.9 },
      { type: 'file', path: 'apps/business/src/ai/specialists/knowledge.ts', relevance: 0.85 },
      { type: 'file', path: 'apps/business/src/queue/knowledge-workers.ts', relevance: 0.8 },
      { type: 'table', name: 'knowledge_nodes', relevance: 0.95 },
      { type: 'table', name: 'knowledge_edges', relevance: 0.9 },
      { type: 'table', name: 'page_index', relevance: 0.9 },
    ],
    queryPatterns: [
      'knowledge graph', 'grafo de conocimiento', 'wiki', 'page index',
      'meta-rag', 'embeddings', 'knowledge search', 'annotations',
    ],
  });

  // ── Dynamically discovered topics from skills ──

  const skillsDir = path.join(repoRoot, 'skills');
  if (fs.existsSync(skillsDir)) {
    const skillDirs = fs.readdirSync(skillsDir).filter((d) =>
      fs.statSync(path.join(skillsDir, d)).isDirectory()
    );

    for (const skillDir of skillDirs) {
      const skillMd = path.join(skillsDir, skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf-8');
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1] : skillDir;

      // Only add if not already covered by a manual topic
      const alreadyCovered = topics.some((t) =>
        t.sources.some((s) => s.type === 'skill' && s.name === skillDir)
      );

      if (!alreadyCovered) {
        topics.push({
          topic: `skill_${skillDir}`,
          description: `AI skill: ${title}. Defines agent behavior for ${skillDir.replace('agente-', '')} domain.`,
          sources: [
            { type: 'skill', name: skillDir, relevance: 0.95 },
            { type: 'file', path: `skills/${skillDir}/SKILL.md`, relevance: 0.9 },
          ],
          queryPatterns: [
            skillDir.replace('agente-', ''),
            skillDir,
            title.toLowerCase(),
          ],
        });
      }
    }
  }

  return topics;
}

// ── Seeder ──

export async function seedPageIndex(): Promise<void> {
  const repoRoot = process.cwd();
  const topics = buildTopics(repoRoot);

  logger.info({ topicCount: topics.length }, 'Seeding page_index...');

  let seeded = 0;
  for (const topic of topics) {
    try {
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(`${topic.topic}: ${topic.description}`);
      } catch (err) {
        logger.warn({ topic: topic.topic, err }, 'Failed to generate embedding, seeding without');
      }

      await upsertPageIndex({
        topic: topic.topic,
        description: topic.description,
        embedding,
        sources: topic.sources,
        queryPatterns: topic.queryPatterns,
      });
      seeded++;
    } catch (err) {
      logger.error({ topic: topic.topic, err }, 'Failed to seed page_index entry');
    }
  }

  logger.info({ seeded, total: topics.length }, 'PageIndex seeding complete');
}

// Allow running directly: npx tsx src/ai/tools/seed-page-index.ts
if (process.argv[1]?.endsWith('seed-page-index.ts') || process.argv[1]?.endsWith('seed-page-index.js')) {
  seedPageIndex()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
