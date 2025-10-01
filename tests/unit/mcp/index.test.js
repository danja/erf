
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErfMCPServer } from '../../../mcp/index.js'
import { handleAnalyze } from '../../../mcp/tools/analyze-codebase.js'
import { handleDeadCode } from '../../../mcp/tools/find-dead-code.js'
import { handleHealth } from '../../../mcp/tools/check-health.js'
import { handleIsolated } from '../../../mcp/tools/find-isolated.js'
import { handleHubs } from '../../../mcp/tools/find-hubs.js'
import { handleFunctions } from '../../../mcp/tools/analyze-functions.js'

// Mock DeadCodeDetector
const mockDeadCodeDetector = {
  detect: vi.fn(() => ({
    deadFiles: [
      { path: 'src/unused/old.js', reason: 'Unreachable from entry points' },
      { path: 'lib/deprecated.js', reason: 'No imports found' }
    ],
    reachableFiles: ['src/index.js', 'src/main.js'],
    stats: {
      totalFiles: 10,
      reachableFiles: 8,
      deadFiles: 2,
      unusedExports: 5,
      reachabilityPercentage: 80
    }
  })),
  generateReport: vi.fn(() => 'Dead Code Analysis Report\n\nSummary:\nTotal files: 10\nReachable files: 8\nDead files: 2')
}

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
  })),
}));

vi.mock('../../../src/analyzers/GraphBuilder.js', () => ({
  GraphBuilder: vi.fn(() => ({
    buildGraph: vi.fn(),
    getGraph: () => ({
      getStats: () => ({
        files: 10,
        modules: 2,
        functions: 20,
        imports: 30,
        exports: 15,
        entryPoints: 1,
        externalModules: 1,
        totalTriples: 100,
      }),
      queryNodesByType: vi.fn((type) => {
        if (type === 'function') {
          return [
            { id: 'func1' },
            { id: 'func2' },
            { id: 'func3' }
          ]
        }
        return []
      }),
      getNodeMetadata: vi.fn((id) => ({
        type: 'function',
        async: 'false',
        static: 'false',
        generator: 'false',
        file: 'src/test.js'
      }))
    }),
    export: (format) => {
      if (format === 'json') {
        return {
          nodes: [
            { id: 'a.js', type: 'file', isEntryPoint: true, importCount: 2, dependentCount: 5, exportCount: 3, isMissing: false },
            { id: 'b.js', type: 'file', isEntryPoint: false, importCount: 1, dependentCount: 2, exportCount: 1, isMissing: false },
            { id: 'c.js', type: 'file', isEntryPoint: false, importCount: 0, dependentCount: 8, exportCount: 4, isMissing: false },
            { id: 'd.js', type: 'external-module', isMissing: false },
          ],
          edges: [],
        };
      }
      return {};
    },
  })),
}));

vi.mock('../../../src/analyzers/DeadCodeDetector.js', () => ({
  DeadCodeDetector: vi.fn(() => mockDeadCodeDetector),
}));

