# KNOWLEDGE.md — How to Use the Knowledge System

_Read this on your first session. This is how you access the platform's institutional memory._

## What Is This?

The Yaya platform has a **knowledge graph** — a structured, searchable database of everything the platform knows about itself: architectural decisions, code patterns, business logic, customer insights, and how the system evolved over time.

Instead of reading hundreds of files, you query the graph. Instead of guessing where something is, you ask the **PageIndex** — a meta-index that tells you WHERE to look before you look.

## Quick Start (Do This First)

When you need to understand something about the codebase, business logic, or past decisions:

```
1. Ask the knowledge agent (it routes automatically for questions like "how does X work")
2. Or use the tools directly in your code/queries:
   - knowledgeSearch   → "What do we know about payments?"
   - pageIndexLookup   → "Where is payment logic?" (returns files, tables, MCP servers)
   - knowledgeGraphQuery → "What depends on the payment system?"
   - knowledgeAnnotate  → "This fact is outdated" (annotate with corrections)
```

## The Four Tools

### 1. `knowledgeSearch` — Find Knowledge

Hybrid semantic + full-text search. Understands Spanish and English.

```
Input:
  query: "como funcionan los pagos"     ← natural language question
  scope: "platform" | "tenant" | "all"  ← where to look
  node_type: "decision" | "pattern" | "module" | "event" | "fact"  ← optional filter
  limit: 5                              ← max results

Output:
  [{ title, summary, node_type, source, confidence, tags, score }]
```

**When to use:** You need to know WHAT the platform knows about a topic.

**Scope guide:**
- `platform` — Codebase architecture, git commit knowledge, design decisions
- `tenant` — Business-specific knowledge for a particular tenant (customer patterns, product insights)
- `all` — Both (default)

### 2. `pageIndexLookup` — Find WHERE Info Lives

This is the secret weapon. Before you search all documents, ask the PageIndex which files, database tables, MCP servers, and skills are relevant to your question.

```
Input:
  question: "how do payments work"

Output:
  topics: [
    {
      topic: "payment_processing",
      description: "How payments work: Yape detection, matching, confirmation...",
      sources: [
        { type: "file",       path: "apps/business/src/payments/yape-matcher.ts" },
        { type: "table",      name: "payments" },
        { type: "mcp_server", name: "payments-mcp", tools: ["verify_payment"] },
        { type: "skill",      name: "agente-payments" },
        { type: "doc",        path: "docs/platform/ARCHITECTURE.md" }
      ]
    }
  ]
```

**When to use:** You need to modify or understand a system but don't know which files to read. Use this FIRST, then read the specific files it points you to.

### 3. `knowledgeGraphQuery` — Traverse Relationships

Navigate the graph to find how concepts connect — what depends on what, what evolved from what, what caused what.

```
Input:
  topic: "swarm architecture"   ← find starting node by title
  relation: "depends_on"        ← optional: filter edge type
  depth: 2                      ← how many hops (1-4)

Output:
  start_node: { id, title, summary, type }
  graph: [
    { node: { title, summary, type }, edge: { relation, weight }, depth: 1 },
    { node: { title, summary, type }, edge: { relation, weight }, depth: 2 },
  ]
```

**Edge types:** `relates_to`, `depends_on`, `supersedes`, `implements`, `caused_by`, `part_of`, `uses`, `contradicts`, `evolved_from`, `answers`

**When to use:** You need to understand impact — "if I change X, what else is affected?" or "why was this decision made?"

### 4. `knowledgeAnnotate` — Annotate Knowledge

Add timestamped notes to knowledge nodes. This is how knowledge improves over time.

```
Input:
  node_id: 42
  annotation_type: "insight" | "correction" | "deprecation" | "relevance_shift" | "connection"
  content: "This pattern was replaced by the swarm architecture in commit 673ae81"
```

**When to use:**
- You notice a fact is outdated → `correction`
- You discover a useful insight → `insight`
- Something is no longer relevant → `deprecation` (reduces confidence automatically)
- You find a connection to another concept → `connection`

## How Knowledge Gets In

You don't need to manually add knowledge. Three background workers do it automatically:

| Worker | Trigger | What It Does |
|--------|---------|--------------|
| **Git Ingestion** | Every 6 hours | Extracts decisions, patterns, and events from new commits |
| **Conversation Extraction** | After each AI conversation | Extracts customer preferences, product insights, operational patterns |
| **PageIndex Refresh** | Daily at 3 AM | Verifies source files/tables still exist, updates relevance |

Knowledge flows: `git commits / conversations → LLM extraction → knowledge_nodes + knowledge_edges → embeddings → searchable`

## Knowledge Types

Each piece of knowledge has a type that determines how it's stored and searched:

| Type | What It Means | Example |
|------|--------------|---------|
| `decision` | An architectural or business choice | "Chose BullMQ over Agenda for job queues" |
| `pattern` | A reusable approach or convention | "All MCP servers use @yaya/mcp-base" |
| `module` | A component or system | "The swarm orchestrator uses FlowProducer for fan-out" |
| `event` | Something that happened | "98 security vulnerabilities fixed in commit 33c2b67" |
| `fact` | A discrete piece of information | "Customer Maria prefers weekend delivery" |
| `concept` | An abstract idea or principle | "Privacy-first: all data encrypted per-tenant" |
| `entity` | A named thing (person, product, service) | "Yape — Peru's dominant mobile payment app" |
| `session` | A development session record | "Session: migrated from monolith to shared packages" |

