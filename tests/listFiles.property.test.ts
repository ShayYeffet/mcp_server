/**
 * Property-based tests for list_files tool
 * Tests file listing completeness and recursive listing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeListFiles } from '../src/tools/listFiles.js';
import { ServerConfig } from '../src/config.js';

describe('list_files Tool - Property Tests', () => {
  let testWorkspace: string;
  let config: ServerConfig;

  beforeEach(async () => {
    // Create a temporary workspace for testing
    const tempBase = path.join(os.tmpdir(), 'listfiles-pbt-' + Date.now());
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

  // Generator for valid directory/file names
  const validNameGenerator = () =>
    fc
      .stringMatching(/^[a-zA-Z0-9_-]+$/)
      .filter(s => s.length > 0 && s.length <= 20);

  // Generator for file content
  const fileContentGenerator = () =>
    fc.string({ minLength: 0, maxLength: 100 });

  /**
   * Property 2: File listing completeness
   * For any directory in the workspace, listing that directory should return 
   * all files and directories it contains, each with name, relative path, type, 
   * size (for files), and last modified timestamp.
   * 
   * Feature: mcp-workspace-server, Property 2: File listing completeness
   * Validates: Requirements 1.1
   */
  it('Property 2: should return all entries with correct metadata', async () => {
    // Generator for a flat directory structure with unique names
    const flatStructureGenerator = fc.record({
      files: fc.uniqueArray(
        fc.record({
          name: validNameGenerator().map(n => n + '.txt'),
          content: fileContentGenerator(),
        }),
        { minLength: 0, maxLength: 10, selector: (item) => item.name }
      ),
      directories: fc.uniqueArray(
        validNameGenerator(),
        { minLength: 0, maxLength: 5 }
      ),
    });

    await fc.assert(
      fc.asyncProperty(flatStructureGenerator, async (structure) => {
        // Create a unique subdirectory for this test iteration
        const testSubdir = path.join(testWorkspace, `test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        await fs.mkdir(testSubdir, { recursive: true });
        
        // Create the directory structure
        const createdFiles = new Map<string, string>(); // name -> content
        const createdDirs = new Set<string>();

        // Create files
        for (const file of structure.files) {
          const filePath = path.join(testSubdir, file.name);
          await fs.writeFile(filePath, file.content, 'utf-8');
          createdFiles.set(file.name, file.content);
        }

        // Create directories (skip if name conflicts with a file)
        for (const dir of structure.directories) {
          if (!createdFiles.has(dir)) {
            const dirPath = path.join(testSubdir, dir);
            await fs.mkdir(dirPath, { recursive: true });
            createdDirs.add(dir);
          }
        }

        // List the directory (use relative path from workspace root)
        const relativePath = path.relative(testWorkspace, testSubdir);
        const result = await executeListFiles({ path: relativePath, recursive: false }, config);

        // Verify all files are returned
        for (const [fileName, content] of createdFiles) {
          const fileEntry = result.files.find(f => f.name === fileName);
          expect(fileEntry, `File ${fileName} should be in listing`).toBeDefined();
          expect(fileEntry?.type).toBe('file');
          expect(fileEntry?.name).toBe(fileName);
          expect(fileEntry?.relativePath).toBe(fileName);
          expect(fileEntry?.size).toBeDefined();
          expect(fileEntry?.lastModified).toBeDefined();
          
          // Verify size matches content
          const expectedSize = Buffer.byteLength(content, 'utf-8');
          expect(fileEntry?.size).toBe(expectedSize);
          
          // Verify lastModified is a valid ISO date
          expect(() => new Date(fileEntry!.lastModified!)).not.toThrow();
        }

        // Verify all directories are returned
        for (const dirName of createdDirs) {
          const dirEntry = result.files.find(f => f.name === dirName);
          expect(dirEntry, `Directory ${dirName} should be in listing`).toBeDefined();
          expect(dirEntry?.type).toBe('directory');
          expect(dirEntry?.name).toBe(dirName);
          expect(dirEntry?.relativePath).toBe(dirName);
          expect(dirEntry?.lastModified).toBeDefined();
          
          // Verify lastModified is a valid ISO date
          expect(() => new Date(dirEntry!.lastModified!)).not.toThrow();
        }

        // Verify no extra entries
        const totalExpected = createdFiles.size + createdDirs.size;
        expect(result.files.length).toBe(totalExpected);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Recursive listing completeness
   * For any directory in the workspace, listing with recursive=true should return 
   * all nested files and directories at any depth within that directory.
   * 
   * Feature: mcp-workspace-server, Property 3: Recursive listing completeness
   * Validates: Requirements 1.2
   */
  it('Property 3: should return all nested items when recursive=true', async () => {
    // Generator for nested directory structures
    const nestedStructureGenerator = fc.record({
      // Root level files
      rootFiles: fc.uniqueArray(
        fc.record({
          name: validNameGenerator().map(n => 'root-' + n + '.txt'),
          content: fileContentGenerator(),
        }),
        { minLength: 0, maxLength: 5, selector: (item) => item.name }
      ),
      // Nested directories with files
      nestedDirs: fc.array(
        fc.record({
          dirPath: fc.array(validNameGenerator(), { minLength: 1, maxLength: 3 })
            .map(parts => parts.join(path.sep)),
          files: fc.uniqueArray(
            fc.record({
              name: validNameGenerator().map(n => n + '.txt'),
              content: fileContentGenerator(),
            }),
            { minLength: 0, maxLength: 3, selector: (item) => item.name }
          ),
        }),
        { minLength: 1, maxLength: 5 }
      ),
    });

    await fc.assert(
      fc.asyncProperty(nestedStructureGenerator, async (structure) => {
        // Create a unique subdirectory for this test iteration
        const testSubdir = path.join(testWorkspace, `test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        await fs.mkdir(testSubdir, { recursive: true });
        
        // Track all created files and directories
        const allFiles = new Map<string, string>(); // relativePath -> content
        const allDirs = new Set<string>(); // relativePath

        // Create root level files
        for (const file of structure.rootFiles) {
          const filePath = path.join(testSubdir, file.name);
          await fs.writeFile(filePath, file.content, 'utf-8');
          allFiles.set(file.name, file.content);
        }

        // Create nested directories and files
        for (const nested of structure.nestedDirs) {
          const dirPath = path.join(testSubdir, nested.dirPath);
          await fs.mkdir(dirPath, { recursive: true });
          
          // Track all parent directories
          let currentPath = '';
          for (const part of nested.dirPath.split(path.sep)) {
            currentPath = currentPath ? path.join(currentPath, part) : part;
            allDirs.add(currentPath);
          }

          // Create files in this directory
          for (const file of nested.files) {
            const filePath = path.join(dirPath, file.name);
            const relativePath = path.join(nested.dirPath, file.name);
            await fs.writeFile(filePath, file.content, 'utf-8');
            allFiles.set(relativePath, file.content);
          }
        }

        // List the directory recursively
        const relativePath = path.relative(testWorkspace, testSubdir);
        const result = await executeListFiles({ path: relativePath, recursive: true }, config);

        // Verify all files are returned
        for (const [fileRelPath, content] of allFiles) {
          const fileEntry = result.files.find(f => f.relativePath === fileRelPath);
          expect(fileEntry, `File ${fileRelPath} should be in recursive listing`).toBeDefined();
          expect(fileEntry?.type).toBe('file');
          expect(fileEntry?.size).toBeDefined();
          
          // Verify size matches content
          const expectedSize = Buffer.byteLength(content, 'utf-8');
          expect(fileEntry?.size).toBe(expectedSize);
        }

        // Verify all directories are returned
        for (const dirRelPath of allDirs) {
          const dirEntry = result.files.find(f => f.relativePath === dirRelPath);
          expect(dirEntry, `Directory ${dirRelPath} should be in recursive listing`).toBeDefined();
          expect(dirEntry?.type).toBe('directory');
        }

        // Verify we have at least the expected number of entries
        const expectedMinEntries = allFiles.size + allDirs.size;
        expect(result.files.length).toBeGreaterThanOrEqual(expectedMinEntries);
      }),
      { numRuns: 100 }
    );
  });
});
