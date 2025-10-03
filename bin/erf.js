#!/usr/bin/env node

import { Command } from 'commander'
import path from 'path'
import { fileURLToPath } from 'url'
import { ErfConfig } from '../src/config/ErfConfig.js'
import { GraphBuilder } from '../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../src/analyzers/DeadCodeDetector.js'
import { DuplicateDetector } from '../src/analyzers/DuplicateDetector.js'
import { initLogger } from '../src/utils/Logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize logger with stdout enabled (CLI mode)
await initLogger({ stdout: true })

const program = new Command()

/**
 * Generate comprehensive report with dead code, large files, duplicates, and recommendations
 */
function generateComprehensiveReport(targetDir, stats, deadCodeResult, duplicateResult, graphBuilder, options) {
  const lines = []

  lines.push('# Code Analysis Report')
  lines.push('')
  lines.push(`**Project:** ${targetDir}`)
  lines.push(`**Generated:** ${new Date().toISOString()}`)
  lines.push('')

  // Summary section
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Total Files:** ${stats.files}`)
  lines.push(`- **Functions/Methods:** ${stats.functions}`)
  lines.push(`- **Imports:** ${stats.imports}`)
  lines.push(`- **Exports:** ${stats.exports}`)
  lines.push(`- **Entry Points:** ${stats.entryPoints}`)
  lines.push(`- **External Dependencies:** ${stats.externalModules}`)
  lines.push('')

  // Health Score (now includes redundancy)
  const reachabilityScore = deadCodeResult.stats.reachabilityPercentage
  const connectivityScore = stats.files > 0 ? (stats.imports / stats.files) * 10 : 0
  const redundancyPenalty = duplicateResult.stats.redundancyScore * 10 // 0-10 point penalty
  const healthScore = Math.max(0, Math.round((reachabilityScore * 0.7) + (connectivityScore * 0.3) - redundancyPenalty))
  const healthEmoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : healthScore >= 40 ? '🟠' : '🔴'

  lines.push('## Health Score')
  lines.push('')
  lines.push(`${healthEmoji} **${healthScore}/100**`)
  lines.push('')
  lines.push(`- Reachability: ${reachabilityScore}%`)
  lines.push(`- Connectivity: ${connectivityScore.toFixed(1)} imports/file`)
  lines.push(`- Code Redundancy: ${(duplicateResult.stats.redundancyScore * 100).toFixed(1)}%`)
  lines.push('')

  // Dead Code Analysis
  lines.push('## Dead Code Analysis')
  lines.push('')
  lines.push(`- **Reachable Files:** ${deadCodeResult.stats.reachableFiles}/${deadCodeResult.stats.totalFiles}`)
  lines.push(`- **Dead Files:** ${deadCodeResult.stats.deadFiles}`)
  lines.push(`- **Unused Exports:** ${deadCodeResult.stats.unusedExports}`)
  lines.push('')

  if (deadCodeResult.deadFiles.length > 0) {
    lines.push('### Dead Files')
    lines.push('')
    deadCodeResult.deadFiles.slice(0, 10).forEach(file => {
      // Convert file:// URI to ./ relative path like other file references
      const relativePath = file.path.replace('file://', '').replace(targetDir, '.')
      lines.push(`- \`${relativePath}\` - ${file.reason}`)
    })
    if (deadCodeResult.deadFiles.length > 10) {
      lines.push(`- ... and ${deadCodeResult.deadFiles.length - 10} more`)
    }
    lines.push('')
  }

  // Duplicate Methods Analysis
  if (duplicateResult.duplicates.length > 0) {
    lines.push('## Duplicate Methods')
    lines.push('')
    lines.push(`Found ${duplicateResult.stats.duplicateGroups} duplicate method name(s):`)
    lines.push('')

    duplicateResult.duplicates.slice(0, 5).forEach(dup => {
      const categoryEmoji = dup.category === 'cross-class' ? '🔄' :
                           dup.category === 'cross-file' ? '📁' : '⚠️'
      lines.push(`${categoryEmoji} **${dup.name}** (${dup.count} occurrences, ${dup.category})`)
      dup.occurrences.slice(0, 3).forEach(occ => {
        const location = occ.file ? `${occ.file.replace(targetDir, '.')}:${occ.line || '?'}` : 'unknown'
        lines.push(`  - ${location}`)
      })
      if (dup.occurrences.length > 3) {
        lines.push(`  - ... and ${dup.occurrences.length - 3} more`)
      }
      lines.push('')
    })

    if (duplicateResult.duplicates.length > 5) {
      lines.push(`... and ${duplicateResult.duplicates.length - 5} more duplicate groups`)
      lines.push('')
    }
  }

  // Find largest files
  lines.push('## Largest Files')
  lines.push('')
  const files = graphBuilder.getGraph().queryNodesByType('file')
  const filesWithSize = files.map(f => {
    const metadata = graphBuilder.getGraph().getNodeMetadata(f.id)
    return { id: f.id, loc: metadata.loc || 0 }
  }).filter(f => f.loc > 0).sort((a, b) => b.loc - a.loc).slice(0, 5)

  filesWithSize.forEach((file, idx) => {
    const filename = file.id.replace('file://', '').replace(targetDir, '.')
    lines.push(`${idx + 1}. \`${filename}\` - ${file.loc} lines`)
  })
  lines.push('')

  // Critical path analysis if entry point specified
  if (options.entry) {
    lines.push('## Critical Path Analysis')
    lines.push('')
    const entryPath = path.resolve(targetDir, options.entry)
    const entryUri = `file://${entryPath}`

    const criticalPaths = traceCriticalPaths(graphBuilder.getGraph(), entryUri)
    if (criticalPaths.length > 0) {
      lines.push(`Entry point: \`${options.entry}\``)
      lines.push('')
      lines.push('### Dependencies (Critical Path)')
      lines.push('')
      criticalPaths.slice(0, 20).forEach((dep, idx) => {
        const depPath = dep.replace('file://', '').replace(targetDir, '.')
        lines.push(`${idx + 1}. \`${depPath}\``)
      })
      if (criticalPaths.length > 20) {
        lines.push(`... and ${criticalPaths.length - 20} more dependencies`)
      }
      lines.push('')
    } else {
      lines.push(`⚠️ Entry point not found: ${options.entry}`)
      lines.push('')
    }
  }

  // Recommendations
  lines.push('## Recommendations')
  lines.push('')

  if (deadCodeResult.stats.deadFiles > 0) {
    lines.push(`- 🧹 Remove ${deadCodeResult.stats.deadFiles} dead file(s) to reduce codebase size`)
  }

  if (filesWithSize[0] && filesWithSize[0].loc > 500) {
    lines.push(`- 📏 Consider refactoring large files (${filesWithSize.length} files over 500 LOC)`)
  }

  if (reachabilityScore < 80) {
    lines.push(`- 🔗 Improve code reachability (currently ${reachabilityScore}%)`)
  }

  if (stats.entryPoints === 0) {
    lines.push('- 🚪 Define entry points in `.erfrc.json` for better analysis')
  }

  if (duplicateResult.stats.redundancyScore > 0.1) {
    const crossClassDups = duplicateResult.duplicates.filter(d => d.category === 'cross-class').length
    if (crossClassDups > 0) {
      lines.push(`- 🔄 Review ${crossClassDups} cross-class duplicate(s) for potential refactoring`)
    }
  }

  if (deadCodeResult.stats.deadFiles === 0 && reachabilityScore === 100) {
    if (duplicateResult.stats.redundancyScore < 0.1) {
      lines.push('- ✅ Codebase is healthy! No dead code and low redundancy.')
    } else {
      lines.push('- ✅ No dead code detected, but consider reviewing duplicate methods.')
    }
  }

  lines.push('')

  return lines.join('\n')
}

