# erf Implementation Plan

**embarrassing relative finder** - A tool to identify unused code, broken dependencies, and complexity hotspots in codebases.

## Architecture Overview

Standalone Node.js tool with three interfaces:
1. **Core Analysis Engine** - Dependency graph builder using RDF-Ext
2. **MCP Server** - Atomic tools for AI-assisted refactoring
3. **Web GUI** - Force-directed graph visualization with Vite (vanilla JS + D3.js, no Vue)

## Deep Analysis & Architectural Decisions

### Core Problem

erf identifies "embarrassing relatives" in codebases:
1. **Dead code** - unused files, functions, classes
2. **Broken dependencies** - import/require statements that don't resolve
3. **Isolated subgraphs** - code islands with few connections
4. **Complexity hotspots** - excessively long files/functions

### Key Technical Decisions

#### 1. Dependency Analysis Engine

**Static Analysis Approach:**
- Parse AST (Abstract Syntax Tree) using `@babel/parser` or `acorn`
- Support both ES modules (`import/export`) and CommonJS (`require/module.exports`)
- Handle dynamic imports: `import()`, `require()` with variables
- Track re-exports: `export * from './module'`

**Graph Model:**
- Use RDF-Ext as specified (excellent choice for flexibility)
- Node types: File, Module, Class, Function, Variable
- Edge types: imports, exports, calls, extends, implements
- Store metadata: LOC, complexity metrics, last modified

#### 2. Dead Code Detection Strategies

**Entry Point Analysis:**
- Start from package.json `main`, `bin`, `exports`
- Identify test files (common patterns: `*.test.js`, `*.spec.js`)
- Mark everything reachable from these as "live"
- Unreachable nodes = dead code candidates

**False Positive Mitigation:**
- Dynamic requires can hide real dependencies
- Config files might be loaded dynamically
- CLI tools might have implicit entry points
- Solution: Allow user-configured entry points and ignore patterns

#### 3. Isolation Detection

**Subgraph Analysis:**
- Use connected components algorithm on undirected graph
- Small isolated subgraphs (<3 nodes) = high suspicion
- Measure "coupling score" - ratio of internal to external edges
- Highly isolated but large subgraphs = potential architectural issues

#### 4. Complexity Metrics

**Multi-level Granularity:**
- **File level**: LOC, number of exports, number of dependencies
- **Function level**: Cyclomatic complexity, LOC, parameter count
- **Class level**: Number of methods, inheritance depth

**Thresholds (configurable):**
- Files: >500 LOC = warning, >1000 LOC = error
- Functions: >50 LOC or complexity >10 = warning
- Classes: >20 methods = warning

## Implementation Phases

### Phase 1: Project Foundation

**Files to create:**
- `package.json` - Dependencies and scripts
- `.erfrc.json` - Default configuration
- Project structure: `src/`, `mcp/`, `ui/`, `tests/`
- `src/config/ErfConfig.js` - Configuration loader

**Dependencies:**
- Core: `@babel/parser`, `acorn`, `acorn-walk`, `rdf-ext`, `@rdfjs/dataset`
- CLI: `commander`, `glob`, `ignore`, `loglevel`
- Dev: `vitest`, `@playwright/test`, `vite`, `@vitejs/plugin-vue`
- UI: `vue`, `d3`, `pinia`

### Phase 2: Core Analysis Engine

```
src/
├── analyzers/
│   ├── FileScanner.js          # Walks directory tree, respects .gitignore
│   ├── DependencyParser.js     # Parses imports/exports from source
│   ├── GraphBuilder.js         # Constructs RDF graph from parsed data
│   └── MetricsCollector.js     # Gathers LOC, complexity metrics
├── graph/
│   ├── RDFModel.js             # RDF-Ext wrapper
│   ├── GraphQueries.js         # SPARQL-like queries for analysis
│   └── GraphAlgorithms.js      # Connected components, centrality, etc.
├── detectors/
│   ├── DeadCodeDetector.js     # Entry point reachability analysis
│   ├── IsolationDetector.js    # Subgraph isolation metrics
│   └── ComplexityDetector.js   # LOC and complexity thresholds
└── config/
    └── ErfConfig.js            # User configuration loader
```

