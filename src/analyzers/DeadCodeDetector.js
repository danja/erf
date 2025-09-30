/**
 * DeadCodeDetector - Identifies unreachable code in dependency graph
 *
 * Uses graph traversal from entry points to find files, functions,
 * and modules that are never imported or called.
 */
export class DeadCodeDetector {
  constructor(rdfModel) {
    this.rdfModel = rdfModel
    this.reachable = new Set()
    this.visited = new Set()
  }

  /**
   * Analyze graph and detect dead code
   * @returns {Object} Dead code analysis results
   */
  detect() {
    console.log('Detecting dead code...')

    // Phase 1: Mark all reachable nodes from entry points
    const entryPoints = this.rdfModel.queryEntryPoints()

    if (entryPoints.length === 0) {
      console.warn('No entry points found. Cannot perform dead code analysis.')
      return {
        deadFiles: [],
        deadExports: [],
        reachableFiles: [],
        stats: {
          totalFiles: 0,
          reachableFiles: 0,
          deadFiles: 0,
          reachabilityPercentage: 0
        }
      }
    }

    console.log(`Starting traversal from ${entryPoints.length} entry points`)

    // Traverse from each entry point
    for (const entryPoint of entryPoints) {
      this._traverseFromNode(entryPoint.id)
    }

    console.log(`Marked ${this.reachable.size} nodes as reachable`)

    // Phase 2: Identify unreachable files
    const allFiles = this.rdfModel.queryNodesByType('file')
    const deadFiles = []
    const reachableFiles = []

    for (const file of allFiles) {
      if (this.reachable.has(file.id)) {
        reachableFiles.push({
          path: file.id,
          metadata: this.rdfModel.getNodeMetadata(file.id)
        })
      } else {
        deadFiles.push({
          path: file.id,
          metadata: this.rdfModel.getNodeMetadata(file.id),
          reason: 'Not reachable from any entry point'
        })
      }
    }

    // Phase 3: Identify unused exports
    const deadExports = this._findUnusedExports()

    // Phase 4: Calculate statistics
    const stats = {
      totalFiles: allFiles.length,
      reachableFiles: reachableFiles.length,
      deadFiles: deadFiles.length,
      unusedExports: deadExports.length,
      reachabilityPercentage: allFiles.length > 0
        ? Math.round((reachableFiles.length / allFiles.length) * 100)
        : 0
    }

    console.log('Dead code detection complete:')
    console.log(`  - Total files: ${stats.totalFiles}`)
    console.log(`  - Reachable files: ${stats.reachableFiles}`)
    console.log(`  - Dead files: ${stats.deadFiles}`)
    console.log(`  - Unused exports: ${stats.unusedExports}`)
    console.log(`  - Reachability: ${stats.reachabilityPercentage}%`)

    return {
      deadFiles,
      deadExports,
      reachableFiles,
      stats
    }
  }

  /**
   * Get list of dead files only
   * @returns {Array} Dead file paths
   */
  getDeadFiles() {
    const result = this.detect()
    return result.deadFiles.map(f => f.path)
  }

  /**
   * Get list of unused exports
   * @returns {Array} Unused exports
   */
  getUnusedExports() {
    const result = this.detect()
    return result.deadExports
  }

  /**
   * Check if a specific file is dead
   * @param {string} filePath - File path to check
   * @returns {boolean} True if file is unreachable
   */
  isFileDead(filePath) {
    if (this.reachable.size === 0) {
      this.detect()
    }
    return !this.reachable.has(filePath)
  }

  /**
   * Get reachability path from entry point to a file
   * @param {string} filePath - Target file path
   * @returns {Array|null} Path from entry point, or null if unreachable
   */
  getReachabilityPath(filePath) {
    const entryPoints = this.rdfModel.queryEntryPoints()

    for (const entryPoint of entryPoints) {
      const path = this._findPath(entryPoint.id, filePath)
      if (path) {
        return path
      }
    }

    return null
  }

  // Private helper methods

