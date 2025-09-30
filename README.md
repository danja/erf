# erf - Embarrassing Relative Finder

A code quality and dependency analysis tool that helps identify dead code, broken dependencies, isolated subgraphs, and complexity hotspots in your codebase.

## Overview

**erf** analyzes JavaScript/Node.js projects to find code quality issues that might be embarrassing if discovered by others:

- 🔍 **Dead Code Detection** - Functions, classes, and modules that are never imported or called
- 🔗 **Broken Dependencies** - Missing imports, circular dependencies, unresolved modules
- 🏝️ **Isolated Subgraphs** - Code clusters with no connections to the main application
- 🔥 **Complexity Hotspots** - Files and functions with high cyclomatic complexity
- 📊 **Dependency Health** - Overall codebase health scores and metrics

## Architecture

erf is designed as a standalone Node.js tool with three interfaces:

1. **Core Analysis Engine** - JavaScript AST parsing and RDF-based dependency graph
2. **MCP Server** - Model Context Protocol integration for AI assistants
3. **Web GUI** - Interactive force-directed graph visualization

### RDF-Based Graph Model

Uses RDF-Ext to model code structure as a semantic graph with custom ontology:

```turtle
@prefix erf: <http://example.org/erf#> .
@prefix code: <http://example.org/code#> .

# Nodes
erf:File, erf:Module, erf:Function, erf:Class, erf:Variable

# Edges
erf:imports, erf:exports, erf:calls, erf:extends, erf:references

# Properties
code:loc, code:complexity, code:lastModified, erf:isEntryPoint, erf:isExternal
```

## Installation

```bash
npm install -g erf-analyzer
```

Or use locally:

```bash
npm install erf-analyzer
npx erf analyze
```

## Usage

### CLI

```bash
# Analyze current directory
erf analyze

# Analyze specific directory
erf analyze /path/to/project

# Output formats
erf analyze --format json
erf analyze --format rdf
erf analyze --format html

# Find dead code only
erf dead-code

# Find isolated subgraphs
erf isolated

# Generate health report
erf health
```

### MCP Server

```bash
# Start MCP server (stdio)
erf-mcp

# Or use via Claude Desktop / other MCP clients
```

Available MCP tools:
- `erf_analyze` - Full codebase analysis
- `erf_dead_code` - Find unused code
- `erf_isolated` - Find disconnected modules
- `erf_health` - Get health metrics

### Configuration

Create `.erfrc.json` in your project root:

```json
{
  "entryPoints": ["src/index.js", "src/server.js"],
  "ignore": ["node_modules/**", "dist/**", "**/*.test.js"],
  "thresholds": {
    "complexity": 10,
    "minReferences": 1
  },
  "analyzers": {
    "deadCode": true,
    "complexity": true,
    "isolated": true
  }
}
```

## Features

### Dead Code Detection

- **Semantic dead code** - Modules imported but never used
- **Unreachable functions** - Not called from any entry point
- **Unused exports** - Exported but never imported
- **Orphaned files** - Not in dependency graph

### Dependency Analysis

- ES modules (`import`/`export`)
- CommonJS (`require`/`module.exports`)
- Dynamic imports
- Circular dependency detection
- Missing module resolution

### Complexity Metrics

- Lines of code (LOC)
- Cyclomatic complexity
- Dependency depth
- Fan-in/fan-out analysis

### Interactive GUI

- Force-directed graph visualization (D3.js)
- Node filtering and search
- Zoom/pan navigation
- Click to view source code
- Color-coded health indicators

## Development

```bash
# Clone repository
git clone https://github.com/danja/erf.git
cd erf

# Install dependencies
npm install

# Run tests
npm test

# Run in development
npm run dev

# Build for production
npm run build
```

## Project Structure

```
erf/
├── src/
│   ├── analyzers/          # Core analysis components
│   │   ├── FileScanner.js
│   │   ├── DependencyParser.js
│   │   ├── GraphBuilder.js
│   │   └── DeadCodeDetector.js
│   ├── config/
│   │   └── ErfConfig.js
│   ├── graph/
│   │   └── RDFModel.js     # RDF-Ext wrapper
│   └── utils/
│       └── ASTWalker.js
├── mcp/
│   ├── index.js            # MCP server entry
│   └── tools.js            # MCP tool definitions
├── ui/
│   ├── src/
│   │   ├── App.vue
│   │   ├── components/
│   │   └── stores/
│   └── vite.config.js
├── bin/
│   ├── erf.js              # CLI entry
│   └── erf-mcp.js          # MCP entry
├── tests/
├── .erfrc.json             # Default config
└── package.json
```

## Technical Approach

### Phase 1: Discovery & Parsing
1. Scan filesystem respecting `.gitignore` and config patterns
2. Parse JavaScript files with Babel to generate AST
3. Extract imports, exports, function calls from AST

