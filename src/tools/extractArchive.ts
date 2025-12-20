/**
 * Extract Archive Tool
 * Extract compressed archives (ZIP, TAR, etc.)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface ExtractArchiveArgs {
  archivePath: string;
  destination?: string;
  overwrite?: boolean;
  preservePaths?: boolean;
}

export const extractArchiveTool: Tool = {
  name: 'extract_archive',
  description: 'Extract compressed archives (ZIP, TAR, GZ, BZ2, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      archivePath: {
        type: 'string',
        description: 'Path to the archive file'
      },
      destination: {
        type: 'string',
        description: 'Destination directory (default: same as archive location)'
      },
      overwrite: {
        type: 'boolean',
        description: 'Whether to overwrite existing files',
        default: false
      },
      preservePaths: {
        type: 'boolean',
        description: 'Preserve directory structure from archive',
        default: true
      }
    },
    required: ['archivePath']
  }
};

export async function executeExtractArchive(
  args: ExtractArchiveArgs,
  config: ServerConfig
): Promise<{ success: boolean; extractedFiles: number; destination: string }> {
  if (config.readOnly) {
    throw new WorkspaceError(ErrorCode.READ_ONLY_MODE, 'Cannot extract archives in read-only mode');
  }

  const { archivePath, destination, overwrite = false } = args;

  try {
    // Validate archive path
    const resolvedArchivePath = await resolveSafePath(config.workspaceRoot, archivePath);
    
    // Check if archive exists
    try {
      await fs.stat(resolvedArchivePath);
    } catch (error) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `Archive not found: ${archivePath}`);
    }

    // Determine destination
    let resolvedDestination: string;
    if (destination) {
      resolvedDestination = await resolveSafePath(config.workspaceRoot, destination);
    } else {
      resolvedDestination = path.dirname(resolvedArchivePath);
    }

    // Create destination directory
    await fs.mkdir(resolvedDestination, { recursive: true });

    // Detect archive format
    const ext = path.extname(archivePath).toLowerCase();
    const format = detectArchiveFormat(archivePath);

    // Build extraction command
    let command: string;
    switch (format) {
      case 'zip':
        command = buildUnzipCommand(resolvedArchivePath, resolvedDestination, overwrite);
        break;
      case 'tar':
      case 'tar.gz':
      case 'tar.bz2':
        command = buildTarExtractCommand(resolvedArchivePath, resolvedDestination, format);
        break;
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unsupported archive format: ${ext}`);
    }

    // Execute extraction
    await execAsync(command, {
      cwd: config.workspaceRoot,
      timeout: 300000 // 5 minutes
    });

    // Count extracted files
    const extractedFiles = await countFilesInDirectory(resolvedDestination);

    return {
      success: true,
      extractedFiles,
      destination: path.relative(config.workspaceRoot, resolvedDestination)
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to extract archive: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function detectArchiveFormat(filename: string): string {
  const lower = filename.toLowerCase();
  
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
  if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) return 'tar.bz2';
  if (lower.endsWith('.tar')) return 'tar';
  if (lower.endsWith('.zip')) return 'zip';
  
  throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Unknown archive format');
}

function buildUnzipCommand(archivePath: string, destination: string, overwrite: boolean): string {
  let command = 'unzip';
  
  if (overwrite) {
    command += ' -o'; // Overwrite without prompting
  } else {
    command += ' -n'; // Never overwrite
  }
  
  command += ` "${archivePath}" -d "${destination}"`;
  
  return command;
}

function buildTarExtractCommand(archivePath: string, destination: string, format: string): string {
  let command = 'tar -xf';
  
  if (format === 'tar.gz') command = 'tar -xzf';
  if (format === 'tar.bz2') command = 'tar -xjf';
  
  command += ` "${archivePath}" -C "${destination}"`;
  
  return command;
}

async function countFilesInDirectory(dirPath: string): Promise<number> {
  let count = 0;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile()) {
        count++;
      } else if (entry.isDirectory()) {
        count += await countFilesInDirectory(path.join(dirPath, entry.name));
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return count;
}