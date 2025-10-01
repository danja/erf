import rdf from 'rdf-ext'
import namespace from '@rdfjs/namespace'

/**
 * RDFModel - Wrapper around RDF-Ext for erf dependency graph
 *
 * Provides convenience methods for building and querying an RDF graph
 * representing code structure, dependencies, and metrics.
 */
export class RDFModel {
  constructor() {
    this.dataset = rdf.dataset()

    // Define namespaces
    this.ns = {
      erf: namespace('http://purl.org/stuff/erf/'),
      code: namespace('http://purl.org/stuff/code/'),
      rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
      rdfs: namespace('http://www.w3.org/2000/01/rdf-schema#')
    }

    // Node type cache for quick lookups
    this.nodeCache = new Map()
  }

  /**
   * Add a file node to the graph
   * @param {string} filePath - Absolute file path
   * @param {Object} metadata - File metadata (size, mtime, etc.)
   * @returns {Object} Named node representing the file
   */
  addFile(filePath, metadata = {}) {
    const fileNode = this._createNode(filePath)

    // Type assertion
    this.addTriple(fileNode, this.ns.rdf.type, this.ns.erf.File)

    // Add metadata
    if (metadata.size) {
      this.addTriple(fileNode, this.ns.code.size, rdf.literal(metadata.size))
    }
    if (metadata.mtime) {
      this.addTriple(fileNode, this.ns.code.lastModified, rdf.literal(metadata.mtime.toISOString()))
    }
    if (metadata.loc) {
      this.addTriple(fileNode, this.ns.code.loc, rdf.literal(metadata.loc))
    }
    if (metadata.parseError !== undefined) {
      this.addTriple(fileNode, this.ns.erf.parseError, rdf.literal(metadata.parseError))
    }
    if (metadata.parseErrorMessage) {
      this.addTriple(fileNode, this.ns.erf.parseErrorMessage, rdf.literal(metadata.parseErrorMessage))
    }
    if (metadata.isMissing !== undefined) {
      this.addTriple(fileNode, this.ns.erf.isMissing, rdf.literal(metadata.isMissing))
    }

    this.nodeCache.set(filePath, { node: fileNode, type: 'file' })
    return fileNode
  }

  /**
   * Add a module node to the graph
   * @param {string} modulePath - Module identifier (file path or package name)
   * @param {boolean} isExternal - Whether this is an external package
   * @returns {Object} Named node representing the module
   */
  addModule(modulePath, isExternal = false) {
    const moduleNode = this._createNode(modulePath)

    // Type assertion
    this.addTriple(moduleNode, this.ns.rdf.type, this.ns.erf.Module)

    // Mark if external
    if (isExternal) {
      this.addTriple(moduleNode, this.ns.erf.isExternal, rdf.literal(true))
    }

    this.nodeCache.set(modulePath, { node: moduleNode, type: 'module', isExternal })
    return moduleNode
  }

  /**
   * Add a function node to the graph
   * @param {string} functionId - Unique function identifier (filePath#functionName)
   * @param {Object} metadata - Function metadata (loc, complexity, etc.)
   * @returns {Object} Named node representing the function
   */
  addFunction(functionId, metadata = {}) {
    const functionNode = this._createNode(functionId)

    // Type assertion
    this.addTriple(functionNode, this.ns.rdf.type, this.ns.erf.Function)

    // Add metadata
    if (metadata.name) {
      this.addTriple(functionNode, this.ns.rdfs.label, rdf.literal(metadata.name))
    }
    if (metadata.loc) {
      this.addTriple(functionNode, this.ns.code.loc, rdf.literal(metadata.loc))
    }
    if (metadata.complexity) {
      this.addTriple(functionNode, this.ns.code.complexity, rdf.literal(metadata.complexity))
    }

    this.nodeCache.set(functionId, { node: functionNode, type: 'function' })
    return functionNode
  }

  /**
   * Add a class node to the graph
   * @param {string} classId - Unique class identifier (filePath#className)
   * @param {Object} metadata - Class metadata
   * @returns {Object} Named node representing the class
   */
  addClass(classId, metadata = {}) {
    const classNode = this._createNode(classId)

    // Type assertion
    this.addTriple(classNode, this.ns.rdf.type, this.ns.erf.Class)

    // Add metadata
    if (metadata.name) {
      this.addTriple(classNode, this.ns.rdfs.label, rdf.literal(metadata.name))
    }
    if (metadata.loc) {
      this.addTriple(classNode, this.ns.code.loc, rdf.literal(metadata.loc))
    }

    this.nodeCache.set(classId, { node: classNode, type: 'class' })
    return classNode
  }

