/**
 * Knowledge Tools — Mastra tools for the knowledge graph and PageIndex.
 *
 * Used by the knowledge specialist agent and optionally by other agents
 * (sales, analytics) when they need to look up institutional knowledge.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { generateEmbedding } from '../embedding-client.js';
import {
  searchNodes,
  lookupPageIndex,
  matchPageIndexByText,
  getRelatedNodes,
  findNodeByTitle,
  getNodeById,
  insertAnnotation,
  getAnnotations,
  type NodeType,
  type EdgeRelation,
  type AnnotationType,
} from '../../db/knowledge-repo.js';
import { getTenantId } from '../agents.js';
import { logger } from '../../shared/logger.js';

/**
 * Hybrid semantic + full-text search across the knowledge graph.
 */
export const knowledgeSearch = createTool({
  id: 'knowledge-search',
  description: 'Search the knowledge graph for information about the platform, business operations, or past decisions. Returns relevant knowledge nodes ranked by relevance.',
  inputSchema: z.object({
    query: z.string().describe('The search query — a question or topic to look up.'),
    scope: z.enum(['platform', 'tenant', 'all']).default('all')
      .describe('platform = codebase/architecture knowledge, tenant = business-specific, all = both.'),
    node_type: z.enum(['entity', 'concept', 'decision', 'pattern', 'module', 'event', 'fact', 'session']).optional()
      .describe('Filter by knowledge type.'),
    limit: z.number().min(1).max(20).default(5).describe('Max results to return.'),
  }),
  execute: async ({ query, scope, node_type, limit }) => {
    try {
      const tenantId = getTenantId();
      const embedding = await generateEmbedding(query);

      const results = await searchNodes({
        embedding,
        textQuery: query,
        tenantId: tenantId || undefined,
        scope: scope as 'platform' | 'tenant' | 'all',
        nodeType: node_type as NodeType | undefined,
        limit,
      });

      if (results.length === 0) {
        return { count: 0, results: [], message: 'No knowledge found for this query.' };
      }

      return {
        count: results.length,
        results: results.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary || r.content.slice(0, 200),
          node_type: r.nodeType,
          source: r.sourceType + (r.sourceRef ? `:${r.sourceRef}` : ''),
          confidence: r.confidence,
          tags: r.tags,
          score: Math.round(r.score * 1000) / 1000,
          created_at: r.createdAt,
        })),
      };
    } catch (err: any) {
      logger.error({ err: err.message }, 'knowledgeSearch failed');
      return { error: `Search failed: ${err.message}` };
    }
  },
});

/**
 * Meta-RAG: looks up WHERE to find information, not the information itself.
 * Returns topics with their data source locations (files, tables, MCP servers, etc.).
 */
export const pageIndexLookup = createTool({
  id: 'page-index-lookup',
  description: 'Find which data sources (files, database tables, MCP servers, knowledge nodes, skills) contain information about a topic. Use this FIRST to know WHERE to look.',
  inputSchema: z.object({
    question: z.string().describe('The question or topic to locate data sources for.'),
  }),
  execute: async ({ question }) => {
    try {
      const tenantId = getTenantId();
      const embedding = await generateEmbedding(question);

      // Combine semantic and text-based matching
      const [semanticResults, textResults] = await Promise.all([
        lookupPageIndex(embedding, tenantId || undefined, 5),
        matchPageIndexByText(question, tenantId || undefined, 3),
      ]);

      // Deduplicate by topic
      const seen = new Set<string>();
      const combined = [];
      for (const r of [...semanticResults, ...textResults]) {
        if (!seen.has(r.topic)) {
          seen.add(r.topic);
          combined.push({
            topic: r.topic,
            description: r.description,
            sources: r.sources,
            query_patterns: r.queryPatterns,
            score: 'score' in r ? Math.round((r as any).score * 1000) / 1000 : null,
          });
        }
      }

      if (combined.length === 0) {
        return { count: 0, topics: [], message: 'No indexed topics match this question.' };
      }

      return { count: combined.length, topics: combined };
    } catch (err: any) {
      logger.error({ err: err.message }, 'pageIndexLookup failed');
      return { error: `Page index lookup failed: ${err.message}` };
    }
  },
});

