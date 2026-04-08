/**
 * @yaya/http-client — zero-dependency HTTP client factory.
 *
 * Replaces the 6+ duplicate fetch wrappers across MCP servers:
 *   crmFetch, erpFetch, lagoFetch, paymentsFetch, gatewayFetch, calFetch
 *
 * Features:
 *   - Auth: Bearer, API-key header, Basic, or custom token format
 *   - Timeout via AbortSignal.timeout()
 *   - Retry with exponential backoff on 5xx / network errors
 *   - JSON parsing with HttpClientError on non-2xx
 *   - raw() escape hatch for streaming / non-JSON responses
 */

// ── Types ───────────────────────────────────────────────

export interface HttpClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;      // default 10_000 ms
  retries?: number;      // default 0
  retryDelay?: number;   // default 1_000 ms (base for exponential backoff)
  auth?:
    | { type: 'bearer'; token: string }
    | { type: 'api-key'; header: string; key: string }
    | { type: 'basic'; username: string; password: string }
    | { type: 'token'; value: string };   // e.g. ERPNext "token key:secret"
  onError?: (error: HttpClientError) => void;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export interface HttpClient {
  get<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  delete<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  raw(path: string, init?: RequestInit & { timeout?: number }): Promise<Response>;
}

// ── Error ───────────────────────────────────────────────

export class HttpClientError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`HTTP ${status} on ${path}: ${body.slice(0, 200)}`);
    this.name = 'HttpClientError';
  }
}

// ── Helpers ─────────────────────────────────────────────

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
): string {
  // Remove trailing slash from base, ensure leading slash on path
  const base = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;

  if (!query || Object.keys(query).length === 0) return url;

  const sep = url.includes('?') ? '&' : '?';
  const qs = new URLSearchParams(query).toString();
  return `${url}${sep}${qs}`;
}

function buildAuthHeaders(
  auth: HttpClientOptions['auth'],
): Record<string, string> {
  if (!auth) return {};

  switch (auth.type) {
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` };
    case 'api-key':
      return { [auth.header]: auth.key };
    case 'basic': {
      const encoded = btoa(`${auth.username}:${auth.password}`);
      return { Authorization: `Basic ${encoded}` };
    }
    case 'token':
      return { Authorization: auth.value };
    default:
      return {};
  }
}

function isRetryable(err: unknown): boolean {
  // Network errors (no status) are retryable
  if (err instanceof HttpClientError) {
    return err.status >= 500;
  }
  // AbortError from timeout — retryable
  if (err instanceof Error && err.name === 'AbortError') {
    return true;
  }
  // TypeError from fetch (DNS failure, connection refused) — retryable
  if (err instanceof TypeError) {
    return true;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Factory ─────────────────────────────────────────────

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    baseUrl,
    headers: defaultHeaders = {},
    timeout: defaultTimeout = 10_000,
    retries = 0,
    retryDelay = 1_000,
    auth,
    onError,
  } = options;

  const authHeaders = buildAuthHeaders(auth);

  // ---- Core request with retries ----

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ): Promise<T> {
    const url = buildUrl(baseUrl, path, opts?.query);
    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...authHeaders,
      ...(opts?.headers ?? {}),
    };

    const effectiveTimeout = opts?.timeout ?? defaultTimeout;
    const maxAttempts = retries + 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const fetchInit: RequestInit = {
          method,
          headers: mergedHeaders,
          signal: opts?.signal ?? AbortSignal.timeout(effectiveTimeout),
        };

        if (body !== undefined && body !== null) {
          fetchInit.body = JSON.stringify(body);
        }

        const res = await fetch(url, fetchInit);

        if (!res.ok) {
          const text = await res.text();
          const err = new HttpClientError(res.status, text, path);
          onError?.(err);

          // Don't retry 4xx — only 5xx
          if (res.status >= 400 && res.status < 500) {
            throw err;
          }
          throw err;
        }

        // Parse response
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('json')) {
          return (await res.json()) as T;
        }
        // Non-JSON 2xx — return empty object for typed methods
        const text = await res.text();
        if (text.length === 0) return {} as T;
        // Try JSON parse as fallback
        try {
          return JSON.parse(text) as T;
        } catch {
          return text as unknown as T;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxAttempts && isRetryable(err)) {
          const delay = Math.min(retryDelay * 2 ** (attempt - 1), 10_000);
          await sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new Error(`Request failed after ${maxAttempts} attempts`);
  }

  // ---- raw() for streaming / non-JSON ----

  async function raw(
    path: string,
    init?: RequestInit & { timeout?: number },
  ): Promise<Response> {
    const url = buildUrl(baseUrl, path);
    const effectiveTimeout = init?.timeout ?? defaultTimeout;

    const mergedHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...authHeaders,
      ...((init?.headers as Record<string, string>) ?? {}),
    };

    const res = await fetch(url, {
      ...init,
      headers: mergedHeaders,
      signal: init?.signal ?? AbortSignal.timeout(effectiveTimeout),
    });

    if (!res.ok) {
      const text = await res.text();
      const err = new HttpClientError(res.status, text, path);
      onError?.(err);
      throw err;
    }

    return res;
  }

  // ---- Public API ----

  return {
    get: <T>(path: string, opts?: RequestOptions) =>
      request<T>('GET', path, undefined, opts),

    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('POST', path, body, opts),

    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PUT', path, body, opts),

    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PATCH', path, body, opts),

    delete: <T>(path: string, opts?: RequestOptions) =>
      request<T>('DELETE', path, undefined, opts),

    raw,
  };
}
