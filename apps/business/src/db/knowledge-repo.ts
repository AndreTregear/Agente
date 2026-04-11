/**
 * Knowledge Repository — data access for the knowledge graph.
 *
 * Follows the pattern of customer-memories-repo.ts:
 *   - Typed interfaces, row mappers
 *   - Tenant-scoped queries (with nullable tenant_id for platform knowledge)
 *   - Uses pg pool from ./pool.ts
 */

import { query, queryOne } from './pool.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type NodeType = 'entity' | 'concept' | 'decision' | 'pattern' | 'module' | 'event' | 'fact' | 'session';
export type SourceType = 'git_commit' | 'conversation' | 'agent_extraction' | 'manual' | 'event';
export type AnnotationType = 'insight' | 'correction' | 'deprecation' | 'relevance_shift' | 'connection';
export type EdgeRelation = 'relates_to' | 'depends_on' | 'supersedes' | 'implements' | 'caused_by' | 'part_of' | 'uses' | 'contradicts' | 'evolved_from' | 'answers';

export interface KnowledgeNode {
  id: number;
  tenantId: string | null;
  nodeType: NodeType;
  title: string;
  content: string;
  summary: string | null;
  sourceType: SourceType;
  sourceRef: string | null;
  confidence: number;
  version: number;
  supersededBy: number | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEdge {
  id: number;
  tenantId: string | null;
  sourceId: number;
  targetId: number;
  relation: EdgeRelation;
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface KnowledgeAnnotation {
  id: number;
  nodeId: number;
  tenantId: string | null;
  annotationType: AnnotationType;
  content: string;
  author: string;
  confidence: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PageIndexEntry {
  id: number;
  tenantId: string | null;
  topic: string;
  description: string;
  sources: Array<{ type: string; [key: string]: unknown }>;
  queryPatterns: string[];
  stalenessHours: number;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult extends KnowledgeNode {
  score: number;
}

// ── Row Mappers ────────────────────────────────────────────────────────────

function rowToNode(r: Record<string, unknown>): KnowledgeNode {
  return {
    id: r.id as number,
    tenantId: r.tenant_id as string | null,
    nodeType: r.node_type as NodeType,
    title: r.title as string,
    content: r.content as string,
    summary: r.summary as string | null,
    sourceType: r.source_type as SourceType,
    sourceRef: r.source_ref as string | null,
    confidence: r.confidence as number,
    version: r.version as number,
    supersededBy: r.superseded_by as number | null,
    tags: r.tags as string[],
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToEdge(r: Record<string, unknown>): KnowledgeEdge {
  return {
    id: r.id as number,
    tenantId: r.tenant_id as string | null,
    sourceId: r.source_id as number,
    targetId: r.target_id as number,
    relation: r.relation as EdgeRelation,
    weight: r.weight as number,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at as string,
  };
}

function rowToAnnotation(r: Record<string, unknown>): KnowledgeAnnotation {
  return {
    id: r.id as number,
    nodeId: r.node_id as number,
    tenantId: r.tenant_id as string | null,
    annotationType: r.annotation_type as AnnotationType,
    content: r.content as string,
    author: r.author as string,
    confidence: r.confidence as number,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at as string,
  };
}

function rowToPageIndex(r: Record<string, unknown>): PageIndexEntry {
  return {
    id: r.id as number,
    tenantId: r.tenant_id as string | null,
    topic: r.topic as string,
    description: r.description as string,
    sources: (r.sources ?? []) as Array<{ type: string; [key: string]: unknown }>,
    queryPatterns: (r.query_patterns ?? []) as string[],
    stalenessHours: r.staleness_hours as number,
    lastRefreshedAt: r.last_refreshed_at as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Escape ILIKE special characters to prevent pattern injection. */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// ── Knowledge Nodes ────────────────────────────────────────────────────────

export async function insertNode(node: {
  tenantId?: string | null;
  nodeType: NodeType;
  title: string;
  content: string;
  summary?: string | null;
  embedding?: number[] | null;
  sourceType: SourceType;
  sourceRef?: string | null;
  confidence?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const embeddingValue = node.embedding ? `[${node.embedding.join(',')}]` : null;

  const result = await queryOne<{ id: number }>(
    `INSERT INTO knowledge_nodes
       (tenant_id, node_type, title, content, summary, embedding, source_type, source_ref, confidence, tags, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      node.tenantId ?? null,
      node.nodeType,
      node.title,
      node.content,
      node.summary ?? null,
      embeddingValue,
      node.sourceType,
      node.sourceRef ?? null,
      node.confidence ?? 1.0,
      node.tags ?? [],
      JSON.stringify(node.metadata ?? {}),
    ],
  );

  return result!.id;
}

/**
 * Get a node by ID with tenant isolation.
 * Returns the node only if it's platform-level (tenant_id IS NULL) or belongs to the given tenant.
 */
export async function getNodeById(id: number, tenantId?: string | null): Promise<KnowledgeNode | null> {
  const row = await queryOne<Record<string, unknown>>(
    tenantId
      ? `SELECT * FROM knowledge_nodes WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)`
      : `SELECT * FROM knowledge_nodes WHERE id = $1 AND tenant_id IS NULL`,
    tenantId ? [id, tenantId] : [id],
  );
  return row ? rowToNode(row) : null;
}

/**
 * Hybrid semantic + full-text search across knowledge nodes.
 * Combines vector similarity (cosine) with Spanish full-text relevance.
 */
export async function searchNodes(params: {
  embedding: number[];
  textQuery?: string;
  tenantId?: string | null;
  scope?: 'platform' | 'tenant' | 'all';
  nodeType?: NodeType;
  limit?: number;
}): Promise<SearchResult[]> {
  const { embedding, textQuery, tenantId, scope = 'all', nodeType, limit = 10 } = params;
  const embeddingStr = `[${embedding.join(',')}]`;

  const conditions: string[] = [
    'superseded_by IS NULL', // Only current versions
    'confidence > 0.1',     // Filter very low confidence
  ];
  const values: unknown[] = [embeddingStr, limit];
  let paramIdx = 3;

  // Scope filtering — always enforce tenant isolation
  if (scope === 'platform') {
    conditions.push('tenant_id IS NULL');
  } else if (scope === 'tenant' && tenantId) {
    conditions.push(`tenant_id = $${paramIdx}`);
    values.push(tenantId);
    paramIdx++;
  } else if (scope === 'all') {
    // 'all' = platform knowledge + current tenant only — never other tenants
    if (tenantId) {
      conditions.push(`(tenant_id IS NULL OR tenant_id = $${paramIdx})`);
      values.push(tenantId);
      paramIdx++;
    } else {
      conditions.push('tenant_id IS NULL');
    }
  }

  if (nodeType) {
    conditions.push(`node_type = $${paramIdx}`);
    values.push(nodeType);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build the hybrid score expression
  const vectorScore = `(1 - (embedding <=> $1::vector))`;
  let scoreExpr = vectorScore;

  if (textQuery) {
    conditions.push(`(
      to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, '')) @@
      plainto_tsquery('spanish', $${paramIdx})
      OR title ILIKE '%' || $${paramIdx} || '%'
    )`);
    values.push(escapeLike(textQuery));
    const ftsScore = `ts_rank(
      to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, '')),
      plainto_tsquery('spanish', $${paramIdx})
    )`;
    scoreExpr = `(0.7 * ${vectorScore} + 0.3 * coalesce(${ftsScore}, 0))`;
    paramIdx++;
  }

  // Rebuild WHERE with the text condition included
  const finalWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<Record<string, unknown>>(
    `SELECT *, ${scoreExpr} AS score
     FROM knowledge_nodes
     ${finalWhere}
     ORDER BY score DESC
     LIMIT $2`,
    values,
  );

  return result.rows.map((r) => ({
    ...rowToNode(r),
    score: r.score as number,
  }));
}

/**
 * Get related nodes via graph traversal (recursive CTE).
 * Traverses knowledge_edges up to `depth` levels from a starting node.
 */
/**
 * Get related nodes via graph traversal with cycle detection and tenant isolation.
 */
export async function getRelatedNodes(
  nodeId: number,
  relation?: EdgeRelation,
  depth: number = 2,
  tenantId?: string | null,
): Promise<Array<{ node: KnowledgeNode; edge: KnowledgeEdge; depth: number }>> {
  const maxDepth = Math.min(depth, 4); // Cap at 4 to prevent runaway queries

  const relationFilter = relation ? `AND e.relation = $2` : '';
  const params: unknown[] = [nodeId];
  if (relation) params.push(relation);
  params.push(maxDepth);
  const depthParam = relation ? '$3' : '$2';

  // Tenant isolation: only traverse into platform nodes or current tenant's nodes
  let tenantFilter = 'AND (n.tenant_id IS NULL)';
  if (tenantId) {
    params.push(tenantId);
    const tenantParam = `$${params.length}`;
    tenantFilter = `AND (n.tenant_id IS NULL OR n.tenant_id = ${tenantParam})`;
  }

  const result = await query<Record<string, unknown>>(
    `WITH RECURSIVE graph AS (
       -- Base: direct edges from the starting node
       SELECT e.id AS edge_id, e.source_id, e.target_id, e.relation, e.weight,
              e.metadata AS edge_metadata, e.tenant_id AS edge_tenant_id, e.created_at AS edge_created_at,
              1 AS depth,
              ARRAY[e.source_id] AS visited
       FROM knowledge_edges e
       WHERE e.source_id = $1 ${relationFilter}

       UNION ALL

       -- Recursive: follow edges from discovered nodes (with cycle detection)
       SELECT e.id, e.source_id, e.target_id, e.relation, e.weight,
              e.metadata, e.tenant_id, e.created_at,
              g.depth + 1,
              g.visited || e.source_id
       FROM knowledge_edges e
       INNER JOIN graph g ON e.source_id = g.target_id
       WHERE g.depth < ${depthParam}
         AND e.target_id <> ALL(g.visited)
         ${relationFilter}
     )
     SELECT g.edge_id, g.source_id, g.target_id, g.relation, g.weight,
            g.edge_metadata, g.edge_tenant_id, g.edge_created_at, g.depth,
            n.*
     FROM graph g
     INNER JOIN knowledge_nodes n ON n.id = g.target_id
     WHERE n.superseded_by IS NULL ${tenantFilter}
     ORDER BY g.depth, g.weight DESC
     LIMIT 50`,
    params,
  );

  return result.rows.map((r) => ({
    node: rowToNode(r),
    edge: {
      id: r.edge_id as number,
      tenantId: r.edge_tenant_id as string | null,
      sourceId: r.source_id as number,
      targetId: r.target_id as number,
      relation: r.relation as EdgeRelation,
      weight: r.weight as number,
      metadata: (r.edge_metadata ?? {}) as Record<string, unknown>,
      createdAt: r.edge_created_at as string,
    },
    depth: r.depth as number,
  }));
}

/**
 * Find a node by title (exact or fuzzy match).
 */
export async function findNodeByTitle(
  title: string,
  tenantId?: string | null,
): Promise<KnowledgeNode | null> {
  const conditions = ['title ILIKE $1', 'superseded_by IS NULL'];
  const params: unknown[] = [`%${escapeLike(title)}%`];

  if (tenantId !== undefined) {
    if (tenantId === null) {
      conditions.push('tenant_id IS NULL');
    } else {
      conditions.push('tenant_id = $2');
      params.push(tenantId);
    }
  }

  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM knowledge_nodes WHERE ${conditions.join(' AND ')} ORDER BY confidence DESC LIMIT 1`,
    params,
  );
  return row ? rowToNode(row) : null;
}

// ── Knowledge Edges ────────────────────────────────────────────────────────

export async function insertEdge(
  sourceId: number,
  targetId: number,
  relation: EdgeRelation,
  weight: number = 1.0,
  tenantId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<number> {
  const result = await queryOne<{ id: number }>(
    `INSERT INTO knowledge_edges (tenant_id, source_id, target_id, relation, weight, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_id, target_id, relation) DO UPDATE SET weight = EXCLUDED.weight
     RETURNING id`,
    [tenantId ?? null, sourceId, targetId, relation, weight, JSON.stringify(metadata ?? {})],
  );
  return result!.id;
}

// ── Knowledge Annotations ──────────────────────────────────────────────────

export async function insertAnnotation(
  nodeId: number,
  annotationType: AnnotationType,
  content: string,
  author: string = 'system',
  tenantId?: string | null,
): Promise<number> {
  // Rate-limit deprecation annotations: max 3 per node per hour
  if (annotationType === 'deprecation') {
    const recentCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM knowledge_annotations
       WHERE node_id = $1 AND annotation_type = 'deprecation' AND created_at > now() - interval '1 hour'`,
      [nodeId],
    );
    if (parseInt(recentCount?.count ?? '0', 10) >= 3) {
      throw new Error('Rate limit: max 3 deprecation annotations per node per hour');
    }
  }

  const result = await queryOne<{ id: number }>(
    `INSERT INTO knowledge_annotations (node_id, tenant_id, annotation_type, content, author)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nodeId, tenantId ?? null, annotationType, content, author],
  );

  // If deprecation, reduce the node's confidence
  if (annotationType === 'deprecation') {
    await query(
      `UPDATE knowledge_nodes
       SET confidence = GREATEST(0, confidence - 0.2), updated_at = now()
       WHERE id = $1`,
      [nodeId],
    );
  }

  return result!.id;
}

export async function getAnnotations(
  nodeId: number,
  limit: number = 20,
): Promise<KnowledgeAnnotation[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM knowledge_annotations WHERE node_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [nodeId, limit],
  );
  return result.rows.map(rowToAnnotation);
}

// ── Page Index ─────────────────────────────────────────────────────────────

export async function upsertPageIndex(entry: {
  tenantId?: string | null;
  topic: string;
  description: string;
  embedding?: number[] | null;
  sources: Array<{ type: string; [key: string]: unknown }>;
  queryPatterns: string[];
  stalenessHours?: number;
}): Promise<number> {
  const embeddingValue = entry.embedding ? `[${entry.embedding.join(',')}]` : null;

  const result = await queryOne<{ id: number }>(
    `INSERT INTO page_index
       (tenant_id, topic, description, embedding, sources, query_patterns, staleness_hours, last_refreshed_at)
     VALUES ($1, $2, $3, $4::vector, $5, $6, $7, now())
     ON CONFLICT ON CONSTRAINT uq_pi_tenant_topic
     DO UPDATE SET
       description = EXCLUDED.description,
       embedding = EXCLUDED.embedding,
       sources = EXCLUDED.sources,
       query_patterns = EXCLUDED.query_patterns,
       staleness_hours = EXCLUDED.staleness_hours,
       last_refreshed_at = now(),
       updated_at = now()
     RETURNING id`,
    [
      entry.tenantId ?? null,
      entry.topic,
      entry.description,
      embeddingValue,
      JSON.stringify(entry.sources),
      entry.queryPatterns,
      entry.stalenessHours ?? 720,
    ],
  );

  return result?.id ?? 0;
}

/**
 * Semantic lookup on the page index — finds which topics match a question.
 */
export async function lookupPageIndex(
  embedding: number[],
  tenantId?: string | null,
  limit: number = 5,
): Promise<Array<PageIndexEntry & { score: number }>> {
  const embeddingStr = `[${embedding.join(',')}]`;

  // Search both platform-level and tenant-specific page index entries
  const conditions = ['embedding IS NOT NULL'];
  const params: unknown[] = [embeddingStr, limit];
  let paramIdx = 3;

  if (tenantId) {
    conditions.push(`(tenant_id IS NULL OR tenant_id = $${paramIdx})`);
    params.push(tenantId);
    paramIdx++;
  }

  const where = conditions.join(' AND ');

  const result = await query<Record<string, unknown>>(
    `SELECT *, (1 - (embedding <=> $1::vector)) AS score
     FROM page_index
     WHERE ${where}
     ORDER BY score DESC
     LIMIT $2`,
    params,
  );

  return result.rows.map((r) => ({
    ...rowToPageIndex(r),
    score: r.score as number,
  }));
}

/**
 * Text-based pattern match on page_index query_patterns.
 */
export async function matchPageIndexByText(
  text: string,
  tenantId?: string | null,
  limit: number = 5,
): Promise<PageIndexEntry[]> {
  const conditions = [`$1 ILIKE ANY(
    SELECT '%' || unnest(query_patterns) || '%'
  )`];
  const params: unknown[] = [text.toLowerCase(), limit];

  if (tenantId) {
    conditions.push(`(tenant_id IS NULL OR tenant_id = $3)`);
    params.push(tenantId);
  }

  const result = await query<Record<string, unknown>>(
    `SELECT * FROM page_index
     WHERE EXISTS (
       SELECT 1 FROM unnest(query_patterns) AS p
       WHERE $1 ILIKE '%' || p || '%' OR p ILIKE '%' || $1 || '%'
     )
     ${tenantId ? 'AND (tenant_id IS NULL OR tenant_id = $3)' : ''}
     LIMIT $2`,
    params,
  );

  return result.rows.map(rowToPageIndex);
}

// ── Ingestion Log ──────────────────────────────────────────────────────────

export async function isAlreadyIngested(
  sourceType: string,
  sourceRef: string,
): Promise<boolean> {
  const row = await queryOne<{ status: string }>(
    `SELECT status FROM knowledge_ingestion_log WHERE source_type = $1 AND source_ref = $2`,
    [sourceType, sourceRef],
  );
  return row?.status === 'completed';
}

export async function logIngestion(
  sourceType: string,
  sourceRef: string,
  tenantId?: string | null,
): Promise<void> {
  await query(
    `INSERT INTO knowledge_ingestion_log (source_type, source_ref, tenant_id, status, started_at)
     VALUES ($1, $2, $3, 'processing', now())
     ON CONFLICT (source_type, source_ref) DO UPDATE SET status = 'processing', started_at = now()`,
    [sourceType, sourceRef, tenantId ?? null],
  );
}

export async function completeIngestion(
  sourceType: string,
  sourceRef: string,
  nodesCreated: number,
  edgesCreated: number,
): Promise<void> {
  await query(
    `UPDATE knowledge_ingestion_log
     SET status = 'completed', nodes_created = $3, edges_created = $4, completed_at = now()
     WHERE source_type = $1 AND source_ref = $2`,
    [sourceType, sourceRef, nodesCreated, edgesCreated],
  );
}

export async function failIngestion(
  sourceType: string,
  sourceRef: string,
  error: string,
): Promise<void> {
  await query(
    `UPDATE knowledge_ingestion_log
     SET status = 'failed', error = $3, completed_at = now()
     WHERE source_type = $1 AND source_ref = $2`,
    [sourceType, sourceRef, error],
  );
}

// ── Bulk Queries (for wiki generation) ─────────────────────────────────────

/**
 * Get all current knowledge nodes grouped by type, for wiki generation.
 */
export async function getNodesByType(
  nodeType?: NodeType,
  tenantId?: string | null,
  limit: number = 500,
): Promise<KnowledgeNode[]> {
  const conditions = ['superseded_by IS NULL', 'confidence > 0.1'];
  const params: unknown[] = [limit];
  let paramIdx = 2;

  if (nodeType) {
    conditions.push(`node_type = $${paramIdx}`);
    params.push(nodeType);
    paramIdx++;
  }

  if (tenantId !== undefined) {
    if (tenantId === null) {
      conditions.push('tenant_id IS NULL');
    } else {
      conditions.push(`tenant_id = $${paramIdx}`);
      params.push(tenantId);
      paramIdx++;
    }
  }

  const result = await query<Record<string, unknown>>(
    `SELECT * FROM knowledge_nodes
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $1`,
    params,
  );

  return result.rows.map(rowToNode);
}

/**
 * Get stale page_index entries that need refreshing.
 */
export async function getStalePageIndexEntries(limit: number = 20): Promise<PageIndexEntry[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM page_index
     WHERE last_refreshed_at IS NULL
        OR last_refreshed_at + (staleness_hours || ' hours')::interval < now()
     ORDER BY last_refreshed_at ASC NULLS FIRST
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(rowToPageIndex);
}
