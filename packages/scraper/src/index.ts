/**
 * @yaya/scraper — Web scraper with caching, politeness, and BullMQ queue support.
 */

// Core types
export type {
  ScrapeRequest,
  ScrapeResult,
  DomainConfig,
  CacheRow,
} from './types.js';

// Main orchestrator
export { scrapeUrl } from './scraper.js';

// Engine
export { fetchPage, extractWithCheerio, scrapeWithCheerio } from './engine/cheerio-scraper.js';
export { extractContent, enhanceWithReadability } from './engine/content-extractor.js';

// Politeness
export { isAllowed, getCrawlDelay, clearRobotsCache } from './politeness/robots-parser.js';
export {
  tryAcquire,
  waitForToken,
  setDomainRate,
  applyRobotsCrawlDelay,
  clearRateLimits,
} from './politeness/rate-limiter.js';

// Cache
export {
  ensureCacheTable,
  getCached,
  setCache,
  searchCache,
  closeCache,
} from './cache.js';

// Queue
export {
  SCRAPER_QUEUE_NAME,
  getScraperQueue,
  enqueueScrape,
  createScrapeWorker,
  closeQueue,
} from './queue.js';
