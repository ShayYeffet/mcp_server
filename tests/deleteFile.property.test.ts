/**
 * Property-based tests for delete_file tool
 * Tests file and directory deletion properties
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeDeleteFile } from '../src/tools/deleteFile';
import { ServerConfig } from '../src/config';

describe('Delete File - Property Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `delete-property-test-${Date.now()}`);
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
   * Property 9: File deletion verification
   * For any file in the workspace, deleting that file should result in 
   * the file no longer existing in the filesystem.
   * 
   * Feature: mcp-workspace-server, Property 9: File deletion verification
   * Validates: Requirements 4.1
   */
  it('Property 9: deleting a file removes it from the filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(validRelativePathGenerator(), fileContentGenerator()),
        async ([relativePath, content]) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Create the file first
          const fullPath = path.join(testDir, relativePath);
          const dirPath = path.dirname(fullPath);
          await fs.mkdir(dirPath, { recursive: true });
          await fs.writeFile(fullPath, content, 'utf-8');

          // Verify file exists before deletion
          await fs.access(fullPath);

          // Delete the file
          const result = await executeDeleteFile(
            { path: relativePath },
            config
          );

          // Verify the result
          expect(result.path).toBe(relativePath);
          expect(result.deleted).toBe(true);
          expect(result.type).toBe('file');

          // Verify the file no longer exists
          try {
            await fs.access(fullPath);
            expect.fail('File should not exist after deletion');
          } catch (error: any) {
            // Expected: file should not exist
            expect(error.code).toBe('ENOENT');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Generator for valid relative directory paths
  const validRelativeDirPathGenerator = () =>
    fc
      .array(
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
        { minLength: 1, maxLength: 3 }
      )
      .map(parts => parts.join(path.sep));

  /**
   * Property 10: Empty directory deletion
   * For any empty directory in the workspace, deleting that directory 
   * should succeed and the directory should no longer exist.
   * 
   * Feature: mcp-workspace-server, Property 10: Empty directory deletion
   * Validates: Requirements 4.2
   */
  it('Property 10: deleting an empty directory removes it from the filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRelativeDirPathGenerator(),
        async (relativePath) => {
          // Create a unique subdirectory for this test iteration to avoid conflicts
          const uniquePrefix = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const isolatedPath = path.join(uniquePrefix, relativePath);
          
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Create the directory structure (may create parents)
          const fullPath = path.join(testDir, isolatedPath);
          await fs.mkdir(fullPath, { recursive: true });

          // Verify the target directory exists and is empty
          await fs.access(fullPath);
          const stats = await fs.stat(fullPath);
          expect(stats.isDirectory()).toBe(true);
          
          const entries = await fs.readdir(fullPath);
          // The directory we're about to delete should be empty
          expect(entries).toHaveLength(0);

          // Delete the directory
          const result = await executeDeleteFile(
            { path: isolatedPath },
            config
          );

          // Verify the result
          expect(result.path).toBe(isolatedPath);
          expect(result.deleted).toBe(true);
          expect(result.type).toBe('directory');

          // Verify the directory no longer exists
          try {
            await fs.access(fullPath);
            expect.fail('Directory should not exist after deletion');
          } catch (error: any) {
            // Expected: directory should not exist
            expect(error.code).toBe('ENOENT');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Non-empty directory protection
   * For any directory containing files or subdirectories, attempting to 
   * delete that directory should be rejected with a clear error message.
   * 
   * Feature: mcp-workspace-server, Property 11: Non-empty directory protection
   * Validates: Requirements 4.3
   */
  it('Property 11: deleting a non-empty directory is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          validRelativeDirPathGenerator(),
          fc.oneof(
            // Either create a file in the directory
            fc.constant('file'),
            // Or create a subdirectory
            fc.constant('subdir')
          )
        ),
        async ([relativePath, contentType]) => {
          // Create a unique subdirectory for this test iteration
          const uniquePrefix = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const isolatedPath = path.join(uniquePrefix, relativePath);
          
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Create the directory
          const fullPath = path.join(testDir, isolatedPath);
          await fs.mkdir(fullPath, { recursive: true });

          // Add content to make it non-empty
          if (contentType === 'file') {
            // Create a file inside the directory
            const filePath = path.join(fullPath, 'test-file.txt');
            await fs.writeFile(filePath, 'test content', 'utf-8');
          } else {
            // Create a subdirectory inside
            const subdirPath = path.join(fullPath, 'subdir');
            await fs.mkdir(subdirPath);
          }

          // Verify directory is not empty
          const entries = await fs.readdir(fullPath);
          expect(entries.length).toBeGreaterThan(0);

          // Attempt to delete the non-empty directory
          try {
            await executeDeleteFile(
              { path: isolatedPath },
              config
            );

            // If we reach here, the test should fail
            expect.fail('Deletion of non-empty directory should have been rejected');
          } catch (error: any) {
            // Expected: should throw an error about non-empty directory
            expect(error.message).toMatch(/non-empty/i);
          }

          // Verify the directory still exists
          await fs.access(fullPath);
          const stillExists = await fs.stat(fullPath);
          expect(stillExists.isDirectory()).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
