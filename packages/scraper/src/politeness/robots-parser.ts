/**
 * robots.txt compliance.
 * Fetches, caches, and parses robots.txt per domain.
 */

import robotsParserModule from 'robots-parser';

const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = 'YayaBot';

// Handle ESM/CJS default export differences
const robotsParser = (
  (robotsParserModule as any).default || robotsParserModule
) as (url: string, contents: string) => Robot;

interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
  isDisallowed(url: string, ua?: string): boolean | undefined;
  getCrawlDelay(ua?: string): number | undefined;
  getSitemaps(): string[];
  getPreferredHost(): string | null;
}

type RobotParser = Robot;

interface CachedRobots {
  parser: RobotParser;
  fetchedAt: number;
}

const robotsCache = new Map<string, CachedRobots>();

function getDomain(url: string): string {
  const parsed = new URL(url);
  return parsed.origin;
}

async function fetchRobotsTxt(origin: string): Promise<string> {
  const robotsUrl = `${origin}/robots.txt`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      // No robots.txt or error — allow everything
      return '';
    }

    return await res.text();
  } catch {
    // Network error — allow everything (be permissive on failure)
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

async function getRobotsParser(
  url: string,
): Promise<RobotParser> {
  const origin = getDomain(url);
  const cached = robotsCache.get(origin);

  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return cached.parser;
  }

  const robotsTxt = await fetchRobotsTxt(origin);
  const parser = robotsParser(`${origin}/robots.txt`, robotsTxt);

  robotsCache.set(origin, {
    parser,
    fetchedAt: Date.now(),
  });

  return parser;
}

/**
 * Check if the given URL is allowed to be crawled according to robots.txt.
 */
export async function isAllowed(url: string): Promise<boolean> {
  const parser = await getRobotsParser(url);
  return parser.isAllowed(url, USER_AGENT) !== false;
}

/**
 * Get the crawl-delay for the domain (in seconds).
 * Returns 0 if no crawl-delay is specified.
 */
export async function getCrawlDelay(url: string): Promise<number> {
  const parser = await getRobotsParser(url);
  return parser.getCrawlDelay(USER_AGENT) || 0;
}

/**
 * Clear the robots.txt cache (useful for tests or long-running processes).
 */
export function clearRobotsCache(): void {
  robotsCache.clear();
}
