import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'

/**
 * Handle erf_analyze tool call
 * Analyzes a codebase and builds dependency graph
 */
export async function handleAnalyze(args) {
  const targetDir = path.resolve(process.cwd(), args.directory)
  const config = await ErfConfig.load(args.configPath || null)

  const graphBuilder = new GraphBuilder(config)
  await graphBuilder.buildGraph(targetDir)

  const stats = graphBuilder.getGraph().getStats()
  const json = await graphBuilder.export('json')

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
