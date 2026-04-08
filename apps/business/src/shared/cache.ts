export function createCache<T>(fetchFn: () => Promise<T>, ttlMs: number) {
  let value: T | undefined;
  let expiresAt = 0;
  return async (): Promise<T> => {
    if (Date.now() < expiresAt && value !== undefined) return value;
    value = await fetchFn();
    expiresAt = Date.now() + ttlMs;
    return value;
  };
}

/**
 * LRU-evicting Map with a maximum size.
 * When the map exceeds maxSize, the least-recently-set entry is evicted.
 * Useful for per-tenant caches that must not grow unbounded.
 */
export class BoundedMap<K, V> extends Map<K, V> {
  private maxSize: number;

  constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }

  override set(key: K, value: V): this {
    // If key exists, delete first so re-insert moves it to end (most recent)
    if (super.has(key)) {
      super.delete(key);
    }
    super.set(key, value);
    // Evict oldest entries if over capacity
    while (super.size > this.maxSize) {
      const oldest = super.keys().next().value;
      if (oldest !== undefined) super.delete(oldest);
    }
    return this;
  }
}
