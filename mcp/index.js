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
import { GraphBuilder } from '../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../src/analyzers/DeadCodeDetector.js'
import { ErfConfig } from '../src/config/ErfConfig.js'
import path from 'path'

/**
 * MCP Server for erf code analysis
 */
class ErfMCPServer {
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
            return await this.handleAnalyze(args)
          case 'erf_dead_code':
            return await this.handleDeadCode(args)
          case 'erf_health':
            return await this.handleHealth(args)
          case 'erf_isolated':
            return await this.handleIsolated(args)
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

  /**
   * Handle erf_analyze tool call
   */
  async handleAnalyze(args) {
    const targetDir = path.resolve(process.cwd(), args.directory)
    const config = await ErfConfig.load(args.configPath || null)

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    const stats = graphBuilder.getGraph().getStats()
    const json = graphBuilder.export('json')

    return {
      content: [
        {
          type: 'text',
          text: `# Codebase Analysis: ${targetDir}

## Statistics
- Files: ${stats.files}
- Modules: ${stats.modules}
- Functions: ${stats.functions}
- Imports: ${stats.imports}
- Exports: ${stats.exports}
- Entry Points: ${stats.entryPoints}
- External Modules: ${stats.externalModules}
- Total Triples: ${stats.totalTriples}

## Graph Summary
- Total Nodes: ${json.nodes.length}
- Total Edges: ${json.edges.length}
- Entry Points: ${json.nodes.filter(n => n.isEntryPoint).length}
- External Modules: ${json.nodes.filter(n => n.type === 'external-module').length}

Use \`erf_dead_code\` to find unreachable code, or \`erf_health\` for overall health score.`
        }
      ]
    }
  }

  /**
   * Handle erf_dead_code tool call
   */
  async handleDeadCode(args) {
    const targetDir = path.resolve(process.cwd(), args.directory)
    const config = await ErfConfig.load(args.configPath || null)
    const format = args.format || 'json'

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    if (format === 'text') {
      const report = detector.generateReport()
      return {
        content: [
          {
            type: 'text',
            text: report
          }
        ]
      }
    }

    // JSON format
    return {
      content: [
        {
          type: 'text',
          text: `# Dead Code Analysis: ${targetDir}

## Summary
- Total Files: ${result.stats.totalFiles}
- Reachable Files: ${result.stats.reachableFiles}
- Dead Files: ${result.stats.deadFiles}
- Unused Exports: ${result.stats.unusedExports}
- Reachability: ${result.stats.reachabilityPercentage}%

## Dead Files (${result.deadFiles.length})
${result.deadFiles.length > 0 ? result.deadFiles.map(f => `- ${f.path}\n  Reason: ${f.reason}`).join('\n') : 'None found!'}

${result.deadFiles.length > 0 ? '⚠️ Consider removing or investigating these files.' : '✅ All files are reachable from entry points.'}`
        }
      ]
    }
  }

  /**
   * Handle erf_health tool call
   */
  async handleHealth(args) {
    const targetDir = path.resolve(process.cwd(), args.directory)
    const config = await ErfConfig.load(args.configPath || null)

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    const stats = graphBuilder.getGraph().getStats()
    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const deadCodeResult = detector.detect()

    // Calculate health score (0-100)
    const healthScore = Math.round(
      (deadCodeResult.stats.reachabilityPercentage * 0.7) + // 70% weight on reachability
      (stats.files > 0 ? Math.min((stats.imports / stats.files) * 10, 30) : 0) // 30% weight on connectivity
    )

    const healthLevel = healthScore >= 80 ? '🟢 Excellent' :
                       healthScore >= 60 ? '🟡 Good' :
                       healthScore >= 40 ? '🟠 Fair' : '🔴 Poor'

    return {
      content: [
        {
          type: 'text',
          text: `# Codebase Health Report: ${targetDir}

## Overall Health Score: ${healthScore}/100 ${healthLevel}

## Graph Metrics
- Files: ${stats.files}
- Modules: ${stats.modules}
- Imports: ${stats.imports}
- Exports: ${stats.exports}
- Entry Points: ${stats.entryPoints}
- External Modules: ${stats.externalModules}

## Code Quality
- Reachable Files: ${deadCodeResult.stats.reachableFiles}/${deadCodeResult.stats.totalFiles}
- Dead Files: ${deadCodeResult.stats.deadFiles}
- Unused Exports: ${deadCodeResult.stats.unusedExports}
- Reachability: ${deadCodeResult.stats.reachabilityPercentage}%

## Recommendations
${healthScore < 50 ? '⚠️ **Critical**: Consider running \`erf_dead_code\` to identify and remove dead code.' : ''}
${deadCodeResult.stats.deadFiles > 0 ? `- Remove ${deadCodeResult.stats.deadFiles} dead file(s)` : '✅ No dead files found'}
${stats.entryPoints === 0 ? '- Configure entry points in .erfrc.json' : `✅ ${stats.entryPoints} entry point(s) configured`}
${healthScore >= 80 ? '✅ Codebase is in excellent health!' : ''}
${healthScore >= 60 && healthScore < 80 ? '👍 Codebase health is good, minor improvements possible.' : ''}
${healthScore < 60 ? '🔧 Significant improvements recommended.' : ''}`
        }
      ]
    }
  }

  /**
   * Handle erf_isolated tool call
   */
  async handleIsolated(args) {
    const targetDir = path.resolve(process.cwd(), args.directory)
    const config = await ErfConfig.load(args.configPath || null)

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    return {
      content: [
        {
          type: 'text',
          text: `# Isolated Code Subgraphs: ${targetDir}

Found ${result.deadFiles.length} isolated file(s) with no connection to entry points:

${result.deadFiles.length > 0 ? result.deadFiles.map(f => `- ${f.path}`).join('\n') : 'No isolated files found! ✅'}

${result.deadFiles.length > 0 ? '\n⚠️ These files are not reachable from any configured entry point.\nConsider:\n- Adding entry points in .erfrc.json\n- Removing unused files\n- Investigating why they are isolated' : ''}`
        }
      ]
    }
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('erf MCP server running on stdio')
  }
}

// Start server
const server = new ErfMCPServer()
server.run().catch(console.error)
