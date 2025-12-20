/**
 * Git Branch Tool
 * List, create, switch, and manage git branches
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface GitBranchArgs {
  action?: 'list' | 'create' | 'switch' | 'delete' | 'rename';
  branchName?: string;
  newName?: string;
  startPoint?: string;
  force?: boolean;
  remote?: boolean;
  all?: boolean;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  lastCommit: string;
  lastCommitMessage: string;
  ahead?: number;
  behind?: number;
}

export const gitBranchTool: Tool = {
  name: 'git_branch',
  description: 'List, create, switch, and manage git branches',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'create', 'switch', 'delete', 'rename'],
        description: 'Action to perform',
        default: 'list'
      },
      branchName: {
        type: 'string',
        description: 'Branch name for create, switch, delete, or rename operations'
      },
      newName: {
        type: 'string',
        description: 'New name for rename operation'
      },
      startPoint: {
        type: 'string',
        description: 'Starting point for new branch (commit, branch, or tag)'
      },
      force: {
        type: 'boolean',
        description: 'Force the operation (for delete or create)',
        default: false
      },
      remote: {
        type: 'boolean',
        description: 'Include remote branches in list',
        default: false
      },
      all: {
        type: 'boolean',
        description: 'Include all branches (local and remote) in list',
        default: false
      }
    }
  }
};

export async function executeGitBranch(
  args: GitBranchArgs,
  config: ServerConfig
): Promise<{ success: boolean; message: string; branches?: GitBranchInfo[]; currentBranch?: string }> {
  const { action = 'list', branchName, newName, startPoint, force = false, remote = false, all = false } = args;

  // Check if git is allowed
  if (!config.allowedCommands.includes('git')) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      'Git commands are not allowed. Add "git" to allowedCommands in configuration.'
    );
  }

  try {
    switch (action) {
      case 'list':
        return await listBranches(config, remote, all);
      
      case 'create':
        if (!branchName) {
          throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Branch name is required for create action');
        }
        return await createBranch(config, branchName, startPoint, force);
      
      case 'switch':
        if (!branchName) {
          throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Branch name is required for switch action');
        }
        return await switchBranch(config, branchName);
      
      case 'delete':
        if (!branchName) {
          throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Branch name is required for delete action');
        }
        return await deleteBranch(config, branchName, force);
      
      case 'rename':
        if (!branchName || !newName) {
          throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Both branchName and newName are required for rename action');
        }
        return await renameBranch(config, branchName, newName);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown action: ${action}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Git branch operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function listBranches(
  config: ServerConfig,
  remote: boolean,
  all: boolean
): Promise<{ success: boolean; message: string; branches: GitBranchInfo[]; currentBranch: string }> {
  let command = 'git branch -v';
  
  if (all) {
    command += ' -a';
  } else if (remote) {
    command += ' -r';
  }

  const result = await execAsync(command, {
    cwd: config.workspaceRoot,
    timeout: 15000
  });

  const branches: GitBranchInfo[] = [];
  let currentBranch = '';
  const lines = result.stdout.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isCurrent = trimmed.startsWith('*');
    const isRemote = trimmed.includes('remotes/') || trimmed.includes('origin/');
    
    // Parse branch info
    const match = trimmed.match(/^(\*?\s*)([^\s]+)\s+([a-f0-9]+)\s+(.+)$/);
    if (match) {
      const [, , name, commit, message] = match;
      const cleanName = name.replace('remotes/', '').replace('origin/', '');
      
      if (isCurrent) {
        currentBranch = cleanName;
      }

      branches.push({
        name: cleanName,
        current: isCurrent,
        remote: isRemote,
        lastCommit: commit,
        lastCommitMessage: message
      });
    }
  }

  // Get ahead/behind info for current branch
  if (currentBranch) {
    try {
      const upstreamResult = await execAsync(`git rev-list --left-right --count HEAD...origin/${currentBranch}`, {
        cwd: config.workspaceRoot,
        timeout: 10000
      });
      
      const [ahead, behind] = upstreamResult.stdout.trim().split('\t').map(n => parseInt(n, 10));
      const currentBranchInfo = branches.find(b => b.current);
      if (currentBranchInfo) {
        currentBranchInfo.ahead = ahead;
        currentBranchInfo.behind = behind;
      }
    } catch {
      // No upstream or other error
    }
  }

  return {
    success: true,
    message: `Found ${branches.length} branches`,
    branches,
    currentBranch
  };
}

async function createBranch(
  config: ServerConfig,
  branchName: string,
  startPoint?: string,
  force?: boolean
): Promise<{ success: boolean; message: string }> {
  let command = `git branch ${branchName}`;
  
  if (startPoint) {
    command += ` ${startPoint}`;
  }
  
  if (force) {
    command = command.replace('git branch', 'git branch -f');
  }

  await execAsync(command, {
    cwd: config.workspaceRoot,
    timeout: 15000
  });

  return {
    success: true,
    message: `Created branch '${branchName}'${startPoint ? ` from '${startPoint}'` : ''}`
  };
}

async function switchBranch(
  config: ServerConfig,
  branchName: string
): Promise<{ success: boolean; message: string }> {
  const command = `git checkout ${branchName}`;

  await execAsync(command, {
    cwd: config.workspaceRoot,
    timeout: 15000
  });

  return {
    success: true,
    message: `Switched to branch '${branchName}'`
  };
}

async function deleteBranch(
  config: ServerConfig,
  branchName: string,
  force?: boolean
): Promise<{ success: boolean; message: string }> {
  const deleteFlag = force ? '-D' : '-d';
  const command = `git branch ${deleteFlag} ${branchName}`;

  await execAsync(command, {
    cwd: config.workspaceRoot,
    timeout: 15000
  });

  return {
    success: true,
    message: `Deleted branch '${branchName}'`
  };
}

async function renameBranch(
  config: ServerConfig,
  oldName: string,
  newName: string
): Promise<{ success: boolean; message: string }> {
  const command = `git branch -m ${oldName} ${newName}`;

  await execAsync(command, {
    cwd: config.workspaceRoot,
    timeout: 15000
  });

  return {
    success: true,
    message: `Renamed branch '${oldName}' to '${newName}'`
  };
}