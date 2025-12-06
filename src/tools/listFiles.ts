/**
 * list_files tool implementation
 * Provides file and directory listing capabilities within the workspace
 */

import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { listDirectory, FileInfo } from '../utils/fsUtils.js';
import { classifyError } from '../utils/errors.js';

/**
 * Input parameters for list_files tool
 */
export interface ListFilesInput {
  path?: string;
  recursive?: boolean;
}

/**
 * Output from list_files tool
 */
export interface ListFilesOutput {
  files: FileInfo[];
  path: string;
}

/**
 * Tool metadata for MCP registration
 */
export const listFilesTool = {
  name: 'list_files',
  description: 'List files and directories in the workspace. Returns file metadata including name, path, type, size, and last modified timestamp.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to list (defaults to workspace root)',
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to list recursively (include subdirectories)',
        default: false,
      },
    },
  },
};

/**
 * Executes the list_files tool
 * @param input - Tool input parameters
 * @param config - Server configuration
 * @returns List of files and directories with metadata
 */
export async function executeListFiles(
  input: ListFilesInput,
  config: ServerConfig
): Promise<ListFilesOutput> {
  // Default to workspace root if no path specified
  const requestedPath = input.path || '.';
  const recursive = input.recursive ?? false;

  try {
    // Validate and resolve the path
    const resolvedPath = await resolveSafePath(config.workspaceRoot, requestedPath);

    // List the directory
    const files = await listDirectory(resolvedPath, recursive);

    return {
      files,
      path: requestedPath,
    };
  } catch (error: unknown) {
    // Classify and re-throw the error
    throw classifyError(error, 'list_files');
  }
}
