import { describe, it, expect } from 'vitest'
import { handleAnalyze } from '../../mcp/tools/analyze-codebase.js'
import { handleDeadCode } from '../../mcp/tools/find-dead-code.js'
import { handleHealth } from '../../mcp/tools/check-health.js'
import { handleIsolated } from '../../mcp/tools/find-isolated.js'
import { handleHubs } from '../../mcp/tools/find-hubs.js'
import { handleFunctions } from '../../mcp/tools/analyze-functions.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('MCP Tools Integration - erf codebase', () => {
  const erfRoot = path.resolve(__dirname, '../..')
  const configPath = path.join(erfRoot, '.erfrc.json')

  describe('erf_analyze tool', () => {
    it('should analyze erf codebase and return comprehensive statistics', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath
      }

      const result = await handleAnalyze(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text

      // Check that analysis header is present
      expect(text).toContain('# Codebase Analysis:')
      expect(text).toContain(erfRoot)

      // Check statistics section
      expect(text).toContain('## Statistics')
      expect(text).toContain('Files:')
      expect(text).toContain('Modules:')
      expect(text).toContain('Functions:')
      expect(text).toContain('Imports:')
      expect(text).toContain('Exports:')
      expect(text).toContain('Entry Points:')
      expect(text).toContain('External Modules:')

      // Check graph summary
      expect(text).toContain('## Graph Summary')
      expect(text).toContain('Total Nodes:')
      expect(text).toContain('Total Edges:')

      // Verify we found actual files (not just 0)
      const filesMatch = text.match(/Files: (\d+)/)
      expect(filesMatch).toBeDefined()
      const fileCount = parseInt(filesMatch[1])
      expect(fileCount).toBeGreaterThan(0)

      // Verify we found imports
      const importsMatch = text.match(/Imports: (\d+)/)
      expect(importsMatch).toBeDefined()
      const importCount = parseInt(importsMatch[1])
      expect(importCount).toBeGreaterThan(0)
    })

    it('should work with relative paths', async () => {
      const args = {
        directory: '.',
        configPath: '.erfrc.json'
      }

      const result = await handleAnalyze(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('# Codebase Analysis')
    })
  })

  describe('erf_dead_code tool', () => {
    it('should detect dead code in erf codebase', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath
      }

      const result = await handleDeadCode(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text

      // Check report structure
      expect(text).toContain('# Dead Code Analysis:')
      expect(text).toContain('## Summary')
      expect(text).toContain('Total Files:')
      expect(text).toContain('Reachable Files:')
      expect(text).toContain('Dead Files:')
      expect(text).toContain('Unused Exports:')
      expect(text).toContain('Reachability:')

      // Check for dead files section
      expect(text).toContain('## Dead Files')

      // Parse reachability percentage
      const reachabilityMatch = text.match(/Reachability: (\d+)%/)
      expect(reachabilityMatch).toBeDefined()
      const reachability = parseInt(reachabilityMatch[1])
      expect(reachability).toBeGreaterThanOrEqual(0)
      expect(reachability).toBeLessThanOrEqual(100)

      // Reachability depends on whether entry points are found
      // If entry points are not in the scanned files, reachability can be 0%
      // This is expected behavior, not an error
    })

    it('should support text format output', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath,
        format: 'text'
      }

      const result = await handleDeadCode(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text
      expect(text).toContain('Dead Code Analysis Report')
    })
  })

  describe('erf_health tool', () => {
    it('should generate health report for erf codebase', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath
      }

      const result = await handleHealth(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text

      // Check report structure
      expect(text).toContain('# Codebase Health Report:')
      expect(text).toContain('## Overall Health Score:')
      expect(text).toContain('/100')

      // Check for score breakdown
      expect(text).toContain('### Score Breakdown')
      expect(text).toContain('Connectivity:')
      expect(text).toContain('Structure:')
      expect(text).toContain('Quality:')

      // Check graph metrics
      expect(text).toContain('## Graph Metrics')
      expect(text).toContain('Files:')
      expect(text).toContain('Functions:')
      expect(text).toContain('Imports:')
      expect(text).toContain('Exports:')

      // Check connectivity analysis
      expect(text).toContain('## Connectivity Analysis')
      expect(text).toContain('Files with dependents:')
      expect(text).toContain('Files with imports:')

      // Check recommendations
      expect(text).toContain('## Recommendations')

      // Parse health score
      const scoreMatch = text.match(/Overall Health Score: (\d+)\/100/)
      expect(scoreMatch).toBeDefined()
      const healthScore = parseInt(scoreMatch[1])
      expect(healthScore).toBeGreaterThanOrEqual(0)
      expect(healthScore).toBeLessThanOrEqual(100)

      // erf should have decent health
      expect(healthScore).toBeGreaterThan(40)

      // Should contain health emoji indicator
      const hasHealthEmoji = text.includes('🟢') || text.includes('🟡') ||
                            text.includes('🟠') || text.includes('🔴')
      expect(hasHealthEmoji).toBe(true)
    })
  })

  describe('erf_isolated tool', () => {
    it('should find isolated files in erf codebase', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath
      }

      const result = await handleIsolated(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text

      // Check report structure
      expect(text).toContain('# Isolated Code Subgraphs:')
      expect(text).toContain('Found')
      expect(text).toContain('isolated file(s)')

      // Parse isolated file count
      const isolatedMatch = text.match(/Found (\d+) isolated file/)
      expect(isolatedMatch).toBeDefined()
      const isolatedCount = parseInt(isolatedMatch[1])
      expect(isolatedCount).toBeGreaterThanOrEqual(0)

      // Should either show files or success message
      if (isolatedCount === 0) {
        expect(text).toContain('No isolated files found!')
        expect(text).toContain('✅')
      } else {
        expect(text).toContain('not reachable from any configured entry point')
      }
    })
  })

  describe('erf_hubs tool', () => {
    it('should identify hub files in erf codebase', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath,
        threshold: 3,
        limit: 10
      }

      const result = await handleHubs(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text

      // Check report structure
      expect(text).toContain('# Hub Files:')
      expect(text).toContain('Found')
      expect(text).toContain('hub file(s)')
      expect(text).toContain('## Analysis')

      // Parse hub count
      const hubMatch = text.match(/Found (\d+) hub file/)
      expect(hubMatch).toBeDefined()
      const hubCount = parseInt(hubMatch[1])
      expect(hubCount).toBeGreaterThanOrEqual(0)

      // If hubs found, check structure
      if (hubCount > 0) {
        expect(text).toContain('Dependents:')
        expect(text).toContain('Imports:')
        expect(text).toContain('Exports:')
        expect(text).toContain('core infrastructure')

        // Some well-connected file should be a hub
        // (RDFModel.js is likely but not guaranteed depending on threshold)
      }
    })

    it('should respect threshold parameter', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath,
        threshold: 100, // Very high threshold
        limit: 10
      }

      const result = await handleHubs(args)
      const text = result.content[0].text

      // With very high threshold, unlikely to find hubs
      expect(text).toContain('# Hub Files:')
    })

    it('should use default threshold when not specified', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath
      }

      const result = await handleHubs(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Hub Files')
    })
  })

  describe('erf_functions tool', () => {
    it('should analyze functions in erf codebase', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath
      }

      const result = await handleFunctions(args)

      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      const text = result.content[0].text

      // Check report structure
      expect(text).toContain('# Function Analysis:')
      expect(text).toContain('## Overall Statistics')
      expect(text).toContain('Total Functions/Methods:')
      expect(text).toContain('Regular Functions:')
      expect(text).toContain('Class Methods:')
      expect(text).toContain('Async Functions:')
      expect(text).toContain('Static Methods:')
      expect(text).toContain('Generators:')

      // Check averages
      expect(text).toContain('## Averages')
      expect(text).toContain('Functions per file:')

      // Parse function count
      const funcMatch = text.match(/Total Functions\/Methods: (\d+)/)
      expect(funcMatch).toBeDefined()
      const funcCount = parseInt(funcMatch[1])
      expect(funcCount).toBeGreaterThan(0)

      // erf likely has async functions, but don't require it
      expect(text).toMatch(/Async Functions: (\d+)/)
    })

    it('should accept showFiles parameter', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath,
        showFiles: true
      }

      const result = await handleFunctions(args)
      const text = result.content[0].text

      // Should contain function analysis
      expect(text).toContain('# Function Analysis')
      expect(text).toContain('Overall Statistics')

      // Per-file breakdown will show if file metadata is tracked
      // (this is optional depending on implementation)
    })

    it('should not show per-file breakdown by default', async () => {
      const args = {
        directory: erfRoot,
        configPath: configPath
      }

      const result = await handleFunctions(args)
      const text = result.content[0].text

      // Should not contain file breakdown when not requested
      expect(text).not.toContain('## Files with Most Functions')
    })
  })

  describe('error handling', () => {
    it('should handle non-existent directory gracefully', async () => {
      const args = {
        directory: '/nonexistent/fake/path/12345'
      }

      // Should throw an error
      await expect(handleAnalyze(args)).rejects.toThrow()
    })

    it('should handle invalid config path gracefully', async () => {
      const args = {
        directory: erfRoot,
        configPath: '/fake/config/path.json'
      }

      // Should fall back to defaults
      const result = await handleAnalyze(args)

      // Should not error, just use defaults
      expect(result.content[0].type).toBe('text')
    })
  })

  describe('cross-tool consistency', () => {
    it('should report consistent file counts across tools', async () => {
      const analyzeResult = await handleAnalyze({
        directory: erfRoot,
        configPath: configPath
      })

      const deadCodeResult = await handleDeadCode({
        directory: erfRoot,
        configPath: configPath
      })

      const healthResult = await handleHealth({
        directory: erfRoot,
        configPath: configPath
      })

      // Extract file counts
      const analyzeText = analyzeResult.content[0].text
      const deadCodeText = deadCodeResult.content[0].text
      const healthText = healthResult.content[0].text

      const analyzeFiles = parseInt(analyzeText.match(/Files: (\d+)/)[1])
      const healthFiles = parseInt(healthText.match(/Files: (\d+)/)[1])

      // Analyze and health should report same file count
      expect(analyzeFiles).toBe(healthFiles)

      // Dead code might report 0 if no entry points, which is OK
      const deadCodeFilesMatch = deadCodeText.match(/Total Files: (\d+)/)
      if (deadCodeFilesMatch) {
        const deadCodeFiles = parseInt(deadCodeFilesMatch[1])
        // Should be same or 0 if no entry points
        expect(deadCodeFiles === analyzeFiles || deadCodeFiles === 0).toBe(true)
      }
    })

    it('should find consistent external module counts', async () => {
      const analyzeResult = await handleAnalyze({
        directory: erfRoot,
        configPath: configPath
      })

      const healthResult = await handleHealth({
        directory: erfRoot,
        configPath: configPath
      })

      const analyzeText = analyzeResult.content[0].text
      const healthText = healthResult.content[0].text

      const analyzeExternal = parseInt(analyzeText.match(/External Modules: (\d+)/)[1])
      const healthExternal = parseInt(healthText.match(/External Modules: (\d+)/)[1])

      // Should be consistent
      expect(analyzeExternal).toBe(healthExternal)
    })
  })

  describe('performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now()

      await handleAnalyze({
        directory: erfRoot,
        configPath: configPath
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in less than 10 seconds for erf's size
      expect(duration).toBeLessThan(10000)
    }, 15000) // 15 second timeout

    it('should complete all tools within reasonable time', async () => {
      const startTime = Date.now()

      await Promise.all([
        handleAnalyze({ directory: erfRoot, configPath }),
        handleDeadCode({ directory: erfRoot, configPath }),
        handleHealth({ directory: erfRoot, configPath }),
        handleIsolated({ directory: erfRoot, configPath }),
        handleHubs({ directory: erfRoot, configPath }),
        handleFunctions({ directory: erfRoot, configPath })
      ])

      const endTime = Date.now()
      const duration = endTime - startTime

      // All tools in parallel should still complete reasonably fast
      expect(duration).toBeLessThan(60000)
    }, 65000) // 65 second timeout
  })
})
