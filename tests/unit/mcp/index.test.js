
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErfMCPServer } from '../../../mcp/index.js'

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
    }),
    export: (format) => {
      if (format === 'json') {
        return {
          nodes: [
            { id: 'a.js', isEntryPoint: true },
            { id: 'b.js', type: 'external-module' },
          ],
          edges: [],
        };
      }
      return {};
    },
  })),
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
      const result = await server.handleAnalyze(args);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('# Codebase Analysis: /fake/path');
      expect(text).toContain('Files: 10');
      expect(text).toContain('Total Nodes: 2');
      expect(text).toContain('Entry Points: 1');
      expect(text).toContain('External Modules: 1');
    });
  });
});
