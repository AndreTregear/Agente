/**
 * Common utilities shared across MCP servers.
 */

/**
 * Safe JSON.stringify with 2-space indent.
 * Returns "null" for undefined, handles circular refs gracefully.
 */
export function formatJSON(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * Extract a human-readable message from any error shape.
 * Works with Error instances, strings, objects with .message, etc.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Format data as a markdown table — useful for tool responses that
 * are easier to read as tables (metrics, lists, etc.).
 *
 * @example
 * ```ts
 * formatTable(
 *   ['Name', 'Amount'],
 *   [['Alice', '100'], ['Bob', '250']],
 * );
 * // | Name  | Amount |
 * // |-------|--------|
 * // | Alice | 100    |
 * // | Bob   | 250    |
 * ```
 */
export function formatTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));

  const headerLine = '| ' + headers.map((h, i) => pad(h, widths[i])).join(' | ') + ' |';
  const separator = '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|';
  const dataLines = rows.map(
    (row) => '| ' + headers.map((_, i) => pad(row[i] ?? '', widths[i])).join(' | ') + ' |',
  );

  return [headerLine, separator, ...dataLines].join('\n');
}
