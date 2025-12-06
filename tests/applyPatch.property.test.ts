/**
 * Property-based tests for apply_patch tool
 * Tests patch application correctness and invalid patch rejection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeApplyPatch } from '../src/tools/applyPatch.js';
import { ServerConfig } from '../src/config.js';

describe('apply_patch Tool - Property Tests', () => {
  let testWorkspace: string;
  let config: ServerConfig;

  beforeEach(async () => {
    // Create a temporary workspace for testing
    const tempBase = path.join(os.tmpdir(), 'applypatch-pbt-' + Date.now());
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

  // Generator for file content segments (avoiding the patch markers)
  const contentSegmentGenerator = () =>
    fc.string({ minLength: 1, maxLength: 100 })
      .filter(s => !s.includes('<<<OLD') && !s.includes('===') && !s.includes('>>>NEW'));

  /**
   * Property 14: Patch application correctness
   * For any file and valid patch, applying the patch should transform the file 
   * content according to the patch specification and return correct old and new sizes.
   * 
   * Feature: mcp-workspace-server, Property 14: Patch application correctness
   * Validates: Requirements 6.1
   */
  it('Property 14: should correctly apply patches and return accurate sizes', async () => {
    // Generator for patch test data with unique oldContent
    const patchDataGenerator = fc.record({
      fileName: validFileNameGenerator(),
      prefix: contentSegmentGenerator(),
      oldContent: contentSegmentGenerator(),
      newContent: contentSegmentGenerator(),
      suffix: contentSegmentGenerator(),
    }).filter(data => {
      // Ensure oldContent appears exactly once in the constructed file
      const fullContent = data.prefix + data.oldContent + data.suffix;
      const firstIndex = fullContent.indexOf(data.oldContent);
      const lastIndex = fullContent.lastIndexOf(data.oldContent);
      return firstIndex === lastIndex && firstIndex !== -1;
    });

    await fc.assert(
      fc.asyncProperty(patchDataGenerator, async (data) => {
        // Construct the original file content
        const originalContent = data.prefix + data.oldContent + data.suffix;
        
        // Create the file
        const filePath = path.join(testWorkspace, data.fileName);
        await fs.writeFile(filePath, originalContent, 'utf-8');
        
        // Get original size
        const originalStats = await fs.stat(filePath);
        const originalSize = originalStats.size;
        
        // Construct the patch
        const patch = `<<<OLD\n${data.oldContent}\n===\n${data.newContent}\n>>>NEW`;
        
        // Apply the patch
        const result = await executeApplyPatch(
          { path: data.fileName, patch },
          config
        );
        
        // Verify the path is correct
        expect(result.path).toBe(data.fileName);
        
        // Verify old size matches
        expect(result.oldSize).toBe(originalSize);
        
        // Read the patched file
        const patchedContent = await fs.readFile(filePath, 'utf-8');
        
        // Verify the content was transformed correctly
        const expectedContent = data.prefix + data.newContent + data.suffix;
        expect(patchedContent).toBe(expectedContent);
        
        // Verify new size matches
        const expectedNewSize = Buffer.byteLength(expectedContent, 'utf-8');
        expect(result.newSize).toBe(expectedNewSize);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Invalid patch rejection
   * For any file and patch where the old content doesn't match, the patch 
   * application should be rejected with a descriptive error explaining the mismatch.
   * 
   * Feature: mcp-workspace-server, Property 15: Invalid patch rejection
   * Validates: Requirements 6.2
   */
  it('Property 15: should reject patches with mismatched old content', async () => {
    // Generator for mismatched patch test data
    const mismatchedPatchDataGenerator = fc.record({
      fileName: validFileNameGenerator(),
      actualContent: contentSegmentGenerator(),
      patchOldContent: contentSegmentGenerator(),
      patchNewContent: contentSegmentGenerator(),
    }).filter(data => !data.actualContent.includes(data.patchOldContent));

    await fc.assert(
      fc.asyncProperty(mismatchedPatchDataGenerator, async (data) => {
        // Create the file with actual content
        const filePath = path.join(testWorkspace, data.fileName);
        await fs.writeFile(filePath, data.actualContent, 'utf-8');
        
        // Construct a patch that won't match
        const patch = `<<<OLD\n${data.patchOldContent}\n===\n${data.patchNewContent}\n>>>NEW`;
        
        // Attempt to apply the patch - should fail
        await expect(
          executeApplyPatch({ path: data.fileName, patch }, config)
        ).rejects.toThrow(/not found/i);
        
        // Verify the file content was not modified
        const unchangedContent = await fs.readFile(filePath, 'utf-8');
        expect(unchangedContent).toBe(data.actualContent);
      }),
      { numRuns: 100 }
    );
  });
});
