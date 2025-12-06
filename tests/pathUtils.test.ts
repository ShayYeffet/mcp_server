/**
 * Unit tests for path security utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveSafePath, isPathSafe, normalizePath } from '../src/utils/pathUtils.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Path Security Utilities', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    // Create a temporary workspace for testing
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
  });

  afterEach(async () => {
    // Clean up temporary workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('normalizePath', () => {
    it('should normalize an existing path', async () => {
      const result = await normalizePath(testWorkspace);
      expect(result).toBe(path.normalize(testWorkspace));
    });

    it('should normalize a non-existent path', async () => {
      const nonExistent = path.join(testWorkspace, 'does-not-exist');
      const result = await normalizePath(nonExistent);
      expect(result).toBe(path.normalize(path.resolve(nonExistent)));
    });

    it('should resolve symbolic links', async () => {
      // Create a file and a symlink to it
      const targetFile = path.join(testWorkspace, 'target.txt');
      const symlinkFile = path.join(testWorkspace, 'link.txt');
      
      await fs.writeFile(targetFile, 'test');
      await fs.symlink(targetFile, symlinkFile);
      
      const result = await normalizePath(symlinkFile);
      expect(result).toBe(path.normalize(targetFile));
    });
  });

  describe('isPathSafe', () => {
    it('should return true for workspace root itself', () => {
      const result = isPathSafe(testWorkspace, testWorkspace);
      expect(result).toBe(true);
    });

    it('should return true for paths within workspace', () => {
      const safePath = path.join(testWorkspace, 'subdir', 'file.txt');
      const result = isPathSafe(testWorkspace, safePath);
      expect(result).toBe(true);
    });

    it('should return false for paths outside workspace', () => {
      const unsafePath = path.join(testWorkspace, '..', 'outside');
      const resolved = path.resolve(unsafePath);
      const result = isPathSafe(testWorkspace, resolved);
      expect(result).toBe(false);
    });

    it('should return false for completely different paths', () => {
      const unsafePath = '/completely/different/path';
      const result = isPathSafe(testWorkspace, unsafePath);
      expect(result).toBe(false);
    });

    it('should handle workspace root with trailing separator', () => {
      const rootWithSep = testWorkspace + path.sep;
      const safePath = path.join(testWorkspace, 'file.txt');
      const result = isPathSafe(rootWithSep, safePath);
      expect(result).toBe(true);
    });

    it('should prevent partial directory name matches', () => {
      // If workspace is /workspace, /workspace-other should not be considered safe
      const fakeWorkspace = '/workspace';
      const similarPath = '/workspace-other/file.txt';
      const result = isPathSafe(fakeWorkspace, similarPath);
      expect(result).toBe(false);
    });
  });

  describe('resolveSafePath with valid paths', () => {
    it('should resolve a simple relative path', async () => {
      const result = await resolveSafePath(testWorkspace, 'file.txt');
      expect(result).toBe(path.join(testWorkspace, 'file.txt'));
    });

    it('should resolve a nested relative path', async () => {
      const result = await resolveSafePath(testWorkspace, 'subdir/nested/file.txt');
      expect(result).toBe(path.join(testWorkspace, 'subdir', 'nested', 'file.txt'));
    });

    it('should resolve current directory reference', async () => {
      const result = await resolveSafePath(testWorkspace, './file.txt');
      expect(result).toBe(path.join(testWorkspace, 'file.txt'));
    });

    it('should resolve parent directory within workspace', async () => {
      const result = await resolveSafePath(testWorkspace, 'subdir/../file.txt');
      expect(result).toBe(path.join(testWorkspace, 'file.txt'));
    });

    it('should resolve absolute path within workspace', async () => {
      const absolutePath = path.join(testWorkspace, 'file.txt');
      const result = await resolveSafePath(testWorkspace, absolutePath);
      expect(result).toBe(absolutePath);
    });
  });

  describe('resolveSafePath with edge cases', () => {
    it('should throw error for empty workspace root', async () => {
      await expect(resolveSafePath('', 'file.txt')).rejects.toThrow(
        'Workspace root cannot be empty'
      );
    });

    it('should throw error for empty requested path', async () => {
      await expect(resolveSafePath(testWorkspace, '')).rejects.toThrow(
        'Requested path cannot be empty'
      );
    });

    it('should handle root path (workspace root itself)', async () => {
      const result = await resolveSafePath(testWorkspace, '.');
      expect(result).toBe(testWorkspace);
    });

    it('should handle deeply nested paths', async () => {
      const deepPath = 'a/b/c/d/e/f/g/h/i/j/file.txt';
      const result = await resolveSafePath(testWorkspace, deepPath);
      expect(result).toBe(path.join(testWorkspace, deepPath));
    });
  });

  describe('resolveSafePath with traversal attempts', () => {
    it('should reject parent directory traversal', async () => {
      await expect(resolveSafePath(testWorkspace, '../outside.txt')).rejects.toThrow(
        /outside the workspace boundary/
      );
    });

    it('should reject multiple parent directory traversals', async () => {
      await expect(resolveSafePath(testWorkspace, '../../outside.txt')).rejects.toThrow(
        /outside the workspace boundary/
      );
    });

    it('should reject traversal after valid path', async () => {
      await expect(resolveSafePath(testWorkspace, 'subdir/../../outside.txt')).rejects.toThrow(
        /outside the workspace boundary/
      );
    });

    it('should reject absolute paths outside workspace', async () => {
      await expect(resolveSafePath(testWorkspace, '/etc/passwd')).rejects.toThrow(
        /outside the workspace boundary/
      );
    });

    it('should reject absolute paths to different locations', async () => {
      const differentPath = path.join(os.tmpdir(), 'different-location');
      await expect(resolveSafePath(testWorkspace, differentPath)).rejects.toThrow(
        /outside the workspace boundary/
      );
    });
  });

  describe('resolveSafePath with symbolic links', () => {
    it('should allow symlink within workspace pointing to workspace', async () => {
      // Create a file and a symlink within workspace
      const targetFile = path.join(testWorkspace, 'target.txt');
      const symlinkFile = path.join(testWorkspace, 'link.txt');
      
      await fs.writeFile(targetFile, 'test');
      await fs.symlink(targetFile, symlinkFile);
      
      const result = await resolveSafePath(testWorkspace, 'link.txt');
      expect(result).toBe(targetFile);
    });

    it('should reject symlink pointing outside workspace', async () => {
      // Create a symlink that points outside the workspace
      const outsideTarget = path.join(os.tmpdir(), 'outside-target.txt');
      const symlinkFile = path.join(testWorkspace, 'bad-link.txt');
      
      await fs.writeFile(outsideTarget, 'test');
      await fs.symlink(outsideTarget, symlinkFile);
      
      await expect(resolveSafePath(testWorkspace, 'bad-link.txt')).rejects.toThrow(
        /symbolic link.*outside the workspace boundary/
      );
      
      // Cleanup
      await fs.unlink(outsideTarget);
    });

    it('should reject symlink to parent directory', async () => {
      // Create a symlink to parent directory
      const parentDir = path.dirname(testWorkspace);
      const symlinkDir = path.join(testWorkspace, 'parent-link');
      
      await fs.symlink(parentDir, symlinkDir);
      
      await expect(resolveSafePath(testWorkspace, 'parent-link/file.txt')).rejects.toThrow(
        /symbolic link.*outside the workspace boundary/
      );
    });
  });
});
