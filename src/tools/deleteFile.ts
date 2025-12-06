/**
 * delete_file tool implementation
 * Provides file and empty directory deletion capabilities within the workspace
 */

import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { deleteFileOrDir } from '../utils/fsUtils.js';
import { createReadOnlyError, classifyError } from '../utils/errors.js';

/**
 * Input parameters for delete_file tool
 */
export interface DeleteFileInput {
  path: string;
}

/**
 * Output from delete_file tool
 */
export interface DeleteFileOutput {
  path: string;
  deleted: boolean;
  type: 'file' | 'directory';
}

/**
 * Tool metadata for MCP registration
 */
export const deleteFileTool = {
  name: 'delete_file',
  description: 'Delete a file or empty directory from the workspace. Non-empty directories cannot be deleted.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file or empty directory to delete',
      },
    },
    required: ['path'],
  },
};

/**
 * Executes the delete_file tool
 * @param input - Tool input parameters
 * @param config - Server configuration
 * @returns Deletion status and type
 */
export async function executeDeleteFile(
  input: DeleteFileInput,
  config: ServerConfig
): Promise<DeleteFileOutput> {
  const requestedPath = input.path;

  // Check read-only mode
  if (config.readOnly) {
    throw createReadOnlyError('Delete');
  }

  try {
    // Validate and resolve the path
    const resolvedPath = await resolveSafePath(config.workspaceRoot, requestedPath);

    // Delete the file or empty directory
    const { deleted, type } = await deleteFileOrDir(resolvedPath);

    return {
      path: requestedPath,
      deleted,
      type,
    };
  } catch (error: unknown) {
    // Classify and re-throw the error
    throw classifyError(error, 'delete_file');
  }
}
