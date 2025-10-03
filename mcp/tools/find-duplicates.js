import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { DuplicateDetector } from '../../src/analyzers/DuplicateDetector.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'

/**
 * Handle erf_duplicates tool call
 * Finds duplicate or similar method/function names across the codebase
 */
export async function handleDuplicates(args) {
  const targetDir = path.resolve(process.cwd(), args.directory)
  const config = await ErfConfig.load(args.configPath || null)

  const graphBuilder = new GraphBuilder(config)
  await graphBuilder.buildGraph(targetDir)

  const detector = new DuplicateDetector(graphBuilder.getGraph(), {
    threshold: args.threshold || 2,
    ignoreCommon: args.ignoreCommon !== false,
    includeSimilar: args.includeSimilar || false,
    similarityThreshold: args.similarityThreshold || 0.8
  })

  const result = detector.detect()

  // Format as markdown for better readability in AI context
  let report = `# Duplicate Method/Function Analysis: ${targetDir}\n\n`

  report += `## Statistics\n`
  report += `- Total Functions/Methods: ${result.stats.totalFunctions}\n`
  report += `- Unique Names: ${result.stats.uniqueNames}\n`
  report += `- Duplicate Groups: ${result.stats.duplicateGroups}\n`
  report += `- Total Duplicates: ${result.stats.totalDuplicates}\n`
  report += `- Redundancy Score: ${(result.stats.redundancyScore * 100).toFixed(1)}%\n\n`

  if (result.duplicates.length === 0) {
    report += '✅ No duplicate method names found.\n'
  } else {
    report += `## Duplicate Names (${result.duplicates.length} groups)\n\n`

    for (const dup of result.duplicates) {
      report += `### ${dup.name} (${dup.count} occurrences, ${dup.category})\n`

      for (const occ of dup.occurrences) {
        const location = occ.file ? `${occ.file}:${occ.line || '?'}` : 'unknown'
        const qualifiers = []
        if (occ.async) qualifiers.push('async')
        if (occ.static) qualifiers.push('static')
        const qualifierStr = qualifiers.length > 0 ? ` [${qualifiers.join(', ')}]` : ''

        report += `  - ${location} (${occ.fullName}, ${occ.params} params)${qualifierStr}\n`
      }
      report += '\n'
    }
  }

  if (result.similarGroups && result.similarGroups.length > 0) {
    report += `## Similar Names (${result.similarGroups.length} groups)\n\n`

    for (const sim of result.similarGroups) {
      report += `### ${sim.names.join(' / ')} (${(sim.similarity * 100).toFixed(0)}% similar)\n`
      for (const occ of sim.occurrences.slice(0, 3)) {
        const location = occ.file ? `${occ.file}:${occ.line || '?'}` : 'unknown'
        report += `  - ${location} (${occ.fullName})\n`
      }
      if (sim.occurrences.length > 3) {
        report += `  ... and ${sim.occurrences.length - 3} more\n`
      }
      report += '\n'
    }
  }

  report += `## Analysis\n\n`

  if (result.duplicates.length === 0) {
    report += '✅ No duplicate method names detected. Code naming is unique.\n'
  } else {
    const crossClassDups = result.duplicates.filter(d => d.category === 'cross-class')
    const crossFileDups = result.duplicates.filter(d => d.category === 'cross-file')

    if (crossClassDups.length > 0) {
      report += `⚠️ Found ${crossClassDups.length} cross-class duplicate(s). These may indicate:\n`
      report += `  - Similar responsibilities across classes (potential for abstraction)\n`
      report += `  - Interface/protocol patterns (acceptable)\n`
      report += `  - Code duplication requiring refactoring\n\n`
    }

    if (crossFileDups.length > 0) {
      report += `⚠️ Found ${crossFileDups.length} cross-file duplicate(s) (regular functions). Consider:\n`
      report += `  - Consolidating into utility modules\n`
      report += `  - More descriptive naming to differentiate purpose\n\n`
    }

    if (result.stats.redundancyScore > 0.3) {
      report += `⚠️ High redundancy score (${(result.stats.redundancyScore * 100).toFixed(1)}%). Review duplicate methods for potential refactoring.\n`
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: report
      }
    ]
  }
}
