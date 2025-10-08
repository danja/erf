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
      projectPathBrowse: document.getElementById('project-path-browse'),
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
      closeDetails: document.getElementById('close-details'),
      directoryDialog: document.getElementById('directory-dialog'),
      directoryList: document.getElementById('directory-list'),
      directoryCurrentPath: document.getElementById('directory-current-path'),
      directorySelectedPath: document.getElementById('directory-selected-path'),
      directoryUp: document.getElementById('directory-up-btn'),
      directoryCancel: document.getElementById('directory-cancel-btn'),
      directorySelect: document.getElementById('directory-select-btn'),
      directoryError: document.getElementById('directory-error')
    }

    this.directoryState = {
      currentPath: null,
      parentPath: null,
      directories: [],
      selectedPath: null
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
    if (this.elements.projectPathBrowse) {
      this.elements.projectPathBrowse.addEventListener('click', () => this.openDirectoryDialog())
    }
    if (this.elements.directoryCancel) {
      this.elements.directoryCancel.addEventListener('click', () => this.closeDirectoryDialog())
    }
    if (this.elements.directorySelect) {
      this.elements.directorySelect.addEventListener('click', () => this.confirmDirectorySelection())
    }
    if (this.elements.directoryUp) {
      this.elements.directoryUp.addEventListener('click', () => this.navigateToParentDirectory())
    }
    if (this.elements.directoryList) {
      this.elements.directoryList.addEventListener('click', (event) => this.handleDirectoryListClick(event))
      this.elements.directoryList.addEventListener('dblclick', (event) => this.handleDirectoryListDoubleClick(event))
    }
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

  async openDirectoryDialog() {
    if (!this.elements.directoryDialog) return
    this.elements.directoryDialog.classList.remove('hidden')
    const initialPath = this.elements.projectPath.value.trim() || '.'
    await this.loadDirectory(initialPath)
  }

  closeDirectoryDialog() {
    if (!this.elements.directoryDialog) return
    this.elements.directoryDialog.classList.add('hidden')
  }

  async loadDirectory(targetPath, { allowFallback = true } = {}) {
    if (!this.elements.directoryList) return

    this.clearDirectoryError()
    this.showDirectoryLoading()

    try {
      const data = await this.api.listDirectory(targetPath)
      this.directoryState = {
        currentPath: data.currentPath,
        parentPath: data.parentPath,
        directories: data.directories || [],
        selectedPath: data.currentPath
      }

      this.renderDirectoryList()
      this.updateDirectorySelection(this.directoryState.selectedPath)
    } catch (error) {
      if (allowFallback && targetPath !== '.') {
        const fallbackMessage = `Could not open ${targetPath}. Showing current working directory instead.`
        await this.loadDirectory('.', { allowFallback: false })
        this.showDirectoryError(fallbackMessage)
        return
      }

      this.directoryState = {
        currentPath: targetPath,
        parentPath: null,
        directories: [],
        selectedPath: null
      }
      this.renderDirectoryList()
      this.updateDirectorySelection(null)
      this.showDirectoryError(error.message || 'Unable to open directory')
    }
  }

  showDirectoryLoading() {
    if (!this.elements.directoryList) return
    this.elements.directoryList.innerHTML = '<p class="directory-placeholder">Loading...</p>'
    if (this.elements.directoryCurrentPath) {
      this.elements.directoryCurrentPath.textContent = ''
    }
    this.updateDirectorySelection(null)
  }

  renderDirectoryList() {
    if (!this.elements.directoryList) return

    const { directories, currentPath } = this.directoryState

    if (this.elements.directoryCurrentPath) {
      this.elements.directoryCurrentPath.textContent = currentPath || ''
    }

    if (!directories || directories.length === 0) {
      this.elements.directoryList.innerHTML = '<p class="directory-placeholder">No subdirectories</p>'
      return
    }

    const fragment = document.createDocumentFragment()
    directories.forEach((dir) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'directory-item'
      button.dataset.path = dir.path
      button.textContent = dir.name
      fragment.appendChild(button)
    })

    this.elements.directoryList.innerHTML = ''
    this.elements.directoryList.appendChild(fragment)
  }

  updateDirectorySelection(selectedPath) {
    this.directoryState.selectedPath = selectedPath

    if (this.elements.directorySelectedPath) {
      this.elements.directorySelectedPath.textContent = selectedPath || 'None'
    }

    if (this.elements.directorySelect) {
      this.elements.directorySelect.disabled = !selectedPath
    }

    if (this.elements.directoryList) {
      const items = this.elements.directoryList.querySelectorAll('.directory-item')
      items.forEach(item => {
        if (item.dataset.path === selectedPath) {
          item.classList.add('selected')
        } else {
          item.classList.remove('selected')
        }
      })
    }
  }

  handleDirectoryListClick(event) {
    const item = event.target.closest('.directory-item')
    if (!item) return
    this.updateDirectorySelection(item.dataset.path)
  }

  handleDirectoryListDoubleClick(event) {
    const item = event.target.closest('.directory-item')
    if (!item) return
    this.navigateDirectory(item.dataset.path)
  }

  async navigateDirectory(path) {
    if (!path) return
    await this.loadDirectory(path)
  }

  async navigateToParentDirectory() {
    if (!this.directoryState.parentPath) return
    await this.loadDirectory(this.directoryState.parentPath)
  }

  confirmDirectorySelection() {
    if (!this.directoryState.selectedPath) return
    this.elements.projectPath.value = this.directoryState.selectedPath
    this.closeDirectoryDialog()
  }

  showDirectoryError(message) {
    if (!this.elements.directoryError) return
    this.elements.directoryError.textContent = message
    this.elements.directoryError.classList.remove('hidden')
  }

  clearDirectoryError() {
    if (!this.elements.directoryError) return
    this.elements.directoryError.classList.add('hidden')
    this.elements.directoryError.textContent = ''
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
