/**
 * Dead code fixture - This file is intentionally isolated and not imported anywhere
 * Used for testing dead code detection
 */

// This function is never used anywhere
export function orphanedFunction() {
  return 'I am alone in the world'
}

// Another unused function
export function abandonedMethod() {
  console.log('Nobody calls me')
}

// Class that's never instantiated
export class IsolatedClass {
  constructor() {
    this.message = 'I exist in isolation'
  }

  unusedMethod() {
    return this.message
  }
}

// Variable that's exported but never imported
export const ORPHANED_CONSTANT = 'I have no purpose'

// Default export that's never used
export default function deadDefaultExport() {
  return 'This should be detected as dead code'
}
