import { describe, it, expect } from 'vitest'
import { DependencyParser } from '../../../src/analyzers/DependencyParser.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('DependencyParser', () => {
  const parser = new DependencyParser()
  const erfRoot = path.resolve(__dirname, '../../..')

  describe('parseFile', () => {
    it('should parse GraphBuilder.js and extract imports', async () => {
      const filePath = path.join(erfRoot, 'src/analyzers/GraphBuilder.js')
      const result = await parser.parseFile(filePath)

      expect(result.imports).toBeDefined()
      expect(result.imports.length).toBeGreaterThan(0)

      // Should import FileScanner
      const fileScannerImport = result.imports.find(imp =>
        imp.source.includes('FileScanner')
      )
      expect(fileScannerImport).toBeDefined()
      expect(fileScannerImport.type).toBe('ImportDeclaration')

      // Should import DependencyParser
      const depParserImport = result.imports.find(imp =>
        imp.source.includes('DependencyParser')
      )
      expect(depParserImport).toBeDefined()

      // Should import RDFModel
      const rdfModelImport = result.imports.find(imp =>
        imp.source.includes('RDFModel')
      )
      expect(rdfModelImport).toBeDefined()
    })

    it('should resolve relative imports to absolute paths', async () => {
      const filePath = path.join(erfRoot, 'src/analyzers/GraphBuilder.js')
      const result = await parser.parseFile(filePath)

      const fileScannerImport = result.imports.find(imp =>
        imp.source.includes('FileScanner')
      )

      expect(fileScannerImport.resolved).toBeDefined()
      expect(path.isAbsolute(fileScannerImport.resolved)).toBe(true)
      expect(fileScannerImport.resolved.endsWith('FileScanner.js')).toBe(true)
    })

    it('should detect external package imports', async () => {
      const filePath = path.join(erfRoot, 'src/analyzers/GraphBuilder.js')
      const result = await parser.parseFile(filePath)

      const pathImport = result.imports.find(imp => imp.source === 'path')
      expect(pathImport).toBeDefined()
      expect(pathImport.resolved).toBeNull() // External packages don't resolve
    })

    it('should extract exports', async () => {
      const filePath = path.join(erfRoot, 'src/analyzers/GraphBuilder.js')
      const result = await parser.parseFile(filePath)

      expect(result.exports).toBeDefined()
      expect(result.exports.length).toBeGreaterThan(0)

      // Should export GraphBuilder class
      const graphBuilderExport = result.exports.find(exp =>
        exp.exported === 'GraphBuilder'
      )
      expect(graphBuilderExport).toBeDefined()
    })

    it('should handle files with no dependencies', async () => {
      // RDFModel should only import rdf-ext and namespace packages
      const filePath = path.join(erfRoot, 'src/graph/RDFModel.js')
      const result = await parser.parseFile(filePath)

      expect(result.imports).toBeDefined()
      expect(result.exports).toBeDefined()

      // All imports should be external packages
      const localImports = result.imports.filter(imp => imp.resolved !== null)
      expect(localImports.length).toBe(0)
    })

    it('should cache parsed results', async () => {
      const filePath = path.join(erfRoot, 'src/analyzers/FileScanner.js')

      // First parse
      const result1 = await parser.parseFile(filePath)

      // Second parse should use cache
      const result2 = await parser.parseFile(filePath)

      expect(result1).toEqual(result2)
    })
  })

  describe('parseSource', () => {
    it('should parse ES module syntax', () => {
      const source = `
        import { foo } from './foo.js'
        export class Bar {}
      `
      const filePath = '/test/file.js'

      const result = parser.parseSource(source, filePath)

      expect(result.imports.length).toBe(1)
      expect(result.exports.length).toBe(1)
    })

    it('should parse CommonJS syntax', () => {
      const source = `
        const foo = require('./foo.js')
        module.exports = { bar: 'baz' }
      `
      const filePath = '/test/file.js'

      const result = parser.parseSource(source, filePath)

      expect(result.imports.some(imp => imp.type === 'require')).toBe(true)
      expect(result.exports.length).toBeGreaterThan(0)
    })

    it('should handle dynamic imports', () => {
      const source = `
        const mod = await import('./dynamic.js')
      `
      const filePath = '/test/file.js'

      const result = parser.parseSource(source, filePath)

      expect(result.imports.length).toBe(1)
      expect(result.imports[0].type).toBe('ImportExpression')
    })

    it('should extract named imports', () => {
      const source = `
        import { foo, bar as baz } from './module.js'
      `
      const filePath = '/test/file.js'

      const result = parser.parseSource(source, filePath)

      expect(result.imports[0].imported).toEqual(['foo', 'bar'])
    })
  })
})