/**
 * Trace all dependencies from an entry point (critical path)
 */
function traceCriticalPaths(graph, entryUri) {
  const visited = new Set()
  const result = []

  function traverse(nodeId) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    if (nodeId !== entryUri && nodeId.startsWith('file://')) {
      result.push(nodeId)
    }

    const imports = graph.queryImports(nodeId)
    for (const imported of imports) {
      traverse(imported.id)
    }
  }

  traverse(entryUri)
  return result
}

program
  .name('erf')
  .description('embarrassing relative finder - Code quality and dependency analysis tool')
  .version('0.1.0')
  .argument('[directory]', 'Directory to analyze (default action: comprehensive report)', '.')
  .option('-f, --file [filename]', 'Save report to file (default: erf-report.md)')
  .option('-r, --rdf [filename]', 'Export dependency graph as RDF Turtle (default: erf.ttl)')
  .option('-e, --entry <file>', 'Entry point file to trace critical paths from')
  .option('-c, --config <file>', 'Config file path', '.erfrc.json')
  .action(async (directory, options) => {
    // Default action: comprehensive analysis report
    try {
      const targetDir = path.resolve(process.cwd(), directory)
      const config = await ErfConfig.load(options.config)

      console.log(`Analyzing: ${targetDir}\n`)

      // Build graph
      const graphBuilder = new GraphBuilder(config)
      await graphBuilder.buildGraph(targetDir)

      const stats = graphBuilder.getGraph().getStats()
      const detector = new DeadCodeDetector(graphBuilder.getGraph())
      const deadCodeResult = detector.detect()

      // Detect duplicate methods
      const duplicateDetector = new DuplicateDetector(graphBuilder.getGraph(), {
        threshold: 2,
        ignoreCommon: true
      })
      const duplicateResult = duplicateDetector.detect()

      // Export to RDF if requested
      if (options.rdf !== undefined) {
        const rdfFilename = (typeof options.rdf === 'string') ? options.rdf : 'erf.ttl'
        const rdfOutput = await graphBuilder.export('rdf')
        const fs = await import('fs/promises')
        await fs.writeFile(rdfFilename, rdfOutput)
        console.log(`✓ RDF exported to: ${rdfFilename}\n`)
      }

      // Generate comprehensive report
      let report = generateComprehensiveReport(targetDir, stats, deadCodeResult, duplicateResult, graphBuilder, options)

      // Save to file or print to stdout
      if (options.file !== undefined) {
        const filename = (typeof options.file === 'string') ? options.file : 'erf-report.md'
        const fs = await import('fs/promises')
        await fs.writeFile(filename, report)
        console.log(`✓ Report saved to: ${filename}`)
      } else {
        console.log(report)
      }

      // Exit with error if significant issues found
      if (deadCodeResult.stats.deadFiles > 10 || deadCodeResult.stats.reachabilityPercentage < 70) {
        process.exit(1)
      }
    } catch (error) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

/**
 * Analyze command - Full codebase analysis
 */
program
  .command('analyze')
  .description('Analyze codebase and generate dependency graph')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-f, --format <format>', 'Output format: json, rdf, stats', 'json')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-c, --config <file>', 'Config file path', '.erfrc.json')
  .action(async (directory, options) => {
    try {
      const targetDir = path.resolve(process.cwd(), directory)
      console.log(`Analyzing: ${targetDir}`)

      // Load config
      const config = await ErfConfig.load(options.config)

      // Build graph
      const graphBuilder = new GraphBuilder(config)
      await graphBuilder.buildGraph(targetDir)

      // Export in requested format
      const output = graphBuilder.export(options.format)

      if (options.output) {
        const fs = await import('fs/promises')
        const outputPath = path.resolve(process.cwd(), options.output)
        await fs.writeFile(outputPath, typeof output === 'string' ? output : JSON.stringify(output, null, 2))
        console.log(`\nOutput written to: ${outputPath}`)
      } else {
        console.log('\n' + (typeof output === 'string' ? output : JSON.stringify(output, null, 2)))
      }
    } catch (error) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

/**
 * Dead code command - Find unused code
 */
program
  .command('dead-code')
  .description('Find dead code (unreachable files and unused exports)')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-c, --config <file>', 'Config file path', '.erfrc.json')
  .option('-f, --format <format>', 'Output format: text, json', 'text')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (directory, options) => {
    try {
      const targetDir = path.resolve(process.cwd(), directory)
      console.log(`Analyzing dead code in: ${targetDir}`)

      // Load config
      const config = await ErfConfig.load(options.config)

      // Build graph
      const graphBuilder = new GraphBuilder(config)
      await graphBuilder.buildGraph(targetDir)

      // Detect dead code
      const detector = new DeadCodeDetector(graphBuilder.getGraph())
      const result = detector.detect()

      let output
      if (options.format === 'json') {
        output = JSON.stringify(result, null, 2)
      } else {
        output = detector.generateReport()
      }

      if (options.output) {
        const fs = await import('fs/promises')
        const outputPath = path.resolve(process.cwd(), options.output)
        await fs.writeFile(outputPath, output)
        console.log(`\nOutput written to: ${outputPath}`)
      } else {
        console.log('\n' + output)
      }

      // Exit with error code if dead code found
      if (result.stats.deadFiles > 0) {
        process.exit(1)
      }
    } catch (error) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

/**
 * Health command - Generate health report
 */
program
  .command('health')
  .description('Generate codebase health report')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-c, --config <file>', 'Config file path', '.erfrc.json')
  .action(async (directory, options) => {
    try {
      const targetDir = path.resolve(process.cwd(), directory)
      console.log(`Generating health report for: ${targetDir}`)

      // Load config
      const config = await ErfConfig.load(options.config)

      // Build graph
      const graphBuilder = new GraphBuilder(config)
      await graphBuilder.buildGraph(targetDir)

      // Get statistics
      const stats = graphBuilder.getGraph().getStats()

      // Detect dead code
      const detector = new DeadCodeDetector(graphBuilder.getGraph())
      const deadCodeResult = detector.detect()

      // Calculate health score (0-100)
      const healthScore = Math.round(
        (deadCodeResult.stats.reachabilityPercentage * 0.7) + // 70% weight on reachability
        (stats.files > 0 ? ((stats.imports / stats.files) * 10) : 0) * 0.3 // 30% weight on connectivity
      )

      // Generate report
      console.log('\n' + '='.repeat(60))
      console.log('Codebase Health Report')
      console.log('='.repeat(60))
      console.log('')
      console.log(`Health Score: ${healthScore}/100`)
      console.log('')
      console.log('Graph Statistics:')
      console.log(`  Files: ${stats.files}`)
      console.log(`  Modules: ${stats.modules}`)
      console.log(`  Imports: ${stats.imports}`)
      console.log(`  Exports: ${stats.exports}`)
      console.log(`  Entry Points: ${stats.entryPoints}`)
      console.log(`  External Modules: ${stats.externalModules}`)
      console.log('')
      console.log('Dead Code Analysis:')
      console.log(`  Reachable Files: ${deadCodeResult.stats.reachableFiles}/${deadCodeResult.stats.totalFiles}`)
      console.log(`  Dead Files: ${deadCodeResult.stats.deadFiles}`)
      console.log(`  Unused Exports: ${deadCodeResult.stats.unusedExports}`)
      console.log(`  Reachability: ${deadCodeResult.stats.reachabilityPercentage}%`)
      console.log('')
      console.log('='.repeat(60))

      // Exit with error if health is poor
      if (healthScore < 50) {
        console.log('\n⚠️  Warning: Codebase health is below 50%')
        process.exit(1)
      }
    } catch (error) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

/**
 * Isolated command - Find isolated subgraphs
 */
program
  .command('isolated')
  .description('Find isolated code subgraphs with no connection to entry points')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-c, --config <file>', 'Config file path', '.erfrc.json')
  .action(async (directory, options) => {
    try {
      const targetDir = path.resolve(process.cwd(), directory)
      console.log(`Finding isolated subgraphs in: ${targetDir}`)

      // Load config
      const config = await ErfConfig.load(options.config)

      // Build graph
      const graphBuilder = new GraphBuilder(config)
      await graphBuilder.buildGraph(targetDir)

      // Detect dead code (which includes isolated files)
      const detector = new DeadCodeDetector(graphBuilder.getGraph())
      const result = detector.detect()

      console.log('\n' + '='.repeat(60))
      console.log('Isolated Code Subgraphs')
      console.log('='.repeat(60))
      console.log('')

      if (result.deadFiles.length === 0) {
        console.log('No isolated files found!')
      } else {
        console.log(`Found ${result.deadFiles.length} isolated files:\n`)
        for (const file of result.deadFiles) {
          console.log(`  ${file.path}`)
        }
      }

      console.log('')
      console.log('='.repeat(60))
    } catch (error) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

/**
 * Duplicates command - Find duplicate method/function names
 */
program
  .command('duplicates')
  .description('Find duplicate or similar method/function names')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-c, --config <file>', 'Config file path', '.erfrc.json')
  .option('-t, --threshold <number>', 'Minimum occurrences to report (default: 2)', '2')
  .option('--ignore-common', 'Ignore common method names', true)
  .option('--include-similar', 'Include similar names (Levenshtein distance)')
  .option('-f, --format <format>', 'Output format: text, json', 'text')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (directory, options) => {
    try {
      const targetDir = path.resolve(process.cwd(), directory)
      console.log(`Finding duplicate method names in: ${targetDir}`)

      // Load config
      const config = await ErfConfig.load(options.config)

      // Build graph
      const graphBuilder = new GraphBuilder(config)
      await graphBuilder.buildGraph(targetDir)

      // Detect duplicates
      const detector = new DuplicateDetector(graphBuilder.getGraph(), {
        threshold: parseInt(options.threshold),
        ignoreCommon: options.ignoreCommon,
        includeSimilar: options.includeSimilar
      })
      const result = detector.detect()

      // Format output
      const output = detector.format(result, options.format)

      if (options.output) {
        const fs = await import('fs/promises')
        const outputPath = path.resolve(process.cwd(), options.output)
        await fs.writeFile(outputPath, output)
        console.log(`\nOutput written to: ${outputPath}`)
      } else {
        console.log('\n' + output)
      }

      // Exit with error code if duplicates found (for CI/CD)
      if (result.duplicates.length > 0) {
        process.exit(1)
      }
    } catch (error) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

/**
 * Show command - Launch GUI visualization
 */
program
  .command('show')
  .description('Launch GUI visualization for codebase analysis')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-p, --port <port>', 'Server port', '3030')
  .action(async (directory, options) => {
    try {
      const targetDir = path.resolve(process.cwd(), directory)
      console.log(`Launching erf GUI for: ${targetDir}`)
      console.log(`Server will start on port ${options.port}`)

      // Import child_process to spawn the dev servers
      const { spawn } = await import('child_process')

      // Set environment variable for the target directory
      process.env.ERF_TARGET_DIR = targetDir

      // Get the erf package directory
      const erfRoot = path.resolve(__dirname, '..')

      // Start API server
      const apiServer = spawn('node', ['ui/server.js'], {
        cwd: erfRoot,
        env: { ...process.env, PORT: options.port },
        stdio: 'inherit'
      })

      // Wait a bit for API server to start
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Start Vite dev server
      const viteServer = spawn('npx', ['vite', '--config', 'ui/vite.config.js'], {
        cwd: erfRoot,
        stdio: 'inherit'
      })

      // Handle cleanup on exit
      const cleanup = () => {
        apiServer.kill()
        viteServer.kill()
        process.exit(0)
      }

      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)

      // Wait for both processes
      apiServer.on('error', (error) => {
        console.error(`API server error: ${error.message}`)
        cleanup()
      })

      viteServer.on('error', (error) => {
        console.error(`Vite server error: ${error.message}`)
        cleanup()
      })

    } catch (error) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }
  })

program.parse()
