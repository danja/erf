import { describe, it, expect, beforeEach } from 'vitest'
import { RDFModel } from '../../../src/graph/RDFModel.js'

describe('RDFModel', () => {
  let model

  beforeEach(() => {
    model = new RDFModel()
  })

  describe('addFile', () => {
    it('should add a file node to the graph', () => {
      const filePath = '/test/file.js'
      const node = model.addFile(filePath, { size: 1024, loc: 50 })

      expect(node).toBeDefined()
      expect(node.value).toBe(filePath)

      const files = model.queryNodesByType('file')
      expect(files.length).toBe(1)
      expect(files[0].id).toBe(filePath)
    })

    it('should store file metadata', () => {
      const filePath = '/test/file.js'
      const mtime = new Date()

      model.addFile(filePath, { size: 1024, mtime, loc: 50 })

      const metadata = model.getNodeMetadata(filePath)
      // RDF literals are returned as strings
      expect(metadata.size).toBe(1024)
      expect(metadata.loc).toBe(50)
      expect(metadata.lastModified).toContain(mtime.getFullYear().toString())
    })
  })

  describe('addModule', () => {
    it('should add a module node', () => {
      const modulePath = '/test/module.js'
      model.addModule(modulePath)

      const modules = model.queryNodesByType('module')
      expect(modules.length).toBe(1)
      expect(modules[0].id).toBe(modulePath)
    })

    it('should mark external modules', () => {
      model.addModule('express', true)

      const externalModules = model.queryExternalModules()
      expect(externalModules.length).toBe(1)
      expect(externalModules[0].id).toBe('express')
    })
  })

  describe('addFunction', () => {
    it('should add a function node with metadata', () => {
      const functionId = '/test/file.js#myFunction'
      model.addFunction(functionId, {
        name: 'myFunction',
        loc: 20,
        complexity: 5
      })

      const functions = model.queryNodesByType('function')
      expect(functions.length).toBe(1)

      const metadata = model.getNodeMetadata(functionId)
      expect(metadata.label).toBe('myFunction')
      expect(metadata.loc).toBe(20)
      expect(metadata.complexity).toBe(5)
    })
  })

  describe('addImport', () => {
    it('should create import relationship between files', () => {
      const from = '/test/a.js'
      const to = '/test/b.js'

      model.addFile(from)
      model.addFile(to)
      model.addImport(from, to)

      const imports = model.queryImports(from)
      expect(imports.length).toBe(1)
      expect(imports[0].id).toBe(to)
    })

    it('should store import metadata', () => {
      const from = '/test/a.js'
      const to = '/test/b.js'

      model.addFile(from)
      model.addFile(to)
      model.addImport(from, to, { line: 5, type: 'ImportDeclaration' })

      // Import metadata is stored as reified statement
      const triples = model.getNodeTriples(from)
      expect(triples.length).toBeGreaterThan(0)
    })
  })

  describe('addExport', () => {
    it('should add export information', () => {
      const filePath = '/test/file.js'
      model.addFile(filePath)
      model.addExport(filePath, 'myExport', { type: 'named', line: 10 })

      const exports = model.queryExports(filePath)
      expect(exports.length).toBe(1)
      expect(exports[0].name).toBe('myExport')
    })
  })

  describe('markAsEntryPoint', () => {
    it('should mark a node as entry point', () => {
      const filePath = '/test/index.js'
      model.addFile(filePath)
      model.markAsEntryPoint(filePath)

      const entryPoints = model.queryEntryPoints()
      expect(entryPoints.length).toBe(1)
      expect(entryPoints[0].id).toBe(filePath)
    })
  })

  describe('getStats', () => {
    it('should return graph statistics', () => {
      model.addFile('/test/a.js')
      model.addFile('/test/b.js')
      model.addModule('express', true)
      model.addImport('/test/a.js', '/test/b.js')
      model.markAsEntryPoint('/test/a.js')

      const stats = model.getStats()

      expect(stats.files).toBe(2)
      expect(stats.modules).toBe(1)
      expect(stats.imports).toBe(1)
      expect(stats.entryPoints).toBe(1)
      expect(stats.externalModules).toBe(1)
      expect(stats.totalTriples).toBeGreaterThan(0)
    })

    it('should return zero stats for empty graph', () => {
      const stats = model.getStats()

      expect(stats.files).toBe(0)
      expect(stats.modules).toBe(0)
      expect(stats.imports).toBe(0)
    })
  })

  describe('serialize', () => {
    it('should serialize graph to N-Quads format', () => {
      model.addFile('/test/file.js')
      model.addModule('express', true)

      const serialized = model.serialize()

      expect(serialized).toContain('/test/file.js')
      expect(serialized).toContain('express')
      expect(serialized.split('\n').length).toBeGreaterThan(0)
    })
  })

  describe('complex graph operations', () => {
    it('should handle multiple imports and exports', () => {
      const fileA = '/test/a.js'
      const fileB = '/test/b.js'
      const fileC = '/test/c.js'

      model.addFile(fileA)
      model.addFile(fileB)
      model.addFile(fileC)

      model.addImport(fileA, fileB)
      model.addImport(fileA, fileC)
      model.addExport(fileB, 'exportB')
      model.addExport(fileC, 'exportC')

      const importsFromA = model.queryImports(fileA)
      expect(importsFromA.length).toBe(2)

      const exportsFromB = model.queryExports(fileB)
      const exportsFromC = model.queryExports(fileC)
      expect(exportsFromB.length).toBe(1)
      expect(exportsFromC.length).toBe(1)
    })
  })
})