vi.mock('../../../src/config/ErfConfig.js', () => ({
  ErfConfig: {
    load: vi.fn(() => ({})),
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  initLogger: vi.fn(),
}));


describe('ErfMCPServer', () => {
  let server;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Create a new server instance for each test
    server = new ErfMCPServer();
  });

  describe('handleAnalyze', () => {
    it('should return analysis statistics in text format', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleAnalyze(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Codebase Analysis: /fake/path');
      expect(text).toContain('Files: 10');
      expect(text).toContain('Total Nodes: 4');
      expect(text).toContain('Entry Points: 1');
      expect(text).toContain('External Modules: 1');
    });

    it('should accept optional configPath', async () => {
      const args = { directory: '/fake/path', configPath: '/custom/config.json' };
      const result = await handleAnalyze(args);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Codebase Analysis');
    });
  });

  describe('handleDeadCode', () => {
    it('should return dead code analysis in default json format', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleDeadCode(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Dead Code Analysis');
      expect(text).toContain('Total Files: 10');
      expect(text).toContain('Reachable Files: 8');
      expect(text).toContain('Dead Files: 2');
      expect(text).toContain('Unused Exports: 5');
      expect(text).toContain('Reachability: 80%');
      expect(text).toContain('src/unused/old.js');
      expect(text).toContain('lib/deprecated.js');
    });

    it('should return dead code analysis in text format when requested', async () => {
      const args = { directory: '/fake/path', format: 'text' };
      const result = await handleDeadCode(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Dead Code Analysis Report');
    });

    it('should show success message when no dead code found', async () => {
      // Mock no dead files
      mockDeadCodeDetector.detect.mockReturnValueOnce({
        deadFiles: [],
        reachableFiles: ['src/index.js', 'src/main.js'],
        stats: {
          totalFiles: 10,
          reachableFiles: 10,
          deadFiles: 0,
          unusedExports: 0,
          reachabilityPercentage: 100
        }
      });

      const args = { directory: '/fake/path' };
      const result = await handleDeadCode(args);

      const text = result.content[0].text;
      expect(text).toContain('None found!');
      expect(text).toContain('All files are reachable');
    });
  });

  describe('handleHealth', () => {
    it('should calculate and return health score', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleHealth(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Codebase Health Report');
      expect(text).toContain('Overall Health Score:');
      expect(text).toContain('/100');
      expect(text).toContain('Connectivity:');
      expect(text).toContain('Structure:');
      expect(text).toContain('Quality:');
    });

    it('should show recommendations based on health score', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleHealth(args);

      const text = result.content[0].text;
      expect(text).toContain('Recommendations');
    });

    it('should include emoji indicators for health level', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleHealth(args);

      const text = result.content[0].text;
      // Should contain one of the health level emojis
      const hasHealthEmoji = text.includes('🟢') || text.includes('🟡') ||
                            text.includes('🟠') || text.includes('🔴');
      expect(hasHealthEmoji).toBe(true);
    });
  });

  describe('handleIsolated', () => {
    it('should return isolated files from dead code analysis', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleIsolated(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Isolated Code Subgraphs');
      expect(text).toContain('Found 2 isolated file(s)');
      expect(text).toContain('src/unused/old.js');
      expect(text).toContain('lib/deprecated.js');
    });

    it('should show success message when no isolated files found', async () => {
      // Mock no dead files
      mockDeadCodeDetector.detect.mockReturnValueOnce({
        deadFiles: [],
        reachableFiles: ['src/index.js'],
        stats: {
          totalFiles: 10,
          reachableFiles: 10,
          deadFiles: 0,
          unusedExports: 0,
          reachabilityPercentage: 100
        }
      });

      const args = { directory: '/fake/path' };
      const result = await handleIsolated(args);

      const text = result.content[0].text;
      expect(text).toContain('No isolated files found!');
      expect(text).toContain('✅');
    });
  });

  describe('handleHubs', () => {
    it('should identify hub files with many dependents', async () => {
      const args = { directory: '/fake/path', threshold: 5, limit: 20 };
      const result = await handleHubs(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Hub Files');
      expect(text).toContain('Found 2 hub file(s)');
      // Should find c.js with 8 dependents and a.js with 5 dependents
      expect(text).toContain('c.js');
      expect(text).toContain('Dependents: 8');
    });

    it('should respect custom threshold', async () => {
      const args = { directory: '/fake/path', threshold: 10, limit: 20 };
      const result = await handleHubs(args);

      const text = result.content[0].text;
      // With threshold of 10, should have no hubs (max is 8)
      expect(text).toContain('No hub files found');
    });

    it('should respect limit parameter', async () => {
      const args = { directory: '/fake/path', threshold: 1, limit: 1 };
      const result = await handleHubs(args);

      const text = result.content[0].text;
      // Should only show 1 hub despite multiple qualifying
      expect(text).toContain('Found 1 hub file(s)');
    });

    it('should use default threshold and limit when not specified', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleHubs(args);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Hub Files');
    });
  });

  describe('handleFunctions', () => {
    it('should return function analysis statistics', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleFunctions(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Function Analysis');
      expect(text).toContain('Overall Statistics');
      expect(text).toContain('Total Functions/Methods: 3');
      expect(text).toContain('Functions per file:');
    });

    it('should show per-file breakdown when showFiles is true', async () => {
      const args = { directory: '/fake/path', showFiles: true };
      const result = await handleFunctions(args);

      const text = result.content[0].text;
      expect(text).toContain('Files with Most Functions');
    });

    it('should not show per-file breakdown by default', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleFunctions(args);

      const text = result.content[0].text;
      // Should not contain file breakdown when showFiles is false
      if (!args.showFiles) {
        const hasFileBreakdown = text.includes('Files with Most Functions');
        expect(hasFileBreakdown).toBe(false);
      }
    });

    it('should detect different function types', async () => {
      const args = { directory: '/fake/path' };
      const result = await handleFunctions(args);

      const text = result.content[0].text;
      expect(text).toContain('Regular Functions:');
      expect(text).toContain('Class Methods:');
      expect(text).toContain('Async Functions:');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const args = { directory: '/nonexistent/path' };

      // Mock an error by creating a broken GraphBuilder
      const { GraphBuilder } = await import('../../../src/analyzers/GraphBuilder.js');
      const originalImpl = GraphBuilder.getMockImplementation();

      GraphBuilder.mockImplementationOnce(() => ({
        buildGraph: vi.fn(async () => {
          throw new Error('Directory not found');
        }),
        getGraph: vi.fn(),
        export: vi.fn()
      }));

      // handleAnalyze doesn't have its own try-catch, so we need to catch here
      try {
        await handleAnalyze(args);
        // If no error thrown, fail the test
        expect.fail('Expected handleAnalyze to throw an error');
      } catch (error) {
        // Verify the error message is correct
        expect(error.message).toContain('Directory not found');
      } finally {
        // Restore original implementation
        GraphBuilder.mockImplementation(originalImpl);
      }
    });
  });
});