**Implementation order:**
1. `FileScanner.js` - Walk directory tree respecting .gitignore
2. `DependencyParser.js` - Parse ES modules + CommonJS imports/exports
3. `RDFModel.js` - Wrap RDF-Ext with convenience methods
4. `GraphBuilder.js` - Construct RDF graph with files, modules, functions
5. `MetricsCollector.js` - Gather LOC and cyclomatic complexity
6. `GraphAlgorithms.js` - Connected components, reachability
7. `DeadCodeDetector.js` - Entry point reachability analysis
8. `IsolationDetector.js` - Subgraph isolation metrics
9. `ComplexityDetector.js` - Apply thresholds to metrics

### Phase 3: MCP Server Interface

```
mcp/
├── index.js                    # MCP server entry point (stdio)
├── tools/
│   ├── analyze-codebase.js     # Full analysis tool
│   ├── find-dead-code.js       # Dead code specific
│   ├── find-isolated.js        # Isolation specific
│   ├── check-complexity.js     # Complexity specific
│   └── get-metrics.js          # Get stats for specific file/module
└── resources/
    ├── graph-data.js           # Expose RDF graph as resource
    └── analysis-report.js      # Formatted report resource
```

**MCP Tools Design:**
- Keep tools atomic and composable
- Claude can chain them: analyze → find-dead-code → suggest-removal
- Return structured data, not just text
- Include confidence scores for each finding

**Tool Specifications:**

1. **analyze-codebase**
   - Input: `{ path: string, config?: object }`
   - Output: Complete analysis with all metrics
   - Use: Initial full scan of codebase

2. **find-dead-code**
   - Input: `{ path: string, entryPoints?: string[] }`
   - Output: List of unreachable files/functions with paths
   - Use: Identify safe-to-remove code

3. **find-isolated**
   - Input: `{ path: string, minSize?: number }`
   - Output: Isolated subgraphs with coupling scores
   - Use: Find architectural issues

4. **check-complexity**
   - Input: `{ path: string, file?: string }`
   - Output: Files/functions exceeding thresholds
   - Use: Identify refactoring candidates

5. **get-metrics**
   - Input: `{ file: string }`
   - Output: Detailed metrics for specific file
   - Use: Detailed inspection

### Phase 4: Web GUI Visualization

```
ui/
├── src/
│   ├── components/
│   │   ├── DependencyGraph.vue    # Force-directed graph visualization
│   │   ├── NodeDetail.vue         # Detail panel for selected node
│   │   ├── FilterPanel.vue        # Filter by type, metrics
│   │   └── MetricsTable.vue       # Tabular view of findings
│   ├── stores/
│   │   └── graphStore.js          # Pinia store for graph data
│   ├── services/
│   │   └── api.js                 # Fetch data from analysis engine
│   └── App.vue
├── public/
└── vite.config.js
```

**Visualization Features:**
- Force-directed layout using D3.js
- Node size = LOC or complexity score
- Node color = category (dead, isolated, complex, healthy)
- Click node → show details + code snippet
- Drag to rearrange, zoom/pan
- Filter: show only files, only dead code, only >500 LOC, etc.

**Color Scheme:**
- 🔴 Red: Dead code (unreachable)
- 🟠 Orange: Isolated (weak connectivity)
- 🟡 Yellow: Complex (exceeds thresholds)
- 🟢 Green: Healthy
- ⚪ Gray: Not analyzed

### Phase 5: Testing & Deployment

```
tests/
├── unit/
│   ├── analyzers/
│   │   ├── FileScanner.test.js
│   │   ├── DependencyParser.test.js
│   │   └── MetricsCollector.test.js
│   ├── graph/
│   │   ├── RDFModel.test.js
│   │   └── GraphAlgorithms.test.js
│   └── detectors/
│       ├── DeadCodeDetector.test.js
│       ├── IsolationDetector.test.js
│       └── ComplexityDetector.test.js
├── integration/
│   ├── full-analysis.test.js
│   └── mcp-tools.test.js
└── e2e/
    └── gui.playwright.test.js
```

