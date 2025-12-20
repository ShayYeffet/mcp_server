/**
 * Find Files Tool
 * Find files by name pattern, extension, or other criteria
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

export interface FindFilesArgs {
  pattern?: string;
  extension?: string;
  name?: string;
  maxDepth?: number;
  includeHidden?: boolean;
  sortBy?: 'name' | 'size' | 'modified';
  maxResults?: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: string;
  isDirectory: boolean;
}

export const findFilesTool: Tool = {
  name: 'find_files',
  description: 'Find files by name pattern, extension, or other criteria',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match filenames (e.g., "*.js", "test*")'
      },
      extension: {
        type: 'string',
        description: 'File extension to search for (e.g., "js", "py")'
      },
      name: {
        type: 'string',
        description: 'Exact filename to search for'
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum directory depth to search',
        default: 10
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files and directories',
        default: false
      },
      sortBy: {
        type: 'string',
        enum: ['name', 'size', 'modified'],
        description: 'Sort results by name, size, or modification date',
        default: 'name'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 100
      }
    }
  }
};

export async function executeFindFiles(
  args: FindFilesArgs,
  config: ServerConfig
): Promise<{ files: FileInfo[]; totalFound: number }> {
  const {
    pattern,
    extension,
    name,
    maxDepth = 10,
    includeHidden = false,
    sortBy = 'name',
    maxResults = 100
  } = args;

  if (!pattern && !extension && !name) {
    throw new WorkspaceError(
      ErrorCode.INVALID_INPUT,
      'Must specify at least one search criteria: pattern, extension, or name'
    );
  }

  const foundFiles: FileInfo[] = [];

  try {
    await findFilesRecursive(
      config.workspaceRoot,
      config.workspaceRoot,
      0,
      maxDepth,
      foundFiles,
      { pattern, extension, name, includeHidden }
    );

    // Sort results
    foundFiles.sort((a, b) => {
      switch (sortBy) {
        case 'size':
          return b.size - a.size;
        case 'modified':
          return new Date(b.modified).getTime() - new Date(a.modified).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    const totalFound = foundFiles.length;
    const results = foundFiles.slice(0, maxResults);

    return { files: results, totalFound };
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to find files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function findFilesRecursive(
  currentDir: string,
  rootDir: string,
  currentDepth: number,
  maxDepth: number,
  results: FileInfo[],
  criteria: {
    pattern?: string;
    extension?: string;
    name?: string;
    includeHidden: boolean;
  }
): Promise<void> {
  if (currentDepth > maxDepth) return;

  try {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      // Skip hidden files/directories if not requested
      if (!criteria.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Skip common build/dependency directories
      if (entry.isDirectory() && ['node_modules', '.git', 'dist', 'build', '.vscode'].includes(entry.name)) {
        continue;
      }

      if (entry.isFile() && matchesCriteria(entry.name, criteria)) {
        try {
          const stats = await fs.stat(fullPath);
          results.push({
            path: relativePath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            isDirectory: false
          });
        } catch (error) {
          // Skip files we can't stat
        }
      } else if (entry.isDirectory()) {
        // Add directory if it matches criteria
        if (matchesCriteria(entry.name, criteria)) {
          try {
            const stats = await fs.stat(fullPath);
            results.push({
              path: relativePath,
              name: entry.name,
              size: 0,
              modified: stats.mtime.toISOString(),
              isDirectory: true
            });
          } catch (error) {
            // Skip directories we can't stat
          }
        }

        // Recurse into directory
        await findFilesRecursive(
          fullPath,
          rootDir,
          currentDepth + 1,
          maxDepth,
          results,
          criteria
        );
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

function matchesCriteria(
  filename: string,
  criteria: {
    pattern?: string;
    extension?: string;
    name?: string;
    includeHidden: boolean;
  }
): boolean {
  const { pattern, extension, name } = criteria;

  // Exact name match
  if (name && filename === name) {
    return true;
  }

  // Extension match
  if (extension) {
    const fileExt = path.extname(filename).slice(1).toLowerCase();
    if (fileExt === extension.toLowerCase()) {
      return true;
    }
  }

  // Pattern match
  if (pattern) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    if (regex.test(filename)) {
      return true;
    }
  }

  return false;
}