/**
 * Clean text extraction using @mozilla/readability + linkedom.
 * Falls back to cheerio-based extraction if readability fails.
 */

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { extractWithCheerio } from './cheerio-scraper.js';
import type { ScrapeResult } from '../types.js';

export interface ExtractedContent {
  title: string | null;
  content: string;
  html: string;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
}

/**
 * Extract readable article content from raw HTML.
 * Uses Mozilla Readability for article extraction, falling back to
 * cheerio-based full-body text extraction on failure.
 */
export function extractContent(rawHtml: string, url: string): ExtractedContent {
  try {
    const { document } = parseHTML(rawHtml);

    const reader = new Readability(document as any, {
      charThreshold: 50,
    });

    const article = reader.parse();

    if (article && article.textContent && article.textContent.trim().length > 100) {
      return {
        title: article.title || null,
        content: article.textContent.replace(/\s+/g, ' ').trim(),
        html: article.content || rawHtml,
        excerpt: article.excerpt || null,
        byline: article.byline || null,
        siteName: article.siteName || null,
      };
    }
  } catch {
    // Readability failed — fall back to cheerio
  }

  // Fallback: use cheerio extraction
  const cheerioResult = extractWithCheerio(rawHtml, url);
  return {
    title: cheerioResult.title,
    content: cheerioResult.content,
    html: cheerioResult.html,
    excerpt: null,
    byline: null,
    siteName: null,
  };
}

/**
 * Enhance a ScrapeResult with readability-extracted content.
 * If readability produces better content, replace the cheerio output.
 */
export function enhanceWithReadability(
  result: ScrapeResult,
  rawHtml: string,
): ScrapeResult {
  const extracted = extractContent(rawHtml, result.url);

  // Only replace if readability produced substantive content
  if (extracted.content.length > result.content.length * 0.3) {
    return {
      ...result,
      title: extracted.title || result.title,
      content: extracted.content,
      html: extracted.html,
      metadata: {
        ...result.metadata,
        excerpt: extracted.excerpt,
        byline: extracted.byline,
        siteName: extracted.siteName,
        extractionMethod: 'readability',
      },
    };
  }

  return {
    ...result,
    metadata: {
      ...result.metadata,
      extractionMethod: 'cheerio',
    },
  };
}
