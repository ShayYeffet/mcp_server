/**
 * Logging utility module for MCP Workspace Server
 * Provides structured logging with configurable log levels
 */

import { LogLevel } from '../config.js';

/**
 * Numeric log level values for comparison
 */
enum LogLevelValue {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Maps string log levels to numeric values
 */
const LOG_LEVEL_MAP: Record<LogLevel, LogLevelValue> = {
  debug: LogLevelValue.DEBUG,
  info: LogLevelValue.INFO,
  warn: LogLevelValue.WARN,
  error: LogLevelValue.ERROR,
};

/**
 * Logger class for structured logging with configurable levels
 */
export class Logger {
  private level: LogLevelValue;

  /**
   * Creates a new Logger instance
   * @param level - The minimum log level to output
   */
  constructor(level: LogLevel) {
    this.level = LOG_LEVEL_MAP[level];
  }

  /**
   * Logs a debug message
   * @param message - The log message
   * @param meta - Optional metadata object
   */
  debug(message: string, meta?: object): void {
    if (this.level <= LogLevelValue.DEBUG) {
      this.log('DEBUG', message, meta);
    }
  }

  /**
   * Logs an info message
   * @param message - The log message
   * @param meta - Optional metadata object
   */
  info(message: string, meta?: object): void {
    if (this.level <= LogLevelValue.INFO) {
      this.log('INFO', message, meta);
    }
  }

  /**
   * Logs a warning message
   * @param message - The log message
   * @param meta - Optional metadata object
   */
  warn(message: string, meta?: object): void {
    if (this.level <= LogLevelValue.WARN) {
      this.log('WARN', message, meta);
    }
  }

  /**
   * Logs an error message
   * @param message - The log message
   * @param meta - Optional metadata object
   */
  error(message: string, meta?: object): void {
    if (this.level <= LogLevelValue.ERROR) {
      this.log('ERROR', message, meta);
    }
  }

  /**
   * Internal method to format and output log messages
   * @param level - The log level string
   * @param message - The log message
   * @param meta - Optional metadata object
   */
  private log(level: string, message: string, meta?: object): void {
    const timestamp = new Date().toISOString();
    const logEntry: Record<string, unknown> = {
      timestamp,
      level,
      message,
    };

    if (meta) {
      logEntry.meta = meta;
    }

    // Output to stderr to avoid interfering with MCP protocol on stdout
    console.error(JSON.stringify(logEntry));
  }
}
