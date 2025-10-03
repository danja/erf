#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

console.log('Starting erf GUI...')
console.log('Root directory:', rootDir)

// Start API server
console.log('\n🚀 Starting API server on port 3001...')
const apiServer = spawn('node', [path.join(rootDir, 'ui/server.js')], {
  stdio: 'inherit',
  cwd: rootDir
})

// Wait a moment for API server to start, then start Vite dev server
setTimeout(() => {
  console.log('\n🎨 Starting Vite dev server...')
  const viteServer = spawn('npx', ['vite'], {
    stdio: 'inherit',
    cwd: path.join(rootDir, 'ui'),
    shell: process.platform === 'win32' // Only use shell on Windows for npx
  })

  // Handle process termination
  const cleanup = () => {
    console.log('\n\n🛑 Shutting down erf GUI...')
    apiServer.kill()
    viteServer.kill()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  viteServer.on('exit', (code) => {
    console.log(`\nVite server exited with code ${code}`)
    apiServer.kill()
    process.exit(code)
  })

  apiServer.on('exit', (code) => {
    console.log(`\nAPI server exited with code ${code}`)
    viteServer.kill()
    process.exit(code)
  })
}, 2000)

apiServer.on('error', (err) => {
  console.error('Failed to start API server:', err)
  process.exit(1)
})
