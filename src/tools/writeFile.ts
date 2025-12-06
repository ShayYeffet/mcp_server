/**
 * write_file tool implementation
 * Provides file writing capabilities within the workspace
 */

import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { writeFileAtomic } from '../utils/fsUtils.js';
import { createReadOnlyError, classifyError } from '../utils/errors.js';

/**
 * Input parameters for write_file tool
 */
export interface WriteFileInput {
  path: string;
  content: string;
  createDirectories?: boolean;
}

/**
 * Output from write_file tool
 */
export interface WriteFileOutput {
  path: string;
  bytesWritten: number;
  created: boolean;
}

/**
 * Tool metadata for MCP registration
 */
export const writeFileTool = {
  name: 'write_file',
  description: 'Create or overwrite a file in the workspace. Supports atomic writes and automatic parent directory creation.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
      createDirectories: {
        type: 'boolean',
        description: 'Whether to create parent directories if they do not exist',
        default: false,
      },
    },
    required: ['path', 'content'],
  },
};

/**
 * Executes the write_file tool
 * @param input - Tool input parameters
 * @param config - Server configuration
 * @returns File path, bytes written, and creation status
 */
export async function executeWriteFile(
  input: WriteFileInput,
  config: ServerConfig
): Promise<WriteFileOutput> {
  const requestedPath = input.path;
  const content = input.content;
  const createDirectories = input.createDirectories ?? false;

  // Check read-only mode
  if (config.readOnly) {
    throw createReadOnlyError('Write');
  }

  try {
    // Validate and resolve the path
    const resolvedPath = await resolveSafePath(config.workspaceRoot, requestedPath);

    // Write the file atomically
    const { bytesWritten, created } = await writeFileAtomic(
      resolvedPath,
      content,
      createDirectories
    );

    return {
      path: requestedPath,
      bytesWritten,
      created,
    };
  } catch (error: unknown) {
    // Classify and re-throw the error
    throw classifyError(error, 'write_file');
  }
}
