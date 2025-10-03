/**
 * DuplicateDetector - Identifies duplicate or similar method/function names
 *
 * Analyzes function names across the codebase to find:
 * - Exact duplicate names (potential redundancy)
 * - Similar names (typos or naming inconsistency)
 * - Cross-class duplicates vs same-class overloads
 */

export class DuplicateDetector {
  constructor(rdfModel, options = {}) {
    this.rdfModel = rdfModel
    this.options = {
      threshold: options.threshold || 2, // Minimum occurrences to report
      ignoreCommon: options.ignoreCommon !== false, // Ignore common names by default
      includeSimilar: options.includeSimilar || false, // Check for similar names
      similarityThreshold: options.similarityThreshold || 0.8, // Levenshtein similarity
      ...options
    }

    // Common method names to potentially ignore
    this.commonNames = new Set([
      'constructor', 'render', 'init', 'initialize', 'setup', 'destroy',
      'toString', 'valueOf', 'get', 'set', 'update', 'create', 'delete',
      'handle', 'process', 'execute'
    ])
  }

  /**
   * Detect duplicate function/method names
   * @returns {Object} Analysis results with duplicates and statistics
   */
  detect() {
    const functions = this.rdfModel.queryNodesByType('function')
    const nameGroups = new Map() // Map of name -> array of function info
    const bareNameGroups = new Map() // Map of bare name -> array of function info

    // Group functions by name
    for (const func of functions) {
      const metadata = this.rdfModel.getNodeMetadata(func.id)
      const fullName = metadata.label || metadata.name

      if (!fullName) continue

      // Extract bare name (e.g., "handleRequest" from "MyClass.handleRequest")
      const bareName = this._extractBareName(fullName)

      // Skip common names if configured
      if (this.options.ignoreCommon && this.commonNames.has(bareName.toLowerCase())) {
        continue
      }

      const functionInfo = {
        id: func.id,
        fullName,
        bareName,
        file: metadata.file,
        line: metadata.line,
        type: metadata.functionType || metadata.type, // 'function' or 'method'
        className: metadata.className,
        methodName: metadata.methodName,
        params: parseInt(metadata.params) || 0,
        async: metadata.async === 'true' || metadata.async === true,
        static: metadata.static === 'true' || metadata.static === true
      }

      // Group by bare name
      if (!bareNameGroups.has(bareName)) {
        bareNameGroups.set(bareName, [])
      }
      bareNameGroups.get(bareName).push(functionInfo)

      // Also group by full name for exact matching
      if (!nameGroups.has(fullName)) {
        nameGroups.set(fullName, [])
      }
      nameGroups.get(fullName).push(functionInfo)
    }

    // Find duplicates (groups with multiple occurrences)
    const duplicates = []
    for (const [name, occurrences] of bareNameGroups.entries()) {
      if (occurrences.length >= this.options.threshold) {
        duplicates.push({
          name,
          count: occurrences.length,
          occurrences: this._sortOccurrences(occurrences),
          category: this._categorize(occurrences)
        })
      }
    }

    // Sort by count descending
    duplicates.sort((a, b) => b.count - a.count)

    // Find similar names if enabled
    const similarGroups = this.options.includeSimilar
      ? this._findSimilarNames(bareNameGroups)
      : []

    // Calculate statistics
    const stats = {
      totalFunctions: functions.length,
      uniqueNames: bareNameGroups.size,
      duplicateGroups: duplicates.length,
      totalDuplicates: duplicates.reduce((sum, d) => sum + d.count, 0),
      similarGroups: similarGroups.length,
      redundancyScore: this._calculateRedundancyScore(duplicates, functions.length)
    }

    return {
      duplicates,
      similarGroups,
      stats
    }
  }

  /**
   * Extract bare method/function name from full name
   * @private
   */
  _extractBareName(fullName) {
    // Handle "ClassName.methodName" format
    const parts = fullName.split('.')
    return parts[parts.length - 1]
  }

  /**
   * Categorize duplicate occurrences
   * @private
   */
  _categorize(occurrences) {
    const classes = new Set()
    const files = new Set()
    let hasRegularFunctions = false
    let hasMethods = false

    for (const occ of occurrences) {
      if (occ.className) {
        classes.add(occ.className)
        hasMethods = true
      } else {
        hasRegularFunctions = true
      }
      if (occ.file) {
        files.add(occ.file)
      }
    }

    // Determine category
    if (classes.size === 1 && occurrences.length > 1 && !hasRegularFunctions) {
      return 'same-class-overload' // Same class, different methods (unusual in JS)
    } else if (classes.size > 1 && !hasRegularFunctions) {
      return 'cross-class' // Different classes with same method name
    } else if (files.size > 1 && hasRegularFunctions && !hasMethods) {
      return 'cross-file' // Regular functions across multiple files
    } else if (files.size === 1 && !hasMethods && !hasRegularFunctions) {
      return 'same-file' // Multiple occurrences in same file (file data missing)
    } else if (files.size === 1 && hasRegularFunctions && !hasMethods) {
      return 'same-file' // Multiple regular functions in same file
    } else {
      return 'mixed' // Mix of methods and functions, or missing file data
    }
  }

