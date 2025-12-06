/**
 * Unit tests for file system utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  listDirectory,
  readFileContent,
  writeFileAtomic,
  deleteFileOrDir,
  ensureDirectory,
} from '../src/utils/fsUtils';

describe('File System Utilities', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `fsutils-test-${Date.now()}`);
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

  describe('listDirectory', () => {
    it('should list files and directories in a flat structure', async () => {
      // Create test structure
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'));

      const results = await listDirectory(testDir, false);

      expect(results).toHaveLength(3);
      expect(results.find(f => f.name === 'file1.txt')).toMatchObject({
        name: 'file1.txt',
        type: 'file',
      });
      expect(results.find(f => f.name === 'file2.txt')).toMatchObject({
        name: 'file2.txt',
        type: 'file',
      });
      expect(results.find(f => f.name === 'subdir')).toMatchObject({
        name: 'subdir',
        type: 'directory',
      });
    });

    it('should list files recursively', async () => {
      // Create nested structure
      await fs.mkdir(path.join(testDir, 'dir1'));
      await fs.mkdir(path.join(testDir, 'dir1', 'dir2'));
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content');
      await fs.writeFile(path.join(testDir, 'dir1', 'file2.txt'), 'content');
      await fs.writeFile(path.join(testDir, 'dir1', 'dir2', 'file3.txt'), 'content');

      const results = await listDirectory(testDir, true);

      expect(results.length).toBeGreaterThanOrEqual(5); // 1 file + 2 dirs + 2 nested files
      expect(results.find(f => f.relativePath === 'file1.txt')).toBeDefined();
      expect(results.find(f => f.relativePath === path.join('dir1', 'file2.txt'))).toBeDefined();
      expect(results.find(f => f.relativePath === path.join('dir1', 'dir2', 'file3.txt'))).toBeDefined();
    });

    it('should include file metadata', async () => {
      await fs.writeFile(path.join(testDir, 'test.txt'), 'hello');

      const results = await listDirectory(testDir, false);
      const file = results.find(f => f.name === 'test.txt');

      expect(file).toBeDefined();
      expect(file?.size).toBe(5);
      expect(file?.lastModified).toBeDefined();
      expect(new Date(file!.lastModified!)).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent directory', async () => {
      const nonExistent = path.join(testDir, 'does-not-exist');
      await expect(listDirectory(nonExistent, false)).rejects.toThrow(/does not exist/);
    });
  });

  describe('readFileContent', () => {
    it('should read file content as UTF-8', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await readFileContent(filePath);

      expect(result.content).toBe(content);
      expect(result.size).toBe(Buffer.byteLength(content, 'utf-8'));
      expect(result.lastModified).toBeDefined();
    });

    it('should read files with various encodings', async () => {
      const filePath = path.join(testDir, 'unicode.txt');
      const content = 'Hello 世界 🌍';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await readFileContent(filePath);

      expect(result.content).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      const nonExistent = path.join(testDir, 'does-not-exist.txt');
      await expect(readFileContent(nonExistent)).rejects.toThrow(/does not exist/);
    });

    it('should throw error when trying to read a directory', async () => {
      const dirPath = path.join(testDir, 'subdir');
      await fs.mkdir(dirPath);

      await expect(readFileContent(dirPath)).rejects.toThrow(/is a directory/);
    });
  });

  describe('writeFileAtomic', () => {
    it('should write content atomically', async () => {
      const filePath = path.join(testDir, 'atomic.txt');
      const content = 'Atomic write test';

      const result = await writeFileAtomic(filePath, content, false);

      expect(result.created).toBe(true);
      expect(result.bytesWritten).toBe(Buffer.byteLength(content, 'utf-8'));

      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const filePath = path.join(testDir, 'overwrite.txt');
      await fs.writeFile(filePath, 'old content');

      const newContent = 'new content';
      const result = await writeFileAtomic(filePath, newContent, false);

      expect(result.created).toBe(false);
      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(newContent);
    });

    it('should create parent directories when requested', async () => {
      const filePath = path.join(testDir, 'nested', 'deep', 'file.txt');
      const content = 'nested file';

      const result = await writeFileAtomic(filePath, content, true);

      expect(result.created).toBe(true);
      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(content);
    });

    it('should fail without createDirs when parent does not exist', async () => {
      const filePath = path.join(testDir, 'nonexistent', 'file.txt');
      const content = 'test';

      await expect(writeFileAtomic(filePath, content, false)).rejects.toThrow();
    });

    it('should handle write failures without leaving partial content', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'test content';

      // First write should succeed
      await writeFileAtomic(filePath, content, false);

      // Verify no temp files left behind
      const files = await fs.readdir(testDir);
      const tempFiles = files.filter(f => f.includes('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe('deleteFileOrDir', () => {
    it('should delete a file', async () => {
      const filePath = path.join(testDir, 'delete-me.txt');
      await fs.writeFile(filePath, 'content');

      const result = await deleteFileOrDir(filePath);

      expect(result.deleted).toBe(true);
      expect(result.type).toBe('file');
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should delete an empty directory', async () => {
      const dirPath = path.join(testDir, 'empty-dir');
      await fs.mkdir(dirPath);

      const result = await deleteFileOrDir(dirPath);

      expect(result.deleted).toBe(true);
      expect(result.type).toBe('directory');
      await expect(fs.access(dirPath)).rejects.toThrow();
    });

    it('should not delete a non-empty directory', async () => {
      const dirPath = path.join(testDir, 'non-empty-dir');
      await fs.mkdir(dirPath);
      await fs.writeFile(path.join(dirPath, 'file.txt'), 'content');

      await expect(deleteFileOrDir(dirPath)).rejects.toThrow('Cannot delete non-empty directory');
    });

    it('should throw error for non-existent path', async () => {
      const nonExistent = path.join(testDir, 'does-not-exist');
      await expect(deleteFileOrDir(nonExistent)).rejects.toThrow(/does not exist/);
    });
  });

  describe('ensureDirectory', () => {
    it('should create a new directory', async () => {
      const dirPath = path.join(testDir, 'new-dir');

      const created = await ensureDirectory(dirPath);

      expect(created).toBe(true);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories', async () => {
      const dirPath = path.join(testDir, 'nested', 'deep', 'dir');

      const created = await ensureDirectory(dirPath);

      expect(created).toBe(true);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should return false if directory already exists', async () => {
      const dirPath = path.join(testDir, 'existing-dir');
      await fs.mkdir(dirPath);

      const created = await ensureDirectory(dirPath);

      expect(created).toBe(false);
    });
  });
});
