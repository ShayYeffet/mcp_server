/**
 * Property-based tests for path sandboxing
 * Property 1: Universal path sandboxing
 * Validates: Requirements 1.4, 2.2, 3.3, 4.4, 5.3, 6.3, 9.1, 9.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveSafePath } from '../src/utils/pathUtils.js';
import * as fc from 'fast-check';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Property-Based Tests: Path Sandboxing', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    // Create a temporary workspace for testing
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-pbt-'));
  });

  afterEach(async () => {
    // Clean up temporary workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Property 1: Universal path sandboxing
   * For any tool and any path parameter, when the resolved path falls outside 
   * the workspace root, the operation should be rejected with a security error.
   * 
   * Validates: Requirements 1.4, 2.2, 3.3, 4.4, 5.3, 6.3, 9.1, 9.2
   */
  it('Property 1: should reject all paths that escape workspace boundary', async () => {
    // Generator for malicious path patterns
    const maliciousPathGenerator = fc.oneof(
      // Parent directory traversal patterns
      fc.constant('..'),
      fc.constant('../'),
      fc.constant('../..'),
      fc.constant('../../'),
      fc.constant('../../../'),
      fc.constant('subdir/../../..'),
      fc.constant('a/b/c/../../../../..'),
      
      // Absolute paths outside workspace
      fc.constant('/etc/passwd'),
      fc.constant('/tmp/outside'),
      fc.constant('C:\\Windows\\System32'),
      fc.constant('/root/.ssh/id_rsa'),
      
      // Mixed traversal patterns
      fc.constant('valid/../../../invalid'),
      fc.constant('./../../outside'),
      fc.constant('subdir/../../../etc/passwd'),
      
      // Multiple parent traversals
      fc.tuple(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom('file.txt', 'secret.key', 'config.json')
      ).map(([depth, filename]) => {
        const traversal = Array(depth).fill('..').join(path.sep);
        return path.join(traversal, filename);
      }),
      
      // Absolute paths to different temp locations
      fc.string({ minLength: 5, maxLength: 20 }).map(s => 
        path.join(os.tmpdir(), 'different-' + s.replace(/[^a-zA-Z0-9]/g, ''))
      )
    );

    await fc.assert(
      fc.asyncProperty(maliciousPathGenerator, async (maliciousPath) => {
        // Attempt to resolve the malicious path
        try {
          const resolved = await resolveSafePath(testWorkspace, maliciousPath);
          
          // If it didn't throw, verify it's actually within workspace
          // (some paths like 'subdir/../../file.txt' might resolve to workspace)
          const normalizedWorkspace = path.normalize(testWorkspace);
          const normalizedResolved = path.normalize(resolved);
          
          const workspaceWithSep = normalizedWorkspace.endsWith(path.sep)
            ? normalizedWorkspace
            : normalizedWorkspace + path.sep;
          
          const isWithinWorkspace = 
            normalizedResolved === normalizedWorkspace ||
            normalizedResolved.startsWith(workspaceWithSep);
          
          // If the path resolved successfully, it MUST be within workspace
          expect(isWithinWorkspace).toBe(true);
        } catch (error: any) {
          // Expected: should throw a security violation error
          expect(error.message).toMatch(/Security violation|outside the workspace/i);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Valid relative paths should always resolve within workspace
   */
  it('Property 1 (inverse): should accept all valid relative paths within workspace', async () => {
    // Generator for valid relative paths
    const validPathGenerator = fc.oneof(
      // Simple filenames
      fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes('..') && !path.isAbsolute(s) && s.trim().length > 0)
        .map(s => s.replace(/[^a-zA-Z0-9._-]/g, '_') + '.txt'),
      
      // Nested paths
      fc.array(
        fc.string({ minLength: 1, maxLength: 10 })
          .map(s => s.replace(/[^a-zA-Z0-9_-]/g, '_')),
        { minLength: 1, maxLength: 5 }
      ).map(parts => parts.join(path.sep) + '.txt'),
      
      // Paths with . references that stay within workspace
      fc.tuple(
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_')),
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_'))
      ).map(([dir, file]) => path.join(dir, '.', file + '.txt')),
      
      // Paths with .. that stay within workspace
      fc.tuple(
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_')),
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_')),
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_'))
      ).map(([dir1, dir2, file]) => path.join(dir1, dir2, '..', file + '.txt'))
    );

    await fc.assert(
      fc.asyncProperty(validPathGenerator, async (validPath) => {
        // Valid paths should resolve without throwing
        const resolved = await resolveSafePath(testWorkspace, validPath);
        
        // Verify the resolved path is within workspace
        const normalizedWorkspace = path.normalize(testWorkspace);
        const normalizedResolved = path.normalize(resolved);
        
        const workspaceWithSep = normalizedWorkspace.endsWith(path.sep)
          ? normalizedWorkspace
          : normalizedWorkspace + path.sep;
        
        const isWithinWorkspace = 
          normalizedResolved === normalizedWorkspace ||
          normalizedResolved.startsWith(workspaceWithSep);
        
        expect(isWithinWorkspace).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Absolute paths within workspace should be accepted
   */
  it('Property 1 (absolute paths): should accept absolute paths within workspace', async () => {
    // Generator for absolute paths within workspace
    const absolutePathWithinWorkspace = fc.oneof(
      // Workspace root itself
      fc.constant(testWorkspace),
      
      // Files directly in workspace
      fc.string({ minLength: 1, maxLength: 20 })
        .map(s => s.replace(/[^a-zA-Z0-9._-]/g, '_') + '.txt')
        .map(filename => path.join(testWorkspace, filename)),
      
      // Nested paths within workspace
      fc.array(
        fc.string({ minLength: 1, maxLength: 10 })
          .map(s => s.replace(/[^a-zA-Z0-9_-]/g, '_')),
        { minLength: 1, maxLength: 3 }
      ).map(parts => path.join(testWorkspace, ...parts, 'file.txt'))
    );

    await fc.assert(
      fc.asyncProperty(absolutePathWithinWorkspace, async (absolutePath) => {
        // Absolute paths within workspace should resolve successfully
        const resolved = await resolveSafePath(testWorkspace, absolutePath);
        
        // Verify the resolved path is within workspace
        const normalizedWorkspace = path.normalize(testWorkspace);
        const normalizedResolved = path.normalize(resolved);
        
        const workspaceWithSep = normalizedWorkspace.endsWith(path.sep)
          ? normalizedWorkspace
          : normalizedWorkspace + path.sep;
        
        const isWithinWorkspace = 
          normalizedResolved === normalizedWorkspace ||
          normalizedResolved.startsWith(workspaceWithSep);
        
        expect(isWithinWorkspace).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
