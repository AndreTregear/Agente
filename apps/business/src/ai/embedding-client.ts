/**
 * Embedding Client — wraps the OpenAI-compatible embeddings API.
 *
 * Reuses AI_EMBEDDING_* config from src/config.ts.
 * Works with OpenAI, vLLM, or any compatible endpoint.
 */

import { AI_EMBEDDING_MODEL, AI_EMBEDDING_BASE_URL, AI_EMBEDDING_API_KEY } from '../config.js';
import { logger } from '../shared/logger.js';

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

/**
 * Generate an embedding vector for a single text input.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [result] = await generateEmbeddings([text]);
  return result;
}

const MAX_BATCH_SIZE = 100;
const MAX_TEXT_LENGTH = 8192;

/**
 * Generate embedding vectors for multiple texts in a single batch call.
 * Returns arrays in the same order as the input.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > MAX_BATCH_SIZE) {
    throw new Error(`Embedding batch size ${texts.length} exceeds limit ${MAX_BATCH_SIZE}`);
  }

  // Truncate overly long texts
  texts = texts.map((t) => t.slice(0, MAX_TEXT_LENGTH));

  const url = `${AI_EMBEDDING_BASE_URL}/embeddings`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AI_EMBEDDING_API_KEY) {
    headers['Authorization'] = `Bearer ${AI_EMBEDDING_API_KEY}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: AI_EMBEDDING_MODEL,
      input: texts,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error({ status: res.status, body, model: AI_EMBEDDING_MODEL }, 'Embedding API error');
    throw new Error(`Embedding API returned ${res.status}: ${body}`);
  }

  const json = (await res.json()) as EmbeddingResponse;

  // Sort by index to guarantee order matches input
  const sorted = json.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}
