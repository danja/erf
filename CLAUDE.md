# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**erf** (embarrassing relative finder) is a code quality and dependency analysis tool for JavaScript/Node.js projects. It identifies dead code, broken dependencies, isolated subgraphs, and complexity hotspots using RDF-based semantic graph analysis.

## Architecture

erf is built with three main interfaces:

1. **Core Analysis Engine** - JavaScript AST parsing with RDF graph storage
2. **CLI Interface** - Commander.js-based command-line tools
3. **MCP Server** - Model Context Protocol for AI assistant integration

### Key Components

- **FileScanner** (`src/analyzers/FileScanner.js`) - Walks directory tree, respects .gitignore
- **DependencyParser** (`src/analyzers/DependencyParser.js`) - Extracts imports/exports from JavaScript files using @babel/parser
- **RDFModel** (`src/graph/RDFModel.js`) - Wraps RDF-Ext for graph operations with custom erf ontology
- **GraphBuilder** (`src/analyzers/GraphBuilder.js`) - Orchestrates scanning, parsing, and graph construction
- **DeadCodeDetector** (`src/analyzers/DeadCodeDetector.js`) - Performs reachability analysis from entry points
- **ErfConfig** (`src/config/ErfConfig.js`) - Loads configuration from .erfrc.json with defaults

## Development Guidelines

### Code Style

- Use ES modules (`import`/`export`) throughout
- Prefer `async`/`await` over callbacks
- Use descriptive variable names
- Add JSDoc comments for public methods

### Configuration

- All user configuration in `.erfrc.json` (not hardcoded)
- Default config in `ErfConfig.js`
- Config structure:
  ```json
  {
    "entryPoints": ["src/index.js", "bin/**/*.js"],
    "ignore": ["node_modules/**", "tests/**"],
    "thresholds": { "cyclomaticComplexity": 10 }
  }
  ```

### Testing

- Use Vitest for all tests
- Tests use erf's own codebase as the test target (dogfooding)
- Run: `npm test`, `npm run test:unit`, `npm run test:integration`
- Test structure:
  - `tests/unit/` - Component-level tests
  - `tests/integration/` - Full workflow tests
- **Current status: 40/43 tests passing (93%)**

### Common Patterns

**Loading config:**
```javascript
import { ErfConfig } from './config/ErfConfig.js'
const config = await ErfConfig.load('.erfrc.json')
// config is a plain object, not ErfConfig instance
```

**Building graph:**
```javascript
import { GraphBuilder } from './analyzers/GraphBuilder.js'
const graphBuilder = new GraphBuilder(config)
await graphBuilder.buildGraph('/path/to/project')
const stats = graphBuilder.getGraph().getStats()
```

**Detecting dead code:**
```javascript
import { DeadCodeDetector } from './analyzers/DeadCodeDetector.js'
const detector = new DeadCodeDetector(rdfModel)
const result = detector.detect()
// result: { deadFiles, deadExports, reachableFiles, stats }
```

**FileScanner returns:**
```javascript
const scanResult = await fileScanner.scan(rootDir)
const files = scanResult.files  // Array of file objects
const stats = scanResult.stats  // { scanned, included, ignored }
```

**File object structure:**
```javascript
{
  path: '/absolute/path/to/file.js',
  relativePath: 'src/file.js',
  size: 1024,
  modified: Date,
  extension: '.js'
}
```

## MCP Server

The MCP server (`mcp/index.js`) provides 4 tools:

- `erf_analyze` - Full codebase analysis
- `erf_dead_code` - Find unreachable code
- `erf_health` - Health score (0-100)
- `erf_isolated` - Find isolated subgraphs

**Testing MCP locally:**
```bash
node bin/erf-mcp.js
```

**MCP Tool Schema:**
All tools accept:
- `directory` (required) - Path to analyze
- `configPath` (optional) - Path to .erfrc.json

## CLI Commands

