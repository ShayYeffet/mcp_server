/**
 * Move File Tool
 * Move or rename files and directories
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

export interface MoveFileArgs {
  source: string;
  destination: string;
  overwrite?: boolean;
}

export const moveFileTool: Tool = {
  name: 'move_file',
  description: 'Move or rename files and directories',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Source file or directory path'
      },
      destination: {
        type: 'string',
        description: 'Destination file or directory path'
      },
      overwrite: {
        type: 'boolean',
        description: 'Whether to overwrite existing files',
        default: false
      }
    },
    required: ['source', 'destination']
  }
};

export async function executeMoveFile(
  args: MoveFileArgs,
  config: ServerConfig
): Promise<{ success: boolean; message: string }> {
  if (config.readOnly) {
    throw new WorkspaceError(ErrorCode.READ_ONLY_MODE, 'Cannot move files in read-only mode');
  }

  const { source, destination, overwrite = false } = args;

  // Validate and resolve paths
  const sourcePath = await resolveSafePath(config.workspaceRoot, source);
  const destPath = await resolveSafePath(config.workspaceRoot, destination);

  try {
    // Check if source exists
    const sourceStats = await fs.stat(sourcePath);
    
    // Check if destination exists
    let destExists = false;
    try {
      await fs.stat(destPath);
      destExists = true;
    } catch (error) {
      // Destination doesn't exist, which is fine
    }

    if (destExists && !overwrite) {
      throw new WorkspaceError(
        ErrorCode.INVALID_INPUT,
        `Destination already exists: ${destination}. Use overwrite=true to replace it.`
      );
    }

    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });

    // If destination exists and overwrite is true, remove it first
    if (destExists && overwrite) {
      const destStats = await fs.stat(destPath);
      if (destStats.isDirectory()) {
        await fs.rm(destPath, { recursive: true, force: true });
      } else {
        await fs.unlink(destPath);
      }
    }

    // Try to rename first (fastest for same filesystem)
    try {
      await fs.rename(sourcePath, destPath);
    } catch (error) {
      // If rename fails (different filesystems), copy then delete
      if (sourceStats.isDirectory()) {
        await copyDirectoryRecursive(sourcePath, destPath);
        await fs.rm(sourcePath, { recursive: true, force: true });
      } else {
        await fs.copyFile(sourcePath, destPath);
        await fs.unlink(sourcePath);
      }
    }

    return {
      success: true,
      message: `Successfully moved ${sourceStats.isDirectory() ? 'directory' : 'file'} from ${source} to ${destination}`
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to move: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function copyDirectoryRecursive(sourcePath: string, destPath: string): Promise<void> {
  // Create destination directory
  await fs.mkdir(destPath, { recursive: true });

  // Read source directory
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceItemPath = path.join(sourcePath, entry.name);
    const destItemPath = path.join(destPath, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourceItemPath, destItemPath);
    } else {
      await fs.copyFile(sourceItemPath, destItemPath);
    }
  }

  // Preserve timestamps
  const sourceStats = await fs.stat(sourcePath);
  await fs.utimes(destPath, sourceStats.atime, sourceStats.mtime);
}