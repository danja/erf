/**
 * OrphanedUtility - Intentionally dead code for testing
 * This file is never imported anywhere and should be detected as dead code
 */

// Import something so this file isn't auto-detected as an entry point
import path from 'path'

export function unusedHelper() {
  return path.join('This function is never called')
}

export function anotherOrphanedFunction() {
  console.log('Nobody imports this file')
}

export class DeadClass {
  constructor() {
    this.message = 'This class is never instantiated'
  }

  deadMethod() {
    return 'Unreachable code'
  }
}

export default {
  unusedHelper,
  anotherOrphanedFunction,
  DeadClass
}
