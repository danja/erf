/**
 * DependencyParser - Parses JavaScript files to extract dependencies
 * Supports ES modules (import/export) and CommonJS (require/module.exports)
 */

import { promises as fs } from 'fs';
import { parse } from '@babel/parser';
import { dirname, resolve, extname, join } from 'path';
import logger from 'loglevel';

export class DependencyParser {
    constructor(config) {
        this.config = config;
        this.cache = new Map(); // Cache parsed files
    }

    /**
     * Parse JavaScript file and extract dependencies
     */
    async parseFile(filePath) {
        // Check cache
        if (this.cache.has(filePath)) {
            logger.debug(`Using cached parse for: ${filePath}`);
            return this.cache.get(filePath);
        }

        try {
            const source = await fs.readFile(filePath, 'utf8');
            const result = this.parseSource(source, filePath);

            // Cache result
            this.cache.set(filePath, result);

            return result;
        } catch (error) {
            logger.error(`Failed to parse ${filePath}: ${error.message}`);
            return {
                imports: [],
                exports: [],
                calls: [],
                error: error.message
            };
        }
    }

    /**
     * Parse source code and extract AST
     */
    parseSource(source, filePath) {
        try {
            const ast = parse(source, {
                sourceType: 'module',
                plugins: [
                    'jsx',
                    'exportDefaultFrom',
                    'exportNamespaceFrom',
                    'dynamicImport',
                    'importMeta'
                ],
                errorRecovery: true
            });

            return this.extractDependencies(ast, filePath);
        } catch (error) {
            // Try as CommonJS if module parsing fails
            try {
                const ast = parse(source, {
                    sourceType: 'script',
                    plugins: ['jsx'],
                    errorRecovery: true
                });

                return this.extractDependencies(ast, filePath);
            } catch (scriptError) {
                throw error; // Throw original error
            }
        }
    }

    /**
     * Extract dependencies from AST
     */
    extractDependencies(ast, filePath) {
        const imports = [];
        const exports = [];
        const calls = [];
        const functions = [];

        // Walk AST
        this.walkAST(ast, {
            // Function declarations
            FunctionDeclaration: (node) => {
                if (node.id && node.id.name) {
                    functions.push({
                        type: 'function',
                        name: node.id.name,
                        params: node.params.length,
                        async: node.async || false,
                        generator: node.generator || false,
                        loc: node.loc
                    });
                }
            },

            // Class declarations and methods
            ClassDeclaration: (node) => {
                const className = node.id ? node.id.name : 'AnonymousClass';

                // Add class methods
                if (node.body && node.body.body) {
                    for (const member of node.body.body) {
                        if (member.type === 'ClassMethod' || member.type === 'MethodDefinition') {
                            const methodName = member.key.name || member.key.value;
                            if (methodName) {
                                functions.push({
                                    type: 'method',
                                    name: `${className}.${methodName}`,
                                    className: className,
                                    methodName: methodName,
                                    kind: member.kind || 'method',
                                    static: member.static || false,
                                    async: member.async || false,
                                    params: member.params ? member.params.length : 0,
                                    loc: member.loc
                                });
                            }
                        }
                    }
                }
            },

            // ES Module imports
            ImportDeclaration: (node) => {
                imports.push({
                    type: 'import',
                    source: node.source.value,
                    specifiers: this.extractImportSpecifiers(node),
                    loc: node.loc
                });
            },

            // ES Module exports
            ExportNamedDeclaration: (node) => {
                if (node.source) {
                    // Re-export from another module
                    imports.push({
                        type: 'import',
                        source: node.source.value,
                        specifiers: this.extractExportSpecifiers(node),
                        loc: node.loc
                    });
                }

                exports.push({
                    type: 'named',
                    specifiers: this.extractExportSpecifiers(node),
                    loc: node.loc
                });
            },

            ExportDefaultDeclaration: (node) => {
                exports.push({
                    type: 'default',
                    loc: node.loc
                });
            },

            ExportAllDeclaration: (node) => {
                imports.push({
                    type: 'import',
                    source: node.source.value,
                    specifiers: ['*'],
                    loc: node.loc
                });

                exports.push({
                    type: 'all',
                    source: node.source.value,
                    loc: node.loc
                });
            },

            // Dynamic imports
            ImportExpression: (node) => {
                if (node.source.type === 'StringLiteral') {
                    imports.push({
                        type: 'dynamic-import',
                        source: node.source.value,
                        dynamic: true,
                        loc: node.loc
                    });
                }
            },

            // CommonJS require
            CallExpression: (node) => {
                if (node.callee.name === 'require' && node.arguments.length > 0) {
                    const arg = node.arguments[0];
                    if (arg.type === 'StringLiteral') {
                        imports.push({
                            type: 'require',
                            source: arg.value,
                            loc: node.loc
                        });
                    } else {
                        // Dynamic require (variable argument)
                        imports.push({
                            type: 'require',
                            source: null,
                            dynamic: true,
                            loc: node.loc
                        });
                    }
                }

                // Track function calls for call graph
                if (node.callee.type === 'Identifier') {
                    calls.push({
                        function: node.callee.name,
                        loc: node.loc
                    });
                }
            },

            // CommonJS exports
            AssignmentExpression: (node) => {
                if (this.isModuleExports(node.left)) {
                    exports.push({
                        type: 'commonjs',
                        kind: 'module.exports',
                        loc: node.loc
                    });
                } else if (this.isExportsProperty(node.left)) {
                    exports.push({
                        type: 'commonjs',
                        kind: 'exports',
                        property: node.left.property.name,
                        loc: node.loc
                    });
                }
            }
        });

        // Resolve import paths
        const resolvedImports = imports.map(imp => ({
            ...imp,
            resolvedPath: imp.source ? this.resolveImportPath(imp.source, filePath) : null
        }));

        return {
            imports: resolvedImports,
            exports,
            calls,
            functions,
            filePath
        };
    }

