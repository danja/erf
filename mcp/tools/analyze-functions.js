import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'

/**
 * Handle erf_functions tool call
 * Analyzes function and method distribution across the codebase
 */
export async function handleFunctions(args) {
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
