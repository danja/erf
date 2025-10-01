import path from 'path'
import { FileScanner } from './FileScanner.js'
import { DependencyParser } from './DependencyParser.js'
import { RDFModel } from '../graph/RDFModel.js'
import logger from '../utils/Logger.js'

/**
 * GraphBuilder - Constructs dependency graph from codebase
 *
 * Orchestrates FileScanner and DependencyParser to build complete
 * RDF dependency graph with all nodes and edges.
 */
export class GraphBuilder {
  constructor(config) {
    this.config = config
    this.rdfModel = new RDFModel()
    this.fileScanner = new FileScanner(config)
    this.dependencyParser = new DependencyParser()
  }

  /**
   * Build complete dependency graph for a project
   * @param {string} rootDir - Root directory to analyze
   * @returns {Promise<RDFModel>} Populated RDF graph
   */
  async buildGraph(rootDir) {
    console.log(`Building dependency graph for: ${rootDir}`)

    // Phase 1: Scan filesystem
    console.log('Phase 1: Scanning filesystem...')
    const scanResult = await this.fileScanner.scan(rootDir)
    const files = scanResult.files || []
    console.log(`Found ${files.length} JavaScript files`)

    // Phase 2: Parse all files and extract dependencies
    console.log('Phase 2: Parsing files and extracting dependencies...')
    const parsedFiles = []

    for (const file of files) {
      try {
        const dependencies = await this.dependencyParser.parseFile(file.path)
        parsedFiles.push({
          file,
          dependencies
        })
      } catch (error) {
        logger.error(`Failed to parse ${file.path}: ${error.message}`)
        // Still add file with parse error flag
        parsedFiles.push({
          file,
          dependencies: {
            imports: [],
            exports: [],
            calls: [],
            functions: [],
            error: error.message
          }
        })
      }
    }

    console.log(`Successfully parsed ${parsedFiles.length} files`)

    // Phase 3: Build RDF graph
    console.log('Phase 3: Building RDF graph...')

    // Add all files as nodes
    for (const { file, dependencies } of parsedFiles) {
      this.rdfModel.addFile(file.path, {
        size: file.size,
        mtime: file.modified,
        loc: await this._countLOC(file.path),
        parseError: dependencies.error ? true : false,
        parseErrorMessage: dependencies.error || undefined
      })
    }

    // Build set of scanned file paths for validation
    const scannedFiles = new Set(files.map(f => f.path))

    // Add all dependencies as edges
    for (const { file, dependencies } of parsedFiles) {
      // Add imports
      for (const imp of dependencies.imports) {
        const targetPath = imp.resolved || imp.source

        // Debug log for null source
        if (!imp.source) {
          logger.debug(`Import with null source in ${file.path}: type=${imp.type}, dynamic=${imp.dynamic}`)
        }

        // Determine if external package
        const isExternal = this._isExternalPackage(imp.source)

        if (isExternal) {
          // Add external module node
          this.rdfModel.addModule(imp.source, true)
          this.rdfModel.addImport(file.path, imp.source, {
            line: imp.loc?.start?.line,
            type: imp.type
          })
        } else if (imp.resolvedPath?.path) {
          if (scannedFiles.has(imp.resolvedPath.path)) {
            // Target file exists - add normal import
            this.rdfModel.addImport(file.path, imp.resolvedPath.path, {
              line: imp.loc?.start?.line,
              type: imp.type
            })
          } else {
            // Target file doesn't exist - create dead node
            console.warn(`Import to non-existent file: ${imp.resolvedPath.path} (from ${file.path})`)
            this.rdfModel.addFile(imp.resolvedPath.path, { isMissing: true })
            this.rdfModel.addImport(file.path, imp.resolvedPath.path, {
              line: imp.loc?.start?.line,
              type: imp.type
            })
          }
        }
      }

      // Add exports
      for (const exp of dependencies.exports) {
        if (exp.type === 'named' && exp.specifiers) {
          // Named exports - add each specifier
          for (const specifier of exp.specifiers) {
            this.rdfModel.addExport(file.path, specifier, {
              type: 'named',
              line: exp.loc?.start?.line
            })
          }
        } else if (exp.type === 'default') {
          // Default export
          this.rdfModel.addExport(file.path, 'default', {
            type: 'default',
            line: exp.loc?.start?.line
          })
        } else if (exp.type === 'all') {
          // Re-export all
          this.rdfModel.addExport(file.path, '*', {
            type: 'all',
            source: exp.source,
            line: exp.loc?.start?.line
          })
        } else if (exp.type === 'commonjs') {
          // CommonJS export
          const exportName = exp.property || 'module.exports'
          this.rdfModel.addExport(file.path, exportName, {
            type: 'commonjs',
            kind: exp.kind,
            line: exp.loc?.start?.line
          })
        }
      }

      // Add function calls (if we extract them in future)
      for (const call of dependencies.calls || []) {
        if (call.resolved) {
          this.rdfModel.addCall(file.path, call.resolved, {
            line: call.loc?.start?.line
          })
        }
      }

      // Add functions and methods
      for (const func of dependencies.functions || []) {
        const functionId = `${file.path}#${func.name}`
        this.rdfModel.addFunction(functionId, {
          name: func.name,
          type: func.type,
          file: file.path,
          line: func.loc?.start?.line,
          params: func.params,
          async: func.async,
          generator: func.generator,
          static: func.static,
          kind: func.kind,
          className: func.className,
          methodName: func.methodName
        })
      }
    }

    // Phase 4: Mark entry points
    console.log('Phase 4: Identifying entry points...')
    await this._markEntryPoints(rootDir)

    // Print statistics
    const stats = this.rdfModel.getStats()
    console.log('Graph built successfully:')
    console.log(`  - Files: ${stats.files}`)
    console.log(`  - Modules: ${stats.modules}`)
    console.log(`  - Functions: ${stats.functions}`)
    console.log(`  - Imports: ${stats.imports}`)
    console.log(`  - Exports: ${stats.exports}`)
    console.log(`  - Entry points: ${stats.entryPoints}`)
    console.log(`  - External modules: ${stats.externalModules}`)
    console.log(`  - Total triples: ${stats.totalTriples}`)

    return this.rdfModel
  }

