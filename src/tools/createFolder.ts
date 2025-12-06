/**
 * create_folder tool implementation
 * Provides directory creation capabilities within the workspace
 */

import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { ensureDirectory } from '../utils/fsUtils.js';
import { createReadOnlyError, classifyError } from '../utils/errors.js';

/**
 * Input parameters for create_folder tool
 */
export interface CreateFolderInput {
  path: string;
}

/**
 * Output from create_folder tool
 */
export interface CreateFolderOutput {
  path: string;
  created: boolean;
}

/**
 * Tool metadata for MCP registration
 */
export const createFolderTool = {
  name: 'create_folder',
  description: 'Create a directory in the workspace. Automatically creates parent directories if they do not exist. Idempotent - succeeds even if directory already exists.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the directory to create',
      },
    },
    required: ['path'],
  },
};

/**
 * Executes the create_folder tool
 * @param input - Tool input parameters
 * @param config - Server configuration
 * @returns Directory path and creation status
 */
export async function executeCreateFolder(
  input: CreateFolderInput,
  config: ServerConfig
): Promise<CreateFolderOutput> {
  const requestedPath = input.path;

  // Check read-only mode
  if (config.readOnly) {
    throw createReadOnlyError('Directory creation');
  }

  try {
    // Validate and resolve the path
    const resolvedPath = await resolveSafePath(config.workspaceRoot, requestedPath);

    // Create the directory (with parents)
    const created = await ensureDirectory(resolvedPath);

    return {
      path: requestedPath,
      created,
    };
  } catch (error: unknown) {
    // Classify and re-throw the error
    throw classifyError(error, 'create_folder');
  }
}
