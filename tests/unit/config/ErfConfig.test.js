import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ErfConfig } from '../../../src/config/ErfConfig.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('ErfConfig', () => {
  const testConfigPath = path.join(__dirname, '.erfrc.test.json')

  afterEach(async () => {
    // Clean up test config file
    try {
      await fs.unlink(testConfigPath)
    } catch {
      // Ignore if file doesn't exist
    }
  })

  describe('load', () => {
    it('should load config from file', async () => {
      const testConfig = {
        entryPoints: ['src/test.js'],
        ignore: ['test/**']
      }

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig))

      const config = await ErfConfig.load(testConfigPath)

      expect(config.entryPoints).toEqual(['src/test.js'])
      expect(config.ignore).toEqual(['test/**'])
    })

    it('should return defaults when config file does not exist', async () => {
      const config = await ErfConfig.load('nonexistent.json')

      expect(config.entryPoints).toBeDefined()
      expect(config.ignore).toBeDefined()
      expect(config.thresholds).toBeDefined()
      expect(config.analyzers).toBeDefined()
    })

    it('should merge user config with defaults', async () => {
      const testConfig = {
        entryPoints: ['custom.js']
      }

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig))

      const config = await ErfConfig.load(testConfigPath)

      expect(config.entryPoints).toEqual(['custom.js'])
      expect(config.ignore).toBeDefined() // Should have default ignore patterns
      expect(config.thresholds).toBeDefined()
    })
  })

  describe('default values', () => {
    it('should have sensible default entry points', async () => {
      const config = await ErfConfig.load('nonexistent.json')

      expect(config.entryPoints).toContain('src/index.js')
    })

    it('should ignore node_modules by default', async () => {
      const config = await ErfConfig.load('nonexistent.json')

      expect(config.ignore).toContain('node_modules/**')
    })

    it('should have complexity threshold', async () => {
      const config = await ErfConfig.load('nonexistent.json')

      expect(config.thresholds.complexity).toBe(10)
    })

    it('should enable all analyzers by default', async () => {
      const config = await ErfConfig.load('nonexistent.json')

      expect(config.analyzers.deadCode).toBe(true)
      expect(config.analyzers.complexity).toBe(true)
      expect(config.analyzers.isolated).toBe(true)
    })
  })
})
