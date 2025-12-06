/**
 * Property-based tests for create_folder tool
 * Tests directory creation properties
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeCreateFolder } from '../src/tools/createFolder';
import { ServerConfig } from '../src/config';

describe('Create Folder - Property Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `createfolder-property-test-${Date.now()}`);
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

  // Generator for nested directory paths (2-5 levels deep)
  const nestedPathGenerator = () =>
    fc
      .array(
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
        { minLength: 2, maxLength: 5 }
      )
      .map(parts => parts.join(path.sep));

  // Generator for simple directory paths (1-3 levels)
  const simplePathGenerator = () =>
    fc
      .array(
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
        { minLength: 1, maxLength: 3 }
      )
      .map(parts => parts.join(path.sep));

  /**
   * Property 12: Directory creation with parents
   * For any nested directory path, creating that directory should create 
   * all necessary parent directories and the target directory.
   * 
   * Feature: mcp-workspace-server, Property 12: Directory creation with parents
   * Validates: Requirements 5.1
   */
  it('Property 12: creating nested directories creates all parent directories', async () => {
    await fc.assert(
      fc.asyncProperty(
        nestedPathGenerator(),
        async (relativePath) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Create the directory
          const result = await executeCreateFolder(
            { path: relativePath },
            config
          );

          // Verify the result
          expect(result.path).toBe(relativePath);

          // Verify the directory was created
          const fullPath = path.join(testDir, relativePath);
          const stats = await fs.stat(fullPath);
          expect(stats.isDirectory()).toBe(true);

          // Verify all parent directories were created
          const parts = relativePath.split(path.sep);
          for (let i = 1; i <= parts.length; i++) {
            const partialPath = parts.slice(0, i).join(path.sep);
            const partialFullPath = path.join(testDir, partialPath);
            const partialStats = await fs.stat(partialFullPath);
            expect(partialStats.isDirectory()).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Directory creation idempotence
   * For any directory path, creating the directory multiple times should 
   * succeed each time without error (idempotent operation).
   * 
   * Feature: mcp-workspace-server, Property 13: Directory creation idempotence
   * Validates: Requirements 5.2
   */
  it('Property 13: creating the same directory multiple times succeeds', async () => {
    let runCounter = 0;
    
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(simplePathGenerator(), fc.integer({ min: 2, max: 5 })),
        async ([relativePath, numCreations]) => {
          // Create a unique subdirectory for each property test run
          const uniqueTestDir = path.join(testDir, `run-${runCounter++}`);
          await fs.mkdir(uniqueTestDir, { recursive: true });

          const config: ServerConfig = {
            workspaceRoot: uniqueTestDir,
            allowedCommands: [],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Track results from each creation attempt
          const results: boolean[] = [];

          // Create the directory multiple times
          for (let i = 0; i < numCreations; i++) {
            const result = await executeCreateFolder(
              { path: relativePath },
              config
            );

            // Each creation should succeed
            expect(result.path).toBe(relativePath);
            results.push(result.created);
          }

          // The first result should be true (directory was created)
          // All subsequent results should be false (directory already exists)
          expect(results[0]).toBe(true);
          for (let i = 1; i < results.length; i++) {
            expect(results[i]).toBe(false);
          }

          // Verify the directory exists
          const fullPath = path.join(uniqueTestDir, relativePath);
          const stats = await fs.stat(fullPath);
          expect(stats.isDirectory()).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify directory creation is rejected in read-only mode
   * This validates Property 7 for create_folder operations
   */
  it('Property 7: directory creation should be rejected in read-only mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        simplePathGenerator(),
        async (relativePath) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: true, // Read-only mode enabled
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Attempt to create a directory in read-only mode
          try {
            await executeCreateFolder(
              { path: relativePath },
              config
            );

            // If we reach here, the test should fail
            expect.fail('Directory creation should have been rejected in read-only mode');
          } catch (error: any) {
            // Expected: should throw a read-only mode error
            expect(error.message).toMatch(/read-only mode|disabled/i);
          }

          // Verify the directory was NOT created
          const fullPath = path.join(testDir, relativePath);
          try {
            await fs.access(fullPath);
            // If directory exists, fail the test
            expect.fail('Directory should not have been created in read-only mode');
          } catch {
            // Expected: directory should not exist
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
