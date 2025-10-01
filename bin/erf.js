#!/usr/bin/env node

import { Command } from 'commander'
import path from 'path'
import { fileURLToPath } from 'url'
import { ErfConfig } from '../src/config/ErfConfig.js'
import { GraphBuilder } from '../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../src/analyzers/DeadCodeDetector.js'
import { initLogger } from '../src/utils/Logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize logger with stdout enabled (CLI mode)
await initLogger({ stdout: true })

const program = new Command()

program
  .name('erf')
  .description('embarrassing relative finder - Code quality and dependency analysis tool')
  .version('0.1.0')

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
