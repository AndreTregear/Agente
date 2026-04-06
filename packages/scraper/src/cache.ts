/**
 * PostgreSQL-based scrape cache.
 * Uses pg directly (not @yaya/core pool) since scraper may run on different machines.
 */

import pg from 'pg';
import pino from 'pino';
import type { ScrapeResult, CacheRow } from './types.js';

const { Pool } = pg;

const logger = pino({ name: 'scraper-cache' });

const DATABASE_URL = process.env.SCRAPER_DATABASE_URL || process.env.DATABASE_URL || '';

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error(
        'No database URL configured. Set SCRAPER_DATABASE_URL or DATABASE_URL.',
      );
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
    pool.on('error', (err) => {
      logger.error(err, 'PostgreSQL pool error');
    });
  }
  return pool;
}

/**
 * Ensure the scraper_cache table exists.
 * Call once at startup.
 */
export async function ensureCacheTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS scraper_cache (
      url         TEXT PRIMARY KEY,
      title       TEXT,
      content     TEXT NOT NULL,
      html        TEXT NOT NULL,
      metadata    JSONB NOT NULL DEFAULT '{}',
      scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_scraper_cache_scraped_at
      ON scraper_cache (scraped_at DESC);

    CREATE INDEX IF NOT EXISTS idx_scraper_cache_content_search
      ON scraper_cache USING gin (to_tsvector('english', coalesce(title, '') || ' ' || content));
  `;
  await getPool().query(sql);
  logger.info('scraper_cache table ensured');
}

/**
 * Look up a cached scrape result that is still within maxAge seconds.
 */
export async function getCached(
  url: string,
  maxAge: number = 3600,
): Promise<ScrapeResult | null> {
  try {
    const result = await getPool().query<CacheRow>(
      `SELECT url, title, content, html, metadata, scraped_at
       FROM scraper_cache
       WHERE url = $1
         AND scraped_at > NOW() - INTERVAL '1 second' * $2`,
      [url, maxAge],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      url: row.url,
      title: row.title,
      content: row.content,
      html: row.html,
      metadata: row.metadata,
      scrapedAt: row.scraped_at,
      cached: true,
    };
  } catch (err) {
    logger.warn({ err, url }, 'Cache lookup failed — proceeding without cache');
    return null;
  }
}

/**
 * Store a scrape result in the cache (upsert).
 */
export async function setCache(result: ScrapeResult): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO scraper_cache (url, title, content, html, metadata, scraped_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (url) DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         html = EXCLUDED.html,
         metadata = EXCLUDED.metadata,
         scraped_at = EXCLUDED.scraped_at`,
      [
        result.url,
        result.title,
        result.content,
        result.html,
        JSON.stringify(result.metadata),
        result.scrapedAt,
      ],
    );
  } catch (err) {
    logger.warn({ err, url: result.url }, 'Cache write failed');
  }
}

/**
 * Search cached pages by keyword in title/content.
 */
export async function searchCache(
  query: string,
  options: { domain?: string; limit?: number } = {},
): Promise<
  Array<{ url: string; title: string | null; snippet: string; scrapedAt: string }>
> {
  const limit = options.limit ?? 10;

  let sql: string;
  let params: unknown[];

  if (options.domain) {
    sql = `
      SELECT url, title,
             left(content, 200) AS snippet,
             scraped_at
      FROM scraper_cache
      WHERE to_tsvector('english', coalesce(title, '') || ' ' || content)
            @@ plainto_tsquery('english', $1)
        AND url LIKE $2
      ORDER BY scraped_at DESC
      LIMIT $3
    `;
    params = [query, `%${options.domain}%`, limit];
  } else {
    sql = `
      SELECT url, title,
             left(content, 200) AS snippet,
             scraped_at
      FROM scraper_cache
      WHERE to_tsvector('english', coalesce(title, '') || ' ' || content)
            @@ plainto_tsquery('english', $1)
      ORDER BY scraped_at DESC
      LIMIT $2
    `;
    params = [query, limit];
  }

  const result = await getPool().query<{
    url: string;
    title: string | null;
    snippet: string;
    scraped_at: string;
  }>(sql, params);

  return result.rows.map((row) => ({
    url: row.url,
    title: row.title,
    snippet: row.snippet,
    scrapedAt: row.scraped_at,
  }));
}

/**
 * Close the database pool.
 */
export async function closeCache(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
