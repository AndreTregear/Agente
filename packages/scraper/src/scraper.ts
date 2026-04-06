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