  /**
   * Add an import relationship between modules/files
   * @param {string|Object} fromId - Source identifier or node
   * @param {string|Object} toId - Target identifier or node
   * @param {Object} metadata - Import metadata (line number, type, etc.)
   */
  addImport(fromId, toId, metadata = {}) {
    const fromNode = this._getOrCreateNode(fromId)
    const toNode = this._getOrCreateNode(toId)

    this.addTriple(fromNode, this.ns.erf.imports, toNode)

    // Add metadata as reified statement if needed
    if (metadata.line || metadata.type) {
      const importNode = this._createNode(`${fromId}-imports-${toId}`)
      this.addTriple(importNode, this.ns.rdf.type, this.ns.erf.Import)
      this.addTriple(importNode, this.ns.erf.from, fromNode)
      this.addTriple(importNode, this.ns.erf.to, toNode)

      if (metadata.line) {
        this.addTriple(importNode, this.ns.code.line, rdf.literal(metadata.line))
      }
      if (metadata.type) {
        this.addTriple(importNode, this.ns.erf.importType, rdf.literal(metadata.type))
      }
    }
  }

  /**
   * Add an export relationship
   * @param {string|Object} fromId - Source identifier or node
   * @param {string} exportName - Name of the export
   * @param {Object} metadata - Export metadata
   */
  addExport(fromId, exportName, metadata = {}) {
    const fromNode = this._getOrCreateNode(fromId)
    const exportNode = this._createNode(`${fromId}#export:${exportName}`)

    this.addTriple(fromNode, this.ns.erf.exports, exportNode)
    this.addTriple(exportNode, this.ns.rdfs.label, rdf.literal(exportName))

    if (metadata.type) {
      this.addTriple(exportNode, this.ns.erf.exportType, rdf.literal(metadata.type))
    }
    if (metadata.line) {
      this.addTriple(exportNode, this.ns.code.line, rdf.literal(metadata.line))
    }
  }

  /**
   * Add a function call relationship
   * @param {string|Object} callerId - Calling function identifier or node
   * @param {string|Object} calleeId - Called function identifier or node
   * @param {Object} metadata - Call metadata
   */
  addCall(callerId, calleeId, metadata = {}) {
    const callerNode = this._getOrCreateNode(callerId)
    const calleeNode = this._getOrCreateNode(calleeId)

    this.addTriple(callerNode, this.ns.erf.calls, calleeNode)

    if (metadata.line) {
      const callNode = this._createNode(`${callerId}-calls-${calleeId}`)
      this.addTriple(callNode, this.ns.rdf.type, this.ns.erf.Call)
      this.addTriple(callNode, this.ns.erf.from, callerNode)
      this.addTriple(callNode, this.ns.erf.to, calleeNode)
      this.addTriple(callNode, this.ns.code.line, rdf.literal(metadata.line))
    }
  }

  /**
   * Add a reference relationship (variable reference, property access, etc.)
   * @param {string|Object} fromId - Source identifier or node
   * @param {string|Object} toId - Target identifier or node
   */
  addReference(fromId, toId) {
    const fromNode = this._getOrCreateNode(fromId)
    const toNode = this._getOrCreateNode(toId)

    this.addTriple(fromNode, this.ns.erf.references, toNode)
  }

  /**
   * Mark a node as an entry point
   * @param {string|Object} nodeId - Node identifier or node
   */
  markAsEntryPoint(nodeId) {
    const node = this._getOrCreateNode(nodeId)
    this.addTriple(node, this.ns.erf.isEntryPoint, rdf.literal(true))
  }

  /**
   * Add a generic triple to the dataset
   * @param {Object} subject - RDF subject node
   * @param {Object} predicate - RDF predicate node
   * @param {Object} object - RDF object node or literal
   */
  addTriple(subject, predicate, object) {
    const quad = rdf.quad(subject, predicate, object)
    this.dataset.add(quad)
  }

  /**
   * Query all nodes of a specific type
   * @param {string} type - Node type (file, module, function, class)
   * @returns {Array} Array of matching nodes with their identifiers
   */
  queryNodesByType(type) {
    const typeNode = this.ns.erf[type.charAt(0).toUpperCase() + type.slice(1)]
    const results = []

    for (const quad of this.dataset.match(null, this.ns.rdf.type, typeNode)) {
      results.push({
        node: quad.subject,
        id: quad.subject.value
      })
    }

    return results
  }

  /**
   * Query all imports for a given node
   * @param {string|Object} nodeId - Node identifier or node
   * @returns {Array} Array of imported nodes
   */
  queryImports(nodeId) {
    const node = this._getOrCreateNode(nodeId)
    const results = []

    for (const quad of this.dataset.match(node, this.ns.erf.imports, null)) {
      results.push({
        node: quad.object,
        id: quad.object.value
      })
    }

    return results
  }

