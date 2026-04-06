import { encryptField, decryptField } from './field-crypto.js';

/**
 * Map of table → columns that must be encrypted.
 * Override via setEncryptedColumns() for your app's schema.
 */
let ENCRYPTED_COLUMNS: Record<string, string[]> = {};

/**
 * Configure which columns should be encrypted per table.
 */
export function setEncryptedColumns(config: Record<string, string[]>): void {
  ENCRYPTED_COLUMNS = { ...config };
}

/**
 * Get current encrypted columns configuration.
 */
export function getEncryptedColumns(): Record<string, string[]> {
  return { ...ENCRYPTED_COLUMNS };
}

/**
 * Encrypt sensitive columns before writing to the database.
 */
export function encryptRow(
  table: string,
  row: Record<string, unknown>,
  dek: Buffer,
  tenantId: string,
): Record<string, unknown> {
  const cols = ENCRYPTED_COLUMNS[table];
  if (!cols || cols.length === 0) return row;

  const result = { ...row };
  for (const col of cols) {
    const val = result[col];
    if (typeof val === 'string' && val.length > 0) {
      result[col] = encryptField(val, dek, tenantId, table, col);
    }
  }
  return result;
}

/**
 * Decrypt sensitive columns after reading from the database.
 */
export function decryptRow(
  table: string,
  row: Record<string, unknown>,
  dek: Buffer,
  tenantId: string,
): Record<string, unknown> {
  const cols = ENCRYPTED_COLUMNS[table];
  if (!cols || cols.length === 0) return row;

  const result = { ...row };
  for (const col of cols) {
    const val = result[col];
    if (typeof val === 'string' && val.length > 0) {
      const decrypted = decryptField(val, dek, tenantId, table, col);
      if (decrypted !== null) {
        result[col] = decrypted;
      }
    }
  }
  return result;
}
