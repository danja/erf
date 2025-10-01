import { describe, it, expect } from 'vitest'
import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../../src/analyzers/DeadCodeDetector.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Full Analysis Integration - erf itself', () => {
  const erfRoot = path.resolve(__dirname, '../..')

  it('should analyze erf codebase and build complete dependency graph', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const stats = graphBuilder.getGraph().getStats()

    // Verify graph was built
    expect(stats.files).toBeGreaterThan(0)
    expect(stats.imports).toBeGreaterThan(0)

    // Should find our core files
    const files = graphBuilder.getGraph().queryNodesByType('file')
    const filePaths = files.map(f => f.id)

    expect(filePaths.some(p => p.includes('FileScanner.js'))).toBe(true)
    expect(filePaths.some(p => p.includes('DependencyParser.js'))).toBe(true)
    expect(filePaths.some(p => p.includes('GraphBuilder.js'))).toBe(true)
    expect(filePaths.some(p => p.includes('RDFModel.js'))).toBe(true)
    expect(filePaths.some(p => p.includes('DeadCodeDetector.js'))).toBe(true)
  })

  it('should detect entry points from config', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const entryPoints = graphBuilder.getGraph().queryEntryPoints()

    expect(entryPoints.length).toBeGreaterThan(0)

    // If entry points are configured, should find them
    if (config.entryPoints.length > 0) {
      const entryPointPaths = entryPoints.map(ep => ep.id)
      expect(entryPointPaths.some(p => p.includes('bin/erf.js'))).toBe(true)
    }
  })

  it('should identify external dependencies', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const externalModules = graphBuilder.getGraph().queryExternalModules()

    expect(externalModules.length).toBeGreaterThan(0)

    const externalNames = externalModules.map(m => m.id)

    // Should find our dependencies
    expect(externalNames.some(name => name.includes('rdf-ext'))).toBe(true)
    expect(externalNames.some(name => name.includes('commander'))).toBe(true)
    expect(externalNames.some(name => name.includes('path'))).toBe(true)
  })

  it('should export graph in JSON format', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const json = await graphBuilder.export('json')

    expect(json.nodes).toBeDefined()
    expect(json.edges).toBeDefined()
    expect(json.stats).toBeDefined()

    expect(json.nodes.length).toBeGreaterThan(0)
    expect(json.edges.length).toBeGreaterThan(0)

    // Check node structure
    const fileNode = json.nodes.find(n => n.type === 'file')
    expect(fileNode).toBeDefined()
    expect(fileNode.id).toBeDefined()
    expect(fileNode.metadata).toBeDefined()

    // Check edge structure
    const importEdge = json.edges.find(e => e.type === 'imports')
    expect(importEdge).toBeDefined()
    expect(importEdge.from).toBeDefined()
    expect(importEdge.to).toBeDefined()
  })

  it('should export graph statistics', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const stats = await graphBuilder.export('stats')

    expect(stats.totalTriples).toBeGreaterThan(0)
    expect(stats.files).toBeGreaterThan(0)
    expect(stats.modules).toBeGreaterThan(0)
    expect(stats.imports).toBeGreaterThan(0)
    expect(stats.externalModules).toBeGreaterThan(0)
  })

  it('should perform dead code analysis on erf codebase', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    expect(result).toBeDefined()
    expect(result.stats).toBeDefined()
    expect(result.deadFiles).toBeDefined()
    expect(result.reachableFiles).toBeDefined()

    // Stats should be valid
    expect(result.stats.totalFiles).toBeGreaterThan(0)
    expect(result.stats.reachabilityPercentage).toBeGreaterThanOrEqual(0)
    expect(result.stats.reachabilityPercentage).toBeLessThanOrEqual(100)

    // Since erf is actively developed, most files should be reachable
    expect(result.stats.reachabilityPercentage).toBeGreaterThan(50)
  })

  it('should generate dead code report', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const report = detector.generateReport()

    expect(report).toBeDefined()
    expect(typeof report).toBe('string')
    expect(report).toContain('Dead Code Analysis Report')
    expect(report).toContain('Summary:')
    expect(report).toContain('Total files:')
    expect(report).toContain('Reachable files:')
  })

  it('should track import relationships correctly', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const graph = graphBuilder.getGraph()
    const files = graph.queryNodesByType('file')

    // Find GraphBuilder.js
    const graphBuilderFile = files.find(f => f.id.includes('GraphBuilder.js'))
    expect(graphBuilderFile).toBeDefined()

    // GraphBuilder should import FileScanner, DependencyParser, and RDFModel
    const imports = graph.queryImports(graphBuilderFile.id)

    const importPaths = imports.map(i => i.id)
    expect(importPaths.some(p => p.includes('FileScanner.js'))).toBe(true)
    expect(importPaths.some(p => p.includes('DependencyParser.js'))).toBe(true)
    expect(importPaths.some(p => p.includes('RDFModel.js'))).toBe(true)
  })

  it('should detect circular dependencies if present', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const graph = graphBuilder.getGraph()
    const files = graph.queryNodesByType('file')

    // Check for circular dependencies
    // This is a simplified check - proper cycle detection would use DFS
    let hasCircular = false

    for (const file of files) {
      const imports = graph.queryImports(file.id)

      for (const imported of imports) {
        const importedImports = graph.queryImports(imported.id)

        // Check if imported file imports back to original
        if (importedImports.some(i => i.id === file.id)) {
          hasCircular = true
          break
        }
      }

      if (hasCircular) break
    }

    // erf should ideally not have circular dependencies
    expect(hasCircular).toBe(false)
  })

  it('should handle empty entry points gracefully', async () => {
    const config = {
      entryPoints: [],
      ignore: ['node_modules/**', 'tests/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    // Should still complete but report no reachability
    expect(result).toBeDefined()
    expect(result.stats.totalFiles).toBeGreaterThan(0)
  })
})
