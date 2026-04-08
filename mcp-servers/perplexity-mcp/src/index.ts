/**
 * Perplexity MCP Server — web search for OpenClaw agents.
 *
 * Tools:
 *   web_search  — Search the internet and get summarized results
 *   web_lookup  — Deep research on a specific topic with citations
 *
 * Uses Perplexity's chat/completions API (sonar model).
 * Runs as stdio MCP transport — agent sends queries, gets results.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const PPLX_API_KEY = process.env.PERPLEXITY_API_KEY ?? '';
const PPLX_URL = 'https://api.perplexity.ai/chat/completions';

if (!PPLX_API_KEY) {
  console.error('PERPLEXITY_API_KEY not set');
  process.exit(1);
}

const server = new Server(
  { name: 'perplexity-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// ── Tool Definitions ──

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
  ],
}));

// ── Tool Handlers ──

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'web_search':
      return handleSearch(
        args?.query as string,
        (args?.language as string) ?? 'es',
      );
    case 'web_research':
      return handleResearch(
        args?.topic as string,
        (args?.focus as string) ?? '',
        (args?.language as string) ?? 'es',
      );
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
});

async function handleSearch(query: string, language: string) {
  try {
    const systemPrompt =
      language === 'es'
        ? 'Eres un asistente de búsqueda. Responde de forma concisa y precisa en español. Incluye las fuentes.'
        : 'You are a search assistant. Respond concisely with sources.';

    const res = await fetch(PPLX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PPLX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        max_tokens: 1024,
        temperature: 0.2,
        return_citations: true,
        return_related_questions: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        content: [{ type: 'text', text: `Search failed (${res.status}): ${err}` }],
        isError: true,
      };
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };

    let result = data.choices[0]?.message?.content ?? 'No results';

    // Append citations
    if (data.citations?.length) {
      result += '\n\nFuentes:\n' + data.citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Search error: ${err}` }],
      isError: true,
    };
  }
}

async function handleResearch(topic: string, focus: string, language: string) {
  try {
    const systemPrompt =
      language === 'es'
        ? 'Eres un investigador experto. Proporciona un análisis detallado y completo en español con múltiples fuentes. Estructura la respuesta con secciones claras.'
        : 'You are an expert researcher. Provide detailed analysis with multiple sources.';

    const userMsg = focus
      ? `Investiga en profundidad: ${topic}\nEnfoque específico: ${focus}`
      : `Investiga en profundidad: ${topic}`;

    const res = await fetch(PPLX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PPLX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 4096,
        temperature: 0.2,
        return_citations: true,
        return_related_questions: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        content: [{ type: 'text', text: `Research failed (${res.status}): ${err}` }],
        isError: true,
      };
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };

    let result = data.choices[0]?.message?.content ?? 'No results';

    if (data.citations?.length) {
      result += '\n\nFuentes:\n' + data.citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Research error: ${err}` }],
      isError: true,
    };
  }
}

// ── Start Server ──

const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error('Failed to start perplexity-mcp:', err);
  process.exit(1);
});
