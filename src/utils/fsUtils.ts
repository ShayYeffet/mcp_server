/**
 * File system utilities for MCP Workspace Server
 * Provides helper functions for common file operations
 */

import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { createNotFoundError, createInvalidInputError, createFilesystemError } from './errors.js';

/**
 * File or directory information
 */
export interface FileInfo {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
}

/**
 * Lists files and directories in a directory
 * @param dirPath - Absolute path to the directory
 * @param recursive - Whether to list recursively
 * @param basePath - Base path for calculating relative paths (used internally)
 * @returns Array of FileInfo objects
 */
export async function listDirectory(
  dirPath: string,
  recursive: boolean = false,
  basePath?: string
): Promise<FileInfo[]> {
  const base = basePath || dirPath;
  const results: FileInfo[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(base, fullPath);
      
      if (entry.isDirectory()) {
        // Add directory entry
        const stats = await fs.stat(fullPath);
        results.push({
          name: entry.name,
          relativePath,
          type: 'directory',
          lastModified: stats.mtime.toISOString(),
        });
        
        // Recursively list subdirectory if requested
        if (recursive) {
          const subResults = await listDirectory(fullPath, recursive, base);
          results.push(...subResults);
        }
      } else if (entry.isFile()) {
        // Add file entry with metadata
        const stats = await fs.stat(fullPath);
        results.push({
          name: entry.name,
          relativePath,
          type: 'file',
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        });
      }
    }
    
    return results;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw createNotFoundError('Directory', dirPath);
    }
    if (error.code === 'ENOTDIR') {
      throw createInvalidInputError(`Path '${dirPath}' is not a directory`, { path: dirPath });
    }
    throw error;
  }
}

/**
 * Reads file content as UTF-8 text
 * @param filePath - Absolute path to the file
 * @returns File content and metadata
 */
export async function readFileContent(filePath: string): Promise<{
  content: string;
  size: number;
  lastModified: string;
}> {
  try {
    const [content, stats] = await Promise.all([
      fs.readFile(filePath, 'utf-8'),
      fs.stat(filePath),
    ]);
    
    return {
      content,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw createNotFoundError('File', filePath);
    }
    if (error.code === 'EISDIR') {
      throw createInvalidInputError(`Path '${filePath}' is a directory, not a file`, { path: filePath });
    }
    throw error;
  }
}

/**
 * Writes file content atomically using temp file + rename
 * @param filePath - Absolute path to the file
 * @param content - Content to write
 * @param createDirs - Whether to create parent directories
 * @returns Bytes written and whether file was created (vs overwritten)
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
  createDirs: boolean = false
): Promise<{ bytesWritten: number; created: boolean }> {
  const dir = path.dirname(filePath);
  
  // Check if file already exists
  let fileExists = false;
  try {
    await fs.access(filePath);
    fileExists = true;
  } catch {
    // File doesn't exist
  }
  
  // Create parent directories if requested
  if (createDirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  
  // Generate temp file name in the same directory
  const tempFileName = `.${path.basename(filePath)}.${randomBytes(8).toString('hex')}.tmp`;
  const tempFilePath = path.join(dir, tempFileName);
  
  try {
    // Write to temp file
    await fs.writeFile(tempFilePath, content, 'utf-8');
    
    // Get size of written content
    const stats = await fs.stat(tempFilePath);
    const bytesWritten = stats.size;
    
    // Atomically rename temp file to target file
    await fs.rename(tempFilePath, filePath);
    
    return {
      bytesWritten,
      created: !fileExists,
    };
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Deletes a file or empty directory
 * @param targetPath - Absolute path to delete
 * @returns Deletion status and type
 */
export async function deleteFileOrDir(targetPath: string): Promise<{
  deleted: boolean;
  type: 'file' | 'directory';
}> {
  try {
    const stats = await fs.stat(targetPath);
    
    if (stats.isDirectory()) {
      // Check if directory is empty
      const entries = await fs.readdir(targetPath);
      if (entries.length > 0) {
        throw createFilesystemError(
          `Cannot delete non-empty directory '${targetPath}'. Directory must be empty.`,
          { path: targetPath, entryCount: entries.length }
        );
      }
      
      // Delete empty directory
      await fs.rmdir(targetPath);
      return { deleted: true, type: 'directory' };
    } else {
      // Delete file
      await fs.unlink(targetPath);
      return { deleted: true, type: 'file' };
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw createNotFoundError('File or directory', targetPath);
    }
    throw error;
  }
}

/**
 * Ensures a directory exists, creating it and parents if necessary
 * @param dirPath - Absolute path to the directory
 * @returns true if directory was created, false if it already existed
 */
export async function ensureDirectory(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath);
    // Directory already exists
    return false;
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  }
}
