-- ============================================================================
-- Knowledge Graph Schema — Agentic Knowledge Wiki
-- ============================================================================
-- Auto-discovered by src/db/migrate.ts (matches schema-*.sql pattern).
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT).
--
-- Tables:
--   knowledge_nodes         — Core graph nodes (concepts, decisions, patterns, etc.)
--   knowledge_edges         — Typed relationships between nodes
--   knowledge_annotations   — Timestamped AI annotations on nodes
--   page_index              — Meta-RAG: maps topics to data sources
--   knowledge_ingestion_log — Dedup tracker for background workers
-- ============================================================================

-- Requires pgvector (already enabled in schema.sql for memory_nodes)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── knowledge_nodes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id            SERIAL PRIMARY KEY,
  tenant_id     TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  -- NULL tenant_id = platform-level knowledge (codebase, architecture)
  -- non-NULL     = tenant-specific knowledge (business operations, customer patterns)

  node_type     TEXT NOT NULL CHECK (node_type IN (
    'entity', 'concept', 'decision', 'pattern', 'module', 'event', 'fact', 'session'
  )),

  title         TEXT NOT NULL,
  content       TEXT NOT NULL,         -- Full knowledge content (markdown)
  summary       TEXT,                  -- AI-generated 1-2 sentence summary
  embedding     vector(1536),          -- For semantic search (matches memory_nodes dimensions)

  source_type   TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN (
    'git_commit', 'conversation', 'agent_extraction', 'manual', 'event'
  )),
  source_ref    TEXT,                  -- Commit SHA, conversation ID, event ID, etc.

  confidence    FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  version       INT NOT NULL DEFAULT 1,
  superseded_by INT REFERENCES knowledge_nodes(id),

  tags          TEXT[] NOT NULL DEFAULT '{}',
  metadata      JSONB NOT NULL DEFAULT '{}',
  -- metadata: { language, author, file_paths[], line_ranges[], commit_sha, ... }

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kn_tenant     ON knowledge_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kn_type       ON knowledge_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_kn_source     ON knowledge_nodes(source_type);
CREATE INDEX IF NOT EXISTS idx_kn_tags       ON knowledge_nodes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_kn_created    ON knowledge_nodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kn_confidence ON knowledge_nodes(confidence DESC);

-- HNSW cosine index for semantic search (cosine is scale-invariant, better for text)
CREATE INDEX IF NOT EXISTS idx_kn_embedding ON knowledge_nodes
  USING hnsw (embedding vector_cosine_ops);

-- Full-text search on title + summary (Spanish dictionary for LATAM)
CREATE INDEX IF NOT EXISTS idx_kn_fts ON knowledge_nodes
  USING GIN(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(summary, '')));


-- ── knowledge_edges ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id          SERIAL PRIMARY KEY,
  tenant_id   TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  source_id   INT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_id   INT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,

  relation    TEXT NOT NULL CHECK (relation IN (
    'relates_to', 'depends_on', 'supersedes', 'implements', 'caused_by',
    'part_of', 'uses', 'contradicts', 'evolved_from', 'answers'
  )),

  weight      FLOAT NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 10),
  metadata    JSONB NOT NULL DEFAULT '{}',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(source_id, target_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_ke_source   ON knowledge_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_ke_target   ON knowledge_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_ke_relation ON knowledge_edges(relation);
CREATE INDEX IF NOT EXISTS idx_ke_tenant   ON knowledge_edges(tenant_id);


-- ── knowledge_annotations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_annotations (
  id              SERIAL PRIMARY KEY,
  node_id         INT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  tenant_id       TEXT REFERENCES tenants(id) ON DELETE CASCADE,

  annotation_type TEXT NOT NULL CHECK (annotation_type IN (
    'insight', 'correction', 'deprecation', 'relevance_shift', 'connection'
  )),

  content         TEXT NOT NULL,
  author          TEXT NOT NULL DEFAULT 'system',  -- 'system' | agent_id | user_id
  confidence      FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),

  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ka_node    ON knowledge_annotations(node_id);
CREATE INDEX IF NOT EXISTS idx_ka_tenant  ON knowledge_annotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ka_created ON knowledge_annotations(created_at DESC);


-- ── page_index (Meta-RAG) ───────────────────────────────────────────────────
-- Maps topics/questions to WHERE relevant data lives (files, tables, MCP
-- servers, knowledge nodes, skills, docs). The agent consults this first
-- to know where to look, then queries those specific sources.

CREATE TABLE IF NOT EXISTS page_index (
  id                SERIAL PRIMARY KEY,
  tenant_id         TEXT REFERENCES tenants(id) ON DELETE CASCADE,

  topic             TEXT NOT NULL,
  description       TEXT NOT NULL,
  embedding         vector(1536),

  sources           JSONB NOT NULL DEFAULT '[]',
  -- Array of source descriptors:
  -- [
  --   { "type": "file",           "path": "apps/business/src/payments/...",  "relevance": 0.95 },
  --   { "type": "table",          "name": "payments",                       "relevance": 0.9  },
  --   { "type": "mcp_server",     "name": "payments-mcp", "tools": [...],   "relevance": 0.85 },
  --   { "type": "knowledge_node", "node_id": 42,                            "relevance": 0.8  },
  --   { "type": "skill",          "name": "agente-payments",                "relevance": 0.7  },
  --   { "type": "doc",            "path": "docs/platform/ARCHITECTURE.md",  "relevance": 0.6  }
  -- ]

  query_patterns    TEXT[] NOT NULL DEFAULT '{}',
  -- Example queries this topic answers (ES + EN):
  -- ["how do payments work", "como funcionan los pagos", "estado de pago"]

  staleness_hours   INT NOT NULL DEFAULT 720,  -- Refresh every 30 days by default
  last_refreshed_at TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pi_tenant    ON page_index(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pi_topic     ON page_index(topic);
CREATE INDEX IF NOT EXISTS idx_pi_embedding ON page_index
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_pi_patterns  ON page_index USING GIN(query_patterns);


-- ── knowledge_ingestion_log ─────────────────────────────────────────────────
-- Tracks what has been ingested to prevent duplicate processing.

CREATE TABLE IF NOT EXISTS knowledge_ingestion_log (
  id              SERIAL PRIMARY KEY,
  source_type     TEXT NOT NULL,           -- 'git_commit' | 'conversation' | 'event'
  source_ref      TEXT NOT NULL,           -- Commit SHA, conversation ID, event ID
  tenant_id       TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  nodes_created   INT NOT NULL DEFAULT 0,
  edges_created   INT NOT NULL DEFAULT 0,
  error           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(source_type, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_kil_status ON knowledge_ingestion_log(status);
CREATE INDEX IF NOT EXISTS idx_kil_source ON knowledge_ingestion_log(source_type, source_ref);
