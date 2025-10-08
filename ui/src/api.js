/**
 * ErfAPI - Client for communicating with erf analysis engine
 */
export class ErfAPI {
  constructor() {
    // API server runs on port 3001 during development
    this.baseUrl = 'http://localhost:3001/api'
  }

  /**
   * Analyze a project directory
   * @param {string} projectPath - Path to analyze
   * @returns {Promise<Object>} Graph data
   */
  async analyze(projectPath) {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ directory: projectPath })
    })

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`)
    }

    const data = await response.json()

    // Transform the data for the visualizer
    return this.transformData(data)
  }

  /**
   * Transform API response to visualizer format
   */
  transformData(data) {
    // Calculate health score
    const healthScore = this.calculateHealthScore(data.stats)

    // Add labels to nodes
    const nodes = (data.nodes || []).map(node => ({
      ...node,
      label: node.id.split('/').pop() || node.id
    }))

    return {
      nodes,
      edges: data.edges || [],
      stats: data.stats || {},
      health: {
        score: healthScore,
        details: {}
      }
    }
  }

  /**
   * Export graph as RDF Turtle format
   * @param {string} projectPath - Path to analyze
   * @returns {Promise<string>} RDF Turtle data
   */
  async exportRdf(projectPath) {
    const response = await fetch(`${this.baseUrl}/export-rdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ directory: projectPath })
    })

    if (!response.ok) {
      throw new Error(`RDF export failed: ${response.statusText}`)
    }

    return await response.text()
  }

  /**
    * List directories within a given path for the GUI file selector
    * @param {string} targetPath - Path to list
    * @returns {Promise<Object>} Directory listing data
    */
  async listDirectory(targetPath = '.') {
    const params = new URLSearchParams()
    if (targetPath) {
      params.set('path', targetPath)
    }

    const query = params.toString()
    const response = await fetch(`${this.baseUrl}/list-directory${query ? `?${query}` : ''}`)

    if (!response.ok) {
      let errorDetail = ''
      try {
        const body = await response.json()
        errorDetail = body?.error ? `: ${body.error}` : ''
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(`Directory listing failed${errorDetail}`)
    }

    return await response.json()
  }

  /**
   * Calculate health score from stats
   */
  calculateHealthScore(stats) {
    if (!stats || !stats.files) return 0

    const reachability = stats.reachableFiles / stats.files
    const connectivity = Math.min((stats.imports / stats.files) * 10, 30)

    return Math.round((reachability * 70) + connectivity)
  }
}
