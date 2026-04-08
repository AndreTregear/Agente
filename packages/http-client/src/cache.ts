/**
 * Simple TTL response cache — zero dependencies.
 *
 * Useful for caching forex rates, product catalogs, or any
 * HTTP response that doesn't need to be fetched every time.
 *
 * Usage:
 *   const cache = createResponseCache<ForexRates>(60_000); // 1 min TTL
 *   const cached = cache.get('USD-PEN');
 *   if (!cached) {
 *     const fresh = await client.get<ForexRates>('/rates/USD-PEN');
 *     cache.set('USD-PEN', fresh);
 *   }
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface ResponseCache<T> {
  /** Get a cached value, or undefined if missing/expired. */
  get(key: string): T | undefined;
  /** Store a value with the configured TTL. */
  set(key: string, value: T): void;
  /** Remove a single entry. */
  delete(key: string): void;
  /** Remove all entries. */
  clear(): void;
  /** Current number of (possibly expired) entries. */
  readonly size: number;
}

export function createResponseCache<T>(ttlMs: number): ResponseCache<T> {
  const store = new Map<string, CacheEntry<T>>();

  function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }

  // Periodic cleanup every 60 s to prevent unbounded growth
  const cleanupInterval = setInterval(evictExpired, 60_000);
  // Allow the process to exit even if the interval is still active
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key: string, value: T): void {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },

    delete(key: string): void {
      store.delete(key);
    },

    clear(): void {
      store.clear();
    },

    get size(): number {
      return store.size;
    },
  };
}
