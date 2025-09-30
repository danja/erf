/**
 * ErfConfig - Configuration loader and manager
 * Handles loading .erfrc.json with defaults and validation
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import logger from 'loglevel';

export class ErfConfig {
    constructor(configPath = null) {
        this.configPath = configPath;
        this.config = this.loadConfig();
    }

    /**
     * Static factory method to load config
     * @param {string} configPath - Path to config file
     * @returns {Promise<Object>} Config object (plain object, not ErfConfig instance)
     */
    static async load(configPath = null) {
        const instance = new ErfConfig(configPath)
        return instance.config
    }

    /**
     * Load configuration from .erfrc.json or use defaults
     */
    loadConfig() {
        const defaultConfig = {
            entryPoints: ['src/index.js', 'bin/**/*.js'],
            ignore: [
                '**/*.test.js',
                '**/*.spec.js',
                'tests/**',
                'dist/**',
                'build/**',
                'coverage/**',
                'node_modules/**',
                '.git/**'
            ],
            thresholds: {
                fileLines: 500,
                functionLines: 50,
                cyclomaticComplexity: 10,
                functionParameters: 5
            },
            languages: ['javascript'],
            includeTests: false,
            outputFormat: 'json'
        };

        // Try to find .erfrc.json
        const searchPaths = [
            this.configPath,
            resolve(process.cwd(), '.erfrc.json'),
            resolve(process.cwd(), '.erf', 'config.json'),
            join(process.env.HOME || process.env.USERPROFILE, '.erfrc.json')
        ].filter(Boolean);

        for (const path of searchPaths) {
            if (existsSync(path)) {
                try {
                    const userConfig = JSON.parse(readFileSync(path, 'utf8'));
                    logger.info(`Loaded configuration from: ${path}`);
                    return this.mergeConfig(defaultConfig, userConfig);
                } catch (error) {
                    logger.warn(`Failed to load config from ${path}: ${error.message}`);
                }
            }
        }

        logger.info('Using default configuration');
        return defaultConfig;
    }

    /**
     * Merge user config with defaults
     */
    mergeConfig(defaults, user) {
        return {
            ...defaults,
            ...user,
            thresholds: {
                ...defaults.thresholds,
                ...(user.thresholds || {})
            },
            ignore: user.ignore || defaults.ignore,
            entryPoints: user.entryPoints || defaults.entryPoints,
            languages: user.languages || defaults.languages
        };
    }

    /**
     * Get configuration value
     */
    get(key) {
        return this.config[key];
    }

    /**
     * Get threshold value
     */
    getThreshold(key) {
        return this.config.thresholds[key];
    }

    /**
     * Check if tests should be included
     */
    shouldIncludeTests() {
        return this.config.includeTests === true;
    }

    /**
     * Get ignore patterns
     */
    getIgnorePatterns() {
        return this.config.ignore;
    }

    /**
     * Get entry points
     */
    getEntryPoints() {
        return this.config.entryPoints;
    }

    /**
     * Get supported languages
     */
    getLanguages() {
        return this.config.languages;
    }

    /**
     * Get output format
     */
    getOutputFormat() {
        return this.config.outputFormat || 'json';
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        // Check thresholds are positive numbers
        for (const [key, value] of Object.entries(this.config.thresholds)) {
            if (typeof value !== 'number' || value <= 0) {
                errors.push(`Invalid threshold ${key}: must be positive number`);
            }
        }

        // Check entry points is array
        if (!Array.isArray(this.config.entryPoints)) {
            errors.push('entryPoints must be an array');
        }

        // Check languages is array
        if (!Array.isArray(this.config.languages)) {
            errors.push('languages must be an array');
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\\n${errors.join('\\n')}`);
        }

        return true;
    }
}

export default ErfConfig;