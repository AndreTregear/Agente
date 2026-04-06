import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { logger } from '../shared/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

/**
 * Run all SQL schema files in order (idempotent).
 * @param schemaFiles - list of SQL filenames relative to project root.
 *   Defaults to ['schema-tenants.sql'].
 */
export async function runDatabaseMigrations(
  schemaFiles: string[] = ['schema-tenants.sql'],
): Promise<void> {
  const client = await pool.connect();
  try {
    for (const file of schemaFiles) {
      const filePath = path.join(ROOT, file);
      if (!fs.existsSync(filePath)) {
        logger.warn({ file }, 'Schema file not found, skipping');
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);
      logger.info({ file }, 'Schema applied');
    }
  } catch (err) {
    logger.error(err, 'Database migration failed');
    throw err;
  } finally {
    client.release();
  }
}
