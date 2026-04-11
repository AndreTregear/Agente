/**
 * Conversation Knowledge Worker — extracts knowledge from completed conversations.
 *
 * Triggered by 'ai-job-completed' events on the app bus.
 * Waits 30 seconds for the conversation to settle, then extracts
 * business knowledge, customer preferences, and operational patterns.
 *
 * All knowledge is tenant-scoped.
 */

import { Agent } from '@mastra/core/agent';
import { QueueFactory } from './queue-factory.js';
import {
  isAlreadyIngested,
  logIngestion,
  completeIngestion,
  failIngestion,
  insertNode,
  insertEdge,
  type NodeType,
  type EdgeRelation,
} from '../db/knowledge-repo.js';
import { query as dbQuery } from '../db/pool.js';
import { generateEmbedding } from '../ai/embedding-client.js';
import { getModel } from '../ai/model-router.js';
import { appBus } from '../shared/events.js';
import { logger } from '../shared/logger.js';

// ── Types ──

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ExtractedFact {
  title: string;
  content: string;
  node_type: string;
  tags: string[];
}

// ── Extraction Prompt ──

const EXTRACTION_PROMPT = `You are a knowledge extraction system for a LATAM business platform. Analyze the following conversation between a WhatsApp business agent and a customer.

Extract reusable business knowledge — things that would be useful to know in future conversations or for business operations.

Return valid JSON:
{
  "facts": [
    {
      "title": "Short title (e.g., 'Customer prefers delivery on weekends')",
      "content": "Detailed explanation (1-2 sentences)",
      "node_type": "fact|pattern|event",
      "tags": ["customer_preference", "delivery"]
    }
  ]
}

What to extract:
- Customer preferences and patterns (delivery times, payment methods, product favorites)
- Product insights (frequently asked questions, common combinations, pricing feedback)
- Operational patterns (peak hours, common issues, refund reasons)
- Service quality signals (complaints, compliments, escalations)

What NOT to extract:
- One-time greetings or generic conversation
- Information already in the order (items, prices — those are in the DB)
- Personal identifiable information (names, phone numbers, addresses)

If nothing worth extracting, return: { "facts": [] }

IMPORTANT: Return ONLY the JSON, no markdown.`;

// ── Queue Setup ──

const conversationFactory = new QueueFactory({
  name: 'knowledge:conversation',
  concurrency: 3,
  processor: async (job) => {
    const { tenantId, jid } = job.data as { tenantId: string; jid: string };
    await extractFromConversation(tenantId, jid);
  },
});

// ── Processing ──

async function getRecentConversation(tenantId: string, jid: string): Promise<ConversationMessage[]> {
  const result = await dbQuery<{ messages: ConversationMessage[] }>(
    `SELECT messages FROM conversations WHERE tenant_id = $1 AND jid = $2 ORDER BY updated_at DESC LIMIT 1`,
    [tenantId, jid],
  );

  if (result.rows.length === 0) return [];

  const messages = result.rows[0].messages;
  if (!Array.isArray(messages)) return [];

  // Only take the last 20 messages to keep context manageable
  return messages.slice(-20);
}

async function extractFromConversation(
  tenantId: string,
  jid: string,
): Promise<{ nodesCreated: number; edgesCreated: number }> {
  const sourceRef = `${tenantId}:${jid}:${Date.now()}`;

  // Check if we've already processed a conversation for this jid recently (within 1 hour)
  const recentCheck = await dbQuery<{ created_at: string }>(
    `SELECT created_at FROM knowledge_ingestion_log
     WHERE source_type = 'conversation' AND source_ref LIKE $1
     AND status = 'completed' AND created_at > now() - interval '1 hour'
     LIMIT 1`,
    [`${tenantId}:${jid}:%`],
  );

  if (recentCheck.rows.length > 0) {
    return { nodesCreated: 0, edgesCreated: 0 };
  }

  const messages = await getRecentConversation(tenantId, jid);
  if (messages.length < 3) {
    // Too short to extract meaningful knowledge
    return { nodesCreated: 0, edgesCreated: 0 };
  }

  await logIngestion('conversation', sourceRef, tenantId);

  try {
    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${m.content}`)
      .join('\n');

    const agent = new Agent({
      id: 'conversation-extractor',
      name: 'Conversation Knowledge Extractor',
      instructions: EXTRACTION_PROMPT,
      model: getModel('local'),
    });

    const result = await agent.generate(conversationText, { maxSteps: 1 });
    const text = result.text || '';

    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await completeIngestion('conversation', sourceRef, 0, 0);
      return { nodesCreated: 0, edgesCreated: 0 };
    }

    let extracted: { facts: ExtractedFact[] };
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      await completeIngestion('conversation', sourceRef, 0, 0);
      return { nodesCreated: 0, edgesCreated: 0 };
    }

    if (!extracted.facts || extracted.facts.length === 0) {
      await completeIngestion('conversation', sourceRef, 0, 0);
      return { nodesCreated: 0, edgesCreated: 0 };
    }

    let nodesCreated = 0;

    for (const fact of extracted.facts) {
      const validTypes: NodeType[] = ['fact', 'pattern', 'event'];
      const nodeType = validTypes.includes(fact.node_type as NodeType) ? fact.node_type as NodeType : 'fact';

      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(`${fact.title}: ${fact.content}`);
      } catch (err) {
        logger.warn({ title: fact.title, err }, 'Failed to generate embedding for conversation fact');
      }

      const nodeId = await insertNode({
        tenantId,
        nodeType,
        title: fact.title,
        content: fact.content,
        summary: fact.content.slice(0, 200),
        embedding,
        sourceType: 'conversation',
        sourceRef,
        tags: fact.tags || [],
        metadata: { customer_jid: jid },
      });

      nodesCreated++;
      appBus.emit('knowledge-node-created', tenantId, nodeId, nodeType);
    }

    await completeIngestion('conversation', sourceRef, nodesCreated, 0);

    if (nodesCreated > 0) {
      logger.info({ tenantId, jid, nodesCreated }, 'Conversation knowledge extracted');
      appBus.emit('knowledge-indexed', 'conversation', sourceRef, nodesCreated);
    }

    return { nodesCreated, edgesCreated: 0 };
  } catch (err: any) {
    await failIngestion('conversation', sourceRef, err.message);
    logger.error({ tenantId, jid, err: err.message }, 'Conversation knowledge extraction failed');
    return { nodesCreated: 0, edgesCreated: 0 };
  }
}

// ── Public API ──

/**
 * Start the conversation knowledge worker and register event listeners.
 */
export function startConversationKnowledgeWorker(): void {
  const queue = conversationFactory.getQueue();

  // Listen for completed AI jobs
  appBus.on('ai-job-completed', (tenantId: string, jid: string) => {
    queue.add(
      'extract',
      { tenantId, jid },
      {
        delay: 30_000, // Wait 30s for conversation to settle
        jobId: `knowledge-conv-${tenantId}-${jid}-${Date.now()}`,
        priority: 5, // Low priority — background work
      },
    ).catch((err) => {
      logger.warn({ tenantId, jid, err }, 'Failed to enqueue conversation knowledge job');
    });
  });

  // Start the worker (processor set in constructor)
  conversationFactory.getWorker();

  logger.info('Conversation knowledge worker started');
}

export async function stopConversationKnowledgeWorker(): Promise<void> {
  await conversationFactory.close();
}
