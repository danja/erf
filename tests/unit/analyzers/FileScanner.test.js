import { describe, it, expect } from 'vitest'
import { FileScanner } from '../../../src/analyzers/FileScanner.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('FileScanner', () => {
  describe('scan', () => {
    it('should scan erf project and find JavaScript files', async () => {
      const erfRoot = path.resolve(__dirname, '../../..')
      const config = {
        ignore: ['node_modules/**', 'dist/**', 'tests/**']
      }

      const scanner = new FileScanner(config)
      const files = await scanner.scan(erfRoot)

      expect(files.length).toBeGreaterThan(0)
      expect(files.every(f => f.path.endsWith('.js'))).toBe(true)

      // Should find our core files
      const filePaths = files.map(f => f.path)
      expect(filePaths.some(p => p.includes('FileScanner.js'))).toBe(true)
      expect(filePaths.some(p => p.includes('DependencyParser.js'))).toBe(true)
      expect(filePaths.some(p => p.includes('GraphBuilder.js'))).toBe(true)
    })

    it('should respect ignore patterns', async () => {
      const erfRoot = path.resolve(__dirname, '../../..')
      const config = {
        ignore: ['node_modules/**', '**/FileScanner.js']
      }

      const scanner = new FileScanner(config)
      const files = await scanner.scan(erfRoot)

      const filePaths = files.map(f => f.path)
      expect(filePaths.some(p => p.includes('FileScanner.js'))).toBe(false)
    })

    it('should return file stats', async () => {
      const erfRoot = path.resolve(__dirname, '../../..')
      const config = { ignore: ['node_modules/**'] }

      const scanner = new FileScanner(config)
      const files = await scanner.scan(erfRoot)

      expect(files[0].stats).toBeDefined()
      expect(files[0].stats.size).toBeGreaterThan(0)
      expect(files[0].stats.mtime).toBeInstanceOf(Date)
    })

    it('should handle directories with no JavaScript files', async () => {
      const emptyDir = path.resolve(__dirname, '../../..')
      const config = {
        ignore: ['**/*.js'] // Ignore all JS files
      }

      const scanner = new FileScanner(config)
      const files = await scanner.scan(emptyDir)

      expect(files.length).toBe(0)
    })
  })
})
