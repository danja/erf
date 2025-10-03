# Code Analysis Report

**Project:** /home/danny/hyperdata/erf
**Generated:** 2025-10-03T08:26:07.768Z

## Summary

- **Total Files:** 25
- **Functions/Methods:** 158
- **Imports:** 79
- **Exports:** 11
- **Entry Points:** 6
- **External Dependencies:** 15

## Health Score

🟡 **76/100**

- Reachability: 96%
- Connectivity: 31.6 imports/file
- Code Redundancy: 5.1%

## Dead Code Analysis

- **Reachable Files:** 24/25
- **Dead Files:** 1
- **Unused Exports:** 3

### Dead Files

- `./src/utils/OrphanedUtility.js` - Not reachable from any entry point

## Duplicate Methods

Found 4 duplicate method name(s):

🔄 **detect** (2 occurrences, cross-class)
  - ./src/analyzers/DeadCodeDetector.js:18
  - ./src/analyzers/DuplicateDetector.js:33

🔄 **getStats** (2 occurrences, cross-class)
  - ./src/analyzers/FileScanner.js:174
  - ./src/graph/RDFModel.js:440

🔄 **analyze** (2 occurrences, cross-class)
  - ./ui/src/api.js:15
  - ./ui/src/main.js:44

🔄 **exportRdf** (2 occurrences, cross-class)
  - ./ui/src/api.js:63
  - ./ui/src/main.js:89

## Largest Files

1. `./bin/erf.js` - 446 lines
2. `./src/analyzers/GraphBuilder.js` - 372 lines
3. `./src/graph/RDFModel.js` - 310 lines
4. `./ui/src/graph.js` - 292 lines
5. `./src/analyzers/DependencyParser.js` - 287 lines

## Recommendations

- 🧹 Remove 1 dead file(s) to reduce codebase size
