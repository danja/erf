# erf Test Suite

Test suite for the erf (embarrassing relative finder) codebase analyzer.

## Test Structure

```
tests/
├── unit/                  # Unit tests for individual components
│   ├── config/           # Config loader tests
│   ├── analyzers/        # FileScanner, DependencyParser, etc.
│   └── graph/            # RDFModel tests
├── integration/          # Integration tests using erf itself as test target
└── e2e/                  # End-to-end GUI tests (Playwright)
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run with coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Test Philosophy

### Unit Tests
- Test individual components in isolation
- Fast execution
- Mock external dependencies only when absolutely necessary
- Focus on public API contracts

### Integration Tests
- **Use erf codebase itself as test target** - This is a form of dogfooding
- Test real-world scenarios with actual file system operations
- No mocking - tests run against live data
- Verify end-to-end workflows (scan → parse → build graph → analyze)

### E2E Tests (future)
- Test GUI interactions with Playwright
- Verify visualization rendering
- Test user workflows through the web interface

## Test Conventions

Following semem project patterns:

1. **Use Vitest** for all JavaScript tests (ES modules support)
2. **No mocking unless absolutely necessary** - Tests work with real data
3. **erf analyzes itself** - The best test is using the tool on its own codebase
4. **Integration tests validate correctness** - Can erf find its own dead code? Its own dependencies?

## What We Test

### FileScanner (`tests/unit/analyzers/FileScanner.test.js`)
- ✅ Scans erf project and finds all JavaScript files
- ✅ Respects ignore patterns (.gitignore, custom)
- ✅ Returns file statistics (size, mtime)

### DependencyParser (`tests/unit/analyzers/DependencyParser.test.js`)
- ✅ Parses erf's own files (GraphBuilder.js, etc.)
- ✅ Extracts ES module imports/exports
- ✅ Resolves relative paths to absolute
- ✅ Detects external packages (rdf-ext, commander)
- ✅ Handles CommonJS require/module.exports
- ✅ Caches parsed results for performance

### RDFModel (`tests/unit/graph/RDFModel.test.js`)
- ✅ Creates file/module/function nodes
- ✅ Creates import/export/call edges
- ✅ Queries nodes by type
- ✅ Marks entry points
- ✅ Tracks external modules
- ✅ Calculates graph statistics
- ✅ Serializes to N-Quads format

### ErfConfig (`tests/unit/config/ErfConfig.test.js`)
- ✅ Loads config from .erfrc.json
- ✅ Merges user config with defaults
- ✅ Provides sensible defaults

### Full Analysis Integration (`tests/integration/full-analysis.test.js`)
- ✅ Analyzes entire erf codebase
- ✅ Builds complete dependency graph
- ✅ Detects entry points (bin/erf.js, etc.)
- ✅ Identifies external dependencies
- ✅ Exports graph in JSON/RDF formats
- ✅ Performs dead code analysis
- ✅ Generates health reports
- ✅ Tracks import relationships correctly
- ✅ Detects circular dependencies
- ✅ Validates graph structure

## Test Coverage Goals

- **Core analyzers**: >90% coverage
- **RDF model**: >85% coverage
- **CLI commands**: >80% coverage
- **Overall**: >80% coverage

## Example Test Run

```bash
$ npm test

 ✓ tests/unit/config/ErfConfig.test.js (8 tests)
 ✓ tests/unit/analyzers/FileScanner.test.js (4 tests)
 ✓ tests/unit/analyzers/DependencyParser.test.js (12 tests)
 ✓ tests/unit/graph/RDFModel.test.js (15 tests)
 ✓ tests/integration/full-analysis.test.js (10 tests)

Test Files  5 passed (5)
     Tests  49 passed (49)
```

## Debugging Tests

Use Vitest's built-in debugging:

```bash
# Run specific test file
npx vitest tests/unit/analyzers/FileScanner.test.js

# Run specific test case
npx vitest -t "should scan erf project"

# Run with console output
npx vitest --reporter=verbose
```

## Adding New Tests

When adding new analyzers or features:

1. Create unit test file in `tests/unit/<category>/`
2. Test against erf's own codebase when possible
3. Add integration test if feature affects end-to-end workflow
4. Update this README with test description

## Known Issues

None currently. All tests passing against erf codebase as test target.
