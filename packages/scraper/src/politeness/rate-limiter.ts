/**
 * Per-domain rate limiter using a simple token bucket pattern.
 * Runs in-process (not Redis-backed) since the scraper worker is a single process.
 */

const DEFAULT_REQUESTS_PER_SECOND = 1;
const MAX_BUCKET_ENTRIES = 5000;
const BUCKET_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per second
  lastRefill: number; // timestamp
}

const buckets = new Map<string, TokenBucket>();
const domainConfigs = new Map<string, number>(); // domain -> requests per second

let lastEviction = 0;
const EVICTION_INTERVAL_MS = 30_000;

/** Evict oldest bucket entries when at capacity, or entries older than 1 hour. */
function evictStaleBuckets(): void {
  const now = Date.now();
  // First pass: remove entries older than 1 hour
  for (const [domain, bucket] of buckets) {
    if (now - bucket.lastRefill > BUCKET_MAX_AGE_MS) {
      buckets.delete(domain);
      domainConfigs.delete(domain);
    }
  }
  // Second pass: if still over capacity, delete oldest entries
  if (buckets.size > MAX_BUCKET_ENTRIES) {
    const sorted = [...buckets.entries()].sort((a, b) => a[1].lastRefill - b[1].lastRefill);
    const toRemove = buckets.size - MAX_BUCKET_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      buckets.delete(sorted[i][0]);
      domainConfigs.delete(sorted[i][0]);
    }
  }
}

function getDomain(url: string): string {
  const parsed = new URL(url);
  return parsed.hostname;
}

function maybeEvict(): void {
  const now = Date.now();
  if (now - lastEviction < EVICTION_INTERVAL_MS) return;
  lastEviction = now;
  evictStaleBuckets();
}

function getBucket(domain: string): TokenBucket {
  let bucket = buckets.get(domain);
  if (!bucket) {
    maybeEvict();
    const rate = domainConfigs.get(domain) ?? DEFAULT_REQUESTS_PER_SECOND;
    bucket = {
      tokens: rate,
      maxTokens: rate,
      refillRate: rate,
      lastRefill: Date.now(),
    };
    buckets.set(domain, bucket);
  }
  return bucket;
}

function refillBucket(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  const newTokens = elapsed * bucket.refillRate;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + newTokens);
  bucket.lastRefill = now;
}

/**
 * Try to acquire a token for the given URL's domain.
 * Returns true if the request can proceed, false if rate-limited.
 */
export function tryAcquire(url: string): boolean {
  const domain = getDomain(url);
  const bucket = getBucket(domain);
  refillBucket(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Wait until a token is available for the given URL's domain.
 * Returns the number of milliseconds waited.
 */
export async function waitForToken(url: string): Promise<number> {
  const domain = getDomain(url);
  const bucket = getBucket(domain);
  refillBucket(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return 0;
  }

  // Calculate wait time until we have 1 token
  const deficit = 1 - bucket.tokens;
  const waitMs = Math.ceil((deficit / bucket.refillRate) * 1000);

  await new Promise((resolve) => setTimeout(resolve, waitMs));

  // Refill after waiting and consume
  refillBucket(bucket);
  bucket.tokens -= 1;
  return waitMs;
}

/**
 * Configure rate limit for a specific domain.
 */
export function setDomainRate(domain: string, requestsPerSecond: number): void {
  domainConfigs.set(domain, requestsPerSecond);
  // Reset the bucket so new config takes effect
  buckets.delete(domain);
}

/**
 * Update rate limit based on robots.txt crawl-delay.
 * crawlDelaySecs=2 means 0.5 requests/second.
 */
export function applyRobotsCrawlDelay(
  domain: string,
  crawlDelaySecs: number,
): void {
  if (crawlDelaySecs > 0) {
    const rate = 1 / crawlDelaySecs;
    setDomainRate(domain, rate);
  }
}

/**
 * Clear all rate limiter state (useful for tests).
 */
export function clearRateLimits(): void {
  buckets.clear();
  domainConfigs.clear();
}
