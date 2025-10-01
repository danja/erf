import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const erfRoot = path.resolve(__dirname, '../..')
const erfBin = path.join(erfRoot, 'bin/erf.js')

/**
 * Execute erf CLI command and capture output
 */
function runErf(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [erfBin, ...args], {
      cwd: options.cwd || erfRoot,
      env: { ...process.env, ...options.env }
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

describe('CLI Integration Tests', () => {
  const tempDir = path.join(erfRoot, '.tmp-test-cli')

  beforeAll(async () => {
    // Create temp directory for test outputs
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterAll(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('Default command: erf [path]', () => {
    it('should generate comprehensive report when run without options', async () => {
      const result = await runErf(['.'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('# Code Analysis Report')
      expect(result.stdout).toContain('## Summary')
      expect(result.stdout).toContain('## Health Score')
      expect(result.stdout).toContain('## Dead Code Analysis')
      expect(result.stdout).toContain('## Largest Files')
      expect(result.stdout).toContain('## Recommendations')
    }, 30000)

    it('should include statistics in report', async () => {
      const result = await runErf(['.'])

      expect(result.code).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toMatch(/\*\*Total Files:\*\* \d+/)
      expect(output).toMatch(/\*\*Functions\/Methods:\*\* \d+/)
      expect(output).toMatch(/\*\*Imports:\*\* \d+/)
      expect(output).toMatch(/\*\*Exports:\*\* \d+/)
      expect(output).toMatch(/\*\*Entry Points:\*\* \d+/)
    }, 30000)

    it('should include health score with emoji', async () => {
      const result = await runErf(['.'])

      expect(result.code).toBe(0)
      expect(result.stdout).toMatch(/[🟢🟡🟠🔴] \*\*\d+\/100\*\*/)
      expect(result.stdout).toContain('Reachability:')
      expect(result.stdout).toContain('Connectivity:')
    }, 30000)

    it('should list largest files', async () => {
      const result = await runErf(['.'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('## Largest Files')
      expect(result.stdout).toMatch(/1\. `.*` - \d+ lines/)
    }, 30000)
  })

  describe('-f flag: Save report to file', () => {
    it('should save report to specified file', async () => {
      const reportFile = path.join(tempDir, 'test-report.md')
      const result = await runErf(['.', '-f', reportFile])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain(`✓ Report saved to: ${reportFile}`)

      // Check file exists and has content
      const content = await fs.readFile(reportFile, 'utf-8')
      expect(content).toContain('# Code Analysis Report')
      expect(content).toContain('## Summary')
      expect(content).toContain('## Health Score')
    }, 30000)

    it('should use default filename when -f used without argument', async () => {
      const defaultFile = path.join(erfRoot, 'erf-report.md')
      const result = await runErf(['.', '-f'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('✓ Report saved to: erf-report.md')

      // Clean up
      await fs.unlink(defaultFile).catch(() => {})
    }, 30000)
  })

  describe('-r flag: Export RDF Turtle', () => {
    it('should export RDF to specified file', async () => {
      const rdfFile = path.join(tempDir, 'test.ttl')
      const result = await runErf(['.', '-r', rdfFile])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain(`✓ RDF exported to: ${rdfFile}`)

      // Check file exists and has RDF content
      const content = await fs.readFile(rdfFile, 'utf-8')
      expect(content).toContain('<file://')
      expect(content).toContain('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
      expect(content).toContain('http://purl.org/stuff/erf/File')
    }, 30000)

    it('should use default filename when -r used without argument', async () => {
      const defaultFile = path.join(erfRoot, 'erf.ttl')
      const result = await runErf(['.', '-r'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('✓ RDF exported to: erf.ttl')

      // Clean up
      await fs.unlink(defaultFile).catch(() => {})
    }, 30000)

    it('should export RDF and still show report', async () => {
      const rdfFile = path.join(tempDir, 'with-report.ttl')
      const result = await runErf(['.', '-r', rdfFile])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('✓ RDF exported to:')
      expect(result.stdout).toContain('# Code Analysis Report')
    }, 30000)
  })

  describe('-e flag: Critical path tracing', () => {
    it('should trace dependencies from entry point', async () => {
      const result = await runErf(['.', '-e', 'bin/erf.js'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('## Critical Path Analysis')
      expect(result.stdout).toContain('Entry point: `bin/erf.js`')
      expect(result.stdout).toContain('### Dependencies (Critical Path)')
      expect(result.stdout).toMatch(/\d+\. `.*`/)
    }, 30000)

    it('should show GraphBuilder and RDFModel in critical path', async () => {
      const result = await runErf(['.', '-e', 'bin/erf.js'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('GraphBuilder.js')
      expect(result.stdout).toContain('RDFModel.js')
    }, 30000)

    it('should handle non-existent entry point', async () => {
      const result = await runErf(['.', '-e', 'nonexistent/file.js'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('⚠️ Entry point not found')
    }, 30000)
  })

  describe('Combined flags', () => {
    it('should work with -f and -r together', async () => {
      const reportFile = path.join(tempDir, 'combined-report.md')
      const rdfFile = path.join(tempDir, 'combined.ttl')
      const result = await runErf(['.', '-f', reportFile, '-r', rdfFile])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain(`✓ RDF exported to: ${rdfFile}`)
      expect(result.stdout).toContain(`✓ Report saved to: ${reportFile}`)

      // Verify both files exist
      const reportContent = await fs.readFile(reportFile, 'utf-8')
      const rdfContent = await fs.readFile(rdfFile, 'utf-8')

      expect(reportContent).toContain('# Code Analysis Report')
      expect(rdfContent).toContain('<file://')
    }, 30000)

    it('should work with -f, -r, and -e together', async () => {
      const reportFile = path.join(tempDir, 'full-report.md')
      const rdfFile = path.join(tempDir, 'full.ttl')
      const result = await runErf(['.', '-f', reportFile, '-r', rdfFile, '-e', 'bin/erf.js'])

      expect(result.code).toBe(0)

      const reportContent = await fs.readFile(reportFile, 'utf-8')
      expect(reportContent).toContain('## Critical Path Analysis')
      expect(reportContent).toContain('Entry point: `bin/erf.js`')
    }, 30000)
  })

  describe('Custom config', () => {
    it('should accept -c flag for custom config', async () => {
      const result = await runErf(['.', '-c', '.erfrc.json'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('# Code Analysis Report')
    }, 30000)
  })

  describe('Error handling', () => {
    it('should handle non-existent directory', async () => {
      const result = await runErf(['/nonexistent/directory/12345'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Error:')
    }, 30000)
  })

  describe('Exit codes', () => {
    it('should exit 0 for healthy codebase', async () => {
      const result = await runErf(['.'])

      // erf's own codebase should be healthy
      expect(result.code).toBe(0)
    }, 30000)
  })
})
