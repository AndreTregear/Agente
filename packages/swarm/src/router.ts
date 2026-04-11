/**
 * Request Router — classifies incoming requests and decides routing.
 *
 * Rule-based first (no LLM call) for speed. Falls back to sensible defaults.
 * The router decides between:
 *   - Pipeline mode: single agent, fast, for interactive use
 *   - Swarm mode: fan-out to multiple agents, for complex/background tasks
 */

import type { AgentContext } from './context.js';
import type { SwarmPlan } from './orchestrator.js';
import { getAllAgents } from './registry.js';

// ── Types ──

export type RouteDecision =
  | { mode: 'pipeline'; agentId: string }
  | { mode: 'swarm'; plan: SwarmPlan };

// ── Classification Heuristics ──

/** Patterns that suggest multiple questions or sub-tasks. */
const MULTI_PART_PATTERNS = [
  /\by\b.*\btambién\b/i,          // "y también" (and also)
  /\badicionalmente\b/i,           // "additionally"
  /\bademás\b/i,                   // "moreover"
  /\bprimero\b.*\bluego\b/i,      // "first... then"
  /\b(?:1|primero)[.)]\s/i,       // numbered lists: "1." or "1)"
  /\band\s+also\b/i,
  /\bfirst\b.*\bthen\b/i,
  /\bplus\b/i,
  /\?\s*\S+.*\?/,                  // Multiple question marks
];

/** Patterns that suggest knowledge/wiki/documentation queries. */
const KNOWLEDGE_PATTERNS = [
  /\bwiki\b/i,
  /\bknowledge\b/i,
  /\bconocimiento\b/i,
  /\b(?:cómo|como)\s+funciona\b/i,       // "how does X work"
  /\barquitectura\b/i,
  /\barchitecture\b/i,
  /\bdecisi[oó]n\b/i,
  /\bpatr[oó]n\b/i,
  /\bpattern\b/i,
  /\bdocumentaci[oó]n\b/i,
  /\b(?:por\s+qu[eé]|why)\b.*\b(?:se\s+hizo|we\s+did|decidimos)\b/i,
  /\b(?:qué|que)\s+cambió\b/i,           // "what changed"
  /\bhistor(?:y|ia)\b/i,
  /\bevoluci[oó]n\b/i,
];

/** Check if the input is a knowledge/wiki query. */
function isKnowledgeQuery(input: string): boolean {
  return KNOWLEDGE_PATTERNS.some((p) => p.test(input));
}

/** Patterns that suggest owner/CEO report requests. */
const REPORT_PATTERNS = [
  /\breporte?\b/i,
  /\breport\b/i,
  /\bresumen\b/i,
  /\bsummary\b/i,
  /\bdashboard\b/i,
  /\banalytics?\b/i,
  /\banálisis\b/i,
  /\bweekly\b/i,
  /\bsemanal\b/i,
  /\bdiario\b/i,
  /\bdaily\b/i,
];

/** Check if the input matches multiple-part heuristics. */
function isMultiPart(input: string): boolean {
  return MULTI_PART_PATTERNS.some((p) => p.test(input));
}

/** Check if the input is a report/analytics request. */
function isReportRequest(input: string): boolean {
  return REPORT_PATTERNS.some((p) => p.test(input));
}

// ── Public API ──

/**
 * Classify an incoming request and decide routing.
 *
 * Rules (evaluated in order):
 *   1. Priority 1 (interactive) → pipeline always
 *   2. Short messages (<50 chars) → pipeline (simple query)
 *   3. Knowledge/wiki queries → pipeline to knowledge agent
 *   4. CEO/owner report requests → swarm (fan-out to analytics agents)
 *   5. Multi-part messages (multiple questions) → swarm candidate
 *   6. Everything else → pipeline with general agent
 */
export function classifyRequest(
  input: string,
  ctx: AgentContext,
): RouteDecision {
  const trimmed = input.trim();

  // 1. Interactive priority → pipeline always (voice, real-time chat)
  if (ctx.priority === 1) {
    return { mode: 'pipeline', agentId: 'general' };
  }

  // 2. Short messages → pipeline (simple query, no decomposition needed)
  if (trimmed.length < 50) {
    return { mode: 'pipeline', agentId: 'general' };
  }

  // 3. Knowledge/wiki queries → pipeline to knowledge agent
  if (isKnowledgeQuery(trimmed)) {
    return { mode: 'pipeline', agentId: 'knowledge' };
  }

  // 4. CEO/owner report requests → swarm with analytics fan-out
  if (ctx.isOwner && isReportRequest(trimmed)) {
    return {
      mode: 'swarm',
      plan: buildReportPlan(trimmed, ctx),
    };
  }

  // 5. Multi-part messages → swarm candidate
  if (isMultiPart(trimmed)) {
    return {
      mode: 'swarm',
      plan: {
        objective: trimmed,
        tasks: [
          { agentId: 'general', input: trimmed },
        ],
        aggregation: 'concat',
      },
    };
  }

  // 6. Default → pipeline with general agent
  return { mode: 'pipeline', agentId: 'general' };
}

/**
 * Build a report plan that fans out to available analytics-capable agents.
 * Falls back to a single general agent if no specialists are registered.
 */
function buildReportPlan(input: string, _ctx: AgentContext): SwarmPlan {
  const agents = getAllAgents();

  // Look for agents with analytics/report-related queues or descriptions
  const analyticsAgents = agents.filter(
    (a) =>
      a.queue === 'analytics' ||
      a.description.toLowerCase().includes('analytics') ||
      a.description.toLowerCase().includes('report') ||
      a.description.toLowerCase().includes('sales'),
  );

  if (analyticsAgents.length === 0) {
    // No specialist agents registered yet — use general
    return {
      objective: input,
      tasks: [{ agentId: 'general', input }],
      aggregation: 'concat',
    };
  }

  return {
    objective: input,
    tasks: analyticsAgents.map((agent) => ({
      agentId: agent.id,
      input: `${input}\n\n[Tu rol: ${agent.description}]`,
    })),
    aggregation: 'synthesize',
  };
}