  /**
   * Query all exports for a given node
   * @param {string|Object} nodeId - Node identifier or node
   * @returns {Array} Array of export information
   */
  queryExports(nodeId) {
    const node = this._getOrCreateNode(nodeId)
    const results = []

    for (const quad of this.dataset.match(node, this.ns.erf.exports, null)) {
      const exportNode = quad.object
      const labelQuad = [...this.dataset.match(exportNode, this.ns.rdfs.label, null)][0]

      results.push({
        node: exportNode,
        name: labelQuad ? labelQuad.object.value : null
      })
    }

    return results
  }

  /**
   * Query all dependents (files that import this node)
   * @param {string|Object} nodeId - Node identifier or node
   * @returns {Array} Array of dependent nodes
   */
  queryDependents(nodeId) {
    const node = this._getOrCreateNode(nodeId)
    const results = []

    // Find all nodes that import this node
    for (const quad of this.dataset.match(null, this.ns.erf.imports, node)) {
      results.push({
        node: quad.subject,
        id: quad.subject.value
      })
    }

    return results
  }

  /**
   * Query all entry points
   * @returns {Array} Array of entry point nodes
   */
  queryEntryPoints() {
    const results = []

    for (const quad of this.dataset.match(null, this.ns.erf.isEntryPoint, rdf.literal(true))) {
      results.push({
        node: quad.subject,
        id: quad.subject.value
      })
    }

    return results
  }

  /**
   * Query all external modules
   * @returns {Array} Array of external module nodes
   */
  queryExternalModules() {
    const results = []

    for (const quad of this.dataset.match(null, this.ns.erf.isExternal, rdf.literal(true))) {
      results.push({
        node: quad.subject,
        id: quad.subject.value
      })
    }

    return results
  }

  /**
   * Get all triples for a specific node
   * @param {string|Object} nodeId - Node identifier or node
   * @returns {Array} Array of quads where node is subject
   */
  getNodeTriples(nodeId) {
    const node = this._getOrCreateNode(nodeId)
    return [...this.dataset.match(node, null, null)]
  }

  /**
   * Get node metadata as object
   * @param {string|Object} nodeId - Node identifier or node
   * @returns {Object} Metadata object with properties
   */
  getNodeMetadata(nodeId) {
    const node = this._getOrCreateNode(nodeId)
    const metadata = { id: node.value }

    for (const quad of this.dataset.match(node, null, null)) {
      const predicate = quad.predicate.value
      const value = quad.object.value

      // Extract property name from namespace
      const propName = predicate.split('#')[1] || predicate.split('/').pop()
      metadata[propName] = value
    }

    return metadata
  }

  /**
   * Export dataset as N-Quads string
   * @returns {string} Serialized RDF in N-Quads format
   */
  serialize() {
    const quads = [...this.dataset]
    return quads.map(q => `${q.subject.value} ${q.predicate.value} ${q.object.value} .`).join('\n')
  }

  /**
   * Get statistics about the graph
   * @returns {Object} Graph statistics
   */
  getStats() {
    const stats = {
      totalTriples: this.dataset.size,
      files: 0,
      modules: 0,
      functions: 0,
      classes: 0,
      imports: 0,
      exports: 0,
      calls: 0,
      entryPoints: 0,
      externalModules: 0
    }

    for (const quad of this.dataset) {
      if (quad.predicate.equals(this.ns.rdf.type)) {
        if (quad.object.equals(this.ns.erf.File)) stats.files++
        if (quad.object.equals(this.ns.erf.Module)) stats.modules++
        if (quad.object.equals(this.ns.erf.Function)) stats.functions++
        if (quad.object.equals(this.ns.erf.Class)) stats.classes++
      }
      if (quad.predicate.equals(this.ns.erf.imports)) stats.imports++
      if (quad.predicate.equals(this.ns.erf.exports)) stats.exports++
      if (quad.predicate.equals(this.ns.erf.calls)) stats.calls++
      if (quad.predicate.equals(this.ns.erf.isEntryPoint)) stats.entryPoints++
      if (quad.predicate.equals(this.ns.erf.isExternal)) stats.externalModules++
    }

    return stats
  }

  // Private helper methods

  _createNode(id) {
    return rdf.namedNode(id)
  }

  _getOrCreateNode(idOrNode) {
    if (typeof idOrNode === 'object' && idOrNode.termType === 'NamedNode') {
      return idOrNode
    }

    const cached = this.nodeCache.get(idOrNode)
    if (cached) {
      return cached.node
    }

    return this._createNode(idOrNode)
  }
}

export default RDFModel
