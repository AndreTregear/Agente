/**
 * MCPServer — eliminates the boilerplate duplicated across all 13 MCP servers.
 *
 * Wraps: Server instantiation, StdioServerTransport, ListTools/CallTool
 * request handlers, error handling, and the main() entry point.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { formatError } from './utils.js';

// ── Types ──

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Handler function that receives the tool name and arguments,
 * and returns the text result. Throwing is fine — it gets caught
 * and returned as an error response automatically.
 *
 * Can return:
 *   - A plain string (wrapped into { content: [{type:'text', text}] })
 *   - A full CallToolResult object (passed through as-is)
 */
export type MCPToolHandler = (
  name: string,
  args: Record<string, unknown>,
) => Promise<string | CallToolResult>;

export interface MCPServerOptions {
  /** Server name (e.g. "business-mcp") */
  name: string;
  /** Semver version */
  version: string;
  /** Tool definitions exposed via ListTools */
  tools: MCPTool[];
  /** Single handler dispatching all tool calls */
  handler: MCPToolHandler;
  /**
   * Optional hook called before the transport connects.
   * Use for DB schema init, connection validation, etc.
   */
  onStartup?: () => Promise<void>;
}

/**
 * Creates a ready-to-run MCP server. Call `.start()` to connect stdio.
 *
 * @example
 * ```ts
 * const mcp = createMCPServer({
 *   name: 'forex-mcp',
 *   version: '0.1.0',
 *   tools: [ ... ],
 *   handler: async (name, args) => { ... },
 * });
 * mcp.start();
 * ```
 */
export function createMCPServer(options: MCPServerOptions) {
  const { name, version, tools, handler, onStartup } = options;

  const server = new Server(
    { name, version },
    { capabilities: { tools: {} } },
  );

  // ── ListTools ──
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools as Tool[],
  }));

  // ── CallTool ──
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name: toolName, arguments: args = {} } = request.params;

    try {
      const result = await handler(
        toolName,
        args as Record<string, unknown>,
      );

      // Handler can return a full CallToolResult or a plain string
      if (typeof result === 'object' && 'content' in result) {
        return result;
      }

      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${formatError(err)}` }],
        isError: true,
      };
    }
  });

  return {
    /** The underlying MCP SDK Server instance, if you need direct access. */
    server,

    /**
     * Connect via stdio and start serving. This is the entry point
     * you call at the bottom of your MCP server file.
     */
    async start(): Promise<void> {
      try {
        if (onStartup) {
          await onStartup();
        }

        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error(`${name} server running on stdio`);
      } catch (err) {
        console.error(`${name} fatal:`, err);
        process.exit(1);
      }
    },
  };
}

export type MCPServerInstance = ReturnType<typeof createMCPServer>;
