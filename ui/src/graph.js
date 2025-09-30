import * as d3 from 'd3'

/**
 * GraphVisualizer - D3.js force-directed graph
 */
export class GraphVisualizer {
  constructor(container) {
    this.container = container
    this.width = container.clientWidth
    this.height = container.clientHeight
    this.data = null
    this.filteredData = null
    this.simulation = null
    this.svg = null
    this.eventListeners = {}

    this.init()
  }

  init() {
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)

    // Add arrow marker definition
    this.svg.append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#404040')

    // Create groups for links and nodes
    this.linkGroup = this.svg.append('g').attr('class', 'links')
    this.nodeGroup = this.svg.append('g').attr('class', 'nodes')

    // Add zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.linkGroup.attr('transform', event.transform)
        this.nodeGroup.attr('transform', event.transform)
      })

    this.svg.call(this.zoom)

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize())
  }

  render(data) {
    console.log('[GraphVisualizer] render() called with data:', {
      nodeCount: data.nodes?.length,
      edgeCount: data.edges?.length
    })
    this.data = data
    this.filteredData = this.prepareData(data)

    console.log('[GraphVisualizer] After prepareData:', {
      nodeCount: this.filteredData.nodes.length,
      edgeCount: this.filteredData.edges.length,
      firstNode: this.filteredData.nodes[0]
    })

    // Initialize force simulation - spread out to use space
    this.simulation = d3.forceSimulation(this.filteredData.nodes)
      .force('link', d3.forceLink(this.filteredData.edges)
        .id(d => d.id)
        .distance(100))  // Longer links for spread
      .force('charge', d3.forceManyBody().strength(-400))  // More repulsion to spread nodes
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 10))
      .force('x', d3.forceX(this.width / 2).strength(0.05))  // Weaker centering
      .force('y', d3.forceY(this.height / 2).strength(0.05))  // Weaker centering
      .alphaDecay(0.02)  // Standard cooling

    console.log('[GraphVisualizer] Simulation created, calling updateGraph()')
    this.updateGraph()

    // After simulation settles, zoom to fit
    this.simulation.on('end', () => {
      this.zoomToFit()
    })
  }

  zoomToFit() {
    if (!this.filteredData || this.filteredData.nodes.length === 0) return

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    this.filteredData.nodes.forEach(node => {
      const padding = node.radius || 10
      minX = Math.min(minX, node.x - padding)
      minY = Math.min(minY, node.y - padding)
      maxX = Math.max(maxX, node.x + padding)
      maxY = Math.max(maxY, node.y + padding)
    })

    const width = maxX - minX
    const height = maxY - minY
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Calculate scale to fit with padding
    const scale = Math.min(
      this.width / width,
      this.height / height,
      2.0 // Max zoom
    ) * 0.9 // 10% padding

    // Apply transform
    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-centerX, -centerY)

    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, transform)
  }

  prepareData(data) {
    // Clone nodes and edges
    const nodes = data.nodes.map(n => ({ ...n }))
    const edges = data.edges.map(e => ({
      ...e,
      source: e.from,  // D3 expects 'source' and 'target'
      target: e.to
    }))

    // Add additional properties for visualization
    nodes.forEach(node => {
      node.radius = this.getNodeRadius(node)
      node.color = this.getNodeColor(node)
      node.label = node.label || this.getNodeLabel(node.id)
    })

    return { nodes, edges }
  }

  updateGraph() {
    console.log('[GraphVisualizer] updateGraph() starting')
    // Render links
    const link = this.linkGroup
      .selectAll('line')
      .data(this.filteredData.edges)
      .join('line')
      .attr('class', 'link')
      .attr('marker-end', 'url(#arrowhead)')

    console.log('[GraphVisualizer] Links rendered:', link.size())

    // Render nodes
    const node = this.nodeGroup
      .selectAll('g')
      .data(this.filteredData.nodes)
      .join('g')
      .attr('class', 'node')
      .call(this.drag())

    console.log('[GraphVisualizer] Node groups created:', node.size())

    node.selectAll('*').remove() // Clear previous contents

    // Add circles
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Add X mark for missing files
    node.filter(d => d.isMissing)
      .append('text')
      .attr('class', 'missing-mark')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('fill', '#fff')
      .style('font-size', d => d.radius * 1.2 + 'px')
      .style('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text('✕')

    console.log('[GraphVisualizer] Circles added')

    // Add labels
    node.append('text')
      .attr('class', 'node-label')
      .attr('dy', d => d.radius + 12)
      .text(d => d.label)

    console.log('[GraphVisualizer] Labels added')

    // Add click handler
    node.on('click', (event, d) => {
      event.stopPropagation()
      this.emit('nodeClick', d)
      this.highlightNode(d)
    })

    // Update positions on simulation tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    console.log('[GraphVisualizer] updateGraph() complete, simulation running')
  }

  getNodeRadius(node) {
    if (node.type === 'external-module') return 6

    // Scale radius based on file size
    const size = node.metadata?.size || 0
    if (size === 0) return 8

    // Logarithmic scale: small files 8-12px, medium 12-18px, large 18-24px
    const baseRadius = 8
    const maxRadius = 24
    const scaledSize = Math.log10(size + 1) / Math.log10(100000) // normalize to 0-1 range
    const radius = baseRadius + (maxRadius - baseRadius) * Math.min(scaledSize, 1)

    return Math.round(radius)
  }

  getNodeColor(node) {
    if (node.isMissing) return '#ef4444'
    if (node.isDead) return '#f87171'
    if (node.isEntryPoint) return '#4ade80'
    if (node.type === 'external-module') return '#a78bfa'
    return '#4a9eff'
  }

  getNodeLabel(id) {
    // Extract filename from path
    const parts = id.split('/')
    return parts[parts.length - 1]
  }

  highlightNode(node) {
    // Reset previous highlights
    this.nodeGroup.selectAll('circle')
      .classed('selected', false)

    this.linkGroup.selectAll('line')
      .classed('highlighted', false)

    // Highlight selected node
    this.nodeGroup.selectAll('g')
      .filter(d => d.id === node.id)
      .select('circle')
      .classed('selected', true)

    // Highlight connected links
    this.linkGroup.selectAll('line')
      .filter(d => d.source.id === node.id || d.target.id === node.id)
      .classed('highlighted', true)
  }

  search(query) {
    if (!query) {
      this.nodeGroup.selectAll('g').style('opacity', 1)
      return
    }

    const lowerQuery = query.toLowerCase()
    this.nodeGroup.selectAll('g')
      .style('opacity', d => {
        const matches = d.id.toLowerCase().includes(lowerQuery) ||
                       d.label.toLowerCase().includes(lowerQuery)
        return matches ? 1 : 0.2
      })
  }

  filter(filters) {
    if (!this.data) return

    let nodes = [...this.data.nodes]

    if (filters.deadOnly) {
      nodes = nodes.filter(n => n.isDead)
    } else {
      if (!filters.files) {
        nodes = nodes.filter(n => n.type !== 'file')
      }
      if (!filters.external) {
        nodes = nodes.filter(n => n.type !== 'external-module')
      }
    }

    const nodeIds = new Set(nodes.map(n => n.id))
    const edges = this.data.edges.filter(e =>
      nodeIds.has(e.from) && nodeIds.has(e.to)
    )

    this.filteredData = this.prepareData({ nodes, edges })
    this.simulation.nodes(this.filteredData.nodes)
    this.simulation.force('link').links(this.filteredData.edges)
    this.simulation.alpha(1).restart()
    this.updateGraph()
  }

  setLayoutStrength(value) {
    if (!this.simulation) return
    this.simulation.force('charge').strength(-value * 10)
    this.simulation.alpha(1).restart()
  }

  drag() {
    function dragstarted(event, d) {
      if (!event.active) this.simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event, d) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event, d) {
      if (!event.active) this.simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return d3.drag()
      .on('start', dragstarted.bind(this))
      .on('drag', dragged.bind(this))
      .on('end', dragended.bind(this))
  }

  handleResize() {
    this.width = this.container.clientWidth
    this.height = this.container.clientHeight

    this.svg
      .attr('width', this.width)
      .attr('height', this.height)

    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2))
      this.simulation.alpha(1).restart()
    }
  }

  on(event, callback) {
    this.eventListeners[event] = callback
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event](data)
    }
  }
}
