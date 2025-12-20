/**
 * Search Files Tool
 * Searches for text content within files (grep-like functionality)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ServerConfig } from '../config.js';
// Path validation not needed for this tool
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

export interface SearchFilesArgs {
  query: string;
  filePattern?: string;
  caseSensitive?: boolean;
  maxResults?: number;
  includeLineNumbers?: boolean;
}

export interface SearchResult {
  file: string;
  matches: Array<{
    line: number;
    content: string;
    column?: number;
  }>;
}

export const searchFilesTool: Tool = {
  name: 'search_files',
  description: 'Search for text content within files in the workspace',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text to search for'
      },
      filePattern: {
        type: 'string',
        description: 'File pattern to search in (e.g., "*.js", "*.py")',
        default: '*'
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether search should be case sensitive',
        default: false
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of files to return results for',
        default: 50
      },
      includeLineNumbers: {
        type: 'boolean',
        description: 'Include line numbers in results',
        default: true
      }
    },
    required: ['query']
  }
};

export async function executeSearchFiles(
  args: SearchFilesArgs,
  config: ServerConfig
): Promise<{ results: SearchResult[]; totalMatches: number }> {
  const { query, filePattern = '*', caseSensitive = false, maxResults = 50, includeLineNumbers = true } = args;

  if (!query.trim()) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Search query cannot be empty');
  }

  const results: SearchResult[] = [];
  let totalMatches = 0;

  try {
    const files = await findMatchingFiles(config.workspaceRoot, filePattern);
    const searchRegex = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi');

    for (const file of files) {
      if (results.length >= maxResults) break;

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        const matches: SearchResult['matches'] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(searchRegex);
          
          if (match) {
            matches.push({
              line: includeLineNumbers ? i + 1 : 0,
              content: line.trim(),
              column: line.indexOf(match[0])
            });
            totalMatches++;
          }
        }

        if (matches.length > 0) {
          const relativePath = path.relative(config.workspaceRoot, file);
          results.push({
            file: relativePath,
            matches
          });
        }
      } catch (error) {
        // Skip files that can't be read (binary files, permission issues, etc.)
        continue;
      }
    }

    return { results, totalMatches };
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function findMatchingFiles(rootDir: string, pattern: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common directories that shouldn't be searched
          if (!['node_modules', '.git', '.vscode', 'dist', 'build'].includes(entry.name)) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile()) {
          if (matchesPattern(entry.name, pattern)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await walkDir(rootDir);
  return files;
}

function matchesPattern(filename: string, pattern: string): boolean {
  if (pattern === '*') return true;
  
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filename);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}