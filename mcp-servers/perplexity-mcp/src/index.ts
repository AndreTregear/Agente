/**
 * Perplexity MCP Server — web search for OpenClaw agents.
 *
 * Tools:
 *   web_search  — Search the internet and get summarized results
 *   web_research — Deep research on a specific topic with citations
 *
 * Uses Perplexity's chat/completions API (sonar model).
 */

import { createMCPServer } from '@yaya/mcp-base';
import { createHttpClient } from '@yaya/http-client';
import type { CallToolResult } from '@yaya/mcp-base';

const PPLX_API_KEY = process.env.PERPLEXITY_API_KEY ?? '';

if (!PPLX_API_KEY) {
  console.error('PERPLEXITY_API_KEY not set');
  process.exit(1);
}

// ── Perplexity HTTP Client ──────────────────────────

const pplx = createHttpClient({
  baseUrl: 'https://api.perplexity.ai',
  auth: { type: 'bearer', token: PPLX_API_KEY },
  timeout: 30_000,
});

// ── Tool Definitions ──

const TOOLS = [
  {
    name: 'web_search',
    description:
      'Search the internet for current information. Returns a concise summary with sources. Use for: news, facts, current events, documentation, tutorials, product info.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query — be specific for better results',
        },
        language: {
          type: 'string',
          description: 'Response language (default: es for Spanish)',
          default: 'es',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_research',
    description:
      'Deep research on a topic — more thorough than web_search. Returns detailed analysis with multiple sources and citations. Use for: complex questions, comparisons, technical deep-dives.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'Topic to research in depth',
        },
        focus: {
          type: 'string',
          description: 'Specific aspect to focus on (optional)',
        },
        language: {
          type: 'string',
          description: 'Response language (default: es)',
          default: 'es',
        },
      },
      required: ['topic'],
    },
  },
];

// ── Helpers ──

async function queryPerplexity(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<CallToolResult> {
  try {
    const data = await pplx.post<{
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    }>('/chat/completions', {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
      return_citations: true,
      return_related_questions: true,
    });

    let result = data.choices[0]?.message?.content ?? 'No results';

    if (data.citations?.length) {
      result += '\n\nFuentes:\n' + data.citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err}` }],
      isError: true,
    };
  }
}

// ── MCP Server ──

const mcp = createMCPServer({
  name: 'perplexity-mcp',
  version: '0.1.0',
  tools: TOOLS,
  handler: async (name, args): Promise<string | CallToolResult> => {
    switch (name) {
      case 'web_search': {
        const language = (args.language as string) ?? 'es';
        const systemPrompt =
          language === 'es'
            ? 'Eres un asistente de búsqueda. Responde de forma concisa y precisa en español. Incluye las fuentes.'
            : 'You are a search assistant. Respond concisely with sources.';

        return queryPerplexity('sonar', systemPrompt, args.query as string, 1024);
      }

      case 'web_research': {
        const language = (args.language as string) ?? 'es';
        const systemPrompt =
          language === 'es'
            ? 'Eres un investigador experto. Proporciona un análisis detallado y completo en español con múltiples fuentes. Estructura la respuesta con secciones claras.'
            : 'You are an expert researcher. Provide detailed analysis with multiple sources.';

        const userMsg = args.focus
          ? `Investiga en profundidad: ${args.topic}\nEnfoque específico: ${args.focus}`
          : `Investiga en profundidad: ${args.topic}`;

        return queryPerplexity('sonar-pro', systemPrompt, userMsg, 4096);
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  },
});

mcp.start();
