/**
 * Configuration module for MCP Workspace Server
 * Loads and validates configuration from environment variables
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ServerConfig {
  workspaceRoot: string;
  allowedCommands: string[];
  readOnly: boolean;
  logLevel: LogLevel;
  commandTimeout: number;
}

/**
 * Parses a boolean environment variable
 * @param value - The environment variable value
 * @param defaultValue - Default value if not set or invalid
 * @returns Parsed boolean value
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Parses a comma-separated list of commands
 * @param value - The environment variable value
 * @returns Array of trimmed command strings
 */
function parseCommandList(value: string | undefined): string[] {
  if (value === undefined || value === '') {
    return [];
  }
  return value
    .split(',')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0);
}

/**
 * Validates and normalizes log level
 * @param value - The environment variable value
 * @param defaultValue - Default log level
 * @returns Valid log level
 */
function parseLogLevel(value: string | undefined, defaultValue: LogLevel): LogLevel {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim() as LogLevel;
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (validLevels.includes(normalized)) {
    return normalized;
  }
  return defaultValue;
}

/**
 * Parses a timeout value in milliseconds
 * @param value - The environment variable value
 * @param defaultValue - Default timeout in milliseconds
 * @returns Parsed timeout value
 */
function parseTimeout(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Loads configuration from environment variables
 * @returns ServerConfig object with validated configuration
 */
export function loadConfig(): ServerConfig {
  const workspaceRoot = process.env.MCP_WORKSPACE_ROOT || process.cwd();
  const allowedCommands = parseCommandList(process.env.MCP_ALLOWED_COMMANDS);
  const readOnly = parseBoolean(process.env.MCP_READ_ONLY, false);
  const logLevel = parseLogLevel(process.env.MCP_LOG_LEVEL, 'info');
  const commandTimeout = parseTimeout(process.env.MCP_COMMAND_TIMEOUT, 300000);

  return {
    workspaceRoot,
    allowedCommands,
    readOnly,
    logLevel,
    commandTimeout,
  };
}