    /**
     * Walk AST and apply visitors
     */
    walkAST(ast, visitors) {
        const walk = (node) => {
            if (!node || typeof node !== 'object') return;

            // Apply visitor for this node type
            if (visitors[node.type]) {
                visitors[node.type](node);
            }

            // Recurse into child nodes
            for (const key of Object.keys(node)) {
                const child = node[key];

                if (Array.isArray(child)) {
                    child.forEach(walk);
                } else if (child && typeof child === 'object') {
                    walk(child);
                }
            }
        };

        walk(ast.program);
    }

    /**
     * Extract import specifiers
     */
    extractImportSpecifiers(node) {
        if (!node.specifiers || node.specifiers.length === 0) {
            return ['*']; // Side-effect import
        }

        return node.specifiers.map(spec => {
            if (spec.type === 'ImportDefaultSpecifier') {
                return 'default';
            } else if (spec.type === 'ImportNamespaceSpecifier') {
                return '*';
            } else {
                return spec.imported.name;
            }
        });
    }

    /**
     * Extract export specifiers
     */
    extractExportSpecifiers(node) {
        if (!node.specifiers || node.specifiers.length === 0) {
            return [];
        }

        return node.specifiers.map(spec => spec.exported.name);
    }

    /**
     * Check if node is module.exports
     */
    isModuleExports(node) {
        return node.type === 'MemberExpression' &&
               node.object.name === 'module' &&
               node.property.name === 'exports';
    }

    /**
     * Check if node is exports.property
     */
    isExportsProperty(node) {
        return node.type === 'MemberExpression' &&
               node.object.name === 'exports';
    }

    /**
     * Resolve import path relative to file
     */
    resolveImportPath(importPath, fromFile) {
        // Skip node built-ins and npm packages
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return {
                type: 'external',
                path: importPath
            };
        }

        try {
            const fromDir = dirname(fromFile);
            let resolved = resolve(fromDir, importPath);

            // Try adding extensions if no extension
            if (!extname(resolved)) {
                const tryExtensions = ['.js', '.mjs', '.cjs', '.jsx', '/index.js'];
                for (const ext of tryExtensions) {
                    const tryPath = resolved + ext;
                    // Note: We don't check fs.exists here for performance
                    // Actual existence check happens in graph building
                    resolved = tryPath;
                    break;
                }
            }

            return {
                type: 'relative',
                path: resolved
            };
        } catch (error) {
            logger.warn(`Failed to resolve import ${importPath} from ${fromFile}`);
            return {
                type: 'unresolved',
                path: importPath
            };
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache size
     */
    getCacheSize() {
        return this.cache.size;
    }
}

export default DependencyParser;