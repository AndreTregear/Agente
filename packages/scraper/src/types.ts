export interface ScrapeRequest {
  url: string;
  selectors?: Record<string, string>; // CSS selectors to extract
  waitFor?: string; // CSS selector to wait for (Playwright — future)
  maxAge?: number; // cache TTL in seconds (default 3600)
  priority?: number; // BullMQ priority (1=highest)
  requestedBy?: string; // agent or system ID
}

export interface ScrapeResult {
  url: string;
  title: string | null;
  content: string; // extracted readable text
  html: string; // cleaned HTML
  metadata: Record<string, unknown>;
  scrapedAt: string; // ISO timestamp
  cached: boolean;
  jobId?: string;
}

export interface DomainConfig {
  domain: string;
  crawlDelaySecs: number;
  isBlocked: boolean;
  lastAccessedAt: string | null;
  totalRequests: number;
}

export interface CacheRow {
  url: string;
  title: string | null;
  content: string;
  html: string;
  metadata: Record<string, unknown>;
  scraped_at: string;
}
