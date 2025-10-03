import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../../src/analyzers/DeadCodeDetector.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'

/**
 * Handle erf_dead_code tool call
 * Finds dead code (unreachable files and unused exports)
 */
export async function handleDeadCode(args) {
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

  // JSON format - convert file:// URIs to ./ relative paths
  const formatPath = (filePath) => {
    return filePath.replace('file://', '').replace(targetDir, '.')
  }

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
${result.deadFiles.length > 0 ? result.deadFiles.map(f => `- ${formatPath(f.path)}\n  Reason: ${f.reason}`).join('\n') : 'None found!'}

${result.deadFiles.length > 0 ? '⚠️ Consider removing or investigating these files.' : '✅ All files are reachable from entry points.'}`
      }
    ]
  }
}
