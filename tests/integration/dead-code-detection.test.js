import { describe, it, expect } from 'vitest'
import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../../src/analyzers/DeadCodeDetector.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Dead Code Detection - OrphanedUtility', () => {
  const erfRoot = path.resolve(__dirname, '../..')

  it('should detect OrphanedUtility.js as dead code (has exports but no incoming imports)', async () => {
    // OrphanedUtility has no incoming imports BUT has exports
    // The smart entry point detection recognizes this as dead code, not an entry point
    const config = {
      entryPoints: ['bin/erf.js'],
      ignore: ['node_modules/**', 'tests/**', 'ui/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const entryPoints = graphBuilder.getGraph().queryEntryPoints()

    // OrphanedUtility should NOT be auto-detected as entry point (has exports = dead code)
    const orphanedEntry = entryPoints.find(e => e.id.includes('OrphanedUtility'))
    expect(orphanedEntry).toBeUndefined()

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    // Should be detected as dead code
    const orphanedFile = result.deadFiles.find(f =>
      f.path.includes('OrphanedUtility.js')
    )

    expect(orphanedFile).toBeDefined()
  })

  it('should detect unused exports in OrphanedUtility.js', async () => {
    const config = {
      entryPoints: ['bin/erf.js'],
      ignore: ['node_modules/**', 'tests/**', 'ui/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    expect(result.deadExports).toBeDefined()
    expect(Array.isArray(result.deadExports)).toBe(true)

    // Should have unused exports from OrphanedUtility
    const orphanedExports = result.deadExports.filter(e =>
      e.file.includes('OrphanedUtility.js')
    )

    expect(orphanedExports.length).toBeGreaterThan(0)
  })

  it('should show OrphanedUtility as dead (not auto-detected as entry point)', async () => {
    const config = {
      entryPoints: [], // No explicit entry points - will auto-detect
      ignore: ['node_modules/**', 'tests/**', 'ui/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    // With smart auto-detection, files with exports but no incoming imports are dead code
    // So OrphanedUtility should NOT be marked as reachable
    const isReachable = result.reachableFiles.some(f =>
      f.path?.includes('OrphanedUtility.js')
    )

    expect(isReachable).toBe(false)
  })

  it('should provide correct statistics about OrphanedUtility', async () => {
    const config = {
      entryPoints: ['bin/erf.js'],
      ignore: ['node_modules/**', 'tests/**', 'ui/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const result = detector.detect()

    expect(result.stats).toBeDefined()
    expect(result.stats.totalFiles).toBeGreaterThan(0)
    expect(result.stats.reachableFiles).toBeGreaterThan(0)

    // OrphanedUtility is now detected as dead code, so reachability will be < 100%
    expect(result.stats.reachabilityPercentage).toBeLessThan(100)
    expect(result.stats.deadFiles).toBeGreaterThan(0)
  })

  it('should generate report with export information', async () => {
    const config = {
      entryPoints: ['bin/erf.js'],
      ignore: ['node_modules/**', 'tests/**', 'ui/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const report = detector.generateReport()

    expect(report).toBeDefined()
    expect(typeof report).toBe('string')
    expect(report).toContain('Dead Code Analysis Report')

    // OrphanedUtility exports should be mentioned as unused
    if (report.includes('OrphanedUtility.js')) {
      expect(report).toContain('Exported but never imported')
    }
  })

  it('should document smart auto-detection behavior', async () => {
    const config = {
      entryPoints: ['bin/erf.js'],
      ignore: ['node_modules/**'] // Include everything else
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const entryPoints = graphBuilder.getGraph().queryEntryPoints()

    // Smart auto-detection: files with no imports are entry points UNLESS they have exports
    // This excludes OrphanedUtility (has exports) but includes test files, config files, etc.
    expect(entryPoints.length).toBeGreaterThan(1) // More than just bin/erf.js

    const orphanedEntry = entryPoints.find(e => e.id.includes('OrphanedUtility'))
    expect(orphanedEntry).toBeUndefined() // Should NOT be an entry point
  })
})
