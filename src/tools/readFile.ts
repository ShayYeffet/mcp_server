/**
 * read_file tool implementation
 * Provides file reading capabilities within the workspace
 */

import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { readFileContent } from '../utils/fsUtils.js';
import { classifyError } from '../utils/errors.js';

/**
 * Input parameters for read_file tool
 */
export interface ReadFileInput {
  path: string;
}

/**
 * Output from read_file tool
 */
export interface ReadFileOutput {
  content: string;
  path: string;
  size: number;
  lastModified: string;
}

/**
 * Tool metadata for MCP registration
 */
export const readFileTool = {
  name: 'read_file',
  description: 'Read file contents from the workspace. Returns file content as UTF-8 text along with metadata including path, size, and last modified timestamp.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file to read',
      },
    },
    required: ['path'],
  },
};

/**
 * Executes the read_file tool
 * @param input - Tool input parameters
 * @param config - Server configuration
 * @returns File content and metadata
 */
export async function executeReadFile(
  input: ReadFileInput,
  config: ServerConfig
): Promise<ReadFileOutput> {
  const requestedPath = input.path;

  try {
    // Validate and resolve the path
    const resolvedPath = await resolveSafePath(config.workspaceRoot, requestedPath);

    // Read the file
    const { content, size, lastModified } = await readFileContent(resolvedPath);

    return {
      content,
      path: requestedPath,
      size,
      lastModified,
    };
  } catch (error: unknown) {
    // Classify and re-throw the error
    throw classifyError(error, 'read_file');
  }
}
