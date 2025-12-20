/**
 * Git Status Tool
 * Get git repository status and changes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface GitStatusArgs {
  porcelain?: boolean;
  showBranch?: boolean;
  showRemote?: boolean;
}

export interface GitStatusResult {
  branch: string;
  remote?: string;
  ahead?: number;
  behind?: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
  clean: boolean;
}

export interface GitFileStatus {
  file: string;
  status: string;
  statusDescription: string;
}

export const gitStatusTool: Tool = {
  name: 'git_status',
  description: 'Get git repository status and changes',
  inputSchema: {
    type: 'object',
    properties: {
      porcelain: {
        type: 'boolean',
        description: 'Use porcelain format for machine-readable output',
        default: false
      },
      showBranch: {
        type: 'boolean',
        description: 'Include branch information',
        default: true
      },
      showRemote: {
        type: 'boolean',
        description: 'Include remote tracking information',
        default: true
      }
    }
  }
};

export async function executeGitStatus(
  args: GitStatusArgs,
  config: ServerConfig
): Promise<GitStatusResult> {
  const { showBranch = true, showRemote = true } = args;

  // Check if git is allowed
  if (!config.allowedCommands.includes('git')) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      'Git commands are not allowed. Add "git" to allowedCommands in configuration.'
    );
  }

  try {
    // Get current branch
    let branch = 'unknown';
    let remote: string | undefined;
    let ahead: number | undefined;
    let behind: number | undefined;

    if (showBranch) {
      try {
        const branchResult = await execAsync('git branch --show-current', {
          cwd: config.workspaceRoot,
          timeout: 10000
        });
        branch = branchResult.stdout.trim() || 'HEAD';
      } catch (error) {
        // Might be in detached HEAD state
        try {
          const headResult = await execAsync('git rev-parse --short HEAD', {
            cwd: config.workspaceRoot,
            timeout: 10000
          });
          branch = `HEAD (${headResult.stdout.trim()})`;
        } catch {
          branch = 'unknown';
        }
      }

      // Get remote tracking info
      if (showRemote && branch !== 'unknown') {
        try {
          const remoteResult = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, {
            cwd: config.workspaceRoot,
            timeout: 10000
          });
          remote = remoteResult.stdout.trim();

          // Get ahead/behind counts
          const countResult = await execAsync(`git rev-list --left-right --count ${branch}...${remote}`, {
            cwd: config.workspaceRoot,
            timeout: 10000
          });
          const [aheadStr, behindStr] = countResult.stdout.trim().split('\t');
          ahead = parseInt(aheadStr, 10);
          behind = parseInt(behindStr, 10);
        } catch {
          // No remote tracking branch
        }
      }
    }

    // Get status
    const statusResult = await execAsync('git status --porcelain=v1', {
      cwd: config.workspaceRoot,
      timeout: 15000
    });

    const statusLines = statusResult.stdout.trim().split('\n').filter(line => line.length > 0);
    
    const staged: GitFileStatus[] = [];
    const unstaged: GitFileStatus[] = [];
    const untracked: string[] = [];

    for (const line of statusLines) {
      const stagedStatus = line[0];
      const unstagedStatus = line[1];
      const file = line.slice(3);

      if (stagedStatus === '?') {
        untracked.push(file);
      } else {
        if (stagedStatus !== ' ') {
          staged.push({
            file,
            status: stagedStatus,
            statusDescription: getStatusDescription(stagedStatus)
          });
        }
        if (unstagedStatus !== ' ') {
          unstaged.push({
            file,
            status: unstagedStatus,
            statusDescription: getStatusDescription(unstagedStatus)
          });
        }
      }
    }

    const clean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

    return {
      branch,
      remote,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      clean
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to get git status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function getStatusDescription(status: string): string {
  switch (status) {
    case 'A': return 'Added';
    case 'M': return 'Modified';
    case 'D': return 'Deleted';
    case 'R': return 'Renamed';
    case 'C': return 'Copied';
    case 'U': return 'Unmerged';
    case '?': return 'Untracked';
    case '!': return 'Ignored';
    default: return 'Unknown';
  }
}