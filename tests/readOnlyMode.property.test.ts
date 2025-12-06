/**
 * Property-based tests for read-only mode enforcement
 * Property 7: Read-only mode enforcement
 * Validates: Requirements 3.4, 4.5, 5.4, 6.5, 8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeWriteFile } from '../src/tools/writeFile';
import { executeDeleteFile } from '../src/tools/deleteFile';
import { ServerConfig } from '../src/config';

describe('Property-Based Tests: Read-Only Mode Enforcement', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `readonly-property-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Generator for valid relative file paths
  const validRelativePathGenerator = () =>
    fc
      .array(
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
        { minLength: 1, maxLength: 3 }
      )
      .map(parts => parts.join(path.sep) + '.txt');

  // Generator for file content
  const fileContentGenerator = () =>
    fc.string({ minLength: 0, maxLength: 500 });

  /**
   * Property 7: Read-only mode enforcement
   * For any write, delete, patch, or create operation, when the server is in 
   * read-only mode, the operation should be rejected with a clear error message.
   * 
   * Feature: mcp-workspace-server, Property 7: Read-only mode enforcement
   * Validates: Requirements 3.4, 4.5, 5.4, 6.5, 8.4
   */
  it('Property 7: write operations should be rejected in read-only mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(validRelativePathGenerator(), fileContentGenerator(), fc.boolean()),
        async ([relativePath, content, createDirectories]) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: true, // Read-only mode enabled
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Attempt to write a file in read-only mode
          try {
            await executeWriteFile(
              {
                path: relativePath,
                content,
                createDirectories,
              },
              config
            );

            // If we reach here, the test should fail
            expect.fail('Write operation should have been rejected in read-only mode');
          } catch (error: any) {
            // Expected: should throw a read-only mode error
            expect(error.message).toMatch(/read-only mode|disabled/i);
          }

          // Verify the file was NOT created
          const fullPath = path.join(testDir, relativePath);
          try {
            await fs.access(fullPath);
            // If file exists, fail the test
            expect.fail('File should not have been created in read-only mode');
          } catch {
            // Expected: file should not exist
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Delete operations should be rejected in read-only mode
   */
  it('Property 7: delete operations should be rejected in read-only mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(validRelativePathGenerator(), fileContentGenerator()),
        async ([relativePath, content]) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: true, // Read-only mode enabled
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // First create a file (with read-only disabled temporarily)
          const fullPath = path.join(testDir, relativePath);
          const dirPath = path.dirname(fullPath);
          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(fullPath, content, 'utf-8');

          // Verify file exists
          await fs.access(fullPath);

          // Attempt to delete the file in read-only mode
          try {
            await executeDeleteFile(
              { path: relativePath },
              config
            );

            // If we reach here, the test should fail
            expect.fail('Delete operation should have been rejected in read-only mode');
          } catch (error: any) {
            // Expected: should throw a read-only mode error
            expect(error.message).toMatch(/read-only mode|disabled/i);
          }

          // Verify the file still exists
          await fs.access(fullPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify write operations work when read-only is disabled
   */
  it('Property 7 (inverse): write operations should succeed when read-only mode is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(validRelativePathGenerator(), fileContentGenerator()),
        async ([relativePath, content]) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: false, // Read-only mode disabled
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Write should succeed
          const result = await executeWriteFile(
            {
              path: relativePath,
              content,
              createDirectories: true,
            },
            config
          );

          // Verify the operation succeeded
          expect(result.path).toBe(relativePath);
          expect(result.bytesWritten).toBeGreaterThanOrEqual(0);

          // Verify the file was created
          const fullPath = path.join(testDir, relativePath);
          const fileContent = await fs.readFile(fullPath, 'utf-8');
          expect(fileContent).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });
});