/**
 * Traverse the knowledge graph via typed edges.
 * Finds related concepts, dependencies, and evolution chains.
 */
export const knowledgeGraphQuery = createTool({
  id: 'knowledge-graph-query',
  description: 'Traverse the knowledge graph to find related concepts, dependencies, and evolution chains. Start from a known node or topic.',
  inputSchema: z.object({
    node_id: z.number().optional().describe('Starting node ID (if known).'),
    topic: z.string().optional().describe('Starting topic to search for (if node_id not known).'),
    relation: z.enum([
      'relates_to', 'depends_on', 'supersedes', 'implements', 'caused_by',
      'part_of', 'uses', 'contradicts', 'evolved_from', 'answers',
    ]).optional().describe('Filter by edge relationship type.'),
    depth: z.number().min(1).max(4).default(2).describe('How many levels deep to traverse.'),
  }),
  execute: async ({ node_id, topic, relation, depth }) => {
    try {
      let startNodeId = node_id;

      // If topic provided, find the starting node
      if (!startNodeId && topic) {
        const tenantId = getTenantId();
        const node = await findNodeByTitle(topic, tenantId || undefined);
        if (!node) {
          return { error: `No knowledge node found matching topic: "${topic}"` };
        }
        startNodeId = node.id;
      }

      if (!startNodeId) {
        return { error: 'Provide either node_id or topic to start the graph query.' };
      }

      // Get the starting node
      const startNode = await getNodeById(startNodeId);
      if (!startNode) {
        return { error: `Node ${startNodeId} not found.` };
      }

      // Traverse
      const related = await getRelatedNodes(
        startNodeId,
        relation as EdgeRelation | undefined,
        depth,
      );

      return {
        start_node: {
          id: startNode.id,
          title: startNode.title,
          summary: startNode.summary || startNode.content.slice(0, 200),
          type: startNode.nodeType,
        },
        related_count: related.length,
        graph: related.map((r) => ({
          node: {
            id: r.node.id,
            title: r.node.title,
            summary: r.node.summary || r.node.content.slice(0, 200),
            type: r.node.nodeType,
            confidence: r.node.confidence,
          },
          edge: {
            relation: r.edge.relation,
            weight: r.edge.weight,
          },
          depth: r.depth,
        })),
      };
    } catch (err: any) {
      logger.error({ err: err.message }, 'knowledgeGraphQuery failed');
      return { error: `Graph query failed: ${err.message}` };
    }
  },
});

/**
 * Add an AI annotation to a knowledge node.
 * Used to refine, correct, deprecate, or connect knowledge over time.
 */
export const knowledgeAnnotate = createTool({
  id: 'knowledge-annotate',
  description: 'Add a timestamped annotation to a knowledge node — insight, correction, deprecation, or connection.',
  inputSchema: z.object({
    node_id: z.number().describe('The knowledge node to annotate.'),
    annotation_type: z.enum(['insight', 'correction', 'deprecation', 'relevance_shift', 'connection'])
      .describe('Type of annotation.'),
    content: z.string().describe('The annotation content.'),
  }),
  execute: async ({ node_id, annotation_type, content }) => {
    try {
      const tenantId = getTenantId();

      // Verify node exists
      const node = await getNodeById(node_id);
      if (!node) {
        return { error: `Node ${node_id} not found.` };
      }

      // Check access: platform nodes are accessible to all, tenant nodes only to matching tenant
      if (node.tenantId && node.tenantId !== tenantId) {
        return { error: 'Cannot annotate a node belonging to another tenant.' };
      }

      const annotationId = await insertAnnotation(
        node_id,
        annotation_type as AnnotationType,
        content,
        'knowledge-agent',
        tenantId || null,
      );

      // Fetch updated annotations count
      const annotations = await getAnnotations(node_id, 1);

      return {
        success: true,
        annotation_id: annotationId,
        node_title: node.title,
        type: annotation_type,
        message: annotation_type === 'deprecation'
          ? `Node "${node.title}" marked as deprecated. Confidence reduced.`
          : `Annotation added to "${node.title}".`,
      };
    } catch (err: any) {
      logger.error({ err: err.message }, 'knowledgeAnnotate failed');
      return { error: `Annotation failed: ${err.message}` };
    }
  },
});
