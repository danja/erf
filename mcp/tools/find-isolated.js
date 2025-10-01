import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../../src/analyzers/DeadCodeDetector.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'

/**
 * Handle erf_isolated tool call
 * Finds isolated code subgraphs (files with no connection to entry points)
 */
export async function handleIsolated(args) {
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
