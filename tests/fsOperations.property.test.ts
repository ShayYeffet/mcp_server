/**
 * Property-based tests for file system operations
 * Tests universal properties that should hold across all valid inputs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  writeFileAtomic,
  readFileContent,
} from '../src/utils/fsUtils';
import { executeWriteFile } from '../src/tools/writeFile';
import { ServerConfig } from '../src/config';

describe('File System Operations - Property Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `fsops-property-test-${Date.now()}`);
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

  // Generator for valid relative file paths (no traversal)
  const validRelativePathGenerator = () =>
    fc
      .array(
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
        { minLength: 1, maxLength: 3 }
      )
      .map(parts => parts.join(path.sep) + '.txt');

  // Generator for file content (including unicode and special characters)
  const fileContentGenerator = () =>
    fc.string({ minLength: 0, maxLength: 1000 });

  // Property 5: Write-read round trip
  // Feature: mcp-workspace-server, Property 5: Write-read round trip
  // Validates: Requirements 3.1
  it('Property 5: writing then reading returns same content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(validRelativePathGenerator(), fileContentGenerator()),
        async ([relativePath, content]) => {
          const filePath = path.join(testDir, relativePath);

          // Write the content
          await writeFileAtomic(filePath, content, true);

          // Read it back
          const result = await readFileContent(filePath);

          // Content should match exactly
          expect(result.content).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 8: Atomic write operations
  // Feature: mcp-workspace-server, Property 8: Atomic write operations
  // Validates: Requirements 3.5
  it('Property 8: write failures leave no partial content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(validRelativePathGenerator(), fileContentGenerator()),
        async ([relativePath, content]) => {
          const filePath = path.join(testDir, relativePath);

          // Perform the write operation
          await writeFileAtomic(filePath, content, true);

          // After a successful write, verify no temp files exist
          const dir = path.dirname(filePath);
          const files = await fs.readdir(dir);
          const tempFiles = files.filter(f => f.includes('.tmp'));

          // No temp files should remain after successful write
          expect(tempFiles).toHaveLength(0);

          // The target file should exist and contain the correct content
          const result = await readFileContent(filePath);
          expect(result.content).toBe(content);

          // File should be complete (size matches content)
          const expectedSize = Buffer.byteLength(content, 'utf-8');
          expect(result.size).toBe(expectedSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6: Parent directory creation
  // Feature: mcp-workspace-server, Property 6: Parent directory creation
  // Validates: Requirements 3.2
  it('Property 6: writing files creates all necessary parent directories', async () => {
    // Generator for nested paths (2-5 levels deep)
    const nestedPathGenerator = () =>
      fc
        .array(
          fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
          { minLength: 2, maxLength: 5 }
        )
        .map(parts => parts.join(path.sep) + '.txt');

    await fc.assert(
      fc.asyncProperty(
        fc.tuple(nestedPathGenerator(), fileContentGenerator()),
        async ([relativePath, content]) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 300000,
          };

          // Write file with createDirectories option
          const result = await executeWriteFile(
            {
              path: relativePath,
              content,
              createDirectories: true,
            },
            config
          );

          // Verify the file was written
          expect(result.path).toBe(relativePath);
          expect(result.bytesWritten).toBeGreaterThanOrEqual(0);

          // Verify all parent directories were created
          const fullPath = path.join(testDir, relativePath);
          const dirPath = path.dirname(fullPath);
          
          // Check that the directory exists
          const dirStats = await fs.stat(dirPath);
          expect(dirStats.isDirectory()).toBe(true);

          // Verify the file exists and has correct content
          const fileStats = await fs.stat(fullPath);
          expect(fileStats.isFile()).toBe(true);

          const readContent = await fs.readFile(fullPath, 'utf-8');
          expect(readContent).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });
});
