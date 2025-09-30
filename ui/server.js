import express from 'express'
import { GraphBuilder } from '../src/analyzers/GraphBuilder.js'
import { DeadCodeDetector } from '../src/analyzers/DeadCodeDetector.js'
import { ErfConfig } from '../src/config/ErfConfig.js'
import path from 'path'

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
    const json = graphBuilder.export('json')

    // Run dead code analysis
    const detector = new DeadCodeDetector(graphBuilder.getGraph())
    const deadCodeResult = detector.detect()

    // Calculate health score
    const healthScore = Math.round(
      (deadCodeResult.stats.reachabilityPercentage * 0.7) +
      (stats.files > 0 ? Math.min((stats.imports / stats.files) * 10, 30) : 0)
    )

    // Mark dead nodes
    json.nodes.forEach(node => {
      const isDead = deadCodeResult.deadFiles.some(f => f.path === node.id)
      if (isDead) {
        node.isDead = true
      }
    })

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
        reachability: deadCodeResult.stats.reachabilityPercentage
      }
    })
  } catch (error) {
    console.error('Analysis error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`erf API server running on http://localhost:${PORT}`)
})
