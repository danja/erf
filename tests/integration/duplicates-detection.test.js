import { describe, it, expect } from 'vitest'
import { GraphBuilder } from '../../src/analyzers/GraphBuilder.js'
import { DuplicateDetector } from '../../src/analyzers/DuplicateDetector.js'
import { ErfConfig } from '../../src/config/ErfConfig.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Duplicate Detection Integration - erf codebase', () => {
  const erfRoot = path.resolve(__dirname, '../..')

  it('should detect duplicate method names across erf codebase', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: true
    })
    const result = detector.detect()

    expect(result).toBeDefined()
    expect(result.duplicates).toBeDefined()
    expect(result.stats).toBeDefined()

    // Stats should be valid
    expect(result.stats.totalFunctions).toBeGreaterThan(0)
    expect(result.stats.uniqueNames).toBeGreaterThan(0)
    expect(result.stats.redundancyScore).toBeGreaterThanOrEqual(0)
    expect(result.stats.redundancyScore).toBeLessThanOrEqual(1)
  })

  it('should find duplicates in test fixtures', async () => {
    const config = {
      entryPoints: [],
      ignore: ['node_modules/**', '!tests/fixtures/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result = detector.detect()

    // Should find duplicates from our fixture file
    const functions = graphBuilder.getGraph().queryNodesByType('function')
    const functionNames = functions.map(f => {
      const metadata = graphBuilder.getGraph().getNodeMetadata(f.id)
      return metadata.label || metadata.name
    })

    // Check if fixture functions are included
    expect(functionNames.some(name => name && name.includes('addFile'))).toBe(true)
    expect(functionNames.some(name => name && name.includes('parseFile'))).toBe(true)

    // Should detect cross-file duplicates
    const addFileDups = result.duplicates.find(d => d.name === 'addFile')
    if (addFileDups) {
      expect(addFileDups.count).toBeGreaterThanOrEqual(2)
      expect(addFileDups.occurrences.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('should detect getStats duplicates across analyzer classes', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result = detector.detect()

    // erf has multiple classes with getStats methods
    const getStatsDup = result.duplicates.find(d => d.name === 'getStats')

    if (getStatsDup) {
      expect(getStatsDup.count).toBeGreaterThanOrEqual(2)
      expect(getStatsDup.category).toMatch(/cross-class|mixed/)
    }
  })

  it('should categorize duplicates correctly', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result = detector.detect()

    // Check categories exist
    const categories = new Set(result.duplicates.map(d => d.category))
    expect(categories.size).toBeGreaterThan(0)

    // Each duplicate should have a valid category
    for (const dup of result.duplicates) {
      expect(['cross-class', 'cross-file', 'same-file', 'same-class-overload', 'mixed'])
        .toContain(dup.category)
    }
  })

  it('should detect similar function names with fuzzy matching', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 1,
      includeSimilar: true,
      similarityThreshold: 0.8
    })
    const result = detector.detect()

    // Should have similar groups if there are similar names
    expect(result.similarGroups).toBeDefined()

    // Each similar group should have similarity score
    for (const group of result.similarGroups) {
      expect(group.names).toBeDefined()
      expect(group.names.length).toBe(2)
      expect(group.similarity).toBeDefined()
      expect(parseFloat(group.similarity)).toBeGreaterThanOrEqual(0.8)
      expect(parseFloat(group.similarity)).toBeLessThan(1.0)
    }
  })

  it('should handle threshold filtering correctly', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    // High threshold - should find fewer duplicates
    const detector1 = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 5,
      ignoreCommon: false
    })
    const result1 = detector1.detect()

    // Low threshold - should find more duplicates
    const detector2 = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result2 = detector2.detect()

    expect(result2.duplicates.length).toBeGreaterThanOrEqual(result1.duplicates.length)
  })

  it('should format duplicate report correctly', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: true
    })
    const result = detector.detect()

    // Test text format
    const textReport = detector.format(result, 'text')
    expect(textReport).toContain('# Duplicate Method/Function Analysis')
    expect(textReport).toContain('## Statistics')
    expect(textReport).toContain('Total Functions/Methods:')
    expect(textReport).toContain('Unique Names:')
    expect(textReport).toContain('Redundancy Score:')

    // Test JSON format
    const jsonReport = detector.format(result, 'json')
    const parsed = JSON.parse(jsonReport)
    expect(parsed.duplicates).toBeDefined()
    expect(parsed.stats).toBeDefined()
    expect(Array.isArray(parsed.duplicates)).toBe(true)
  })

  it('should track function metadata in duplicates', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result = detector.detect()

    // Each duplicate occurrence should have metadata
    for (const dup of result.duplicates) {
      for (const occurrence of dup.occurrences) {
        expect(occurrence.fullName).toBeDefined()
        expect(occurrence.bareName).toBeDefined()
        expect(occurrence.file).toBeDefined()
        expect(occurrence.type).toMatch(/function|method/)

        if (occurrence.type === 'method') {
          expect(occurrence.className).toBeDefined()
        }
      }
    }
  })

  it('should detect dead code fixture as isolated', async () => {
    const config = {
      entryPoints: ['bin/erf.js'],
      ignore: ['node_modules/**', '!tests/fixtures/**']
    }

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const files = graphBuilder.getGraph().queryNodesByType('file')
    const deadCodeFile = files.find(f => f.id.includes('dead-code-example.js'))

    // Dead code fixture should be included in graph
    expect(deadCodeFile).toBeDefined()

    // Check for functions from dead code fixture
    const functions = graphBuilder.getGraph().queryNodesByType('function')
    const deadFunctions = functions.filter(f => f.id.includes('dead-code-example.js'))

    expect(deadFunctions.length).toBeGreaterThan(0)
  })

  it('should ignore common names by default', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    // With ignoreCommon: true (default)
    const detector1 = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: true
    })
    const result1 = detector1.detect()

    // Without ignoring common names
    const detector2 = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result2 = detector2.detect()

    // Should have more duplicates when not ignoring common names
    expect(result2.duplicates.length).toBeGreaterThanOrEqual(result1.duplicates.length)
  })

  it('should calculate meaningful redundancy score', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: true
    })
    const result = detector.detect()

    // Redundancy score should be between 0 and 1
    expect(result.stats.redundancyScore).toBeGreaterThanOrEqual(0)
    expect(result.stats.redundancyScore).toBeLessThanOrEqual(1)

    // If there are cross-class duplicates, score should reflect that
    const crossClassCount = result.duplicates.filter(d => d.category === 'cross-class').length

    if (crossClassCount > 0) {
      expect(result.stats.redundancyScore).toBeGreaterThan(0)
    }
  })

  it('should sort duplicates by count descending', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result = detector.detect()

    // Verify sorting
    for (let i = 0; i < result.duplicates.length - 1; i++) {
      expect(result.duplicates[i].count).toBeGreaterThanOrEqual(result.duplicates[i + 1].count)
    }
  })

  it('should provide occurrence details with line numbers', async () => {
    const config = await ErfConfig.load(path.join(erfRoot, '.erfrc.json'))

    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(erfRoot)

    const detector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: false
    })
    const result = detector.detect()

    // Find a duplicate with line numbers
    const dupWithLines = result.duplicates.find(d =>
      d.occurrences.some(o => o.line)
    )

    if (dupWithLines) {
      const occurrenceWithLine = dupWithLines.occurrences.find(o => o.line)
      expect(occurrenceWithLine.file).toBeDefined()
      expect(occurrenceWithLine.line).toBeDefined()
      // Line can be string or number depending on how it's stored
      expect(['string', 'number']).toContain(typeof occurrenceWithLine.line)
    }
  })
})
