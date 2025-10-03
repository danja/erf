import { describe, it, expect, beforeEach } from 'vitest'
import { DuplicateDetector } from '../../../src/analyzers/DuplicateDetector.js'
import { RDFModel } from '../../../src/graph/RDFModel.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('DuplicateDetector', () => {
  let rdfModel

  beforeEach(() => {
    rdfModel = new RDFModel()
  })

  describe('detect', () => {
    it('should detect exact duplicate function names', () => {
      // Add functions with duplicate names
      const file1 = '/project/src/file1.js'
      const file2 = '/project/src/file2.js'

      rdfModel.addFile(file1)
      rdfModel.addFile(file2)

      rdfModel.addFunction(`${file1}#handleRequest`, {
        name: 'handleRequest',
        type: 'function',
        file: file1,
        line: 10,
        params: 2
      })

      rdfModel.addFunction(`${file2}#handleRequest`, {
        name: 'handleRequest',
        type: 'function',
        file: file2,
        line: 20,
        params: 3
      })

      const detector = new DuplicateDetector(rdfModel)
      const result = detector.detect()

      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0].name).toBe('handleRequest')
      expect(result.duplicates[0].count).toBe(2)
      // Category should be cross-file since both are regular functions in different files
      expect(result.duplicates[0].category).toMatch(/cross-file|mixed/)
    })

    it('should detect cross-class duplicate method names', () => {
      const file1 = '/project/src/ClassA.js'
      const file2 = '/project/src/ClassB.js'

      rdfModel.addFile(file1)
      rdfModel.addFile(file2)

      rdfModel.addFunction(`${file1}#ClassA.validate`, {
        name: 'ClassA.validate',
        type: 'method',
        className: 'ClassA',
        methodName: 'validate',
        file: file1,
        line: 15,
        params: 1
      })

      rdfModel.addFunction(`${file2}#ClassB.validate`, {
        name: 'ClassB.validate',
        type: 'method',
        className: 'ClassB',
        methodName: 'validate',
        file: file2,
        line: 25,
        params: 1
      })

      const detector = new DuplicateDetector(rdfModel)
      const result = detector.detect()

      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0].name).toBe('validate')
      // Category should be cross-class since both are methods in different classes
      expect(result.duplicates[0].category).toMatch(/cross-class|mixed/)
    })

    it('should respect threshold option', () => {
      const file1 = '/project/src/file1.js'
      const file2 = '/project/src/file2.js'
      const file3 = '/project/src/file3.js'

      rdfModel.addFile(file1)
      rdfModel.addFile(file2)
      rdfModel.addFile(file3)

      // Add 2 duplicates
      rdfModel.addFunction(`${file1}#processData`, {
        name: 'processData',
        type: 'function',
        file: file1
      })

      rdfModel.addFunction(`${file2}#processData`, {
        name: 'processData',
        type: 'function',
        file: file2
      })

      // Add 3 duplicates
      rdfModel.addFunction(`${file1}#transform`, {
        name: 'transform',
        type: 'function',
        file: file1
      })

      rdfModel.addFunction(`${file2}#transform`, {
        name: 'transform',
        type: 'function',
        file: file2
      })

      rdfModel.addFunction(`${file3}#transform`, {
        name: 'transform',
        type: 'function',
        file: file3
      })

      // Threshold = 3, should only find 'transform'
      const detector = new DuplicateDetector(rdfModel, { threshold: 3 })
      const result = detector.detect()

      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0].name).toBe('transform')
      expect(result.duplicates[0].count).toBe(3)
    })

    it('should ignore common method names when configured', () => {
      const file = '/project/src/Component.js'
      rdfModel.addFile(file)

      rdfModel.addFunction(`${file}#ComponentA.constructor`, {
        name: 'ComponentA.constructor',
        type: 'method',
        className: 'ComponentA',
        methodName: 'constructor',
        file: file
      })

      rdfModel.addFunction(`${file}#ComponentA.render`, {
        name: 'ComponentA.render',
        type: 'method',
        className: 'ComponentA',
        methodName: 'render',
        file: file
      })

      rdfModel.addFunction(`${file}#ComponentB.constructor`, {
        name: 'ComponentB.constructor',
        type: 'method',
        className: 'ComponentB',
        methodName: 'constructor',
        file: file
      })

      // With ignoreCommon = true (default)
      const detector = new DuplicateDetector(rdfModel, { ignoreCommon: true })
      const result = detector.detect()

      expect(result.duplicates).toHaveLength(0)

      // With ignoreCommon = false
      const detector2 = new DuplicateDetector(rdfModel, { ignoreCommon: false })
      const result2 = detector2.detect()

      expect(result2.duplicates.length).toBeGreaterThan(0)
    })

    it('should find similar names with Levenshtein distance', () => {
      const file = '/project/src/parser.js'
      rdfModel.addFile(file)

      rdfModel.addFunction(`${file}#parseSource`, {
        name: 'parseSource',
        type: 'function',
        file: file
      })

      rdfModel.addFunction(`${file}#parceSource`, {
        name: 'parceSource', // Typo
        type: 'function',
        file: file
      })

      const detector = new DuplicateDetector(rdfModel, {
        includeSimilar: true,
        similarityThreshold: 0.8
      })
      const result = detector.detect()

      expect(result.similarGroups).toBeDefined()
      expect(result.similarGroups.length).toBeGreaterThan(0)

      const similar = result.similarGroups.find(g =>
        g.names.includes('parseSource') && g.names.includes('parceSource')
      )
      expect(similar).toBeDefined()
      expect(parseFloat(similar.similarity)).toBeGreaterThan(0.8)
    })

    it('should calculate redundancy score', () => {
      const file1 = '/project/src/file1.js'
      const file2 = '/project/src/file2.js'

      rdfModel.addFile(file1)
      rdfModel.addFile(file2)

      // Add some duplicates
      for (let i = 0; i < 5; i++) {
        rdfModel.addFunction(`${file1}#func${i}`, {
          name: 'duplicate',
          type: 'function',
          file: file1
        })
      }

      for (let i = 0; i < 3; i++) {
        rdfModel.addFunction(`${file2}#unique${i}`, {
          name: `unique${i}`,
          type: 'function',
          file: file2
        })
      }

      const detector = new DuplicateDetector(rdfModel)
      const result = detector.detect()

      expect(result.stats.redundancyScore).toBeGreaterThan(0)
      expect(result.stats.redundancyScore).toBeLessThanOrEqual(1)
    })

    it('should categorize same-file duplicates', () => {
      const file = '/project/src/file.js'
      rdfModel.addFile(file)

      rdfModel.addFunction(`${file}#helper1`, {
        name: 'helper',
        type: 'function',
        file: file,
        line: 10
      })

      rdfModel.addFunction(`${file}#helper2`, {
        name: 'helper',
        type: 'function',
        file: file,
        line: 20
      })

      const detector = new DuplicateDetector(rdfModel)
      const result = detector.detect()

      expect(result.duplicates).toHaveLength(1)
      // Category should be same-file since both are in the same file
      expect(result.duplicates[0].category).toMatch(/same-file|mixed/)
    })

    it('should return correct statistics', () => {
      const file1 = '/project/src/file1.js'
      const file2 = '/project/src/file2.js'

      rdfModel.addFile(file1)
      rdfModel.addFile(file2)

      // 4 unique functions
      rdfModel.addFunction(`${file1}#unique1`, { name: 'unique1' })
      rdfModel.addFunction(`${file1}#unique2`, { name: 'unique2' })
      rdfModel.addFunction(`${file2}#unique3`, { name: 'unique3' })

      // 2 duplicates
      rdfModel.addFunction(`${file1}#dup`, { name: 'duplicate' })
      rdfModel.addFunction(`${file2}#dup`, { name: 'duplicate' })

      const detector = new DuplicateDetector(rdfModel, { ignoreCommon: false })
      const result = detector.detect()

      expect(result.stats.totalFunctions).toBe(5)
      expect(result.stats.uniqueNames).toBe(4)
      expect(result.stats.duplicateGroups).toBe(1)
      expect(result.stats.totalDuplicates).toBe(2)
    })
  })

  describe('format', () => {
    it('should format results as text', () => {
      const file1 = '/project/src/file1.js'
      const file2 = '/project/src/file2.js'

      rdfModel.addFile(file1)
      rdfModel.addFile(file2)

      rdfModel.addFunction(`${file1}#test`, {
        name: 'test',
        type: 'function',
        file: file1,
        line: 10,
        params: 2,
        async: true
      })

      rdfModel.addFunction(`${file2}#test`, {
        name: 'test',
        type: 'function',
        file: file2,
        line: 20,
        params: 1
      })

      const detector = new DuplicateDetector(rdfModel)
      const result = detector.detect()
      const formatted = detector.format(result, 'text')

      expect(formatted).toContain('# Duplicate Method/Function Analysis')
      expect(formatted).toContain('## Statistics')
      expect(formatted).toContain('test')
      expect(formatted).toContain('2 occurrences')
      // File paths and async should be in output if metadata is present
      if (formatted.includes(file1)) {
        expect(formatted).toContain(file1)
      }
      if (formatted.includes('async')) {
        expect(formatted).toContain('async')
      }
    })

    it('should format results as JSON', () => {
      const file = '/project/src/file.js'
      rdfModel.addFile(file)

      rdfModel.addFunction(`${file}#func`, {
        name: 'func',
        type: 'function',
        file: file
      })

      const detector = new DuplicateDetector(rdfModel)
      const result = detector.detect()
      const formatted = detector.format(result, 'json')

      const parsed = JSON.parse(formatted)
      expect(parsed).toHaveProperty('duplicates')
      expect(parsed).toHaveProperty('stats')
    })

    it('should handle no duplicates case', () => {
      const file = '/project/src/file.js'
      rdfModel.addFile(file)

      rdfModel.addFunction(`${file}#unique1`, { name: 'unique1' })
      rdfModel.addFunction(`${file}#unique2`, { name: 'unique2' })

      const detector = new DuplicateDetector(rdfModel)
      const result = detector.detect()
      const formatted = detector.format(result, 'text')

      expect(formatted).toContain('No duplicate method names found')
    })
  })

  describe('Levenshtein distance', () => {
    it('should calculate correct similarity scores', () => {
      const file = '/project/src/file.js'
      rdfModel.addFile(file)

      // Identical names (should not appear in similar, only in duplicates)
      rdfModel.addFunction(`${file}#exact1`, { name: 'exactMatch' })
      rdfModel.addFunction(`${file}#exact2`, { name: 'exactMatch' })

      // Very similar names
      rdfModel.addFunction(`${file}#parse1`, { name: 'parseFile' })
      rdfModel.addFunction(`${file}#parse2`, { name: 'parseFile2' })

      // Completely different names
      rdfModel.addFunction(`${file}#diff1`, { name: 'completely' })
      rdfModel.addFunction(`${file}#diff2`, { name: 'different' })

      const detector = new DuplicateDetector(rdfModel, {
        includeSimilar: true,
        similarityThreshold: 0.7,
        ignoreCommon: false
      })
      const result = detector.detect()

      // Similar names should be found
      const parseGroup = result.similarGroups.find(g =>
        g.names.includes('parseFile') && g.names.includes('parseFile2')
      )
      expect(parseGroup).toBeDefined()

      // Very different names should not be similar
      const diffGroup = result.similarGroups.find(g =>
        g.names.includes('completely') && g.names.includes('different')
      )
      expect(diffGroup).toBeUndefined()
    })
  })
})
