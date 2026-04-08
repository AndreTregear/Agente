/**
 * Main scraper orchestrator.
 * Coordinates cache, robots.txt, rate limiting, fetching, and content extraction.
 */

import pino from 'pino';
import type { ScrapeRequest, ScrapeResult } from './types.js';
import { getCached, setCache } from './cache.js';
import { isAllowed, getCrawlDelay } from './politeness/robots-parser.js';
import { waitForToken, applyRobotsCrawlDelay } from './politeness/rate-limiter.js';
import { fetchPage, extractWithCheerio } from './engine/cheerio-scraper.js';
import { enhanceWithReadability } from './engine/content-extractor.js';

const logger = pino({ name: 'scraper' });

const DEFAULT_MAX_AGE = 3600; // 1 hour

/**
 * Validate a URL before scraping to prevent SSRF attacks.
 * Blocks private/internal IP ranges and non-HTTP protocols.
 */
function validateScrapeUrl(url: string): void {
  const parsed = new URL(url);

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol} — only HTTP/HTTPS allowed`);
  }

  // Block private/internal IP ranges
  const hostname = parsed.hostname;
  const blocked = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^0\./,
    /^169\.254\./,         // link-local
    /^::1$/,               // IPv6 loopback
    /^fc00:/i,             // IPv6 private
    /^fe80:/i,             // IPv6 link-local
    /^localhost$/i,
    /^.*\.local$/i,
    /^.*\.internal$/i,
  ];

  if (blocked.some(re => re.test(hostname))) {
    throw new Error(`Blocked hostname: ${hostname} — private/internal addresses not allowed`);
  }
}

/**
 * Scrape a URL with full pipeline:
 * 1. Check cache
 * 2. Check robots.txt
 * 3. Rate-limit
 * 4. Fetch with cheerio
 * 5. Extract content with readability
 * 6. Store in cache
 * 7. Return result
 */
export async function scrapeUrl(request: ScrapeRequest): Promise<ScrapeResult> {
  const { url, selectors, maxAge = DEFAULT_MAX_AGE } = request;

  // SSRF protection — validate URL before any processing
  validateScrapeUrl(url);

  logger.info({ url, requestedBy: request.requestedBy }, 'Scrape requested');

  // 1. Check cache
  if (maxAge > 0) {
    const cached = await getCached(url, maxAge);
    if (cached) {
      logger.info({ url }, 'Returning cached result');
      return cached;
    }
  }

  // 2. Check robots.txt
  const allowed = await isAllowed(url);
  if (!allowed) {
    logger.warn({ url }, 'URL blocked by robots.txt');
    return {
      url,
      title: null,
      content: '',
      html: '',
      metadata: { error: 'Blocked by robots.txt', allowed: false },
      scrapedAt: new Date().toISOString(),
      cached: false,
    };
  }

  // Apply robots.txt crawl-delay to rate limiter
  const crawlDelay = await getCrawlDelay(url);
  if (crawlDelay > 0) {
    const domain = new URL(url).hostname;
    applyRobotsCrawlDelay(domain, crawlDelay);
  }

  // 3. Rate limit — wait for token
  const waitedMs = await waitForToken(url);
  if (waitedMs > 0) {
    logger.debug({ url, waitedMs }, 'Rate-limited, waited before fetch');
  }

  // 4. Fetch with cheerio
  const { html: rawHtml, statusCode, headers } = await fetchPage(url);

  if (statusCode >= 400) {
    logger.warn({ url, statusCode }, 'HTTP error response');
    return {
      url,
      title: null,
      content: '',
      html: '',
      metadata: {
        statusCode,
        error: `HTTP ${statusCode}`,
        headers,
      },
      scrapedAt: new Date().toISOString(),
      cached: false,
    };
  }

  // Extract with cheerio first
  let result = extractWithCheerio(rawHtml, url, selectors, statusCode);

  // 5. Enhance with readability
  result = enhanceWithReadability(result, rawHtml);

  // 6. Store in cache
  await setCache(result);

  logger.info(
    {
      url,
      titleLen: result.title?.length ?? 0,
      contentLen: result.content.length,
      method: result.metadata.extractionMethod,
    },
    'Scrape complete',
  );

  // 7. Return result
  return result;
}
