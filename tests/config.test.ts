/**
 * Unit tests for configuration module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, type ServerConfig } from '../src/config.js';

describe('Configuration Module', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig with default values', () => {
    it('should use current working directory as default workspace root', () => {
      delete process.env.MCP_WORKSPACE_ROOT;
      const config = loadConfig();
      expect(config.workspaceRoot).toBe(process.cwd());
    });

    it('should use empty array as default allowed commands', () => {
      delete process.env.MCP_ALLOWED_COMMANDS;
      const config = loadConfig();
      expect(config.allowedCommands).toEqual([]);
    });

    it('should use false as default read-only mode', () => {
      delete process.env.MCP_READ_ONLY;
      const config = loadConfig();
      expect(config.readOnly).toBe(false);
    });

    it('should use info as default log level', () => {
      delete process.env.MCP_LOG_LEVEL;
      const config = loadConfig();
      expect(config.logLevel).toBe('info');
    });

    it('should use 300000ms as default command timeout', () => {
      delete process.env.MCP_COMMAND_TIMEOUT;
      const config = loadConfig();
      expect(config.commandTimeout).toBe(300000);
    });
  });

  describe('loadConfig with custom values', () => {
    it('should use custom workspace root when provided', () => {
      process.env.MCP_WORKSPACE_ROOT = '/custom/workspace';
      const config = loadConfig();
      expect(config.workspaceRoot).toBe('/custom/workspace');
    });

    it('should parse comma-separated command list', () => {
      process.env.MCP_ALLOWED_COMMANDS = 'npm install,npm test,npm run build';
      const config = loadConfig();
      expect(config.allowedCommands).toEqual(['npm install', 'npm test', 'npm run build']);
    });

    it('should trim whitespace from commands', () => {
      process.env.MCP_ALLOWED_COMMANDS = '  npm install  ,  npm test  ,  npm run build  ';
      const config = loadConfig();
      expect(config.allowedCommands).toEqual(['npm install', 'npm test', 'npm run build']);
    });

    it('should filter out empty commands', () => {
      process.env.MCP_ALLOWED_COMMANDS = 'npm install,,npm test,  ,npm run build';
      const config = loadConfig();
      expect(config.allowedCommands).toEqual(['npm install', 'npm test', 'npm run build']);
    });

    it('should parse read-only mode as true', () => {
      process.env.MCP_READ_ONLY = 'true';
      const config = loadConfig();
      expect(config.readOnly).toBe(true);
    });

    it('should parse read-only mode with various true values', () => {
      const trueValues = ['true', 'TRUE', 'True', '1', 'yes', 'YES'];
      trueValues.forEach(value => {
        process.env.MCP_READ_ONLY = value;
        const config = loadConfig();
        expect(config.readOnly).toBe(true);
      });
    });

    it('should parse read-only mode as false for non-true values', () => {
      const falseValues = ['false', 'FALSE', '0', 'no', 'NO', 'invalid'];
      falseValues.forEach(value => {
        process.env.MCP_READ_ONLY = value;
        const config = loadConfig();
        expect(config.readOnly).toBe(false);
      });
    });

    it('should parse valid log levels', () => {
      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];
      levels.forEach(level => {
        process.env.MCP_LOG_LEVEL = level;
        const config = loadConfig();
        expect(config.logLevel).toBe(level);
      });
    });

    it('should handle case-insensitive log levels', () => {
      process.env.MCP_LOG_LEVEL = 'DEBUG';
      const config = loadConfig();
      expect(config.logLevel).toBe('debug');
    });

    it('should use default log level for invalid values', () => {
      process.env.MCP_LOG_LEVEL = 'invalid';
      const config = loadConfig();
      expect(config.logLevel).toBe('info');
    });

    it('should parse custom command timeout', () => {
      process.env.MCP_COMMAND_TIMEOUT = '60000';
      const config = loadConfig();
      expect(config.commandTimeout).toBe(60000);
    });

    it('should use default timeout for invalid numeric values', () => {
      process.env.MCP_COMMAND_TIMEOUT = 'invalid';
      const config = loadConfig();
      expect(config.commandTimeout).toBe(300000);
    });

    it('should use default timeout for negative values', () => {
      process.env.MCP_COMMAND_TIMEOUT = '-1000';
      const config = loadConfig();
      expect(config.commandTimeout).toBe(300000);
    });

    it('should use default timeout for zero', () => {
      process.env.MCP_COMMAND_TIMEOUT = '0';
      const config = loadConfig();
      expect(config.commandTimeout).toBe(300000);
    });
  });

  describe('loadConfig with combined environment variables', () => {
    it('should load all custom values together', () => {
      process.env.MCP_WORKSPACE_ROOT = '/my/workspace';
      process.env.MCP_ALLOWED_COMMANDS = 'git status,npm test';
      process.env.MCP_READ_ONLY = 'true';
      process.env.MCP_LOG_LEVEL = 'debug';
      process.env.MCP_COMMAND_TIMEOUT = '120000';

      const config = loadConfig();

      expect(config.workspaceRoot).toBe('/my/workspace');
      expect(config.allowedCommands).toEqual(['git status', 'npm test']);
      expect(config.readOnly).toBe(true);
      expect(config.logLevel).toBe('debug');
      expect(config.commandTimeout).toBe(120000);
    });

    it('should handle empty string environment variables', () => {
      process.env.MCP_WORKSPACE_ROOT = '';
      process.env.MCP_ALLOWED_COMMANDS = '';
      process.env.MCP_READ_ONLY = '';
      process.env.MCP_LOG_LEVEL = '';
      process.env.MCP_COMMAND_TIMEOUT = '';

      const config = loadConfig();

      expect(config.workspaceRoot).toBe(process.cwd());
      expect(config.allowedCommands).toEqual([]);
      expect(config.readOnly).toBe(false);
      expect(config.logLevel).toBe('info');
      expect(config.commandTimeout).toBe(300000);
    });
  });
});
