import express from 'express'
import { GraphBuilder } from '../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../src/analyzers/DeadCodeDetector.js'
import { DuplicateDetector } from '../src/analyzers/DuplicateDetector.js'
import { ErfConfig } from '../src/config/ErfConfig.js'
import { initLogger } from '../src/utils/Logger.js'
import path from 'path'

// Initialize logger with stdout enabled (API server mode)
await initLogger({ stdout: true })

const app = express()
const PORT = 3001

app.use(express.json())

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

/**
 * POST /api/analyze
 * Analyze a project directory
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const { directory, configPath } = req.body

    if (!directory) {
      return res.status(400).json({ error: 'Directory is required' })
    }

    const targetDir = path.resolve(directory)
    console.log(`Analyzing: ${targetDir}`)

    // Load config
    const config = await ErfConfig.load(configPath || null)

    // Build graph
    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    // Get graph data
    const stats = graphBuilder.getGraph().getStats()
    const json = await graphBuilder.export('json')

    // Run dead code analysis
    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const deadCodeResult = detector.detect()

    // Run duplicate detection
    const duplicateDetector = new DuplicateDetector(graphBuilder.getGraph(), {
      threshold: 2,
      ignoreCommon: true
    })
    const duplicateResult = duplicateDetector.detect()

    // Calculate health score (including redundancy penalty)
    const reachabilityScore = deadCodeResult.stats.reachabilityPercentage
    const connectivityScore = stats.files > 0 ? Math.min((stats.imports / stats.files) * 10, 30) : 0
    const redundancyPenalty = duplicateResult.stats.redundancyScore * 10
    const healthScore = Math.max(0, Math.round((reachabilityScore * 0.7) + connectivityScore - redundancyPenalty))

    // Mark dead nodes (LOC is already calculated in GraphBuilder)
    for (const node of json.nodes) {
      const isDead = deadCodeResult.deadFiles.some(f => f.path === node.id)
      if (isDead) {
        node.isDead = true
      }

      // LOC is already calculated in the GraphBuilder and included in metadata
      // No need to recalculate here
    }

    res.json({
      nodes: json.nodes,
      edges: json.edges,
      stats: {
        ...stats,
        reachableFiles: deadCodeResult.stats.reachableFiles,
        deadFiles: deadCodeResult.stats.deadFiles
      },
      health: {
        score: healthScore,
        reachability: deadCodeResult.stats.reachabilityPercentage,
        redundancy: duplicateResult.stats.redundancyScore
      },
      duplicates: {
        groups: duplicateResult.duplicates.slice(0, 10), // Top 10
        stats: duplicateResult.stats
      }
    })
  } catch (error) {
    console.error('Analysis error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/export-rdf
 * Export graph as RDF Turtle format
 */
app.post('/api/export-rdf', async (req, res) => {
  try {
    const { directory, configPath } = req.body

    if (!directory) {
      return res.status(400).json({ error: 'Directory is required' })
    }

    const targetDir = path.resolve(directory)
    console.log(`Exporting RDF for: ${targetDir}`)

    // Load config
    const config = await ErfConfig.load(configPath || null)

    // Build graph
    const graphBuilder = new GraphBuilder(config)
    await graphBuilder.buildGraph(targetDir)

    // Export as Turtle
    const turtle = await graphBuilder.export('rdf')

    res.setHeader('Content-Type', 'text/turtle')
    res.send(turtle)
  } catch (error) {
    console.error('RDF export error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`erf API server running on http://localhost:${PORT}`)
})
