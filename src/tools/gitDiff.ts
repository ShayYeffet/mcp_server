/**
 * Git Diff Tool
 * Show differences between commits, branches, or working directory
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface GitDiffArgs {
  target?: string;
  source?: string;
  staged?: boolean;
  nameOnly?: boolean;
  statOnly?: boolean;
  contextLines?: number;
  files?: string[];
}

export interface GitDiffResult {
  diff: string;
  files: GitDiffFile[];
  summary: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

export interface GitDiffFile {
  file: string;
  status: string;
  insertions: number;
  deletions: number;
}

export const gitDiffTool: Tool = {
  name: 'git_diff',
  description: 'Show differences between commits, branches, or working directory',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Target commit, branch, or tag to compare against (default: HEAD)'
      },
      source: {
        type: 'string',
        description: 'Source commit, branch, or tag to compare from'
      },
      staged: {
        type: 'boolean',
        description: 'Show staged changes only',
        default: false
      },
      nameOnly: {
        type: 'boolean',
        description: 'Show only file names',
        default: false
      },
      statOnly: {
        type: 'boolean',
        description: 'Show only statistics',
        default: false
      },
      contextLines: {
        type: 'number',
        description: 'Number of context lines to show',
        default: 3
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific files to show diff for'
      }
    }
  }
};

export async function executeGitDiff(
  args: GitDiffArgs,
  config: ServerConfig
): Promise<GitDiffResult> {
  const {
    target,
    source,
    staged = false,
    nameOnly = false,
    statOnly = false,
    contextLines = 3,
    files = []
  } = args;

  // Check if git is allowed
  if (!config.allowedCommands.includes('git')) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      'Git commands are not allowed. Add "git" to allowedCommands in configuration.'
    );
  }

  try {
    // Build git diff command
    let command = 'git diff';
    
    if (staged) {
      command += ' --staged';
    }
    
    if (nameOnly) {
      command += ' --name-only';
    } else if (statOnly) {
      command += ' --stat';
    } else {
      command += ` --unified=${contextLines}`;
    }

    // Add source and target
    if (source && target) {
      command += ` ${source}..${target}`;
    } else if (target) {
      command += ` ${target}`;
    }

    // Add specific files
    if (files.length > 0) {
      command += ' -- ' + files.join(' ');
    }

    // Execute diff command
    const diffResult = await execAsync(command, {
      cwd: config.workspaceRoot,
      timeout: 30000
    });

    let diff = diffResult.stdout;

    // Get file statistics
    const statCommand = command.replace(/--unified=\d+/, '--stat').replace('--name-only', '--stat');
    let statResult: { stdout: string } = { stdout: '' };
    
    try {
      statResult = await execAsync(statCommand, {
        cwd: config.workspaceRoot,
        timeout: 15000
      });
    } catch {
      // Stats might not be available
    }

    const diffFiles: GitDiffFile[] = [];
    let filesChanged = 0;
    let totalInsertions = 0;
    let totalDeletions = 0;

    // Parse statistics
    if (statResult.stdout) {
      const statLines = statResult.stdout.trim().split('\n');
      
      for (const line of statLines) {
        if (line.includes('|')) {
          const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+([+-]+)$/);
          if (match) {
            const [, file, , symbols] = match;
            const insertions = (symbols.match(/\+/g) || []).length;
            const deletions = (symbols.match(/-/g) || []).length;
            
            diffFiles.push({
              file: file.trim(),
              status: 'M', // Modified (could be more specific)
              insertions,
              deletions
            });
            
            totalInsertions += insertions;
            totalDeletions += deletions;
          }
        } else if (line.includes('file') && line.includes('changed')) {
          const match = line.match(/(\d+) files? changed/);
          if (match) {
            filesChanged = parseInt(match[1], 10);
          }
          
          const insertMatch = line.match(/(\d+) insertions?/);
          if (insertMatch) {
            totalInsertions = parseInt(insertMatch[1], 10);
          }
          
          const deleteMatch = line.match(/(\d+) deletions?/);
          if (deleteMatch) {
            totalDeletions = parseInt(deleteMatch[1], 10);
          }
        }
      }
    }

    // If no files were parsed from stats, try to get them from name-only
    if (diffFiles.length === 0 && !nameOnly) {
      try {
        const nameOnlyCommand = command.replace(/--unified=\d+/, '--name-only').replace('--stat', '--name-only');
        const nameResult = await execAsync(nameOnlyCommand, {
          cwd: config.workspaceRoot,
          timeout: 15000
        });
        
        const fileNames = nameResult.stdout.trim().split('\n').filter(name => name.length > 0);
        for (const fileName of fileNames) {
          diffFiles.push({
            file: fileName,
            status: 'M',
            insertions: 0,
            deletions: 0
          });
        }
      } catch {
        // Ignore errors
      }
    }

    return {
      diff,
      files: diffFiles,
      summary: {
        filesChanged: filesChanged || diffFiles.length,
        insertions: totalInsertions,
        deletions: totalDeletions
      }
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to get git diff: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}