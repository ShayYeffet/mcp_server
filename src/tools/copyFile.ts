/**
 * Copy File Tool
 * Copy files or directories from one location to another
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

export interface CopyFileArgs {
  source: string;
  destination: string;
  overwrite?: boolean;
  preserveTimestamps?: boolean;
}

export const copyFileTool: Tool = {
  name: 'copy_file',
  description: 'Copy files or directories from one location to another',
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
      },
      preserveTimestamps: {
        type: 'boolean',
        description: 'Whether to preserve original timestamps',
        default: true
      }
    },
    required: ['source', 'destination']
  }
};

export async function executeCopyFile(
  args: CopyFileArgs,
  config: ServerConfig
): Promise<{ success: boolean; message: string; copiedItems: number }> {
  if (config.readOnly) {
    throw new WorkspaceError(ErrorCode.READ_ONLY_MODE, 'Cannot copy files in read-only mode');
  }

  const { source, destination, overwrite = false, preserveTimestamps = true } = args;

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

    let copiedItems = 0;

    if (sourceStats.isDirectory()) {
      copiedItems = await copyDirectory(sourcePath, destPath, overwrite, preserveTimestamps);
    } else {
      await copyFile(sourcePath, destPath, preserveTimestamps);
      copiedItems = 1;
    }

    return {
      success: true,
      message: `Successfully copied ${sourceStats.isDirectory() ? 'directory' : 'file'} from ${source} to ${destination}`,
      copiedItems
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to copy: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function copyFile(sourcePath: string, destPath: string, preserveTimestamps: boolean): Promise<void> {
  // Ensure destination directory exists
  const destDir = path.dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });

  // Copy the file
  await fs.copyFile(sourcePath, destPath);

  if (preserveTimestamps) {
    const sourceStats = await fs.stat(sourcePath);
    await fs.utimes(destPath, sourceStats.atime, sourceStats.mtime);
  }
}

async function copyDirectory(
  sourcePath: string,
  destPath: string,
  overwrite: boolean,
  preserveTimestamps: boolean
): Promise<number> {
  let copiedItems = 0;

  // Create destination directory
  await fs.mkdir(destPath, { recursive: true });

  // Read source directory
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceItemPath = path.join(sourcePath, entry.name);
    const destItemPath = path.join(destPath, entry.name);

    if (entry.isDirectory()) {
      copiedItems += await copyDirectory(sourceItemPath, destItemPath, overwrite, preserveTimestamps);
    } else {
      // Check if destination file exists
      let destExists = false;
      try {
        await fs.stat(destItemPath);
        destExists = true;
      } catch (error) {
        // File doesn't exist
      }

      if (!destExists || overwrite) {
        await copyFile(sourceItemPath, destItemPath, preserveTimestamps);
        copiedItems++;
      }
    }
  }

  if (preserveTimestamps) {
    const sourceStats = await fs.stat(sourcePath);
    await fs.utimes(destPath, sourceStats.atime, sourceStats.mtime);
  }

  return copiedItems;
}