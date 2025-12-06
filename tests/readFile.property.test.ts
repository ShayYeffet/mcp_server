/**
 * Property-based tests for read_file tool
 * Tests file read completeness
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeReadFile } from '../src/tools/readFile.js';
import { ServerConfig } from '../src/config.js';

describe('read_file Tool - Property Tests', () => {
  let testWorkspace: string;
  let config: ServerConfig;

  beforeEach(async () => {
    // Create a temporary workspace for testing
    const tempBase = path.join(os.tmpdir(), 'readfile-pbt-' + Date.now());
    await fs.mkdir(tempBase, { recursive: true });
    testWorkspace = tempBase;
    config = {
      workspaceRoot: testWorkspace,
      allowedCommands: [],
      readOnly: false,
      logLevel: 'error',
      commandTimeout: 300000,
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

  // Generator for valid file names
  const validFileNameGenerator = () =>
    fc
      .stringMatching(/^[a-zA-Z0-9_-]+$/)
      .filter(s => s.length > 0 && s.length <= 20)
      .map(s => s + '.txt');

  // Generator for file content (including various UTF-8 characters)
  const fileContentGenerator = () =>
    fc.string({ minLength: 0, maxLength: 500 });

  /**
   * Property 4: File read completeness
   * For any file in the workspace, reading that file should return its complete 
   * content as UTF-8 text along with path, size, and last modified metadata.
   * 
   * Feature: mcp-workspace-server, Property 4: File read completeness
   * Validates: Requirements 2.1
   */
  it('Property 4: should return complete content and correct metadata', async () => {
    // Generator for file data
    const fileDataGenerator = fc.record({
      fileName: validFileNameGenerator(),
      content: fileContentGenerator(),
    });

    await fc.assert(
      fc.asyncProperty(fileDataGenerator, async (fileData) => {
        // Create the file
        const filePath = path.join(testWorkspace, fileData.fileName);
        await fs.writeFile(filePath, fileData.content, 'utf-8');
        
        // Get expected metadata
        const stats = await fs.stat(filePath);
        const expectedSize = stats.size;
        const expectedLastModified = stats.mtime.toISOString();

        // Read the file using the tool
        const result = await executeReadFile({ path: fileData.fileName }, config);

        // Verify content matches exactly
        expect(result.content).toBe(fileData.content);
        
        // Verify path is correct
        expect(result.path).toBe(fileData.fileName);
        
        // Verify size matches
        expect(result.size).toBe(expectedSize);
        
        // Verify lastModified is defined and is a valid ISO date
        expect(result.lastModified).toBeDefined();
        expect(() => new Date(result.lastModified)).not.toThrow();
        
        // Verify lastModified is close to expected (within 1 second tolerance for filesystem timing)
        const resultDate = new Date(result.lastModified);
        const expectedDate = new Date(expectedLastModified);
        const timeDiff = Math.abs(resultDate.getTime() - expectedDate.getTime());
        expect(timeDiff).toBeLessThan(1000);
      }),
      { numRuns: 100 }
    );
  });
});
