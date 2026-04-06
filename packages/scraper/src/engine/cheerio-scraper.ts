/**
 * Static HTML scraper using native fetch + cheerio.
 * Extracts title, text content, metadata, and optional CSS selectors.
 */

import * as cheerio from 'cheerio';
import type { ScrapeRequest, ScrapeResult } from '../types.js';

const DEFAULT_USER_AGENT =
  'YayaBot/1.0 (+https://yaya.sh; compatible; research-bot)';

const FETCH_TIMEOUT_MS = 30_000;

export interface FetchedPage {
  html: string;
  statusCode: number;
  headers: Record<string, string>;
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5,es;q=0.3',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return { html, statusCode: res.status, headers };
  } finally {
    clearTimeout(timeout);
  }
}

export function extractWithCheerio(
  html: string,
  url: string,
  selectors?: Record<string, string>,
  statusCode?: number,
): ScrapeResult {
  const $ = cheerio.load(html);

  // Remove script, style, and other non-content tags
  $('script, style, noscript, iframe, svg').remove();

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    null;

  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    null;

  // Extract body text
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  // Build metadata
  const metadata: Record<string, unknown> = {
    statusCode: statusCode ?? 200,
    description,
    ogImage: $('meta[property="og:image"]').attr('content') || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    language: $('html').attr('lang') || null,
  };

  // Apply custom selectors if provided
  if (selectors) {
    const extracted: Record<string, string | string[]> = {};
    for (const [key, selector] of Object.entries(selectors)) {
      const elements = $(selector);
      if (elements.length === 1) {
        extracted[key] = elements.text().trim();
      } else if (elements.length > 1) {
        extracted[key] = elements
          .map((_i, el) => $(el).text().trim())
          .get();
      } else {
        extracted[key] = '';
      }
    }
    metadata.selectors = extracted;
  }

  // Get cleaned HTML (body only, scripts/styles already removed)
  const cleanedHtml = $('body').html() || html;

  return {
    url,
    title,
    content: bodyText,
    html: cleanedHtml,
    metadata,
    scrapedAt: new Date().toISOString(),
    cached: false,
  };
}

export async function scrapeWithCheerio(
  request: ScrapeRequest,
): Promise<ScrapeResult> {
  const { html, statusCode } = await fetchPage(request.url);
  return extractWithCheerio(html, request.url, request.selectors, statusCode);
}
