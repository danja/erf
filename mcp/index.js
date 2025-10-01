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
import { initLogger } from '../src/utils/Logger.js'
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
          case 'erf_hubs':
            return await this.handleHubs(args)
          case 'erf_functions':
            return await this.handleFunctions(args)
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
    const graphData = graphBuilder.export('json')

    // Calculate graph-based metrics
    const filesWithDependents = graphData.nodes.filter(n => n.type === 'file' && n.dependentCount > 0).length
    const filesWithImports = graphData.nodes.filter(n => n.type === 'file' && n.importCount > 0).length
    const connectedFiles = graphData.nodes.filter(n => n.type === 'file' && (n.dependentCount > 0 || n.importCount > 0)).length
    const missingFiles = graphData.nodes.filter(n => n.isMissing).length

    // Connectivity score (0-50): How well-connected is the codebase
    const connectivityScore = stats.files > 0 ?
      Math.round((connectedFiles / stats.files) * 50) : 0

    // Structure score (0-30): Balance of imports/exports
    const avgImportsPerFile = stats.files > 0 ? stats.imports / stats.files : 0
    const avgExportsPerFile = stats.files > 0 ? stats.exports / stats.files : 0
    const structureScore = Math.min(
      Math.round((avgImportsPerFile + avgExportsPerFile) * 3),
      30
    )

    // Quality score (0-20): Few missing files
    const missingPenalty = missingFiles * 5
    const qualityScore = Math.max(20 - missingPenalty, 0)

    // Calculate overall health score (0-100)
    const healthScore = connectivityScore + structureScore + qualityScore

    const healthLevel = healthScore >= 80 ? '🟢 Excellent' :
                       healthScore >= 60 ? '🟡 Good' :
                       healthScore >= 40 ? '🟠 Fair' : '🔴 Poor'

    return {
      content: [
        {
          type: 'text',
          text: `# Codebase Health Report: ${targetDir}

## Overall Health Score: ${healthScore}/100 ${healthLevel}

### Score Breakdown
- Connectivity: ${connectivityScore}/50 (${connectedFiles}/${stats.files} files connected)
- Structure: ${structureScore}/30 (avg ${avgImportsPerFile.toFixed(1)} imports, ${avgExportsPerFile.toFixed(1)} exports per file)
- Quality: ${qualityScore}/20 (${missingFiles} missing file(s))

## Graph Metrics
- Files: ${stats.files}
- Functions: ${stats.functions}
- Imports: ${stats.imports}
- Exports: ${stats.exports}
- External Modules: ${stats.externalModules}

## Connectivity Analysis
- Files with dependents: ${filesWithDependents} (hub candidates)
- Files with imports: ${filesWithImports}
- Connected files: ${connectedFiles}
- Isolated files: ${stats.files - connectedFiles}
${missingFiles > 0 ? `- ⚠️ Missing files: ${missingFiles}` : ''}

## Recommendations
${healthScore >= 80 ? '✅ Codebase is in excellent health!' : ''}
${healthScore >= 60 && healthScore < 80 ? '👍 Codebase health is good, minor improvements possible.' : ''}
${healthScore < 60 ? '🔧 Significant improvements recommended:' : ''}
${connectivityScore < 25 ? '- ⚠️ Low connectivity - many isolated files' : ''}
${missingFiles > 0 ? `- ⚠️ Fix ${missingFiles} missing import(s)` : ''}
${stats.files - connectedFiles > 10 ? `- Consider reviewing ${stats.files - connectedFiles} isolated files` : ''}
${healthScore >= 60 && missingFiles === 0 ? '- ✅ No broken imports found' : ''}`
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

  /**
   * Handle erf_hubs tool call
   */
  async handleHubs(args) {
    const targetDir = path.resolve(process.cwd(), args.directory)
    const config = await ErfConfig.load(args.configPath || null)
    const threshold = args.threshold || 5
    const limit = args.limit || 20

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    // Export graph as JSON to get dependency metrics
    const graphData = graphBuilder.export('json')

    // Find hub files (files with many dependents)
    const hubs = graphData.nodes
      .filter(n => n.type === 'file' && !n.isMissing)
      .filter(n => n.dependentCount >= threshold)
      .sort((a, b) => b.dependentCount - a.dependentCount)
      .slice(0, limit)

    return {
      content: [
        {
          type: 'text',
          text: `# Hub Files: ${targetDir}

Found ${hubs.length} hub file(s) with ${threshold}+ dependents:

${hubs.length > 0 ? hubs.map((hub, idx) => `${idx + 1}. **${hub.id}**
   - Dependents: ${hub.dependentCount}
   - Imports: ${hub.importCount}
   - Exports: ${hub.exportCount}
   - Type: ${hub.dependentCount > 10 ? '🟢 Major Hub' : '🟡 Medium Hub'}`).join('\n\n') : 'No hub files found with the specified threshold.'}

## Analysis
${hubs.length > 0 ? `
- Hub files are core infrastructure components
- Changes to hubs affect ${hubs.reduce((sum, h) => sum + h.dependentCount, 0)} total dependencies
- Consider extra testing/review when modifying these files
` : `No files found with ${threshold}+ dependents. Try lowering the threshold.`}`
        }
      ]
    }
  }

  /**
   * Handle erf_functions tool call
   */
  async handleFunctions(args) {
    const targetDir = path.resolve(process.cwd(), args.directory)
    const config = await ErfConfig.load(args.configPath || null)
    const showFiles = args.showFiles || false

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    const stats = graphBuilder.getGraph().getStats()
    const functions = graphBuilder.getGraph().queryNodesByType('function')

    // Analyze function types
    const functionStats = {
      total: functions.length,
      methods: 0,
      regularFunctions: 0,
      async: 0,
      static: 0,
      generators: 0
    }

    const fileStats = new Map()

    for (const func of functions) {
      const metadata = graphBuilder.getGraph().getNodeMetadata(func.id)

      if (metadata.type === 'method') functionStats.methods++
      else functionStats.regularFunctions++

      if (metadata.async === 'true') functionStats.async++
      if (metadata.static === 'true') functionStats.static++
      if (metadata.generator === 'true') functionStats.generators++

      // Track per-file counts
      if (metadata.file) {
        const count = fileStats.get(metadata.file) || 0
        fileStats.set(metadata.file, count + 1)
      }
    }

    // Find files with most functions
    const topFiles = [...fileStats.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    return {
      content: [
        {
          type: 'text',
          text: `# Function Analysis: ${targetDir}

## Overall Statistics
- Total Functions/Methods: ${functionStats.total}
- Regular Functions: ${functionStats.regularFunctions}
- Class Methods: ${functionStats.methods}
- Async Functions: ${functionStats.async}
- Static Methods: ${functionStats.static}
- Generators: ${functionStats.generators}

## Averages
- Functions per file: ${stats.files > 0 ? (functionStats.total / stats.files).toFixed(1) : 0}

${showFiles && topFiles.length > 0 ? `## Files with Most Functions

${topFiles.map(([file, count], idx) => `${idx + 1}. ${file}: ${count} functions`).join('\n')}` : ''}

## Analysis
${functionStats.total === 0 ? '⚠️ No functions detected. Check if files are being parsed correctly.' : ''}
${functionStats.async > 0 ? `✅ ${functionStats.async} async functions detected (${((functionStats.async / functionStats.total) * 100).toFixed(1)}%)` : ''}
${functionStats.methods > functionStats.regularFunctions ? '📊 Method-heavy codebase (more OOP style)' : ''}
${functionStats.regularFunctions > functionStats.methods ? '📊 Function-heavy codebase (more functional style)' : ''}`
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

// Initialize logger (disable stdout for MCP STDIO)
await initLogger({ stdout: false })

// Start server
const server = new ErfMCPServer()
server.run().catch(console.error)