  /**
   * Get the built RDF model
   * @returns {RDFModel} The dependency graph
   */
  getGraph() {
    return this.rdfModel
  }

  /**
   * Export graph in various formats
   * @param {string} format - Format: 'json', 'rdf', 'stats'
   * @returns {string|Object} Serialized graph
   */
  async export(format = 'json') {
    switch (format) {
      case 'json':
        return this._exportJSON()
      case 'rdf':
        return await this.rdfModel.serialize()
      case 'stats':
        return this.rdfModel.getStats()
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  // Private helper methods

  /**
   * Mark entry points in the graph based on config
   * @private
   */
  async _markEntryPoints(rootDir) {
    const entryPoints = this.config.entryPoints || []

    for (const entryPoint of entryPoints) {
      const absolutePath = path.resolve(rootDir, entryPoint)
      const fileUri = `file://${absolutePath}`

      // Check if entry point exists in graph
      const files = this.rdfModel.queryNodesByType('file')
      const fileExists = files.some(f => f.id === fileUri)

      if (fileExists) {
        this.rdfModel.markAsEntryPoint(absolutePath)
        console.log(`  Marked entry point: ${entryPoint}`)
      } else {
        console.warn(`  Entry point not found in graph: ${entryPoint}`)
      }
    }

    // If no entry points configured, try to infer from package.json
    if (entryPoints.length === 0) {
      const inferred = await this._inferEntryPointsFromPackageJson(rootDir)

      // If still no entry points, find files with no incoming imports
      if (inferred === 0) {
        console.log('  No configured entry points, auto-detecting files with no incoming imports...')
        const autoDetected = this._autoDetectEntryPoints()

        if (autoDetected === 0) {
          console.log('  No entry points found, treating all files as potential entry points')
          const files = this.rdfModel.queryNodesByType('file')
          for (const file of files) {
            this.rdfModel.markAsEntryPoint(file.id)
          }
        } else {
          console.log(`  Auto-detected ${autoDetected} entry point(s) based on import analysis`)
        }
      }
    } else {
      // Config has entry points, but also auto-detect additional ones
      console.log('  Also checking for files with no incoming imports...')
      this._autoDetectEntryPoints()
    }
  }

  /**
   * Auto-detect entry points by finding files with no incoming imports
   * These are files that no other file depends on, likely true entry points
   * @private
   * @returns {number} Number of entry points auto-detected
   */
  _autoDetectEntryPoints() {
    const files = this.rdfModel.queryNodesByType('file')
    const allImportTargets = new Set()

    // Collect all files that are imported by other files
    for (const file of files) {
      const imports = this.rdfModel.queryImports(file.id)
      for (const imported of imports) {
        // Only track imports to other source files (not external modules)
        if (imported.id.startsWith('file://')) {
          allImportTargets.add(imported.id)
        }
      }
    }

    // Files with no incoming imports are potential entry points
    let count = 0
    for (const file of files) {
      if (!allImportTargets.has(file.id)) {
        // This file is not imported by any other file
        this.rdfModel.markAsEntryPoint(file.id)
        count++

        // Extract just the filename for cleaner logging
        const filename = file.id.replace('file://', '').split('/').pop()
        console.log(`  Auto-detected entry point: ${filename}`)
      }
    }

    return count
  }

  /**
   * Infer entry points from package.json
   * @private
   * @returns {number} Number of entry points inferred
   */
  async _inferEntryPointsFromPackageJson(rootDir) {
    try {
      const packageJsonPath = path.join(rootDir, 'package.json')
      const { default: fs } = await import('fs/promises')
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

      const inferredEntryPoints = []

      // Check main field
      if (packageJson.main) {
        const mainPath = path.resolve(rootDir, packageJson.main)
        inferredEntryPoints.push(mainPath)
      }

      // Check bin field
      if (packageJson.bin) {
        if (typeof packageJson.bin === 'string') {
          const binPath = path.resolve(rootDir, packageJson.bin)
          inferredEntryPoints.push(binPath)
        } else {
          for (const binFile of Object.values(packageJson.bin)) {
            const binPath = path.resolve(rootDir, binFile)
            inferredEntryPoints.push(binPath)
          }
        }
      }

      // Check exports field
      if (packageJson.exports) {
        const extractExports = (exports, basePath = '') => {
          if (typeof exports === 'string') {
            inferredEntryPoints.push(path.resolve(rootDir, exports))
          } else if (typeof exports === 'object') {
            for (const [key, value] of Object.entries(exports)) {
              if (key.startsWith('.')) {
                extractExports(value, key)
              } else if (typeof value === 'string') {
                inferredEntryPoints.push(path.resolve(rootDir, value))
              }
            }
          }
        }
        extractExports(packageJson.exports)
      }

      // Mark all inferred entry points
      let markedCount = 0
      for (const entryPoint of inferredEntryPoints) {
        const files = this.rdfModel.queryNodesByType('file')
        const fileExists = files.some(f => f.id === entryPoint)

        if (fileExists) {
          this.rdfModel.markAsEntryPoint(entryPoint)
          console.log(`  Inferred entry point: ${path.relative(rootDir, entryPoint)}`)
          markedCount++
        }
      }

      if (markedCount === 0) {
        console.warn('  No entry points found in package.json')
      }

      return markedCount
    } catch (error) {
      console.warn(`  Could not infer entry points from package.json: ${error.message}`)
      return 0
    }
  }

  /**
   * Check if a module path is an external package
   * @private
   */
  _isExternalPackage(modulePath) {
    // Handle null/undefined (dynamic imports)
    if (!modulePath) return false

    // External if doesn't start with . or /
    return !modulePath.startsWith('.') && !modulePath.startsWith('/')
  }

  /**
   * Count lines of code in a file
   * @private
   */
  async _countLOC(filePath) {
    try {
      // Use fs/promises for async file reading in ES module context
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf8')

      // Split into lines and filter out empty lines and comments
      const lines = content.split('\n')

      let loc = 0
      for (const line of lines) {
        const trimmed = line.trim()
        // Count non-empty lines that aren't just comments
        if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
          loc++
        }
      }

      return loc
    } catch (error) {
      logger.warn(`Could not count LOC for ${filePath}: ${error.message}`)
      return 0
    }
  }

  /**
   * Export graph as JSON
   * @private
   */
  _exportJSON() {
    const files = this.rdfModel.queryNodesByType('file')
    const modules = this.rdfModel.queryNodesByType('module')
    const entryPoints = this.rdfModel.queryEntryPoints()
    const externalModules = this.rdfModel.queryExternalModules()

    const nodes = []
    const edges = []

    // Add file nodes
    for (const file of files) {
      const metadata = this.rdfModel.getNodeMetadata(file.id)
      const imports = this.rdfModel.queryImports(file.id)
      const exports = this.rdfModel.queryExports(file.id)
      const dependents = this.rdfModel.queryDependents(file.id)

      nodes.push({
        id: file.id,
        type: 'file',
        metadata,
        isEntryPoint: entryPoints.some(ep => ep.id === file.id),
        isMissing: metadata.isMissing === 'true' || metadata.isMissing === true,
        hasParseError: metadata.parseError === 'true' || metadata.parseError === true,
        parseErrorMessage: metadata.parseErrorMessage,
        importCount: imports.length,
        exportCount: exports.length,
        dependentCount: dependents.length,
        size: parseInt(metadata.size) || 0,
        loc: parseInt(metadata.loc) || 0
      })

      // Add import edges
      for (const imp of imports) {
        edges.push({
          from: file.id,
          to: imp.id,
          type: 'imports'
        })
      }
    }

    // Add external module nodes
    for (const mod of externalModules) {
      nodes.push({
        id: mod.id,
        type: 'external-module',
        isExternal: true
      })
    }

    return {
      nodes,
      edges,
      stats: this.rdfModel.getStats()
    }
  }
}

export default GraphBuilder