  /**
   * Traverse graph from a node, marking all reachable nodes
   * @private
   */
  _traverseFromNode(nodeId) {
    // Avoid revisiting nodes
    if (this.visited.has(nodeId)) {
      return
    }

    this.visited.add(nodeId)
    this.reachable.add(nodeId)

    // Get all imports from this node
    const imports = this.rdfModel.queryImports(nodeId)

    for (const imported of imports) {
      // Don't traverse external modules
      const externalModules = this.rdfModel.queryExternalModules()
      const isExternal = externalModules.some(m => m.id === imported.id)

      if (!isExternal) {
        this._traverseFromNode(imported.id)
      }
    }

    // Also traverse function calls if available
    // (Future enhancement when we track function-level calls)
  }

  /**
   * Find unused exports across all files
   * @private
   */
  _findUnusedExports() {
    const unusedExports = []
    const allFiles = this.rdfModel.queryNodesByType('file')

    for (const file of allFiles) {
      const exports = this.rdfModel.queryExports(file.id)

      for (const exp of exports) {
        // Check if this export is imported anywhere
        const isUsed = this._isExportUsed(file.id, exp.name)

        if (!isUsed) {
          unusedExports.push({
            file: file.id,
            exportName: exp.name,
            reason: 'Exported but never imported'
          })
        }
      }
    }

    return unusedExports
  }

  /**
   * Check if an export from a file is imported anywhere
   * @private
   */
  _isExportUsed(filePath, exportName) {
    const allFiles = this.rdfModel.queryNodesByType('file')

    for (const file of allFiles) {
      if (file.id === filePath) continue

      const imports = this.rdfModel.queryImports(file.id)

      for (const imported of imports) {
        if (imported.id === filePath) {
          // File is imported, but we'd need more granular import data
          // to know if specific named export is used
          // For now, assume if file is imported, all exports are potentially used
          return true
        }
      }
    }

    return false
  }

  /**
   * Find path between two nodes using BFS
   * @private
   */
  _findPath(startId, targetId) {
    if (startId === targetId) {
      return [startId]
    }

    const queue = [[startId]]
    const visited = new Set([startId])

    while (queue.length > 0) {
      const path = queue.shift()
      const current = path[path.length - 1]

      const imports = this.rdfModel.queryImports(current)

      for (const imported of imports) {
        if (imported.id === targetId) {
          return [...path, imported.id]
        }

        if (!visited.has(imported.id)) {
          visited.add(imported.id)
          queue.push([...path, imported.id])
        }
      }
    }

    return null
  }

  /**
   * Generate detailed report
   * @returns {string} Human-readable dead code report
   */
  generateReport() {
    const result = this.detect()
    const lines = []

    lines.push('='.repeat(60))
    lines.push('Dead Code Analysis Report')
    lines.push('='.repeat(60))
    lines.push('')

    lines.push('Summary:')
    lines.push(`  Total files: ${result.stats.totalFiles}`)
    lines.push(`  Reachable files: ${result.stats.reachableFiles}`)
    lines.push(`  Dead files: ${result.stats.deadFiles}`)
    lines.push(`  Unused exports: ${result.stats.unusedExports}`)
    lines.push(`  Reachability: ${result.stats.reachabilityPercentage}%`)
    lines.push('')

    if (result.deadFiles.length > 0) {
      lines.push('Dead Files:')
      lines.push('-'.repeat(60))
      for (const deadFile of result.deadFiles) {
        lines.push(`  ${deadFile.path}`)
        lines.push(`    Reason: ${deadFile.reason}`)
      }
      lines.push('')
    } else {
      lines.push('No dead files found!')
      lines.push('')
    }

    if (result.deadExports.length > 0) {
      lines.push('Unused Exports:')
      lines.push('-'.repeat(60))
      for (const deadExport of result.deadExports.slice(0, 20)) {
        lines.push(`  ${deadExport.file}`)
        lines.push(`    Export: ${deadExport.exportName}`)
        lines.push(`    Reason: ${deadExport.reason}`)
      }
      if (result.deadExports.length > 20) {
        lines.push(`  ... and ${result.deadExports.length - 20} more`)
      }
      lines.push('')
    }

    lines.push('='.repeat(60))

    return lines.join('\n')
  }
}

export default DeadCodeDetector
