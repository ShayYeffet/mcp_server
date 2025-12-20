/**
 * Path security utilities for MCP Workspace Server
 * Provides path validation and sandboxing to prevent directory traversal attacks
 */

import path from 'path';
import fs from 'fs/promises';
import { createSecurityError, createInvalidInputError } from './errors.js';

/**
 * Normalizes a path and resolves symbolic links
 * @param targetPath - The path to normalize
 * @returns Normalized absolute path with symlinks resolved
 */
export async function normalizePath(targetPath: string): Promise<string> {
  try {
    // Resolve to absolute path and follow symlinks
    const realPath = await fs.realpath(targetPath);
    return path.normalize(realPath);
  } catch (error) {
    // If path doesn't exist, normalize without following symlinks
    // This allows validation of paths that will be created
    return path.normalize(path.resolve(targetPath));
  }
}

/**
 * Checks if a resolved path is within the workspace boundary
 * @param workspaceRoot - The workspace root directory (must be absolute)
 * @param resolvedPath - The resolved path to check (must be absolute)
 * @returns true if path is safe, false otherwise
 */
export function isPathSafe(workspaceRoot: string, resolvedPath: string): boolean {
  // Normalize both paths to ensure consistent comparison
  const normalizedRoot = path.normalize(workspaceRoot);
  const normalizedPath = path.normalize(resolvedPath);
  
  // Check if the resolved path starts with the workspace root
  // Add path separator to prevent partial directory name matches
  // e.g., /workspace should not match /workspace-other
  const rootWithSep = normalizedRoot.endsWith(path.sep) 
    ? normalizedRoot 
    : normalizedRoot + path.sep;
  
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(rootWithSep);
}

/**
 * Resolves a requested path relative to workspace root and validates
 * it stays within the workspace boundary
 * @param workspaceRoot - The workspace root directory (absolute path)
 * @param requestedPath - The requested path (relative or absolute)
 * @returns Resolved absolute path within workspace
 * @throws Error if path escapes workspace or contains security violations
 */
export async function resolveSafePath(
  workspaceRoot: string,
  requestedPath: string
): Promise<string> {
  // Validate inputs
  if (!workspaceRoot) {
    throw createInvalidInputError('Workspace root cannot be empty');
  }
  
  if (!requestedPath) {
    throw createInvalidInputError('Requested path cannot be empty');
  }
  
  // Ensure workspace root is absolute
  const absoluteRoot = path.resolve(workspaceRoot);
  
  // Detect absolute paths that might be outside workspace
  if (path.isAbsolute(requestedPath)) {
    // If it's an absolute path, we need to check if it's within workspace
    const normalizedRequested = path.normalize(requestedPath);
    
    // Normalize the workspace root for comparison
    const normalizedRoot = await normalizePath(absoluteRoot);
    
    // Check if the absolute path is within workspace
    if (!isPathSafe(normalizedRoot, normalizedRequested)) {
      throw createSecurityError(
        `Path '${requestedPath}' is outside the workspace boundary`,
        { requestedPath, workspaceRoot: normalizedRoot }
      );
    }
    
    // Try to resolve symlinks if path exists
    const resolvedPath = await normalizePath(normalizedRequested);
    
    // Final safety check after symlink resolution
    if (!isPathSafe(normalizedRoot, resolvedPath)) {
      throw createSecurityError(
        `Path '${requestedPath}' resolves to a location outside the workspace boundary`,
        { requestedPath, resolvedPath, workspaceRoot: normalizedRoot }
      );
    }
    
    return resolvedPath;
  }
  
  // Join relative path with workspace root
  const joinedPath = path.join(absoluteRoot, requestedPath);
  
  // Normalize to resolve . and .. segments
  const normalizedPath = path.normalize(joinedPath);
  
  // Normalize workspace root
  const normalizedRoot = await normalizePath(absoluteRoot);
  
  // Check if normalized path is within workspace
  if (!isPathSafe(normalizedRoot, normalizedPath)) {
    throw createSecurityError(
      `Path '${requestedPath}' attempts to traverse outside the workspace boundary`,
      { requestedPath, normalizedPath, workspaceRoot: normalizedRoot }
    );
  }
  
  // Check each component of the path for symlinks that might escape
  // We need to check parent directories even if the final path doesn't exist
  let currentCheckPath = normalizedRoot;
  const relativeParts = path.relative(normalizedRoot, normalizedPath).split(path.sep);
  
  for (const part of relativeParts) {
    if (!part || part === '.') continue;
    
    currentCheckPath = path.join(currentCheckPath, part);
    
    // Check if this component exists
    try {
      await fs.access(currentCheckPath);
      
      // Resolve any symlinks at this level
      const realPath = await fs.realpath(currentCheckPath);
      
      // Check if the real path is within workspace
      if (!isPathSafe(normalizedRoot, realPath)) {
        throw createSecurityError(
          `Path '${requestedPath}' contains a symbolic link that points outside the workspace boundary`,
          { requestedPath, realPath, workspaceRoot: normalizedRoot }
        );
      }
      
      // Continue checking from the real path
      currentCheckPath = realPath;
    } catch (error: any) {
      // If ENOENT, path doesn't exist yet - that's fine
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // For non-existent paths, we've already validated the normalized path
      // so we can safely continue
    }
  }
  
  // Try to resolve symlinks if the full path exists
  const resolvedPath = await normalizePath(normalizedPath);
  
  // Final safety check after symlink resolution
  if (!isPathSafe(normalizedRoot, resolvedPath)) {
    throw createSecurityError(
      `Path '${requestedPath}' contains a symbolic link that points outside the workspace boundary`,
      { requestedPath, resolvedPath, workspaceRoot: normalizedRoot }
    );
  }
  
  return resolvedPath;
}

/**
 * Synchronous path validation for simple cases
 * @param requestedPath - The requested path (relative or absolute)
 * @param workspaceRoot - The workspace root directory (absolute path)
 * @returns Resolved absolute path within workspace
 * @throws Error if path escapes workspace or contains security violations
 */
export function validatePath(requestedPath: string, workspaceRoot: string): string {
  // Validate inputs
  if (!workspaceRoot) {
    throw createInvalidInputError('Workspace root cannot be empty');
  }
  
  if (!requestedPath) {
    throw createInvalidInputError('Requested path cannot be empty');
  }
  
  // Ensure workspace root is absolute
  const absoluteRoot = path.resolve(workspaceRoot);
  
  // Handle absolute paths
  if (path.isAbsolute(requestedPath)) {
    const normalizedRequested = path.normalize(requestedPath);
    const normalizedRoot = path.normalize(absoluteRoot);
    
    if (!isPathSafe(normalizedRoot, normalizedRequested)) {
      throw createSecurityError(
        `Path '${requestedPath}' is outside the workspace boundary`,
        { requestedPath, workspaceRoot: normalizedRoot }
      );
    }
    
    return normalizedRequested;
  }
  
  // Join relative path with workspace root
  const joinedPath = path.join(absoluteRoot, requestedPath);
  const normalizedPath = path.normalize(joinedPath);
  const normalizedRoot = path.normalize(absoluteRoot);
  
  // Check if normalized path is within workspace
  if (!isPathSafe(normalizedRoot, normalizedPath)) {
    throw createSecurityError(
      `Path '${requestedPath}' attempts to traverse outside the workspace boundary`,
      { requestedPath, normalizedPath, workspaceRoot: normalizedRoot }
    );
  }
  
  return normalizedPath;
}
