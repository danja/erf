import { GraphVisualizer } from './graph.js'
import { ErfAPI } from './api.js'

class ErfUI {
  constructor() {
    this.api = new ErfAPI()
    this.visualizer = null
    this.currentData = null
    this.projectPath = null

    this.elements = {
      projectPath: document.getElementById('project-path'),
      analyzeBtn: document.getElementById('analyze-btn'),
      exportRdfBtn: document.getElementById('export-rdf-btn'),
      search: document.getElementById('search'),
      filterFiles: document.getElementById('filter-files'),
      filterExternal: document.getElementById('filter-external'),
      filterDead: document.getElementById('filter-dead'),
      layoutStrength: document.getElementById('layout-strength'),
      stats: document.getElementById('stats'),
      health: document.getElementById('health'),
      graphContainer: document.getElementById('graph'),
      loading: document.getElementById('loading'),
      error: document.getElementById('error'),
      detailsPanel: document.querySelector('.details-panel'),
      detailsTitle: document.getElementById('details-title'),
      detailsContent: document.getElementById('details-content'),
      closeDetails: document.getElementById('close-details')
    }

    this.setupEventListeners()
  }

  setupEventListeners() {
    this.elements.analyzeBtn.addEventListener('click', () => this.analyze())
    this.elements.exportRdfBtn.addEventListener('click', () => this.exportRdf())
    this.elements.search.addEventListener('input', (e) => this.handleSearch(e.target.value))
    this.elements.filterFiles.addEventListener('change', () => this.applyFilters())
    this.elements.filterExternal.addEventListener('change', () => this.applyFilters())
    this.elements.filterDead.addEventListener('change', () => this.applyFilters())
    this.elements.layoutStrength.addEventListener('input', (e) => this.updateLayoutStrength(e.target.value))
    this.elements.closeDetails.addEventListener('click', () => this.hideDetails())
  }

