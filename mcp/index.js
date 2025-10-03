#!/usr/bin/env node

/**
 * erf MCP Server - Model Context Protocol interface
 * Provides AI assistants with access to erf code analysis tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { initLogger } from '../src/utils/Logger.js'

// Import tool handlers
import { handleAnalyze } from './tools/analyze-codebase.js'
import { handleDeadCode } from './tools/find-dead-code.js'
import { handleHealth } from './tools/check-health.js'
import { handleIsolated } from './tools/find-isolated.js'
import { handleHubs } from './tools/find-hubs.js'
import { handleFunctions } from './tools/analyze-functions.js'
import { handleDuplicates } from './tools/find-duplicates.js'

/**
 * MCP Server for erf code analysis
 */
export class ErfMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'erf-analyzer',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupHandlers()
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'erf_analyze',
            description: 'Analyze a codebase and build dependency graph. Returns statistics about files, imports, exports, and modules.',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path to analyze (absolute or relative to current working directory)'
                },
                configPath: {
                  type: 'string',
                  description: 'Optional path to .erfrc.json config file'
                }
              },
              required: ['directory']
            }
          },
          {
            name: 'erf_dead_code',
            description: 'Find dead code (unreachable files and unused exports) in a codebase. Returns list of dead files and statistics.',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path to analyze'
                },
                configPath: {
                  type: 'string',
                  description: 'Optional path to config file'
                },
                format: {
                  type: 'string',
                  enum: ['text', 'json'],
                  description: 'Output format (default: json)'
                }
              },
              required: ['directory']
            }
          },
          {
            name: 'erf_health',
            description: 'Generate codebase health report with overall health score (0-100). Includes metrics on reachability, connectivity, and code quality.',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path to analyze'
                },
                configPath: {
                  type: 'string',
                  description: 'Optional path to config file'
                }
              },
              required: ['directory']
            }
          },
          {
            name: 'erf_isolated',
            description: 'Find isolated code subgraphs (files with no connection to entry points). Returns list of isolated files.',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path to analyze'
                },
                configPath: {
                  type: 'string',
                  description: 'Optional path to config file'
                }
              },
              required: ['directory']
            }
          },
          {
            name: 'erf_hubs',
            description: 'Identify hub files (files with many dependents). Hub files are core infrastructure that many other files depend on.',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path to analyze'
                },
                configPath: {
                  type: 'string',
                  description: 'Optional path to config file'
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum number of dependents to be considered a hub (default: 5)',
                  default: 5
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of hubs to return (default: 20)',
                  default: 20
                }
              },
              required: ['directory']
            }
          },
          {
            name: 'erf_functions',
            description: 'Analyze function and method distribution across the codebase. Shows function counts, types, and complexity indicators.',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path to analyze'
                },
                configPath: {
                  type: 'string',
                  description: 'Optional path to config file'
                },
                showFiles: {
                  type: 'boolean',
                  description: 'Show per-file function counts (default: false)',
                  default: false
                }
              },
              required: ['directory']
            }
          },
          {
            name: 'erf_duplicates',
            description: 'Find duplicate or similar method/function names across the codebase. Identifies potential code redundancy and naming inconsistencies.',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory path to analyze'
                },
                configPath: {
                  type: 'string',
                  description: 'Optional path to config file'
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum occurrences to report as duplicate (default: 2)',
                  default: 2
                },
                ignoreCommon: {
                  type: 'boolean',
                  description: 'Ignore common method names like "constructor", "render", etc. (default: true)',
                  default: true
                },
                includeSimilar: {
                  type: 'boolean',
                  description: 'Include similar names using Levenshtein distance (default: false)',
                  default: false
                },
                similarityThreshold: {
                  type: 'number',
                  description: 'Similarity threshold for fuzzy matching (0-1, default: 0.8)',
                  default: 0.8
                }
              },
              required: ['directory']
            }
          }
        ]
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'erf_analyze':
            return await handleAnalyze(args)
          case 'erf_dead_code':
            return await handleDeadCode(args)
          case 'erf_health':
            return await handleHealth(args)
          case 'erf_isolated':
            return await handleIsolated(args)
          case 'erf_hubs':
            return await handleHubs(args)
          case 'erf_functions':
            return await handleFunctions(args)
          case 'erf_duplicates':
            return await handleDuplicates(args)
          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n\nStack trace:\n${error.stack}`
            }
          ],
          isError: true
        }
      }
    })
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('erf MCP server running on stdio')
  }
}

// Initialize logger (disable stdout for MCP STDIO)
await initLogger({ stdout: false })

// Start server
const server = new ErfMCPServer()
server.run().catch(console.error)
