/**
 * Knowledge Workers — barrel file for all knowledge background workers.
 *
 * Provides start/stop lifecycle methods for platform.ts.
 */

import { startGitIngestionWorker, stopGitIngestionWorker } from './knowledge-git-worker.js';
import { startConversationKnowledgeWorker, stopConversationKnowledgeWorker } from './knowledge-conversation-worker.js';
import { startPageIndexRefreshWorker, stopPageIndexRefreshWorker } from './knowledge-pageindex-worker.js';
import { logger } from '../shared/logger.js';

/**
 * Start all knowledge background workers.
 * Call once during platform startup (in platform.ts).
 */
export async function startKnowledgeWorkers(): Promise<void> {
  logger.info('Starting knowledge workers...');

  await startGitIngestionWorker();
  startConversationKnowledgeWorker();
  await startPageIndexRefreshWorker();

  logger.info('All knowledge workers started');
}

/**
 * Stop all knowledge background workers.
 * Call during graceful shutdown.
 */
export async function stopKnowledgeWorkers(): Promise<void> {
  logger.info('Stopping knowledge workers...');

  await Promise.allSettled([
    stopGitIngestionWorker(),
    stopConversationKnowledgeWorker(),
    stopPageIndexRefreshWorker(),
  ]);

  logger.info('All knowledge workers stopped');
}

// Re-export for direct access
export { ingestAllCommits } from './knowledge-git-worker.js';