  async analyze() {
    const projectPath = this.elements.projectPath.value.trim() || '.'
    this.projectPath = projectPath
    console.log('[ErfUI] Starting analysis for:', projectPath)

    this.showLoading()
    this.hideError()

    try {
      // Analyze the project
      const data = await this.api.analyze(projectPath)
      console.log('[ErfUI] Received data:', {
        nodeCount: data.nodes?.length,
        edgeCount: data.edges?.length,
        stats: data.stats,
        health: data.health
      })
      this.currentData = data

      // Initialize visualizer if needed
      if (!this.visualizer) {
        console.log('[ErfUI] Creating new GraphVisualizer')
        this.visualizer = new GraphVisualizer(this.elements.graphContainer)
        this.visualizer.on('nodeClick', (node) => this.showNodeDetails(node))
      }

      // Render the graph
      console.log('[ErfUI] Calling visualizer.render()')
      this.visualizer.render(data)

      // Update stats and health
      this.updateStats(data.stats, data.duplicates)
      this.updateHealth(data.health)

      // Enable export button
      this.elements.exportRdfBtn.disabled = false

      this.hideLoading()
      console.log('[ErfUI] Analysis complete')
    } catch (error) {
      console.error('[ErfUI] Error during analysis:', error)
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async exportRdf() {
    const projectPath = this.elements.projectPath.value.trim() || '.'
    console.log('[ErfUI] Exporting RDF for:', projectPath)

    try {
      const rdfData = await this.api.exportRdf(projectPath)

      // Create download link
      const blob = new Blob([rdfData], { type: 'text/turtle' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `erf-graph-${Date.now()}.ttl`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('[ErfUI] RDF export complete')
    } catch (error) {
      console.error('[ErfUI] Error exporting RDF:', error)
      this.showError(error.message)
    }
  }

  updateStats(stats, duplicates) {
    let duplicateInfo = ''
    if (duplicates && duplicates.stats) {
      duplicateInfo = `
        <p><strong>Duplicate Methods:</strong> ${duplicates.stats.duplicateGroups}</p>
        <p><strong>Code Redundancy:</strong> ${(duplicates.stats.redundancyScore * 100).toFixed(1)}%</p>
      `
    }

    this.elements.stats.innerHTML = `
      <p><strong>Files:</strong> ${stats.files}</p>
      <p><strong>Modules:</strong> ${stats.modules}</p>
      <p><strong>Imports:</strong> ${stats.imports}</p>
      <p><strong>Exports:</strong> ${stats.exports}</p>
      <p><strong>Entry Points:</strong> ${stats.entryPoints}</p>
      <p><strong>External Modules:</strong> ${stats.externalModules}</p>
      ${duplicateInfo}
    `
  }

  updateHealth(health) {
    const scoreElement = this.elements.health.querySelector('.health-score')
    const labelElement = this.elements.health.querySelector('.health-label')

    scoreElement.textContent = health.score

    let label = 'Unknown'
    let gradient = 'linear-gradient(135deg, #f87171, #ef4444)'

    if (health.score >= 80) {
      label = '🟢 Excellent'
      gradient = 'linear-gradient(135deg, #4ade80, #22c55e)'
    } else if (health.score >= 60) {
      label = '🟡 Good'
      gradient = 'linear-gradient(135deg, #fbbf24, #f59e0b)'
    } else if (health.score >= 40) {
      label = '🟠 Fair'
      gradient = 'linear-gradient(135deg, #fb923c, #f97316)'
    } else {
      label = '🔴 Poor'
    }

    labelElement.textContent = label
    scoreElement.style.background = gradient
    scoreElement.style.webkitBackgroundClip = 'text'
    scoreElement.style.webkitTextFillColor = 'transparent'
    scoreElement.style.backgroundClip = 'text'
  }

  handleSearch(query) {
    if (!this.visualizer) return
    this.visualizer.search(query)
  }

  applyFilters() {
    if (!this.visualizer) return

    const filters = {
      files: this.elements.filterFiles.checked,
      external: this.elements.filterExternal.checked,
      deadOnly: this.elements.filterDead.checked
    }

    this.visualizer.filter(filters)
  }

  updateLayoutStrength(value) {
    if (!this.visualizer) return
    this.visualizer.setLayoutStrength(parseInt(value))
  }

  formatPath(filePath) {
    // Convert file:// URI to ./ relative path
    if (!filePath) return filePath

    // Remove file:// protocol
    let path = filePath.replace('file://', '')

    // If we have a project path, make it relative
    if (this.projectPath && path.includes(this.projectPath)) {
      // Handle both absolute and relative project paths
      const absoluteProjectPath = this.projectPath.startsWith('/')
        ? this.projectPath
        : path.substring(0, path.indexOf(this.projectPath) + this.projectPath.length)

      path = path.replace(absoluteProjectPath, '.')
    }

    return path
  }

  showNodeDetails(node) {
    const displayPath = this.formatPath(node.id)
    this.elements.detailsTitle.textContent = node.label || displayPath

    let content = `<p><strong>Type:</strong> ${node.type}</p>`
    content += `<p><strong>Path:</strong><br><code>${displayPath}</code></p>`

    if (node.metadata) {
      content += '<h4>Metadata</h4>'
      if (node.metadata.loc) {
        content += `<p>Lines of Code: ${node.metadata.loc.toLocaleString()}</p>`
      }
      if (node.metadata.size) {
        content += `<p>Size: ${node.metadata.size.toLocaleString()} bytes</p>`
      }
    }

    if (node.imports && node.imports.length > 0) {
      content += '<h4>Imports</h4><ul>'
      node.imports.forEach(imp => {
        content += `<li>${imp}</li>`
      })
      content += '</ul>'
    }

    if (node.exports && node.exports.length > 0) {
      content += '<h4>Exports</h4><ul>'
      node.exports.forEach(exp => {
        content += `<li>${exp}</li>`
      })
      content += '</ul>'
    }

    if (node.hasParseError) {
      content += '<p><strong style="color: #dc2626;">⚠️ Parse Error</strong></p>'
      if (node.parseErrorMessage) {
        content += `<p style="color: #dc2626; font-size: 0.9em;"><code>${node.parseErrorMessage}</code></p>`
      }
    }

    if (node.isMissing) {
      content += '<p><strong>✕ Missing File (import target not found)</strong></p>'
    }

    if (node.isEntryPoint) {
      content += '<p><strong>📌 Entry Point</strong></p>'
    }

    if (node.isDead) {
      content += '<p><strong>⚠️ Unreachable from Entry Points</strong></p>'
    }

    this.elements.detailsContent.innerHTML = content
    this.elements.detailsPanel.classList.remove('hidden')
  }

  hideDetails() {
    this.elements.detailsPanel.classList.add('hidden')
  }

  showLoading() {
    this.elements.loading.classList.remove('hidden')
  }

  hideLoading() {
    this.elements.loading.classList.add('hidden')
  }

  showError(message) {
    this.elements.error.textContent = `Error: ${message}`
    this.elements.error.classList.remove('hidden')
  }

  hideError() {
    this.elements.error.classList.add('hidden')
  }
}

// Initialize the app
new ErfUI()
