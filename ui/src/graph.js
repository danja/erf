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

    // Create groups for links and nodes
    this.linkGroup = this.svg.append('g').attr('class', 'links')
    this.nodeGroup = this.svg.append('g').attr('class', 'nodes')

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.linkGroup.attr('transform', event.transform)
        this.nodeGroup.attr('transform', event.transform)
      })

    this.svg.call(zoom)

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize())
  }

  render(data) {
    this.data = data
    this.filteredData = this.prepareData(data)

    // Initialize force simulation
    this.simulation = d3.forceSimulation(this.filteredData.nodes)
      .force('link', d3.forceLink(this.filteredData.edges)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(30))

    this.updateGraph()
  }

  prepareData(data) {
    // Clone nodes and edges
    const nodes = data.nodes.map(n => ({ ...n }))
    const edges = data.edges.map(e => ({ ...e }))

    // Add additional properties for visualization
    nodes.forEach(node => {
      node.radius = this.getNodeRadius(node)
      node.color = this.getNodeColor(node)
      node.label = node.label || this.getNodeLabel(node.id)
    })

    return { nodes, edges }
  }

  updateGraph() {
    // Render links
    const link = this.linkGroup
      .selectAll('line')
      .data(this.filteredData.edges)
      .join('line')
      .attr('class', 'link')
      .attr('marker-end', 'url(#arrowhead)')

    // Render nodes
    const node = this.nodeGroup
      .selectAll('g')
      .data(this.filteredData.nodes)
      .join('g')
      .attr('class', 'node')
      .call(this.drag())

    node.selectAll('*').remove() // Clear previous contents

    // Add circles
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Add labels
    node.append('text')
      .attr('class', 'node-label')
      .attr('dy', d => d.radius + 12)
      .text(d => d.label)

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
  }

  getNodeRadius(node) {
    if (node.isEntryPoint) return 12
    if (node.type === 'external-module') return 8
    return 10
  }

  getNodeColor(node) {
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
