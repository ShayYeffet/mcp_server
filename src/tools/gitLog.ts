/**
 * Git Log Tool
 * Show commit history with detailed information
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface GitLogArgs {
  limit?: number;
  branch?: string;
  author?: string;
  since?: string;
  until?: string;
  grep?: string;
  oneline?: boolean;
  graph?: boolean;
  stat?: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  files?: GitCommitFile[];
}

export interface GitCommitFile {
  file: string;
  insertions: number;
  deletions: number;
  status: string;
}

export const gitLogTool: Tool = {
  name: 'git_log',
  description: 'Show git commit history with detailed information',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of commits to show',
        default: 10
      },
      branch: {
        type: 'string',
        description: 'Branch to show history for (default: current branch)'
      },
      author: {
        type: 'string',
        description: 'Filter commits by author'
      },
      since: {
        type: 'string',
        description: 'Show commits since date (e.g., "2023-01-01", "1 week ago")'
      },
      until: {
        type: 'string',
        description: 'Show commits until date'
      },
      grep: {
        type: 'string',
        description: 'Filter commits by message content'
      },
      oneline: {
        type: 'boolean',
        description: 'Show compact one-line format',
        default: false
      },
      graph: {
        type: 'boolean',
        description: 'Show branch graph',
        default: false
      },
      stat: {
        type: 'boolean',
        description: 'Include file change statistics',
        default: false
      }
    }
  }
};

export async function executeGitLog(
  args: GitLogArgs,
  config: ServerConfig
): Promise<{ commits: GitCommit[]; totalCommits: number }> {
  const {
    limit = 10,
    branch,
    author,
    since,
    until,
    grep,
    oneline = false,
    graph = false,
    stat = false
  } = args;

  // Check if git is allowed
  if (!config.allowedCommands.includes('git')) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      'Git commands are not allowed. Add "git" to allowedCommands in configuration.'
    );
  }

  try {
    // Build git log command
    let command = 'git log';
    
    // Add formatting
    if (oneline) {
      command += ' --oneline';
    } else {
      command += ' --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=iso';
    }
    
    if (graph) {
      command += ' --graph';
    }
    
    if (stat) {
      command += ' --stat';
    }
    
    // Add limit
    command += ` -${limit}`;
    
    // Add filters
    if (author) {
      command += ` --author="${author}"`;
    }
    
    if (since) {
      command += ` --since="${since}"`;
    }
    
    if (until) {
      command += ` --until="${until}"`;
    }
    
    if (grep) {
      command += ` --grep="${grep}"`;
    }
    
    // Add branch
    if (branch) {
      command += ` ${branch}`;
    }

    // Execute git log
    const result = await execAsync(command, {
      cwd: config.workspaceRoot,
      timeout: 30000
    });

    const commits: GitCommit[] = [];
    
    if (oneline) {
      // Parse oneline format
      const lines = result.stdout.trim().split('\n').filter(line => line.length > 0);
      
      for (const line of lines) {
        const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
        if (match) {
          const [, hash, message] = match;
          commits.push({
            hash,
            shortHash: hash,
            author: 'Unknown',
            authorEmail: '',
            date: '',
            message: message.trim()
          });
        }
      }
    } else {
      // Parse detailed format
      const lines = result.stdout.trim().split('\n').filter(line => line.length > 0);
      
      for (const line of lines) {
        if (line.includes('|')) {
          const parts = line.split('|');
          if (parts.length >= 6) {
            const [hash, shortHash, author, authorEmail, date, message] = parts;
            
            commits.push({
              hash: hash.trim(),
              shortHash: shortHash.trim(),
              author: author.trim(),
              authorEmail: authorEmail.trim(),
              date: date.trim(),
              message: message.trim()
            });
          }
        }
      }
    }

    // Get file statistics if requested
    if (stat && commits.length > 0) {
      for (const commit of commits) {
        try {
          const statResult = await execAsync(`git show --stat --format="" ${commit.hash}`, {
            cwd: config.workspaceRoot,
            timeout: 10000
          });
          
          commit.files = parseGitStat(statResult.stdout);
        } catch {
          // Skip if stat fails for this commit
        }
      }
    }

    // Get total commit count
    let totalCommits = commits.length;
    try {
      const countResult = await execAsync('git rev-list --count HEAD', {
        cwd: config.workspaceRoot,
        timeout: 10000
      });
      totalCommits = parseInt(countResult.stdout.trim(), 10) || commits.length;
    } catch {
      // Use current count if total count fails
    }

    return {
      commits,
      totalCommits
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to get git log: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function parseGitStat(statOutput: string): GitCommitFile[] {
  const files: GitCommitFile[] = [];
  const lines = statOutput.trim().split('\n');
  
  for (const line of lines) {
    if (line.includes('|')) {
      const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+([+-]+)$/);
      if (match) {
        const [, file, , symbols] = match;
        const insertions = (symbols.match(/\+/g) || []).length;
        const deletions = (symbols.match(/-/g) || []).length;
        
        files.push({
          file: file.trim(),
          insertions,
          deletions,
          status: 'M' // Modified (could be more specific)
        });
      }
    }
  }
  
  return files;
}