/**
 * PageIndex Refresh Worker — keeps the meta-RAG index up to date.
 *
 * Runs daily at 3 AM. For each stale page_index entry:
 *   1. Re-scans source files/tables for existence and freshness
 *   2. Updates relevance scores
 *   3. Refreshes the last_refreshed_at timestamp
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { QueueFactory } from './queue-factory.js';
import { getStalePageIndexEntries } from '../db/knowledge-repo.js';
import { query as dbQuery } from '../db/pool.js';
import { logger } from '../shared/logger.js';

// ── Queue Setup ──

const pageIndexFactory = new QueueFactory({
  name: 'knowledge:pageindex-refresh',
  concurrency: 1,
  processor: async () => refreshStaleEntries(),
});

// ── Source Verification ──

interface SourceDescriptor {
  type: string;
  path?: string;
  name?: string;
  node_id?: number;
  relevance: number;
  [key: string]: unknown;
}

function getRepoRoot(): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

async function verifySources(sources: SourceDescriptor[]): Promise<SourceDescriptor[]> {
  const root = getRepoRoot();
  const verified: SourceDescriptor[] = [];

  for (const source of sources) {
    switch (source.type) {
      case 'file': {
        if (source.path) {
          const fullPath = path.resolve(root, source.path);
          if (fs.existsSync(fullPath)) {
            verified.push(source);
          } else {
            // File no longer exists — drop it
            logger.debug({ path: source.path }, 'PageIndex source file no longer exists');
          }
        }
        break;
      }

      case 'table': {
        if (source.name) {
          try {
            const result = await dbQuery<{ exists: boolean }>(
              `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
              [source.name],
            );
            if (result.rows[0]?.exists) {
              verified.push(source);
            }
          } catch {
            // Keep the source if we can't verify
            verified.push(source);
          }
        }
        break;
      }

      case 'mcp_server': {
        // MCP servers are always valid if they were registered
        verified.push(source);
        break;
      }

      case 'knowledge_node': {
        if (source.node_id) {
          try {
            const result = await dbQuery<{ confidence: number }>(
              `SELECT confidence FROM knowledge_nodes WHERE id = $1 AND superseded_by IS NULL`,
              [source.node_id],
            );
            if (result.rows.length > 0 && result.rows[0].confidence > 0.1) {
              verified.push({ ...source, relevance: source.relevance * result.rows[0].confidence });
            }
          } catch {
            verified.push(source);
          }
        }
        break;
      }

      case 'skill':
      case 'doc': {
        if (source.path || source.name) {
          const checkPath = source.path
            ? path.resolve(root, source.path)
            : path.resolve(root, 'skills', source.name as string, 'SKILL.md');
          if (fs.existsSync(checkPath)) {
            verified.push(source);
          }
        }
        break;
      }

      default:
        verified.push(source);
    }
  }

  return verified;
}

// ── Processing ──

async function refreshStaleEntries(): Promise<void> {
  const staleEntries = await getStalePageIndexEntries(20);

  if (staleEntries.length === 0) {
    logger.debug('No stale page_index entries to refresh');
    return;
  }

  logger.info({ count: staleEntries.length }, 'Refreshing stale page_index entries');

  for (const entry of staleEntries) {
    try {
      const verifiedSources = await verifySources(entry.sources as SourceDescriptor[]);

      await dbQuery(
        `UPDATE page_index
         SET sources = $1, last_refreshed_at = now(), updated_at = now()
         WHERE id = $2`,
        [JSON.stringify(verifiedSources), entry.id],
      );

      logger.debug({ topic: entry.topic, sourcesBefore: entry.sources.length, sourcesAfter: verifiedSources.length }, 'PageIndex entry refreshed');
    } catch (err) {
      logger.error({ topic: entry.topic, err }, 'Failed to refresh page_index entry');
    }
  }
}

// ── Public API ──

export async function startPageIndexRefreshWorker(): Promise<void> {
  const queue = pageIndexFactory.getQueue();

  // Schedule daily at 3 AM
  await queue.add(
    'refresh',
    { type: 'scheduled' },
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'pageindex-refresh-repeatable',
    },
  );

  // Start the worker (processor set in constructor)
  pageIndexFactory.getWorker();

  logger.info('PageIndex refresh worker started (daily at 3 AM)');
}

export async function stopPageIndexRefreshWorker(): Promise<void> {
  await pageIndexFactory.close();
}
