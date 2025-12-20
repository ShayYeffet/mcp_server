/**
 * Get File Info Tool
 * Get detailed file and directory metadata
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

export interface GetFileInfoArgs {
  path: string;
  includeHash?: boolean;
  hashAlgorithm?: 'md5' | 'sha1' | 'sha256';
}

export interface FileInfoResult {
  path: string;
  name: string;
  size: number;
  sizeFormatted: string;
  type: 'file' | 'directory' | 'symlink';
  permissions: string;
  owner?: string;
  group?: string;
  created: string;
  modified: string;
  accessed: string;
  extension?: string;
  mimeType?: string;
  hash?: string;
  hashAlgorithm?: string;
  isHidden: boolean;
  isExecutable: boolean;
  children?: number; // For directories
}

export const getFileInfoTool: Tool = {
  name: 'get_file_info',
  description: 'Get detailed information about files and directories',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file or directory'
      },
      includeHash: {
        type: 'boolean',
        description: 'Calculate file hash (for files only)',
        default: false
      },
      hashAlgorithm: {
        type: 'string',
        enum: ['md5', 'sha1', 'sha256'],
        description: 'Hash algorithm to use',
        default: 'sha256'
      }
    },
    required: ['path']
  }
};

export async function executeGetFileInfo(
  args: GetFileInfoArgs,
  config: ServerConfig
): Promise<FileInfoResult> {
  const { path: filePath, includeHash = false, hashAlgorithm = 'sha256' } = args;

  try {
    // Validate and resolve path
    const resolvedPath = await resolveSafePath(config.workspaceRoot, filePath);
    
    // Get file stats
    const stats = await fs.stat(resolvedPath);
    const lstat = await fs.lstat(resolvedPath); // For symlink detection
    
    const fileName = path.basename(resolvedPath);
    const extension = path.extname(fileName).slice(1);
    const isSymlink = lstat.isSymbolicLink();
    const isDirectory = stats.isDirectory();
    const isFile = stats.isFile();
    
    // Determine file type
    let fileType: 'file' | 'directory' | 'symlink';
    if (isSymlink) {
      fileType = 'symlink';
    } else if (isDirectory) {
      fileType = 'directory';
    } else {
      fileType = 'file';
    }
    
    // Format file size
    const sizeFormatted = formatFileSize(stats.size);
    
    // Get permissions
    const permissions = formatPermissions(stats.mode);
    
    // Check if hidden (starts with . on Unix, or has hidden attribute on Windows)
    const isHidden = fileName.startsWith('.') || (stats.mode & 0o002) === 0;
    
    // Check if executable
    const isExecutable = (stats.mode & 0o111) !== 0;
    
    // Get MIME type for files
    let mimeType: string | undefined;
    if (isFile) {
      mimeType = getMimeType(extension);
    }
    
    // Count children for directories
    let children: number | undefined;
    if (isDirectory) {
      try {
        const entries = await fs.readdir(resolvedPath);
        children = entries.length;
      } catch {
        children = 0;
      }
    }
    
    // Calculate hash for files if requested
    let hash: string | undefined;
    let usedHashAlgorithm: string | undefined;
    if (includeHash && isFile && stats.size > 0) {
      try {
        hash = await calculateFileHash(resolvedPath, hashAlgorithm);
        usedHashAlgorithm = hashAlgorithm;
      } catch {
        // Hash calculation failed
      }
    }
    
    const result: FileInfoResult = {
      path: path.relative(config.workspaceRoot, resolvedPath),
      name: fileName,
      size: stats.size,
      sizeFormatted,
      type: fileType,
      permissions,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
      isHidden,
      isExecutable
    };
    
    if (extension) {
      result.extension = extension;
    }
    
    if (mimeType) {
      result.mimeType = mimeType;
    }
    
    if (hash) {
      result.hash = hash;
      result.hashAlgorithm = usedHashAlgorithm;
    }
    
    if (children !== undefined) {
      result.children = children;
    }
    
    return result;
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.FILESYSTEM_ERROR,
      `Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatPermissions(mode: number): string {
  const permissions = [];
  
  // Owner permissions
  permissions.push((mode & 0o400) ? 'r' : '-');
  permissions.push((mode & 0o200) ? 'w' : '-');
  permissions.push((mode & 0o100) ? 'x' : '-');
  
  // Group permissions
  permissions.push((mode & 0o040) ? 'r' : '-');
  permissions.push((mode & 0o020) ? 'w' : '-');
  permissions.push((mode & 0o010) ? 'x' : '-');
  
  // Other permissions
  permissions.push((mode & 0o004) ? 'r' : '-');
  permissions.push((mode & 0o002) ? 'w' : '-');
  permissions.push((mode & 0o001) ? 'x' : '-');
  
  return permissions.join('');
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    // Text
    'txt': 'text/plain',
    'md': 'text/markdown',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'json': 'application/json',
    'xml': 'text/xml',
    'csv': 'text/csv',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Archives
    'zip': 'application/zip',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'bz2': 'application/x-bzip2',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    
    // Audio/Video
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    
    // Code
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'cpp': 'text/x-c++src',
    'c': 'text/x-csrc',
    'h': 'text/x-chdr',
    'php': 'text/x-php',
    'rb': 'text/x-ruby',
    'go': 'text/x-go',
    'rs': 'text/x-rust',
    'sh': 'text/x-shellscript',
    'bat': 'text/x-msdos-batch',
    'ps1': 'text/x-powershell'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

async function calculateFileHash(filePath: string, algorithm: string): Promise<string> {
  const hash = crypto.createHash(algorithm);
  const fileBuffer = await fs.readFile(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}