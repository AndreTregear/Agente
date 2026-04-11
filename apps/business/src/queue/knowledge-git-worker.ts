/**
 * Git Commit Ingestion Worker — extracts knowledge from git history.
 *
 * Runs on a schedule (every 6 hours) and processes new commits:
 *   1. Finds commits not yet ingested
 *   2. Extracts structured knowledge via LLM
 *   3. Creates knowledge nodes + edges
 *   4. Generates embeddings for vector search
 *
 * Uses the local 35B model (background priority, no need for 122B).
 */

import { execSync } from 'node:child_process';
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
import { generateEmbedding } from '../ai/embedding-client.js';
import { getModel } from '../ai/model-router.js';
import { appBus } from '../shared/events.js';
import { logger } from '../shared/logger.js';

// ── Types ──

interface CommitInfo {
  sha: string;
  subject: string;
  author: string;
  date: string;
}

interface ExtractedKnowledge {
  nodes: Array<{
    title: string;
    content: string;
    node_type: string;
    tags: string[];
  }>;
  edges: Array<{
    source_title: string;
    target_title: string;
    relation: string;
  }>;
}

// ── Extraction Prompt ──

const EXTRACTION_PROMPT = `You are a knowledge extraction system. Analyze the following git commit and extract structured knowledge.

Return valid JSON with this exact structure:
{
  "nodes": [
    {
      "title": "Short descriptive title",
      "content": "Detailed explanation of what was done and why (2-4 sentences)",
      "node_type": "decision|pattern|module|event|fact",
      "tags": ["relevant", "topic", "tags"]
    }
  ],
  "edges": [
    {
      "source_title": "Title of source node",
      "target_title": "Title of target node",
      "relation": "relates_to|depends_on|implements|caused_by|part_of|uses|evolved_from"
    }
  ]
}

Guidelines:
- Extract 1-5 nodes per commit depending on complexity
- node_type: "decision" for architectural choices, "pattern" for reusable patterns, "module" for new components, "event" for significant changes, "fact" for important details
- Create edges between nodes you extract AND to concepts from the commit message
- Tags should be lowercase, specific (e.g., "security", "whatsapp", "payments", "swarm")
- Content should explain the WHY, not just the WHAT
- If the commit is trivial (chore, typo fix), extract 1 node with type "event"

IMPORTANT: Return ONLY the JSON object, no markdown, no explanation.`;

// ── Queue Setup ──

async function processGitScan(): Promise<void> {
  logger.info('Git ingestion worker scanning for new commits...');

  const commits = getRecentCommits(new Date(Date.now() - 7 * 86400 * 1000).toISOString());
  let totalNodes = 0;
  let totalEdges = 0;

  for (const commit of commits.reverse()) {
    try {
      const result = await processCommit(commit);
      totalNodes += result.nodesCreated;
      totalEdges += result.edgesCreated;
    } catch (err) {
      logger.error({ sha: commit.sha, err }, 'Failed to process commit');
    }
  }

  logger.info({
    commitsScanned: commits.length,
    nodesCreated: totalNodes,
    edgesCreated: totalEdges,
  }, 'Git ingestion scan complete');
}

const gitIngestionFactory = new QueueFactory({
  name: 'knowledge:git-ingestion',
  concurrency: 1,
  processor: async () => processGitScan(),
});

// ── Git Helpers ──

function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

