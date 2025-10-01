import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'

/**
 * Handle erf_health tool call
 * Generates codebase health report with overall health score (0-100)
 */
export async function handleHealth(args) {
  const targetDir = path.resolve(process.cwd(), args.directory)
  const config = await ErfConfig.load(args.configPath || null)

  const graphBuilder = new GraphBuilder(config)
  await graphBuilder.buildGraph(targetDir)

  const stats = graphBuilder.getGraph().getStats()
  const graphData = await graphBuilder.export('json')

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
