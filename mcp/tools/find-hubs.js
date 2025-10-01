import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'

/**
 * Handle erf_hubs tool call
 * Identifies hub files (files with many dependents)
 */
export async function handleHubs(args) {
  const targetDir = path.resolve(process.cwd(), args.directory)
  const config = await ErfConfig.load(args.configPath || null)
  const threshold = args.threshold || 5
  const limit = args.limit || 20

  const graphBuilder = new GraphBuilder(config)
  await graphBuilder.buildGraph(targetDir)

  // Export graph as JSON to get dependency metrics
  const graphData = await graphBuilder.export('json')

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
