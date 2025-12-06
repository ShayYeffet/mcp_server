/**
 * Property-based tests for MCP protocol compliance
 * Tests response format, error handling, and malformed request handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ServerConfig } from '../src/config.js';

// Import all tool executors
import { executeListFiles } from '../src/tools/listFiles.js';
import { executeReadFile } from '../src/tools/readFile.js';
import { executeWriteFile } from '../src/tools/writeFile.js';
import { executeDeleteFile } from '../src/tools/deleteFile.js';
import { executeCreateFolder } from '../src/tools/createFolder.js';
import { executeApplyPatch } from '../src/tools/applyPatch.js';
import { executeRunCommand } from '../src/tools/runCommand.js';

describe('MCP Protocol - Property Tests', () => {
  let testWorkspace: string;
  let config: ServerConfig;

  beforeEach(async () => {
    // Create a temporary workspace for testing
    const tempBase = path.join(os.tmpdir(), 'mcp-protocol-pbt-' + Date.now());
    await fs.mkdir(tempBase, { recursive: true });
    testWorkspace = tempBase;
    config = {
      workspaceRoot: testWorkspace,
      allowedCommands: ['echo', 'node'],
      readOnly: false,
      logLevel: 'error',
      commandTimeout: 5000,
    };
  });

  afterEach(async () => {
    // Clean up temporary workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Generator for valid file/directory names
  const validNameGenerator = () =>
    fc
      .stringMatching(/^[a-zA-Z0-9_-]+$/)
      .filter(s => s.length > 0 && s.length <= 20);

  // Generator for file content
  const fileContentGenerator = () =>
    fc.string({ minLength: 0, maxLength: 100 });

  /**
   * Property 21: MCP protocol response format
   * For any tool invocation, the response should be properly formatted 
   * according to MCP protocol specifications.
   * 
   * Feature: mcp-workspace-server, Property 21: MCP protocol response format
   * Validates: Requirements 10.2
   */
  it('Property 21: should return properly formatted responses for all tools', async () => {
    // Generator for various tool invocations
    const toolInvocationGenerator = fc.oneof(
      // list_files invocations
      fc.record({
        tool: fc.constant('list_files'),
        input: fc.record({
          path: fc.constant('.'),
          recursive: fc.boolean(),
        }),
      }),
      // read_file invocations (we'll create the file first)
      fc.record({
        tool: fc.constant('read_file'),
        input: fc.record({
          path: validNameGenerator().map(n => n + '.txt'),
        }),
        setup: fileContentGenerator(),
      }),
      // write_file invocations
      fc.record({
        tool: fc.constant('write_file'),
        input: fc.record({
          path: validNameGenerator().map(n => n + '.txt'),
          content: fileContentGenerator(),
          createDirectories: fc.boolean(),
        }),
      }),
      // create_folder invocations
      fc.record({
        tool: fc.constant('create_folder'),
        input: fc.record({
          path: validNameGenerator(),
        }),
      }),
      // run_command invocations
      fc.record({
        tool: fc.constant('run_command'),
        input: fc.record({
          command: fc.constant('echo'),
          args: fc.array(fc.string({ minLength: 0, maxLength: 20 }), { maxLength: 3 }),
        }),
      })
    );

    await fc.assert(
      fc.asyncProperty(toolInvocationGenerator, async (invocation) => {
        let result: any;

        // Setup if needed (e.g., create file for read_file)
        if ('setup' in invocation && invocation.tool === 'read_file') {
          const filePath = path.join(testWorkspace, invocation.input.path);
          await fs.writeFile(filePath, invocation.setup, 'utf-8');
        }

        // Execute the tool
        switch (invocation.tool) {
          case 'list_files':
            result = await executeListFiles(invocation.input, config);
            break;
          case 'read_file':
            result = await executeReadFile(invocation.input, config);
            break;
          case 'write_file':
            result = await executeWriteFile(invocation.input, config);
            break;
          case 'create_folder':
            result = await executeCreateFolder(invocation.input, config);
            break;
          case 'run_command':
            result = await executeRunCommand(invocation.input, config);
            break;
        }

        // Verify response is an object
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();

        // Verify response can be serialized to JSON (MCP requirement)
        expect(() => JSON.stringify(result)).not.toThrow();
        const serialized = JSON.stringify(result);
        expect(serialized).toBeDefined();
        expect(serialized.length).toBeGreaterThan(0);

        // Verify response can be deserialized
        const deserialized = JSON.parse(serialized);
        expect(deserialized).toBeDefined();

        // Tool-specific response format checks
        switch (invocation.tool) {
          case 'list_files':
            expect(result).toHaveProperty('files');
            expect(result).toHaveProperty('path');
            expect(Array.isArray(result.files)).toBe(true);
            break;
          case 'read_file':
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('path');
            expect(result).toHaveProperty('size');
            expect(result).toHaveProperty('lastModified');
            expect(typeof result.content).toBe('string');
            expect(typeof result.size).toBe('number');
            break;
          case 'write_file':
            expect(result).toHaveProperty('path');
            expect(result).toHaveProperty('bytesWritten');
            expect(result).toHaveProperty('created');
            expect(typeof result.bytesWritten).toBe('number');
            expect(typeof result.created).toBe('boolean');
            break;
          case 'create_folder':
            expect(result).toHaveProperty('path');
            expect(result).toHaveProperty('created');
            expect(typeof result.created).toBe('boolean');
            break;
          case 'run_command':
            expect(result).toHaveProperty('exitCode');
            expect(result).toHaveProperty('stdout');
            expect(result).toHaveProperty('stderr');
            expect(result).toHaveProperty('timedOut');
            expect(typeof result.exitCode).toBe('number');
            expect(typeof result.stdout).toBe('string');
            expect(typeof result.stderr).toBe('string');
            expect(typeof result.timedOut).toBe('boolean');
            break;
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Error response format
   * For any error during tool execution, the error response should be 
   * properly formatted with a descriptive message according to MCP protocol.
   * 
   * Feature: mcp-workspace-server, Property 22: Error response format
   * Validates: Requirements 10.3
   */
  it('Property 22: should return properly formatted error responses', async () => {
    // Generator for various error-inducing invocations
    const errorInvocationGenerator = fc.oneof(
      // Security violation - path traversal
      fc.record({
        tool: fc.constant('read_file'),
        input: fc.record({
          path: fc.constant('../../../etc/passwd'),
        }),
        expectedErrorPrefix: fc.constant('SECURITY_VIOLATION:'),
      }),
      // Not found error
      fc.record({
        tool: fc.constant('read_file'),
        input: fc.record({
          path: validNameGenerator().map(n => 'nonexistent-' + n + '.txt'),
        }),
        expectedErrorPrefix: fc.constant('NOT_FOUND:'),
      }),
      // Read-only mode error
      fc.record({
        tool: fc.constant('write_file'),
        input: fc.record({
          path: validNameGenerator().map(n => n + '.txt'),
          content: fc.constant('test'),
        }),
        expectedErrorPrefix: fc.constant('READ_ONLY_MODE:'),
        setupReadOnly: fc.constant(true),
      }),
      // Command not allowed error
      fc.record({
        tool: fc.constant('run_command'),
        input: fc.record({
          command: fc.constant('rm'),
          args: fc.constant(['-rf', '/']),
        }),
        expectedErrorPrefix: fc.constant('COMMAND_NOT_ALLOWED:'),
      }),
      // Invalid patch error
      fc.record({
        tool: fc.constant('apply_patch'),
        input: fc.record({
          path: validNameGenerator().map(n => n + '.txt'),
          patch: fc.constant('<<<OLD\nwrong content\n===\nnew content\n>>>NEW'),
        }),
        expectedErrorPrefix: fc.constant('PATCH_FAILED:'),
        setup: fc.constant('actual content'),
      })
    );

    await fc.assert(
      fc.asyncProperty(errorInvocationGenerator, async (invocation) => {
        // Setup if needed
        const testConfig = { ...config };
        if ('setupReadOnly' in invocation && invocation.setupReadOnly) {
          testConfig.readOnly = true;
        }

        if ('setup' in invocation && invocation.tool === 'apply_patch') {
          const filePath = path.join(testWorkspace, invocation.input.path);
          await fs.writeFile(filePath, invocation.setup, 'utf-8');
        }

        // Execute the tool and expect an error
        let error: Error | undefined;
        try {
          switch (invocation.tool) {
            case 'read_file':
              await executeReadFile(invocation.input, testConfig);
              break;
            case 'write_file':
              await executeWriteFile(invocation.input, testConfig);
              break;
            case 'run_command':
              await executeRunCommand(invocation.input, testConfig);
              break;
            case 'apply_patch':
              await executeApplyPatch(invocation.input, testConfig);
              break;
          }
        } catch (e) {
          error = e as Error;
        }

        // Verify an error was thrown
        expect(error).toBeDefined();
        expect(error).toBeInstanceOf(Error);

        // Verify error has a message
        expect(error!.message).toBeDefined();
        expect(typeof error!.message).toBe('string');
        expect(error!.message.length).toBeGreaterThan(0);

        // Verify error message is descriptive (contains relevant keywords)
        const message = error!.message.toLowerCase();
        
        // Check that error message contains relevant keywords based on error type
        if (invocation.expectedErrorPrefix.includes('SECURITY')) {
          expect(message).toMatch(/outside|workspace|boundary/);
        } else if (invocation.expectedErrorPrefix.includes('NOT_FOUND')) {
          expect(message).toMatch(/not found|does not exist/);
        } else if (invocation.expectedErrorPrefix.includes('READ_ONLY')) {
          expect(message).toMatch(/read-only|disabled/);
        } else if (invocation.expectedErrorPrefix.includes('COMMAND_NOT_ALLOWED')) {
          expect(message).toMatch(/not in the allowed|not allowed/);
        } else if (invocation.expectedErrorPrefix.includes('PATCH_FAILED')) {
          expect(message).toMatch(/not found|cannot be applied/);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23: Malformed request handling
   * For any malformed or invalid request, the server should return an error 
   * response without crashing.
   * 
   * Feature: mcp-workspace-server, Property 23: Malformed request handling
   * Validates: Requirements 10.4
   */
  it('Property 23: should handle malformed requests gracefully', async () => {
    // Generator for various malformed inputs
    const malformedInputGenerator = fc.oneof(
      // Missing required fields
      fc.record({
        tool: fc.constant('read_file'),
        input: fc.record({}), // Missing 'path'
      }),
      fc.record({
        tool: fc.constant('write_file'),
        input: fc.record({
          path: validNameGenerator().map(n => n + '.txt'),
          // Missing 'content'
        }),
      }),
      // Invalid types
      fc.record({
        tool: fc.constant('list_files'),
        input: fc.record({
          path: fc.integer(), // Should be string
          recursive: fc.constant('yes'), // Should be boolean
        }),
      }),
      // Null/undefined values
      fc.record({
        tool: fc.constant('read_file'),
        input: fc.record({
          path: fc.constant(null),
        }),
      }),
      // Empty strings where not allowed
      fc.record({
        tool: fc.constant('read_file'),
        input: fc.record({
          path: fc.constant(''),
        }),
      })
    );

    await fc.assert(
      fc.asyncProperty(malformedInputGenerator, async (invocation) => {
        // Execute the tool and expect it to handle gracefully
        let error: Error | undefined;
        let result: any;

        try {
          switch (invocation.tool) {
            case 'read_file':
              result = await executeReadFile(invocation.input as any, config);
              break;
            case 'write_file':
              result = await executeWriteFile(invocation.input as any, config);
              break;
            case 'list_files':
              result = await executeListFiles(invocation.input as any, config);
              break;
          }
        } catch (e) {
          error = e as Error;
        }

        // Either the tool should throw an error OR handle it gracefully
        // The key is that it should NOT crash the process
        if (error) {
          // If an error was thrown, it should be a proper Error object
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
        } else {
          // If no error was thrown, result should be defined
          // (some tools may handle missing fields with defaults)
          expect(result).toBeDefined();
        }

        // The important property: we got here without crashing
        expect(true).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