### Phase 2: Graph Construction
1. Build RDF graph with files/modules/functions as nodes
2. Create edges for imports, exports, calls, references
3. Identify entry points from config

### Phase 3: Analysis
1. **Dead code**: Traverse from entry points, mark unreachable nodes
2. **Isolated subgraphs**: Find connected components with no entry point
3. **Complexity**: Calculate metrics per file/function
4. **Health scores**: Aggregate metrics into overall scores

### Phase 4: Output
1. CLI: Text reports with colored output
2. JSON: Structured data for CI/CD integration
3. RDF: Export graph for further semantic analysis
4. HTML: Interactive visualization

## Roadmap

- [x] Project initialization and structure
- [x] FileScanner implementation
- [x] DependencyParser (ES modules + CommonJS)
- [ ] RDF graph model wrapper
- [ ] GraphBuilder for dependency graph construction
- [ ] DeadCodeDetector algorithm
- [ ] CLI interface with Commander.js
- [ ] MCP server with stdio protocol
- [ ] Web GUI with Vue 3 + D3.js
- [ ] TypeScript support
- [ ] Multi-language support (Python, Go, etc.)
- [ ] CI/CD integration examples
- [ ] VSCode extension

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Status 2025-09-30

### Completed ✅

1. **Project Initialization**
   - Created package.json with all dependencies (@babel/parser, acorn, rdf-ext, commander, etc.)
   - Set up directory structure (src/, mcp/, ui/, tests/, bin/)
   - Created .erfrc.json default configuration

2. **ErfConfig.js** - Configuration Management
   - Loads user config from .erfrc.json
   - Merges with sensible defaults
   - Provides validation methods
   - Location: `/home/danny/hyperdata/erf/src/config/ErfConfig.js`

3. **FileScanner.js** - Filesystem Analysis
   - Walks directory tree recursively
   - Respects .gitignore patterns using ignore library
   - Supports custom ignore patterns from config
   - Returns file info with stats (size, mtime, etc.)
   - Location: `/home/danny/hyperdata/erf/src/analyzers/FileScanner.js`

4. **DependencyParser.js** - AST-Based Dependency Extraction
   - Parses JavaScript files using @babel/parser
   - Extracts ES module imports/exports (`import`, `export`)
   - Extracts CommonJS dependencies (`require`, `module.exports`)
   - Handles dynamic imports and require() with variables
   - Resolves relative import paths to absolute paths
   - Distinguishes external packages from local files
   - Implements caching for performance
   - Location: `/home/danny/hyperdata/erf/src/analyzers/DependencyParser.js`
   - 350+ lines of production-ready code

### In Progress 🔄

5. **Documentation**
   - Created comprehensive README.md with usage examples, architecture overview, and development roadmap

### Next Steps ⏳

6. **RDFModel.js** - RDF-Ext Wrapper
   - Wrap RDF-Ext library with convenience methods
   - Implement custom erf ontology (erf:, code: namespaces)
   - Provide methods to add nodes (files, modules, functions)
   - Provide methods to add edges (imports, exports, calls)
   - Query interface for graph analysis

7. **GraphBuilder.js** - Dependency Graph Construction
   - Use FileScanner + DependencyParser to build complete graph
   - Populate RDF model with nodes and edges
   - Identify entry points
   - Mark external dependencies

8. **DeadCodeDetector.js** - Reachability Analysis
   - Traverse graph from entry points
   - Mark reachable nodes
   - Report unreachable code (dead code)
   - Detect unused exports

9. **MCP Server Interface**
   - Implement stdio protocol server
   - Define MCP tools (analyze, dead-code, isolated, health)
   - Tool parameter validation with Zod schemas

10. **Web GUI**
    - Vite + Vue 3 setup
    - D3.js force-directed graph visualization
    - Interactive filtering and search
    - Source code viewer

### Technical Decisions

- **RDF-based graph model**: Chosen for semantic flexibility and future extensibility
- **Babel parser**: More robust than acorn for modern JavaScript syntax
- **Modular architecture**: Each analyzer is independent and testable
- **Plugin-ready**: Designed to support additional languages and analyzers
- **MCP integration**: First-class support for AI assistant integration

### Performance Considerations

- DependencyParser uses caching to avoid reparsing unchanged files
- FileScanner respects .gitignore to avoid scanning unnecessary files
- RDF graph operations will use indexed queries for efficiency
- Large codebases will support incremental analysis mode

### Notes

- Following semem project patterns for MCP integration
- Configuration follows common patterns (.erfrc.json similar to .eslintrc)
- CLI will use Commander.js for consistency with Node.js ecosystem
- GUI will be embeddable in other tools (similar to semem workbench)