**Testing Strategy:**
- Unit tests for each analyzer/detector
- Integration tests on sample codebases
- E2E tests for GUI interactions
- MCP protocol compliance tests

**Deployment:**
- Publish to npm as `erf-analyzer`
- Install: `npm install --save-dev erf-analyzer`
- CLI: `npx erf analyze`, `npx erf gui`
- MCP: `npx erf-mcp` (stdio server)

## Technical Considerations

### 1. Performance

**Optimization strategies:**
- Large codebases (1000+ files) need optimization
- Stream file parsing rather than loading all in memory
- Cache parsed ASTs (invalidate on file change)
- Incremental graph updates for watch mode
- Use worker threads for parallel file analysis

**Benchmarks to target:**
- 100 files: <5 seconds
- 1000 files: <30 seconds
- 10000 files: <3 minutes

### 2. Language Support

**Initial:**
- JavaScript (ES modules + CommonJS)
- Handle `.js`, `.mjs`, `.cjs` extensions

**Architecture for extensibility:**
- Plugin system for language-specific parsers
- Abstract parser interface
- Future: TypeScript, Python, Go, Rust

### 3. Configuration

**`.erfrc.json` format:**
```json
{
  "entryPoints": ["src/index.js", "bin/cli.js"],
  "ignore": ["**/*.test.js", "dist/**"],
  "thresholds": {
    "fileLines": 500,
    "functionLines": 50,
    "cyclomaticComplexity": 10,
    "functionParameters": 5
  },
  "languages": ["javascript"]
}
```

**Configuration sources (priority order):**
1. CLI arguments
2. `.erfrc.json` in current directory
3. `.erf/config.json` in current directory
4. `~/.erfrc.json` in home directory
5. Default configuration

### 4. RDF Vocabulary

**Custom ontology for code analysis:**
```turtle
@prefix erf: <http://purl.org/stuff/erf/> .
@prefix code: <http://purl.org/stuff/code/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Classes
code:File a rdfs:Class ;
    rdfs:label "Source file" .

code:Module a rdfs:Class ;
    rdfs:label "JavaScript module" .

code:Function a rdfs:Class ;
    rdfs:label "Function or method" .

code:Class a rdfs:Class ;
    rdfs:label "Class definition" .

code:Variable a rdfs:Class ;
    rdfs:label "Variable or constant" .

# Properties
erf:imports a rdf:Property ;
    rdfs:label "imports from" .

erf:exports a rdf:Property ;
    rdfs:label "exports" .

erf:calls a rdf:Property ;
    rdfs:label "calls function" .

erf:extends a rdf:Property ;
    rdfs:label "extends class" .

erf:linesOfCode a rdf:Property ;
    rdfs:label "lines of code" .

erf:cyclomaticComplexity a rdf:Property ;
    rdfs:label "cyclomatic complexity" .

erf:isReachable a rdf:Property ;
    rdfs:label "is reachable from entry point" .

erf:isolationScore a rdf:Property ;
    rdfs:label "isolation score (0-1)" .

erf:lastModified a rdf:Property ;
    rdfs:label "last modification date" .
```

## Novel Insights & Advanced Features

### 1. Semantic Dead Code Detection

Beyond simple reachability:
- Functions called only from tests (potentially unused in production)
- Exports that are imported but never actually used
- Abstraction layers with only one implementation
- Dead branches in conditionals

### 2. Temporal Analysis

Track changes over time:
- Files that haven't been modified in 2+ years
- Functions with high churn rate (instability indicator)
- Correlate deadness with last-modified date
- Predict future dead code based on usage trends

### 3. Dependency Health Score

Composite metric combining:
- **Coupling**: Fan-in/fan-out ratio
- **Cohesion**: Internal connectivity
- **Complexity**: LOC, cyclomatic complexity
- **Reachability**: Distance from entry points
- **Stability**: Change frequency

Formula:
```
healthScore = (cohesion * 0.3) +
              ((1 - coupling) * 0.3) +
              ((1 - normalizedComplexity) * 0.2) +
              (reachability * 0.1) +
              (stability * 0.1)
```

### 4. Interactive Refactoring Mode (MCP)

