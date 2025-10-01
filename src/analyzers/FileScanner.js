/**
 * FileScanner - Walks directory tree and collects source files
 * Respects .gitignore patterns and custom ignore rules
 */

import { promises as fs } from 'fs';
import { join, relative, resolve, extname } from 'path';
import ignore from 'ignore';
import logger from '../utils/Logger.js';

export class FileScanner {
    constructor(config) {
        this.config = config;
        this.ig = ignore();
        this.files = [];
        this.stats = {
            scanned: 0,
            included: 0,
            ignored: 0
        };
    }

    /**
     * Initialize ignore patterns from .gitignore and config
     */
    async initializeIgnore(rootPath) {
        // Add patterns from config
        const configPatterns = this.config.ignore || this.config.getIgnorePatterns?.() || [];
        this.ig.add(configPatterns);

        // Try to read .gitignore
        const gitignorePath = join(rootPath, '.gitignore');
        try {
            const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
            this.ig.add(gitignoreContent);
            logger.debug('Loaded .gitignore patterns');
        } catch (error) {
            logger.debug('.gitignore not found, using config patterns only');
        }
    }

    /**
     * Check if path should be ignored
     */
    shouldIgnore(relativePath) {
        // Always ignore node_modules and .git
        if (relativePath.includes('node_modules') || relativePath.includes('.git')) {
            return true;
        }

        return this.ig.ignores(relativePath);
    }

    /**
     * Check if file is a supported source file
     */
    isSupportedFile(filePath) {
        const ext = extname(filePath);
        const supportedExtensions = ['.js', '.mjs', '.cjs', '.jsx'];

        // TODO: Add TypeScript support
        // if (this.config.getLanguages().includes('typescript')) {
        //     supportedExtensions.push('.ts', '.tsx');
        // }

        return supportedExtensions.includes(ext);
    }

    /**
     * Recursively scan directory
     */
    async scanDirectory(dirPath, rootPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dirPath, entry.name);
            const relativePath = relative(rootPath, fullPath);

            this.stats.scanned++;

            // Check if should be ignored
            if (this.shouldIgnore(relativePath)) {
                this.stats.ignored++;
                logger.debug(`Ignored: ${relativePath}`);
                continue;
            }

            if (entry.isDirectory()) {
                // Recurse into directory
                await this.scanDirectory(fullPath, rootPath);
            } else if (entry.isFile()) {
                // Check if supported source file
                if (this.isSupportedFile(fullPath)) {
                    const fileInfo = await this.getFileInfo(fullPath, relativePath);
                    this.files.push(fileInfo);
                    this.stats.included++;
                    logger.debug(`Included: ${relativePath}`);
                }
            }
        }
    }

    /**
     * Get file information including stats
     */
    async getFileInfo(fullPath, relativePath) {
        const stats = await fs.stat(fullPath);

        return {
            path: fullPath,
            relativePath: relativePath,
            size: stats.size,
            modified: stats.mtime,
            extension: extname(fullPath)
        };
    }

    /**
     * Scan codebase starting from root path
     */
    async scan(rootPath) {
        const resolvedRoot = resolve(rootPath);

        logger.info(`Scanning codebase at: ${resolvedRoot}`);

        // Reset state
        this.files = [];
        this.stats = {
            scanned: 0,
            included: 0,
            ignored: 0
        };

        // Initialize ignore patterns
        await this.initializeIgnore(resolvedRoot);

        // Start recursive scan
        try {
            await this.scanDirectory(resolvedRoot, resolvedRoot);
        } catch (error) {
            logger.error(`Failed to scan directory: ${error.message}`);
            throw error;
        }

        logger.info(`Scan complete: ${this.stats.included} files included, ${this.stats.ignored} ignored`);

        return {
            files: this.files,
            stats: this.stats
        };
    }

    /**
     * Get files matching specific patterns
     */
    async scanWithPattern(rootPath, pattern) {
        await this.scan(rootPath);

        // Filter by pattern if provided
        if (pattern) {
            const regex = new RegExp(pattern);
            this.files = this.files.filter(file => regex.test(file.relativePath));
        }

        return {
            files: this.files,
            stats: this.stats
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Get all scanned files
     */
    getFiles() {
        return [...this.files];
    }

    /**
     * Get file count
     */
    getFileCount() {
        return this.files.length;
    }

    /**
     * Clear cached results
     */
    clear() {
        this.files = [];
        this.stats = {
            scanned: 0,
            included: 0,
            ignored: 0
        };
    }
}

export default FileScanner;