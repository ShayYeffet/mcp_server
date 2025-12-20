/**
 * Compress Files Tool
 * Create ZIP, TAR, and other compressed archives
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

export interface CompressFilesArgs {
  files: string[];
  outputPath: string;
  format?: 'zip' | 'tar' | 'tar.gz' | 'tar.bz2';
  compressionLevel?: number;
  excludePatterns?: string[];
}

export const compressFilesTool: Tool = {
  name: 'compress_files',
  description: 'Create compressed archives (ZIP, TAR, etc.) from files and directories',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of files and directories to compress'
      },
      outputPath: {
        type: 'string',
        description: 'Output archive file path'
      },
      format: {
        type: 'string',
        enum: ['zip', 'tar', 'tar.gz', 'tar.bz2'],
        description: 'Archive format',
        default: 'zip'
      },
      compressionLevel: {
        type: 'number',
        minimum: 0,
        maximum: 9,
        description: 'Compression level (0-9, higher = better compression)',
        default: 6
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns to exclude (e.g., "*.log", "node_modules")'
      }
    },
    required: ['files', 'outputPath']
  }
};

export async function executeCompressFiles(
  args: CompressFilesArgs,
  config: ServerConfig
): Promise<{ success: boolean; archivePath: string; compressedSize: number; originalSize: number }> {
  if (config.readOnly) {
    throw new WorkspaceError(ErrorCode.READ_ONLY_MODE, 'Cannot create archives in read-only mode');
  }

  const { files, outputPath, format = 'zip', compressionLevel = 6, excludePatterns = [] } = args;

  if (files.length === 0) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'No files specified for compression');
  }

  try {
    // Validate all input paths
    const resolvedFiles: string[] = [];
    let originalSize = 0;

    for (const file of files) {
      const resolvedPath = await resolveSafePath(config.workspaceRoot, file);
      resolvedFiles.push(resolvedPath);
      
      // Calculate original size
      try {
        const stats = await fs.stat(resolvedPath);
        if (stats.isFile()) {
          originalSize += stats.size;
        } else if (stats.isDirectory()) {
          originalSize += await getDirectorySize(resolvedPath);
        }
      } catch (error) {
        throw new WorkspaceError(ErrorCode.NOT_FOUND, `File not found: ${file}`);
      }
    }

    // Validate output path
    const resolvedOutputPath = await resolveSafePath(config.workspaceRoot, outputPath);
    
    // Ensure output directory exists
    const outputDir = path.dirname(resolvedOutputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Create archive based on format
    let command: string;
    const relativePaths = resolvedFiles.map(f => path.relative(config.workspaceRoot, f));

    switch (format) {
      case 'zip':
        command = await buildZipCommand(resolvedOutputPath, relativePaths, compressionLevel, excludePatterns);
        break;
      case 'tar':
        command = await buildTarCommand(resolvedOutputPath, relativePaths, false, false, excludePatterns);
        break;
      case 'tar.gz':
        command = await buildTarCommand(resolvedOutputPath, relativePaths, true, false, excludePatterns);
        break;
      case 'tar.bz2':
        command = await buildTarCommand(resolvedOutputPath, relativePaths, false, true, excludePatterns);
        break;
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unsupported format: ${format}`);
    }

    // Execute compression command
    await execAsync(command, {
      cwd: config.workspaceRoot,
      timeout: 300000 // 5 minutes timeout
    });

    // Get compressed file size
    const compressedStats = await fs.stat(resolvedOutputPath);
    const compressedSize = compressedStats.size;

    return {
      success: true,
      archivePath: path.relative(config.workspaceRoot, resolvedOutputPath),
      compressedSize,
      originalSize
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to create archive: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function buildZipCommand(
  outputPath: string,
  files: string[],
  compressionLevel: number,
  excludePatterns: string[]
): Promise<string> {
  let command = `zip -r -${compressionLevel} "${outputPath}"`;
  
  // Add files
  for (const file of files) {
    command += ` "${file}"`;
  }
  
  // Add exclusions
  for (const pattern of excludePatterns) {
    command += ` -x "${pattern}"`;
  }
  
  return command;
}

async function buildTarCommand(
  outputPath: string,
  files: string[],
  gzip: boolean,
  bzip2: boolean,
  excludePatterns: string[]
): Promise<string> {
  let command = 'tar -cf';
  
  if (gzip) command = 'tar -czf';
  if (bzip2) command = 'tar -cjf';
  
  command += ` "${outputPath}"`;
  
  // Add exclusions
  for (const pattern of excludePatterns) {
    command += ` --exclude="${pattern}"`;
  }
  
  // Add files
  for (const file of files) {
    command += ` "${file}"`;
  }
  
  return command;
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      } else if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return totalSize;
}