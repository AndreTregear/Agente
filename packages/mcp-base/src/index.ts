/**
 * @yaya/mcp-base — shared foundation for all MCP servers.
 *
 * Eliminates the boilerplate duplicated across every mcp-servers/* package:
 *   - Server instantiation & transport setup
 *   - ListTools / CallTool request handler registration
 *   - Error-wrapped main() entry point
 *   - Common formatting utilities
 */

export {
  createMCPServer,
  type MCPServerInstance,
  type MCPServerOptions,
  type MCPTool,
  type MCPToolHandler,
} from './server.js';

// Re-export the SDK's CallToolResult for convenience
export type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export {
  formatError,
  formatJSON,
  formatTable,
} from './utils.js';