**Workflow with Claude:**
1. Claude: "File X appears dead, safe to remove?"
2. erf: Verifies no external references
3. Claude: Creates git branch, removes file
4. erf: Runs project tests
5. Auto-rollback if tests fail, commit if pass

### 5. Architectural Pattern Detection

Identify common patterns and anti-patterns:
- God objects (high fan-in, many responsibilities)
- Feature envy (excessive external calls)
- Circular dependencies
- Missing abstractions (duplicate code structures)

## CLI Interface

### Commands

```bash
# Full analysis
erf analyze [path] [--config .erfrc.json] [--output report.json]

# Dead code only
erf dead-code [path] [--entry-points src/index.js]

# Complexity check
erf complexity [path] [--threshold 500]

# Isolated modules
erf isolated [path] [--min-size 3]

# Web GUI
erf gui [path] [--port 3000]

# Watch mode
erf watch [path] [--interval 5000]

# Export graph
erf export [path] [--format rdf|json|dot]
```

### Output Formats

**JSON:**
```json
{
  "summary": {
    "filesAnalyzed": 247,
    "deadFiles": 12,
    "isolatedModules": 3,
    "complexFiles": 8
  },
  "deadCode": [
    {
      "file": "src/unused/helper.js",
      "type": "file",
      "reason": "unreachable",
      "confidence": 0.95
    }
  ],
  "complexity": [
    {
      "file": "src/api/handler.js",
      "linesOfCode": 847,
      "functions": [
        {
          "name": "processRequest",
          "lines": 156,
          "complexity": 23
        }
      ]
    }
  ]
}
```

**RDF/Turtle:**
```turtle
@prefix erf: <http://purl.org/stuff/erf/> .

<file:///src/index.js> a code:File ;
    erf:linesOfCode 234 ;
    erf:imports <file:///src/utils.js> ;
    erf:isReachable true .
```

## MCP Integration Example

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "erf": {
      "command": "npx",
      "args": ["erf-mcp"],
      "env": {
        "ERF_PROJECT_PATH": "/path/to/project"
      }
    }
  }
}
```

**Conversation with Claude:**
```
User: Can you help clean up dead code in my project?

Claude: I'll use erf to analyze your codebase.
[calls analyze-codebase tool]

Claude: I found 12 potentially dead files. The safest to remove are:
1. src/unused/oldHelper.js (0% confidence of use)
2. lib/deprecated/formatter.js (2% confidence)

Would you like me to verify these and create a PR?

User: Yes, please verify and remove them.

Claude: [calls find-dead-code with verification]
All clear - no hidden references found.
Creating branch 'cleanup/remove-dead-code'...
[removes files, runs tests]
Tests pass ✓. Created PR #123.
```

## Success Metrics

### Effectiveness
- Reduce codebase size by 10-30% on typical projects
- Identify 90%+ of truly dead code
- False positive rate <5%
- Find complexity hotspots for refactoring

### Performance
- Analyze 1000 files in <30 seconds
- Real-time updates in GUI (<100ms)
- Incremental analysis in watch mode

### Usability
- Zero-config for standard Node.js projects
- One command to get actionable insights
- Integration with existing tools (VS Code, Claude)

## Roadmap

### v0.1 (MVP)
- File-level analysis only
- JavaScript ES modules
- Basic MCP tools
- CLI interface
- JSON output

### v0.2
- Function-level analysis
- CommonJS support
- Web GUI
- RDF export
- Watch mode

### v0.3
- Class-level analysis
- TypeScript support
- Temporal analysis
- Health scores
- VS Code extension

### v1.0
- Full language support
- Advanced pattern detection
- Interactive refactoring
- Cloud dashboard
- Team collaboration features

## References

- AST Parsing: https://github.com/babel/babel/tree/main/packages/babel-parser
- RDF-Ext: https://github.com/rdf-ext/rdf-ext
- MCP Protocol: https://modelcontextprotocol.io
- Cyclomatic Complexity: https://en.wikipedia.org/wiki/Cyclomatic_complexity
- Graph Algorithms: https://en.wikipedia.org/wiki/Connected_component_(graph_theory)