/**
 * Comprehensive error handling utilities
 * Provides error classification, formatting, and consistent error responses
 */

import { Logger } from './logging.js';

/**
 * Error codes for different error categories
 */
export enum ErrorCode {
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  NOT_FOUND = 'NOT_FOUND',
  READ_ONLY_MODE = 'READ_ONLY_MODE',
  COMMAND_NOT_ALLOWED = 'COMMAND_NOT_ALLOWED',
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  INVALID_INPUT = 'INVALID_INPUT',
  FILESYSTEM_ERROR = 'FILESYSTEM_ERROR',
  PATCH_FAILED = 'PATCH_FAILED',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
}

/**
 * Custom error class for MCP Workspace Server errors
 */
export class WorkspaceError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
    this.details = details;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkspaceError);
    }
  }
}

/**
 * Creates a security violation error
 */
export function createSecurityError(
  message: string,
  details?: Record<string, unknown>
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.SECURITY_VIOLATION,
    message,
    details
  );
}

/**
 * Creates a not found error
 */
export function createNotFoundError(
  resource: string,
  path: string
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.NOT_FOUND,
    `${resource} '${path}' does not exist`,
    { resource, path }
  );
}

/**
 * Creates a read-only mode error
 */
export function createReadOnlyError(
  operation: string
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.READ_ONLY_MODE,
    `${operation} operations are disabled in read-only mode`,
    { operation }
  );
}

/**
 * Creates a command not allowed error
 */
export function createCommandNotAllowedError(
  command: string,
  allowedCommands: string[]
): WorkspaceError {
  const allowedList = allowedCommands.length > 0 
    ? allowedCommands.join(', ') 
    : 'none';
  
  return new WorkspaceError(
    ErrorCode.COMMAND_NOT_ALLOWED,
    `Command '${command}' is not in the allowed commands list. Allowed commands: ${allowedList}`,
    { command, allowedCommands }
  );
}

/**
 * Creates a command timeout error
 */
export function createCommandTimeoutError(
  command: string,
  timeoutMs: number
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.COMMAND_TIMEOUT,
    `Command '${command}' exceeded timeout of ${timeoutMs}ms`,
    { command, timeoutMs }
  );
}

/**
 * Creates an invalid input error
 */
export function createInvalidInputError(
  message: string,
  details?: Record<string, unknown>
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.INVALID_INPUT,
    message,
    details
  );
}

/**
 * Creates a filesystem error
 */
export function createFilesystemError(
  message: string,
  details?: Record<string, unknown>,
  originalError?: Error
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.FILESYSTEM_ERROR,
    message,
    details,
    originalError
  );
}

/**
 * Creates a patch failed error
 */
export function createPatchFailedError(
  message: string,
  details?: Record<string, unknown>
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.PATCH_FAILED,
    message,
    details
  );
}

/**
 * Creates an unexpected error
 */
export function createUnexpectedError(
  message: string,
  originalError?: Error
): WorkspaceError {
  return new WorkspaceError(
    ErrorCode.UNEXPECTED_ERROR,
    message,
    undefined,
    originalError
  );
}

/**
 * Classifies an unknown error into a WorkspaceError
 */
export function classifyError(error: unknown, context?: string): WorkspaceError {
  // If already a WorkspaceError, return as-is
  if (error instanceof WorkspaceError) {
    return error;
  }

  // If it's an Error with our error code prefix format
  if (error instanceof Error) {
    const message = error.message;
    
    // Check for error code prefixes
    if (message.includes('Security violation') || message.includes('outside the workspace')) {
      return createSecurityError(message);
    }
    
    if (message.includes('not found') || message.includes('does not exist')) {
      const contextMsg = context ? ` in ${context}` : '';
      return createNotFoundError('Resource', contextMsg);
    }
    
    if (message.includes('read-only mode') || message.includes('Read-only')) {
      return createReadOnlyError(context || 'Write');
    }
    
    if (message.includes('not allowed') || message.includes('not in the allowed')) {
      return new WorkspaceError(ErrorCode.COMMAND_NOT_ALLOWED, message);
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return new WorkspaceError(ErrorCode.COMMAND_TIMEOUT, message);
    }
    
    if (message.includes('Invalid') || message.includes('invalid')) {
      return createInvalidInputError(message);
    }
    
    // Check Node.js error codes
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code) {
      switch (nodeError.code) {
        case 'ENOENT':
          return createNotFoundError('File or directory', nodeError.path || 'unknown');
        case 'EACCES':
        case 'EPERM':
          return createFilesystemError(
            `Permission denied: ${nodeError.message}`,
            { code: nodeError.code, path: nodeError.path },
            error
          );
        case 'ENOTDIR':
          return createInvalidInputError('Path is not a directory', { path: nodeError.path });
        case 'EISDIR':
          return createInvalidInputError('Path is a directory, not a file', { path: nodeError.path });
        case 'ENOTEMPTY':
          return createFilesystemError(
            'Cannot delete non-empty directory',
            { path: nodeError.path },
            error
          );
        default:
          return createFilesystemError(
            `Filesystem error: ${nodeError.message}`,
            { code: nodeError.code, path: nodeError.path },
            error
          );
      }
    }
    
    // Generic error - wrap as unexpected
    return createUnexpectedError(
      `An unexpected error occurred${context ? ` in ${context}` : ''}: ${error.message}`,
      error
    );
  }

  // Non-Error object
  return createUnexpectedError(
    `An unexpected error occurred${context ? ` in ${context}` : ''}: ${String(error)}`
  );
}

/**
 * Formats an error for logging with full context
 */
export function formatErrorForLogging(
  error: WorkspaceError,
  toolName?: string,
  input?: unknown
): Record<string, unknown> {
  return {
    errorCode: error.code,
    message: error.message,
    tool: toolName,
    details: error.details,
    input: input,
    stack: error.stack,
    originalError: error.originalError ? {
      message: error.originalError.message,
      stack: error.originalError.stack,
    } : undefined,
  };
}

/**
 * Formats an error for user-friendly display
 * Removes internal details and provides clear, actionable messages
 */
export function formatErrorForUser(error: WorkspaceError): string {
  // Return the message as-is - it's already user-friendly
  return error.message;
}

/**
 * Logs an error with full context
 */
export function logError(
  logger: Logger,
  error: WorkspaceError,
  toolName?: string,
  input?: unknown
): void {
  const logData = formatErrorForLogging(error, toolName, input);
  
  // Log at appropriate level based on error type
  if (error.code === ErrorCode.UNEXPECTED_ERROR) {
    logger.error('Unexpected error occurred', logData);
  } else if (error.code === ErrorCode.SECURITY_VIOLATION) {
    logger.warn('Security violation detected', logData);
  } else {
    logger.info('Operation failed', logData);
  }
}
