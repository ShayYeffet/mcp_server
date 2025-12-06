/**
 * Unit tests for logging utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../src/utils/logging.js';

describe('Logger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should log debug messages when level is debug', () => {
    const logger = new Logger('debug');
    logger.debug('test message');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logEntry.level).toBe('DEBUG');
    expect(logEntry.message).toBe('test message');
    expect(logEntry.timestamp).toBeDefined();
  });

  it('should not log debug messages when level is info', () => {
    const logger = new Logger('info');
    logger.debug('test message');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should log info messages when level is info', () => {
    const logger = new Logger('info');
    logger.info('test message');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logEntry.level).toBe('INFO');
    expect(logEntry.message).toBe('test message');
  });

  it('should log warn messages when level is warn', () => {
    const logger = new Logger('warn');
    logger.warn('test message');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logEntry.level).toBe('WARN');
    expect(logEntry.message).toBe('test message');
  });

  it('should not log info messages when level is warn', () => {
    const logger = new Logger('warn');
    logger.info('test message');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should log error messages at any level', () => {
    const logger = new Logger('error');
    logger.error('test message');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logEntry.level).toBe('ERROR');
    expect(logEntry.message).toBe('test message');
  });

  it('should include metadata when provided', () => {
    const logger = new Logger('info');
    const metadata = { userId: '123', action: 'test' };
    logger.info('test message', metadata);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logEntry.meta).toEqual(metadata);
  });

  it('should respect log level hierarchy', () => {
    const logger = new Logger('warn');
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    
    const firstLog = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(firstLog.level).toBe('WARN');
    
    const secondLog = JSON.parse(consoleErrorSpy.mock.calls[1][0] as string);
    expect(secondLog.level).toBe('ERROR');
  });
});
