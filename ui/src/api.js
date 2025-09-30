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
    try {
      // For development, we'll call the CLI directly via a fetch to a dev server
      // that wraps the erf CLI commands
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
    } catch (error) {
      // For development without backend, use mock data
      console.warn('API call failed, using mock data:', error)
      return this.getMockData()
    }
  }

  /**
   * Transform API response to visualizer format
   */
  transformData(data) {
    // Calculate health score
    const healthScore = this.calculateHealthScore(data.stats)

    return {
      nodes: data.nodes || [],
      edges: data.edges || [],
      stats: data.stats || {},
      health: {
        score: healthScore,
        details: {}
      }
    }
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

  /**
   * Get mock data for development
   */
  getMockData() {
    return {
      nodes: [
        {
          id: '/src/index.js',
          label: 'index.js',
          type: 'file',
          isEntryPoint: true,
          metadata: { size: 1024, loc: 50 }
        },
        {
          id: '/src/utils.js',
          label: 'utils.js',
          type: 'file',
          metadata: { size: 512, loc: 30 }
        },
        {
          id: '/src/config.js',
          label: 'config.js',
          type: 'file',
          metadata: { size: 256, loc: 15 }
        },
        {
          id: 'express',
          label: 'express',
          type: 'external-module',
          isExternal: true
        },
        {
          id: 'lodash',
          label: 'lodash',
          type: 'external-module',
          isExternal: true
        },
        {
          id: '/src/dead.js',
          label: 'dead.js',
          type: 'file',
          isDead: true,
          metadata: { size: 128, loc: 10 }
        }
      ],
      edges: [
        { from: '/src/index.js', to: '/src/utils.js', type: 'imports' },
        { from: '/src/index.js', to: '/src/config.js', type: 'imports' },
        { from: '/src/index.js', to: 'express', type: 'imports' },
        { from: '/src/utils.js', to: 'lodash', type: 'imports' }
      ],
      stats: {
        files: 4,
        modules: 6,
        imports: 4,
        exports: 3,
        entryPoints: 1,
        externalModules: 2,
        reachableFiles: 3,
        deadFiles: 1
      },
      health: {
        score: 75,
        details: {}
      }
    }
  }
}