## Database Tables

If you need to query directly (via `postgres-mcp` or raw SQL):

```sql
-- Search knowledge by text
SELECT id, title, summary, confidence
FROM knowledge_nodes
WHERE to_tsvector('spanish', title || ' ' || coalesce(summary, ''))
      @@ plainto_tsquery('spanish', 'pagos yape')
ORDER BY confidence DESC;

-- Find related nodes
WITH RECURSIVE graph AS (
  SELECT target_id, relation, 1 AS depth
  FROM knowledge_edges WHERE source_id = 42
  UNION ALL
  SELECT e.target_id, e.relation, g.depth + 1
  FROM knowledge_edges e JOIN graph g ON e.source_id = g.target_id
  WHERE g.depth < 2
)
SELECT n.title, n.summary, g.relation, g.depth
FROM graph g JOIN knowledge_nodes n ON n.id = g.target_id;

-- Check what topics the PageIndex knows about
SELECT topic, description, array_length(query_patterns, 1) AS patterns
FROM page_index ORDER BY topic;
```

**Tables:**
- `knowledge_nodes` — The graph nodes (with embeddings, tags, confidence)
- `knowledge_edges` — Typed relationships between nodes
- `knowledge_annotations` — Timestamped AI annotations
- `page_index` — Meta-RAG: topic → data source mapping
- `knowledge_ingestion_log` — What's been ingested (dedup)

## Key Files

```
apps/business/
├── schema-knowledge.sql              ← Table definitions (5 tables)
├── src/ai/
│   ├── embedding-client.ts           ← OpenAI-compatible embedding wrapper
│   ├── tools/
│   │   ├── knowledge-tools.ts        ← The 4 Mastra tools (search, pageindex, graph, annotate)
│   │   ├── seed-page-index.ts        ← One-time PageIndex bootstrap
│   │   └── wiki-generator.ts         ← Renders graph → markdown wiki
│   └── specialists/
│       └── knowledge.ts              ← Knowledge agent spec (AgentSpec)
├── src/db/
│   └── knowledge-repo.ts             ← All data access (CRUD, search, traversal)
└── src/queue/
    ├── knowledge-workers.ts           ← Start/stop lifecycle
    ├── knowledge-git-worker.ts        ← Git commit → knowledge nodes
    ├── knowledge-conversation-worker.ts ← Conversations → knowledge nodes
    └── knowledge-pageindex-worker.ts  ← PageIndex freshness checker
```

## The Swarm Agent

The knowledge agent is the 6th specialist in the `@yaya/swarm`:

| Agent | Queue | Model | Purpose |
|-------|-------|-------|---------|
| Router | swarm:router | 35B | Classifies messages |
| Sales | swarm:sales | 35B | Products, orders, payments |
| Analytics | swarm:analytics | 122B | Reports, insights |
| Support | swarm:support | 35B | Complaints, issues |
| Researcher | swarm:researcher | 122B | Web search, analysis |
| **Knowledge** | **swarm:knowledge** | **122B** | **Knowledge graph, wiki, PageIndex** |

The swarm router automatically sends knowledge queries to the knowledge agent when it detects patterns like "how does X work", "architecture", "decision", "documentation", "what changed", etc.

## For Other Agents: How to Query Knowledge

If you're building or modifying a specialist agent and want it to access knowledge:

1. **Add tools to the agent spec** — In `apps/business/src/ai/specialists/your-agent.ts`:
   ```typescript
   tools: ['yourExistingTools', 'knowledgeSearch', 'pageIndexLookup'],
   ```

2. **Use in the system prompt** — Tell the agent when to use knowledge tools:
   ```
   - Cuando necesites contexto de cómo funciona un sistema → knowledge-search
   - Cuando no sepas dónde buscar información → page-index-lookup
   ```

3. That's it. The tools are already registered in `allBusinessTools`.

## Wiki Output

The wiki generator renders the knowledge graph to `docs/knowledge-base/wiki/`:

```
docs/knowledge-base/wiki/
├── README.md                ← Top-level index
├── architecture/            ← Modules, concepts, entities
├── decisions/               ← Architectural decisions
├── patterns/                ← Patterns and facts
├── sessions/                ← Events and session logs
├── debugging/               ← (populated by annotations)
└── tools/                   ← Tool/infrastructure knowledge
```

These files are **generated artifacts** — the graph is the source of truth. Don't edit wiki files directly; add knowledge through the tools or let the background workers extract it.

## Environment Variables

The knowledge system needs an embedding API. Set in `.env`:

```bash
AI_EMBEDDING_MODEL=text-embedding-3-small    # or a local model
AI_EMBEDDING_BASE_URL=https://api.openai.com/v1  # or local vLLM
AI_EMBEDDING_API_KEY=sk-...                  # required for OpenAI
```

For fully self-hosted: host `bge-m3` on vLLM (multilingual, supports Spanish) and point `AI_EMBEDDING_BASE_URL` to it.

---

_This system learns automatically. Every commit and conversation feeds the graph. If something is wrong, annotate it. If something is missing, the background workers will catch it on the next cycle._
