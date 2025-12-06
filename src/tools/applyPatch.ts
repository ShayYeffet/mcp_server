/**
 * apply_patch tool implementation
 * Provides file patching capabilities within the workspace
 */

import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { readFileContent, writeFileAtomic } from '../utils/fsUtils.js';
import { createReadOnlyError, createPatchFailedError, classifyError } from '../utils/errors.js';

/**
 * Input parameters for apply_patch tool
 */
export interface ApplyPatchInput {
  path: string;
  patch: string;
}

/**
 * Output from apply_patch tool
 */
export interface ApplyPatchOutput {
  path: string;
  oldSize: number;
  newSize: number;
}

/**
 * Tool metadata for MCP registration
 */
export const applyPatchTool = {
  name: 'apply_patch',
  description: 'Apply a patch to an existing file in the workspace. Uses a simple patch format: <<<OLD\\n...\\n===\\n...\\n>>>NEW',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file to patch',
      },
      patch: {
        type: 'string',
        description: 'Patch content in format: <<<OLD\\n...\\n===\\n...\\n>>>NEW',
      },
    },
    required: ['path', 'patch'],
  },
};

/**
 * Parses a patch string in the format: <<<OLD\n...\n===\n...\n>>>NEW
 * @param patch - The patch string to parse
 * @returns Object containing oldContent and newContent
 * @throws Error if patch format is invalid
 */
function parsePatch(patch: string): { oldContent: string; newContent: string } {
  // Check for required markers
  if (!patch.includes('<<<OLD') || !patch.includes('===') || !patch.includes('>>>NEW')) {
    throw createPatchFailedError(
      'Invalid patch format. Expected format: <<<OLD\\n...\\n===\\n...\\n>>>NEW',
      { patch: patch.substring(0, 100) }
    );
  }

  // Find marker positions
  const oldMarkerIndex = patch.indexOf('<<<OLD');
  const separatorIndex = patch.indexOf('===', oldMarkerIndex);
  const newMarkerIndex = patch.indexOf('>>>NEW', separatorIndex);

  if (oldMarkerIndex === -1 || separatorIndex === -1 || newMarkerIndex === -1) {
    throw createPatchFailedError('Invalid patch format. Missing required markers.');
  }

  // Extract content between markers
  // Skip past "<<<OLD" and any newline
  let oldStart = oldMarkerIndex + '<<<OLD'.length;
  if (patch[oldStart] === '\n') {
    oldStart++;
  } else if (patch[oldStart] === '\r' && patch[oldStart + 1] === '\n') {
    oldStart += 2;
  }

  // Extract old content (everything before ===)
  let oldEnd = separatorIndex;
  // Trim trailing newline before ===
  if (patch[oldEnd - 1] === '\n') {
    oldEnd--;
    if (patch[oldEnd - 1] === '\r') {
      oldEnd--;
    }
  }
  const oldContent = patch.substring(oldStart, oldEnd);

  // Skip past "===" and any newline
  let newStart = separatorIndex + '==='.length;
  if (patch[newStart] === '\n') {
    newStart++;
  } else if (patch[newStart] === '\r' && patch[newStart + 1] === '\n') {
    newStart += 2;
  }

  // Extract new content (everything before >>>NEW)
  let newEnd = newMarkerIndex;
  // Trim trailing newline before >>>NEW
  if (patch[newEnd - 1] === '\n') {
    newEnd--;
    if (patch[newEnd - 1] === '\r') {
      newEnd--;
    }
  }
  const newContent = patch.substring(newStart, newEnd);

  return { oldContent, newContent };
}

/**
 * Applies a patch to file content
 * @param currentContent - The current file content
 * @param oldContent - The content to find and replace
 * @param newContent - The content to replace with
 * @returns The patched content
 * @throws Error if old content is not found in current content
 */
function applyPatchToContent(
  currentContent: string,
  oldContent: string,
  newContent: string
): string {
  // Check if old content exists in current content
  const index = currentContent.indexOf(oldContent);
  
  if (index === -1) {
    throw createPatchFailedError(
      'Old content not found in file. The patch cannot be applied because the expected content does not match the current file content.',
      { 
        expectedContent: oldContent.substring(0, 100),
        actualContentPreview: currentContent.substring(0, 100)
      }
    );
  }

  // Replace the old content with new content
  const patchedContent = 
    currentContent.substring(0, index) +
    newContent +
    currentContent.substring(index + oldContent.length);

  return patchedContent;
}

/**
 * Executes the apply_patch tool
 * @param input - Tool input parameters
 * @param config - Server configuration
 * @returns File path, old size, and new size
 */
export async function executeApplyPatch(
  input: ApplyPatchInput,
  config: ServerConfig
): Promise<ApplyPatchOutput> {
  const requestedPath = input.path;
  const patch = input.patch;

  // Check read-only mode
  if (config.readOnly) {
    throw createReadOnlyError('Write');
  }

  try {
    // Validate and resolve the path
    const resolvedPath = await resolveSafePath(config.workspaceRoot, requestedPath);

    // Read the current file content
    const { content: currentContent, size: oldSize } = await readFileContent(resolvedPath);

    // Parse the patch
    const { oldContent, newContent } = parsePatch(patch);

    // Apply the patch
    const patchedContent = applyPatchToContent(currentContent, oldContent, newContent);

    // Write the patched content back to the file
    await writeFileAtomic(resolvedPath, patchedContent, false);

    const newSize = Buffer.byteLength(patchedContent, 'utf-8');

    return {
      path: requestedPath,
      oldSize,
      newSize,
    };
  } catch (error: unknown) {
    // Classify and re-throw the error
    throw classifyError(error, 'apply_patch');
  }
}
