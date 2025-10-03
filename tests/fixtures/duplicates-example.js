/**
 * Duplicates fixture - Contains duplicate method names from actual erf codebase
 * Used for testing duplicate detection
 */

// Duplicate of RDFModel.addFile - same name, different signature
export function addFile(filePath, options) {
  console.log('Duplicate addFile in test fixture')
  return { path: filePath, ...options }
}

// Duplicate of DependencyParser.parseFile - same name
export async function parseFile(path) {
  console.log('Duplicate parseFile in test fixture')
  return { imports: [], exports: [] }
}

// Duplicate of GraphBuilder.buildGraph - same name
export async function buildGraph(directory) {
  console.log('Duplicate buildGraph in test fixture')
  return { nodes: [], edges: [] }
}

// Duplicate of DeadCodeDetector.detect - same name
export function detect() {
  console.log('Duplicate detect in test fixture')
  return { deadFiles: [], reachableFiles: [] }
}

// Class with duplicate method names from actual codebase
export class TestAnalyzer {
  // Duplicate of RDFModel.getStats
  getStats() {
    return { total: 0 }
  }

  // Duplicate of GraphBuilder.export
  async export(format) {
    return JSON.stringify({ format })
  }

  // Similar name to RDFModel.serialize (for similarity testing)
  serialise() {
    return 'British spelling version'
  }
}

// Another class with duplicates
export class AnotherAnalyzer {
  // Another getStats - cross-class duplicate
  getStats() {
    return { count: 0 }
  }

  // Another detect - cross-class duplicate
  detect() {
    return []
  }
}

// Regular functions with duplicate names (cross-file)
export function handleRequest() {
  return 'Handling request in fixture'
}

export function processData() {
  return 'Processing data in fixture'
}

// Similar names for fuzzy matching
export function parseSource() {
  return 'parseSource'
}

export function parseSourceCode() {
  return 'parseSourceCode'
}

export function parceSource() {
  // Intentional typo for similarity testing
  return 'parceSource'
}