function getRecentCommits(since?: string): CommitInfo[] {
  const cwd = getRepoRoot();
  const sinceArg = since ? `--since="${since}"` : '';
  try {
    const output = execSync(
      `git log ${sinceArg} --format="%H|%s|%an|%aI" --no-merges`,
      { cwd, encoding: 'utf-8', maxBuffer: 1024 * 1024 },
    ).trim();

    if (!output) return [];

    return output.split('\n').map((line) => {
      const [sha, subject, author, date] = line.split('|');
      return { sha, subject, author, date };
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get git commits');
    return [];
  }
}

function getCommitDiff(sha: string): string {
  const cwd = getRepoRoot();
  try {
    const stat = execSync(`git show --stat ${sha}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 512 * 1024,
    });
    const diff = execSync(`git show ${sha} --no-stat`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 512 * 1024,
    });
    // Truncate to 8K chars for LLM context
    const combined = `${stat}\n\n${diff}`;
    return combined.slice(0, 8192);
  } catch (err) {
    logger.warn({ sha, err }, 'Failed to get commit diff');
    return '';
  }
}

// ── LLM Extraction ──

async function extractKnowledgeFromCommit(commit: CommitInfo): Promise<ExtractedKnowledge> {
  const diff = getCommitDiff(commit.sha);

  const agent = new Agent({
    id: 'knowledge-extractor',
    name: 'Knowledge Extractor',
    instructions: EXTRACTION_PROMPT,
    model: getModel('local'), // Use local 35B for background tasks
  });

  const result = await agent.generate(
    `Commit: ${commit.sha.slice(0, 8)}
Subject: ${commit.subject}
Author: ${commit.author}
Date: ${commit.date}

${diff}`,
    { maxSteps: 1 },
  );

  const text = result.text || '';

  // Parse JSON from the response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.warn({ sha: commit.sha, response: text.slice(0, 200) }, 'LLM did not return valid JSON');
    // Fallback: create a single event node from the commit message
    return {
      nodes: [{
        title: commit.subject,
        content: `Commit ${commit.sha.slice(0, 8)} by ${commit.author} on ${commit.date}.\n\n${commit.subject}`,
        node_type: 'event',
        tags: [],
      }],
      edges: [],
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as ExtractedKnowledge;
  } catch {
    logger.warn({ sha: commit.sha }, 'Failed to parse LLM JSON response');
    return {
      nodes: [{
        title: commit.subject,
        content: `Commit ${commit.sha.slice(0, 8)} by ${commit.author} on ${commit.date}.\n\n${commit.subject}`,
        node_type: 'event',
        tags: [],
      }],
      edges: [],
    };
  }
}

// ── Processing ──

async function processCommit(commit: CommitInfo): Promise<{ nodesCreated: number; edgesCreated: number }> {
  if (await isAlreadyIngested('git_commit', commit.sha)) {
    return { nodesCreated: 0, edgesCreated: 0 };
  }

  await logIngestion('git_commit', commit.sha);

  try {
    const knowledge = await extractKnowledgeFromCommit(commit);
    const nodeIdMap = new Map<string, number>();
    let nodesCreated = 0;
    let edgesCreated = 0;

    // Insert nodes
    for (const node of knowledge.nodes) {
      const validTypes: NodeType[] = ['entity', 'concept', 'decision', 'pattern', 'module', 'event', 'fact', 'session'];
      const nodeType = validTypes.includes(node.node_type as NodeType) ? node.node_type as NodeType : 'event';

      // Generate embedding
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(`${node.title}: ${node.content}`);
      } catch (err) {
        logger.warn({ title: node.title, err }, 'Failed to generate embedding, inserting without');
      }

      const nodeId = await insertNode({
        tenantId: null, // Platform-level knowledge
        nodeType,
        title: node.title,
        content: node.content,
        summary: node.content.slice(0, 200),
        embedding,
        sourceType: 'git_commit',
        sourceRef: commit.sha,
        tags: node.tags || [],
        metadata: {
          commit_sha: commit.sha,
          commit_subject: commit.subject,
          author: commit.author,
          date: commit.date,
        },
      });

      nodeIdMap.set(node.title, nodeId);
      nodesCreated++;

      appBus.emit('knowledge-node-created', null, nodeId, nodeType);
    }

    // Insert edges (only between nodes we just created)
    for (const edge of knowledge.edges) {
      const sourceId = nodeIdMap.get(edge.source_title);
      const targetId = nodeIdMap.get(edge.target_title);

      if (sourceId && targetId) {
        const validRelations: EdgeRelation[] = [
          'relates_to', 'depends_on', 'supersedes', 'implements', 'caused_by',
          'part_of', 'uses', 'contradicts', 'evolved_from', 'answers',
        ];
        const relation = validRelations.includes(edge.relation as EdgeRelation)
          ? edge.relation as EdgeRelation
          : 'relates_to';

        await insertEdge(sourceId, targetId, relation, 1.0, null);
        edgesCreated++;
      }
    }

    await completeIngestion('git_commit', commit.sha, nodesCreated, edgesCreated);
    appBus.emit('knowledge-indexed', 'git_commit', commit.sha, nodesCreated);

    logger.info({
      sha: commit.sha.slice(0, 8),
      subject: commit.subject,
      nodesCreated,
      edgesCreated,
    }, 'Git commit ingested into knowledge graph');

    return { nodesCreated, edgesCreated };
  } catch (err: any) {
    await failIngestion('git_commit', commit.sha, err.message);
    throw err;
  }
}

// ── Public API ──

/**
 * Start the git ingestion worker with a repeatable schedule.
 */
export async function startGitIngestionWorker(): Promise<void> {
  const queue = gitIngestionFactory.getQueue();

  // Add repeatable job — runs every 6 hours
  await queue.add(
    'git-scan',
    { type: 'scheduled' },
    {
      repeat: { pattern: '0 */6 * * *' },
      jobId: 'git-scan-repeatable',
    },
  );

  // Start the worker (processor set in constructor)
  gitIngestionFactory.getWorker();

  logger.info('Git ingestion worker started (every 6 hours)');
}

/**
 * Run a one-time ingestion of all commits (for initial population).
 */
export async function ingestAllCommits(): Promise<void> {
  logger.info('Starting full git history ingestion...');
  const commits = getRecentCommits(); // No since = all commits

  for (const commit of commits.reverse()) {
    try {
      await processCommit(commit);
    } catch (err) {
      logger.error({ sha: commit.sha, err }, 'Failed to process commit');
    }
  }

  logger.info('Full git history ingestion complete');
}

export async function stopGitIngestionWorker(): Promise<void> {
  await gitIngestionFactory.close();
}
