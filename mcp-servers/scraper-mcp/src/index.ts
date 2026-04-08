#!/usr/bin/env node
/**
 * Scraper MCP Server
 * Exposes web scraping tools for OpenClaw agents via MCP protocol.
 *
 * Tools:
 *  - scrape_url:      Scrape a single URL and extract content
 *  - search_cached:   Search previously scraped pages by keyword
 *  - check_robots:    Check if a URL is allowed by robots.txt
 */

import { createMCPServer, formatJSON } from '@yaya/mcp-base';
import {
  scrapeUrl,
  searchCache,
  isAllowed,
  getCrawlDelay,
  ensureCacheTable,
} from '@yaya/scraper';

// ── Tool Definitions ─────────────────────────────────

const TOOLS = [
  {
    name: 'scrape_url',
    description:
      'Scrape a single URL and extract its content. Returns the page title, readable text content (truncated to 4000 chars), and metadata. Respects robots.txt and rate limits.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scrape',
        },
        selectors: {
          type: 'object',
          description:
            'Optional CSS selectors to extract specific elements. Keys are names, values are CSS selectors.',
          additionalProperties: { type: 'string' },
        },
        maxAge: {
          type: 'number',
          description:
            'Cache TTL in seconds. Use 0 to force a fresh scrape. Default: 3600 (1 hour).',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_cached',
    description:
      'Search previously scraped pages by keyword in title and content. Returns matching pages with URL, title, snippet, and scrape timestamp.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search term to find in scraped page titles and content',
        },
        domain: {
          type: 'string',
          description: 'Filter results to a specific domain (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_robots',
    description:
      'Check if a URL is allowed to be crawled according to its robots.txt. Also returns the crawl-delay if specified.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to check against robots.txt',
        },
      },
      required: ['url'],
    },
  },
];

// ── Tool Handlers ────────────────────────────────────

const MAX_CONTENT_LENGTH = 4000;

async function handleTool(
  name: string,
  args: Record<string, any>,
): Promise<string> {
  switch (name) {
    case 'scrape_url': {
      const result = await scrapeUrl({
        url: args.url,
        selectors: args.selectors,
        maxAge: args.maxAge,
        requestedBy: 'scraper-mcp',
      });

      // Truncate content for MCP response
      const truncatedContent =
        result.content.length > MAX_CONTENT_LENGTH
          ? result.content.slice(0, MAX_CONTENT_LENGTH) + '...[truncated]'
          : result.content;

      return JSON.stringify(
        {
          url: result.url,
          title: result.title,
          content: truncatedContent,
          metadata: result.metadata,
          scrapedAt: result.scrapedAt,
          cached: result.cached,
          contentLength: result.content.length,
        },
        null,
        2,
      );
    }

    case 'search_cached': {
      const results = await searchCache(args.query, {
        domain: args.domain,
        limit: args.limit,
      });

      if (results.length === 0) {
        return JSON.stringify({
          message: 'No cached pages match the query.',
          query: args.query,
          results: [],
        });
      }

      return JSON.stringify(
        {
          query: args.query,
          count: results.length,
          results,
        },
        null,
        2,
      );
    }

    case 'check_robots': {
      const allowed = await isAllowed(args.url);
      const crawlDelay = await getCrawlDelay(args.url);

      return JSON.stringify(
        {
          url: args.url,
          allowed,
          crawlDelay,
        },
        null,
        2,
      );
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP Server ──────────────────────────────────────

const mcp = createMCPServer({
  name: 'scraper-mcp',
  version: '0.1.0',
  tools: TOOLS,
  onStartup: async () => {
    try {
      await ensureCacheTable();
      console.error('Scraper MCP: Cache table ready');
    } catch (err: any) {
      console.error(
        `WARNING: Could not ensure cache table: ${err.message}. search_cached may not work.`,
      );
    }
  },
  handler: async (name, args) => handleTool(name, args),
});

mcp.start();