  /**
   * Sort occurrences by file and line
   * @private
   */
  _sortOccurrences(occurrences) {
    return occurrences.sort((a, b) => {
      if (a.file !== b.file) {
        return (a.file || '').localeCompare(b.file || '')
      }
      return (parseInt(a.line) || 0) - (parseInt(b.line) || 0)
    })
  }

  /**
   * Find similar function names using Levenshtein distance
   * @private
   */
  _findSimilarNames(bareNameGroups) {
    const names = Array.from(bareNameGroups.keys())
    const similarGroups = []

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const name1 = names[i]
        const name2 = names[j]
        const similarity = this._calculateSimilarity(name1, name2)

        if (similarity >= this.options.similarityThreshold && similarity < 1.0) {
          similarGroups.push({
            names: [name1, name2],
            similarity: similarity.toFixed(2),
            occurrences: [
              ...bareNameGroups.get(name1),
              ...bareNameGroups.get(name2)
            ]
          })
        }
      }
    }

    return similarGroups
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   * @private
   */
  _calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const distance = this._levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @private
   */
  _levenshteinDistance(str1, str2) {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Calculate redundancy score (0-1)
   * Higher score indicates more potential redundancy
   * @private
   */
  _calculateRedundancyScore(duplicates, totalFunctions) {
    if (totalFunctions === 0) return 0

    const duplicateCount = duplicates.reduce((sum, d) => sum + d.count, 0)
    const crossClassDuplicates = duplicates.filter(d => d.category === 'cross-class').length

    // Weight cross-class duplicates more heavily as they're more likely to be redundant
    const weightedScore = (duplicateCount + crossClassDuplicates * 2) / (totalFunctions * 2)

    return Math.min(weightedScore, 1.0)
  }

  /**
   * Format results for display
   * @param {Object} results - Detection results
   * @param {string} format - Output format ('text' or 'json')
   * @returns {string} Formatted output
   */
  format(results, format = 'text') {
    if (format === 'json') {
      return JSON.stringify(results, null, 2)
    }

    // Text format
    let output = '# Duplicate Method/Function Analysis\n\n'

    output += `## Statistics\n`
    output += `- Total Functions/Methods: ${results.stats.totalFunctions}\n`
    output += `- Unique Names: ${results.stats.uniqueNames}\n`
    output += `- Duplicate Groups: ${results.stats.duplicateGroups}\n`
    output += `- Total Duplicates: ${results.stats.totalDuplicates}\n`
    output += `- Redundancy Score: ${(results.stats.redundancyScore * 100).toFixed(1)}%\n\n`

    if (results.duplicates.length === 0) {
      output += '✅ No duplicate method names found.\n'
    } else {
      output += `## Duplicate Names (${results.duplicates.length} groups)\n\n`

      for (const dup of results.duplicates) {
        output += `### ${dup.name} (${dup.count} occurrences, ${dup.category})\n`

        for (const occ of dup.occurrences) {
          const location = occ.file ? `${occ.file}:${occ.line || '?'}` : 'unknown'
          const qualifiers = []
          if (occ.async) qualifiers.push('async')
          if (occ.static) qualifiers.push('static')
          const qualifierStr = qualifiers.length > 0 ? ` [${qualifiers.join(', ')}]` : ''

          output += `  - ${location} (${occ.fullName}, ${occ.params} params)${qualifierStr}\n`
        }
        output += '\n'
      }
    }

    if (results.similarGroups && results.similarGroups.length > 0) {
      output += `## Similar Names (${results.similarGroups.length} groups)\n\n`

      for (const sim of results.similarGroups) {
        output += `### ${sim.names.join(' / ')} (${(sim.similarity * 100).toFixed(0)}% similar)\n`
        for (const occ of sim.occurrences.slice(0, 3)) { // Show first 3
          const location = occ.file ? `${occ.file}:${occ.line || '?'}` : 'unknown'
          output += `  - ${location} (${occ.fullName})\n`
        }
        if (sim.occurrences.length > 3) {
          output += `  ... and ${sim.occurrences.length - 3} more\n`
        }
        output += '\n'
      }
    }

    return output
  }
}

export default DuplicateDetector
