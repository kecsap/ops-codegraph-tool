/**
 * MCP (Model Context Protocol) server for codegraph.
 * Exposes codegraph queries as tools that AI coding assistants can call.
 *
 * Requires: npm install @modelcontextprotocol/sdk
 */

import { createRequire } from 'node:module';
import { findCycles } from './cycles.js';
import { findDbPath } from './db.js';

const TOOLS = [
  {
    name: 'query_function',
    description: 'Find callers and callees of a function by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Function name to query (supports partial match)' },
        depth: {
          type: 'number',
          description: 'Traversal depth for transitive callers',
          default: 2,
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'file_deps',
    description: 'Show what a file imports and what imports it',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File path (partial match supported)' },
      },
      required: ['file'],
    },
  },
  {
    name: 'impact_analysis',
    description: 'Show files affected by changes to a given file (transitive)',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File path to analyze' },
      },
      required: ['file'],
    },
  },
  {
    name: 'find_cycles',
    description: 'Detect circular dependencies in the codebase',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'module_map',
    description: 'Get high-level overview of most-connected files',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of top files to show', default: 20 },
      },
    },
  },
];

export { TOOLS };

/**
 * Start the MCP server.
 * This function requires @modelcontextprotocol/sdk to be installed.
 */
export async function startMCPServer(customDbPath) {
  let Server, StdioServerTransport;
  try {
    const sdk = await import('@modelcontextprotocol/sdk/server/index.js');
    Server = sdk.Server;
    const transport = await import('@modelcontextprotocol/sdk/server/stdio.js');
    StdioServerTransport = transport.StdioServerTransport;
  } catch {
    console.error(
      'MCP server requires @modelcontextprotocol/sdk.\n' +
        'Install it with: npm install @modelcontextprotocol/sdk',
    );
    process.exit(1);
  }

  // Lazy import query functions to avoid circular deps at module load
  const { queryNameData, impactAnalysisData, moduleMapData, fileDepsData } = await import(
    './queries.js'
  );

  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');

  const server = new Server(
    { name: 'codegraph', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler('tools/list', async () => ({ tools: TOOLS }));

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    const dbPath = customDbPath || undefined;

    try {
      let result;
      switch (name) {
        case 'query_function':
          result = queryNameData(args.name, dbPath);
          break;
        case 'file_deps':
          result = fileDepsData(args.file, dbPath);
          break;
        case 'impact_analysis':
          result = impactAnalysisData(args.file, dbPath);
          break;
        case 'find_cycles': {
          const db = new Database(findDbPath(dbPath), { readonly: true });
          const cycles = findCycles(db);
          db.close();
          result = { cycles, count: cycles.length };
          break;
        }
        case 'module_map':
          result = moduleMapData(dbPath, args.limit || 20);
          break;
        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