- `erf analyze [directory]` - Analyze and generate dependency graph
- `erf dead-code [directory]` - Find dead code
- `erf health [directory]` - Generate health report
- `erf isolated [directory]` - Find isolated subgraphs
- `erf init` - Create default .erfrc.json

**Adding new CLI commands:**
Edit `bin/erf.js` and add a new `.command()` using Commander.js pattern.

## File Organization

```
erf/
├── src/
│   ├── analyzers/      # Core analysis components
│   ├── config/         # Configuration loader
│   └── graph/          # RDF model wrapper
├── mcp/
│   └── index.js        # MCP server implementation
├── bin/
│   ├── erf.js          # CLI entry point
│   └── erf-mcp.js      # MCP entry point
├── tests/
│   ├── unit/           # Component tests
│   └── integration/    # Full workflow tests
├── .erfrc.json         # Default configuration
└── package.json
```

## Dependencies

**Core:**
- `@babel/parser` - JavaScript AST parsing
- `rdf-ext` - RDF graph operations
- `commander` - CLI framework
- `ignore` - .gitignore pattern matching
- `@modelcontextprotocol/sdk` - MCP protocol

**Dev:**
- `vitest` - Test framework
- `@playwright/test` - E2E testing (future)

## Known Issues & Limitations

1. **Import path resolution incomplete** - DependencyParser doesn't fully resolve all relative imports
2. **Entry point glob patterns** - Entry points like `bin/**/*.js` need glob expansion
3. **No TypeScript support yet** - Only JavaScript (.js, .mjs, .cjs) currently supported

These are tracked and will be addressed in future iterations.

## Adding New Features

### Adding a new analyzer

1. Create class in `src/analyzers/YourAnalyzer.js`
2. Accept `rdfModel` or `config` in constructor
3. Implement main analysis method
4. Add tests in `tests/unit/analyzers/YourAnalyzer.test.js`
5. Integrate in `GraphBuilder` or create new CLI command

### Adding a new MCP tool

1. Add tool definition in `mcp/index.js` `ListToolsRequestSchema` handler
2. Implement handler method (e.g., `handleYourTool`)
3. Add case in `CallToolRequestSchema` switch statement
4. Return formatted response with `content` array

### Adding configuration options

1. Add to default config in `ErfConfig.js` `loadConfig()` method
2. Document in README.md Configuration section
3. Update `.erfrc.json` example

## Common Tasks

**Run erf on itself:**
```bash
npm run analyze
```

**Run specific test:**
```bash
npx vitest tests/unit/analyzers/FileScanner.test.js
```

**Test MCP server manually:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node bin/erf-mcp.js
```

**Debug with verbose output:**
Add `console.log` statements (output goes to stderr in MCP mode to avoid polluting stdio protocol).

## Performance Considerations

- DependencyParser caches parsed ASTs to avoid reparsing
- FileScanner uses ignore library for efficient pattern matching
- RDF graph queries should use specific predicates (not `null, null, null`)
- For large codebases (1000+ files), consider implementing incremental analysis

## Troubleshooting

**Tests failing:**
- Check if dependencies installed: `npm install`
- Verify Node.js version: `node --version` (>=18.0.0)
- Check working directory matches erf root

**MCP not working in Claude Code:**
- Verify absolute path in mcp.json
- Check node is in PATH
- Test MCP server: `node bin/erf-mcp.js`
- Check stderr for error messages

**Analysis not finding files:**
- Check .erfrc.json ignore patterns
- Verify entry points are correct
- Check file extensions (.js, .mjs, .cjs)

## Contributing

When contributing to erf:

1. Run tests: `npm test`
2. Ensure 90%+ pass rate maintained
3. Add tests for new features
4. Update documentation (README.md, this file)
5. Follow existing code patterns
6. Use descriptive commit messages

## Resources

- RDF-Ext documentation: https://rdf-ext.org/
- MCP specification: https://modelcontextprotocol.io/
- Babel parser: https://babeljs.io/docs/babel-parser
- Commander.js: https://github.com/tj/commander.js

---

**Last updated:** 2025-09-30
