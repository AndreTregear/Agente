import pg from 'pg';
import { DATABASE_URL } from '../config.js';
import { logger } from '../shared/logger.js';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected database pool error');
});

/**
 * Execute a query with optional tenant isolation via search_path / app.tenant_id.
 */
export async function query<T extends pg.QueryResultRow = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
  tenantId?: string,
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    if (tenantId) {
      await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
    }
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Execute within a transaction.
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  tenantId?: string,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (tenantId) {
      await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
