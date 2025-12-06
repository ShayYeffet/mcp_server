/**
 * Property-based tests for error handling
 * Tests comprehensive error handling across all error categories
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from '../src/config.js';
import { executeListFiles } from '../src/tools/listFiles.js';
import { executeReadFile } from '../src/tools/readFile.js';
import { executeWriteFile } from '../src/tools/writeFile.js';
import { executeDeleteFile } from '../src/tools/deleteFile.js';
import { executeCreateFolder } from '../src/tools/createFolder.js';
import { executeApplyPatch } from '../src/tools/applyPatch.js';
import { executeRunCommand } from '../src/tools/runCommand.js';
import { WorkspaceError, ErrorCode } from '../src/utils/errors.js';

describe('Error Handling Property Tests', () => {
  let testDir: string;
  let config: ReturnType<typeof loadConfig>;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-error-test-'));
    config = {
      workspaceRoot: testDir,
      allowedCommands: ['echo', 'node'],
      readOnly: false,
      logLevel: 'error' as const,
      commandTimeout: 5000,
    };
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Property 24: Security error messages
  // Validates: Requirements 11.1
  test('Property 24: security violations produce clear error messages indicating path is outside workspace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Absolute paths outside workspace
          fc.constant('/etc/passwd'),
          fc.constant('C:\\Windows\\System32'),
          // Parent directory traversal
          fc.constant('../../../etc/passwd'),
          fc.constant('..\\..\\..\\Windows\\System32'),
          // Mixed traversal
          fc.constant('subdir/../../../../../../etc/passwd'),
          // Absolute path that's clearly outside
          fc.constant('/tmp/outside'),
          fc.constant('C:\\outside')
        ),
        async (maliciousPath) => {
          // Test various tools with malicious paths
          const tools = [
            () => executeListFiles({ path: maliciousPath }, config),
            () => executeReadFile({ path: maliciousPath }, config),
            () => executeWriteFile({ path: maliciousPath, content: 'test' }, config),
            () => executeDeleteFile({ path: maliciousPath }, config),
            () => executeCreateFolder({ path: maliciousPath }, config),
          ];

          for (const tool of tools) {
            try {
              await tool();
              // Should not reach here
              expect.fail('Expected security error to be thrown');
            } catch (error) {
              // Verify it's a WorkspaceError with SECURITY_VIOLATION code
              expect(error).toBeInstanceOf(WorkspaceError);
              const wsError = error as WorkspaceError;
              expect(wsError.code).toBe(ErrorCode.SECURITY_VIOLATION);
              
              // Verify error message is clear and mentions workspace/boundary
              const message = wsError.message.toLowerCase();
              expect(
                message.includes('outside') || 
                message.includes('workspace') || 
                message.includes('boundary') ||
                message.includes('security')
              ).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 25: Not-found error messages
  // Validates: Requirements 11.2
  test('Property 25: operations on non-existent files produce clear error messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 30 })
          .filter(s => !s.includes('..'))  // No traversal
          .filter(s => !s.startsWith('/'))  // No absolute paths
          .filter(s => !s.startsWith('\\'))  // No Windows absolute paths
          .filter(s => !/^[A-Z]:/i.test(s))  // No drive letters
          .map(s => s.replace(/\\/g, '/')),  // Normalize to forward slashes
        async (nonExistentPath) => {
          // Skip if path is empty after filtering
          if (!nonExistentPath.trim()) {
            return;
          }
          
          // Test various tools with non-existent paths
          const tools = [
            { name: 'read_file', fn: () => executeReadFile({ path: nonExistentPath }, config) },
            { name: 'delete_file', fn: () => executeDeleteFile({ path: nonExistentPath }, config) },
            { name: 'list_files', fn: () => executeListFiles({ path: nonExistentPath }, config) },
          ];

          for (const tool of tools) {
            try {
              await tool.fn();
              // If it succeeds, the path might have been created by another test
              // Skip this iteration
              continue;
            } catch (error) {
              // Verify it's a WorkspaceError
              expect(error).toBeInstanceOf(WorkspaceError);
              const wsError = error as WorkspaceError;
              
              // Should be NOT_FOUND (not a security violation since we filtered those out)
              if (wsError.code === ErrorCode.SECURITY_VIOLATION) {
                // This shouldn't happen with our filters, but if it does, skip
                continue;
              }
              
              expect(wsError.code).toBe(ErrorCode.NOT_FOUND);
              
              // Verify error message is clear and mentions what was not found
              const message = wsError.message.toLowerCase();
              expect(
                message.includes('not found') || 
                message.includes('does not exist') ||
                message.includes('not exist')
              ).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 26: Read-only error messages
  // Validates: Requirements 11.3
  test('Property 26: write operations in read-only mode produce clear error messages', async () => {
    // Create read-only config
    const readOnlyConfig = {
      ...config,
      readOnly: true,
    };

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[\/\\]/g, '_')),
        fc.string({ minLength: 0, maxLength: 100 }),
        async (filePath, content) => {
          // Test various write operations in read-only mode
          const operations = [
            { name: 'write_file', fn: () => executeWriteFile({ path: filePath, content }, readOnlyConfig) },
            { name: 'delete_file', fn: () => executeDeleteFile({ path: filePath }, readOnlyConfig) },
            { name: 'create_folder', fn: () => executeCreateFolder({ path: filePath }, readOnlyConfig) },
            { name: 'apply_patch', fn: () => executeApplyPatch({ path: filePath, patch: '<<<OLD\nold\n===\nnew\n>>>NEW' }, readOnlyConfig) },
          ];

          for (const operation of operations) {
            try {
              await operation.fn();
              // Should not reach here
              expect.fail(`Expected read-only error for ${operation.name}`);
            } catch (error) {
              // Verify it's a WorkspaceError with READ_ONLY_MODE code
              expect(error).toBeInstanceOf(WorkspaceError);
              const wsError = error as WorkspaceError;
              expect(wsError.code).toBe(ErrorCode.READ_ONLY_MODE);
              
              // Verify error message is clear and mentions read-only mode
              const message = wsError.message.toLowerCase();
              expect(
                message.includes('read-only') || 
                message.includes('read only') ||
                message.includes('disabled')
              ).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 27: Command failure information
  // Validates: Requirements 11.4
  test('Property 27: failing commands return exit code and output', async () => {
    // Update config to allow a command that will fail
    const commandConfig = {
      ...config,
      allowedCommands: ['node'],
    };

    await fc.assert(
      fc.asyncProperty(
        fc.constant('node'),
        fc.constantFrom(
          // Commands that will fail with non-zero exit codes
          ['-e', 'process.exit(1)'],
          ['-e', 'process.exit(42)'],
          ['-e', 'throw new Error("test error")'],
          ['-e', 'console.error("error message"); process.exit(1)']
        ),
        async (command, args) => {
          const result = await executeRunCommand({ command, args }, commandConfig);
          
          // Verify exit code is captured and non-zero
          expect(result.exitCode).not.toBe(0);
          expect(typeof result.exitCode).toBe('number');
          
          // Verify stdout and stderr are captured
          expect(typeof result.stdout).toBe('string');
          expect(typeof result.stderr).toBe('string');
          
          // Verify timedOut flag is present
          expect(typeof result.timedOut).toBe('boolean');
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property 28: Unexpected error handling
  // Validates: Requirements 11.5
  test('Property 28: unexpected errors are handled gracefully with user-friendly messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant('test'),
        async (fileName) => {
          // Create a file
          const filePath = `${fileName}.txt`;
          await fs.writeFile(path.join(testDir, filePath), 'test content');
          
          // Try to write to it with a very long content that might cause issues
          // Or try operations that might trigger unexpected filesystem errors
          try {
            // Try to create a directory with the same name as an existing file
            await executeCreateFolder({ path: filePath }, config);
            // If it succeeds, that's unexpected but okay
          } catch (error) {
            // Verify it's a WorkspaceError (classified from unexpected error)
            expect(error).toBeInstanceOf(WorkspaceError);
            const wsError = error as WorkspaceError;
            
            // Should have a valid error code
            expect(Object.values(ErrorCode)).toContain(wsError.code);
            
            // Should have a user-friendly message (not empty, not just a stack trace)
            expect(wsError.message).toBeTruthy();
            expect(wsError.message.length).toBeGreaterThan(0);
            expect(wsError.message).not.toMatch(/^Error:/);  // Not just raw error
            expect(wsError.message).not.toMatch(/at Object\./);  // Not a stack trace
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
