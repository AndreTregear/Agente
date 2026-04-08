import { encryptField, decryptField } from './field-crypto.js';

/** Map of table → columns that must be encrypted. */
const ENCRYPTED_COLUMNS: Record<string, string[]> = {
  patients: ['full_name', 'phone', 'dni', 'address', 'emergency_contact'],
  children: ['full_name'],
  health_readings: ['notes'],
  food_logs: ['raw_description'],
  medications: ['medication_name', 'dosage', 'notes'],
  conversations: [],
  message_log: ['content'],
};

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
