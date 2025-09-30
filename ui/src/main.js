import { GraphVisualizer } from './graph.js'
import { ErfAPI } from './api.js'

class ErfUI {
  constructor() {
    this.api = new ErfAPI()
    this.visualizer = null
    this.currentData = null

    this.elements = {
      projectPath: document.getElementById('project-path'),
      analyzeBtn: document.getElementById('analyze-btn'),
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
    this.elements.search.addEventListener('input', (e) => this.handleSearch(e.target.value))
    this.elements.filterFiles.addEventListener('change', () => this.applyFilters())
    this.elements.filterExternal.addEventListener('change', () => this.applyFilters())
    this.elements.filterDead.addEventListener('change', () => this.applyFilters())
    this.elements.layoutStrength.addEventListener('input', (e) => this.updateLayoutStrength(e.target.value))
    this.elements.closeDetails.addEventListener('click', () => this.hideDetails())
  }

  async analyze() {
    const projectPath = this.elements.projectPath.value.trim() || '.'
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
      this.updateStats(data.stats)
      this.updateHealth(data.health)

      this.hideLoading()
      console.log('[ErfUI] Analysis complete')
    } catch (error) {
      console.error('[ErfUI] Error during analysis:', error)
      this.hideLoading()
      this.showError(error.message)
    }
  }

  updateStats(stats) {
    this.elements.stats.innerHTML = `
      <p><strong>Files:</strong> ${stats.files}</p>
      <p><strong>Modules:</strong> ${stats.modules}</p>
      <p><strong>Imports:</strong> ${stats.imports}</p>
      <p><strong>Exports:</strong> ${stats.exports}</p>
      <p><strong>Entry Points:</strong> ${stats.entryPoints}</p>
      <p><strong>External Modules:</strong> ${stats.externalModules}</p>
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

  showNodeDetails(node) {
    this.elements.detailsTitle.textContent = node.label || node.id

    let content = `<p><strong>Type:</strong> ${node.type}</p>`
    content += `<p><strong>Path:</strong><br><code>${node.id}</code></p>`

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
