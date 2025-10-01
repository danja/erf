/**
 * Centralized logging module built on loglevel
 * Features:
 * - Configurable stdout logging (can be disabled for MCP STDIO)
 * - File logging to logs/ directory
 * - Automatic log rotation (keeps last 2 runs)
 * - DateTime-stamped log files
 */

import log from 'loglevel'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class Logger {
  constructor() {
    this.logsDir = join(__dirname, '../../logs')
    this.currentLogFile = null
    this.fileStream = null
    this.stdoutEnabled = true
    this.initialized = false
  }

  /**
   * Initialize the logger
   * @param {Object} options
   * @param {boolean} options.stdout - Enable stdout logging (default: true)
   * @param {string} options.level - Log level (default: 'info')
   */
  async init(options = {}) {
    if (this.initialized) return

    this.stdoutEnabled = options.stdout !== false
    const level = options.level || process.env.LOG_LEVEL || 'info'

    // Set log level
    log.setLevel(level)

    // Create logs directory
    await this.ensureLogsDir()

    // Rotate old logs
    await this.rotateLogs()

    // Create new log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    this.currentLogFile = join(this.logsDir, `erf-${timestamp}.log`)

    // Override loglevel's methodFactory to add file logging
    const originalFactory = log.methodFactory
    log.methodFactory = (methodName, logLevel, loggerName) => {
      const rawMethod = originalFactory(methodName, logLevel, loggerName)

      return (...args) => {
        // Format message
        const timestamp = new Date().toISOString()
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')
        const logLine = `[${timestamp}] [${methodName.toUpperCase()}] ${message}\n`

        // Write to file
        this.writeToFile(logLine)

        // Optionally write to stdout
        if (this.stdoutEnabled) {
          rawMethod(...args)
        }
      }
    }

    // Rebuild logger with new factory
    log.setLevel(log.getLevel())

    this.initialized = true
  }

  /**
   * Ensure logs directory exists
   */
  async ensureLogsDir() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Rotate logs - keep only last 2 runs
   */
  async rotateLogs() {
    try {
      const files = await fs.readdir(this.logsDir)
      const logFiles = files
        .filter(f => f.startsWith('erf-') && f.endsWith('.log'))
        .sort()
        .reverse()

      // Keep last log, delete older ones
      for (let i = 1; i < logFiles.length; i++) {
        try {
          await fs.unlink(join(this.logsDir, logFiles[i]))
        } catch (error) {
          // Ignore errors deleting old logs
        }
      }
    } catch (error) {
      // Logs directory might not exist yet
    }
  }

  /**
   * Write log line to file
   */
  writeToFile(line) {
    if (!this.currentLogFile) return

    // Append to file asynchronously (fire and forget)
    fs.appendFile(this.currentLogFile, line).catch(err => {
      // Fallback to stderr if file write fails
      if (this.stdoutEnabled) {
        console.error('Failed to write to log file:', err.message)
      }
    })
  }

  /**
   * Get the underlying loglevel instance
   */
  getLogger() {
    return log
  }

  /**
   * Enable/disable stdout logging
   */
  setStdout(enabled) {
    this.stdoutEnabled = enabled
  }
}

// Singleton instance
const loggerInstance = new Logger()

/**
 * Initialize logger (call once at app startup)
 */
export async function initLogger(options = {}) {
  await loggerInstance.init(options)
}

/**
 * Get logger instance
 */
export function getLogger() {
  // Auto-initialize with defaults if not initialized
  if (!loggerInstance.initialized) {
    loggerInstance.init().catch(err => {
      console.error('Failed to initialize logger:', err)
    })
  }
  return loggerInstance.getLogger()
}

/**
 * Set stdout logging on/off
 */
export function setStdout(enabled) {
  loggerInstance.setStdout(enabled)
}

// Export logger methods directly for convenience
export const logger = {
  trace: (...args) => getLogger().trace(...args),
  debug: (...args) => getLogger().debug(...args),
  info: (...args) => getLogger().info(...args),
  warn: (...args) => getLogger().warn(...args),
  error: (...args) => getLogger().error(...args)
}

export default logger
