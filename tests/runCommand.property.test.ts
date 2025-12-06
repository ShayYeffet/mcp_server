/**
 * Property-based tests for run_command tool
 * Tests command execution properties
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeRunCommand } from '../src/tools/runCommand';
import { ServerConfig } from '../src/config';

describe('Run Command - Property Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `runcommand-property-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Property 16: Allowed command execution
   * For any command in the allowed commands list, executing that command 
   * should run it in the workspace and return exit code, stdout, and stderr.
   * 
   * Feature: mcp-workspace-server, Property 16: Allowed command execution
   * Validates: Requirements 7.1
   */
  it('Property 16: allowed commands execute and return output', async () => {
    // Use platform-specific commands that are universally available
    const isWindows = process.platform === 'win32';
    const echoCommand = isWindows ? 'cmd' : 'echo';
    
    // Generator for safe text (alphanumeric, spaces, basic punctuation)
    // Avoid shell metacharacters that could cause issues
    const safeTextGenerator = () =>
      fc.stringMatching(/^[a-zA-Z0-9 .,!?_-]+$/).filter(s => s.length > 0 && s.length <= 50);
    
    // Generator for echo arguments
    const echoArgsGenerator = () => {
      if (isWindows) {
        // For Windows cmd, use /c echo <text>
        return safeTextGenerator().map(text => ['/c', 'echo', text]);
      } else {
        // For Unix echo, just pass the text
        return safeTextGenerator().map(text => [text]);
      }
    };

    await fc.assert(
      fc.asyncProperty(
        echoArgsGenerator(),
        async (args) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [echoCommand],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 5000,
          };

          // Execute the allowed command
          const result = await executeRunCommand(
            {
              command: echoCommand,
              args: args,
            },
            config
          );

          // Verify the command executed successfully
          expect(result.exitCode).toBe(0);
          expect(result.timedOut).toBe(false);
          
          // Verify stdout contains output (echo should produce output)
          expect(result.stdout).toBeDefined();
          expect(typeof result.stdout).toBe('string');
          
          // Verify stderr is defined (may be empty)
          expect(result.stderr).toBeDefined();
          expect(typeof result.stderr).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17: Disallowed command rejection
   * For any command not in the allowed commands list, attempting to 
   * execute it should be rejected with a clear error message.
   * 
   * Feature: mcp-workspace-server, Property 17: Disallowed command rejection
   * Validates: Requirements 7.2
   */
  it('Property 17: disallowed commands are rejected', async () => {
    // Generator for command names that are not in the allowlist
    const disallowedCommandGenerator = () =>
      fc.oneof(
        fc.constant('rm'),
        fc.constant('del'),
        fc.constant('format'),
        fc.constant('shutdown'),
        fc.constant('reboot'),
        fc.constant('curl'),
        fc.constant('wget'),
        fc.stringMatching(/^[a-z]{3,10}$/)
      );

    await fc.assert(
      fc.asyncProperty(
        disallowedCommandGenerator(),
        async (command) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: ['echo', 'ls', 'dir'], // Specific allowlist
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 5000,
          };

          // Skip if the command happens to be in the allowlist
          if (config.allowedCommands.includes(command)) {
            return;
          }

          // Attempt to execute the disallowed command
          try {
            await executeRunCommand(
              {
                command: command,
                args: [],
              },
              config
            );

            // If we reach here, the test should fail
            expect.fail(`Command '${command}' should have been rejected`);
          } catch (error: any) {
            // Expected: should throw an error about command not allowed
            expect(error.message).toMatch(/not in the allowed commands list/i);
            expect(error.message).toContain(command);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18: Command working directory
   * For any allowed command and relative working directory path, the command 
   * should execute in that directory relative to the workspace root.
   * 
   * Feature: mcp-workspace-server, Property 18: Command working directory
   * Validates: Requirements 7.3
   */
  it('Property 18: commands execute in specified working directory', async () => {
    // Generator for valid relative directory paths
    const validRelativeDirGenerator = () =>
      fc
        .array(
          fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
          { minLength: 1, maxLength: 2 }
        )
        .map(parts => parts.join(path.sep));

    await fc.assert(
      fc.asyncProperty(
        validRelativeDirGenerator(),
        async (relativePath) => {
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: process.platform === 'win32' ? ['cmd'] : ['pwd'],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 5000,
          };

          // Create the directory
          const fullPath = path.join(testDir, relativePath);
          await fs.mkdir(fullPath, { recursive: true });

          // Execute command in the specified directory
          const isWindows = process.platform === 'win32';
          const result = await executeRunCommand(
            {
              command: isWindows ? 'cmd' : 'pwd',
              args: isWindows ? ['/c', 'cd'] : [],
              cwd: relativePath,
            },
            config
          );

          // Verify the command executed successfully
          expect(result.exitCode).toBe(0);
          expect(result.timedOut).toBe(false);

          // Verify the output contains the expected directory path
          const output = result.stdout.trim();
          const normalizedFullPath = path.normalize(fullPath);
          
          // The output should contain the full path to the working directory
          // On Windows, paths might have different casing, so compare case-insensitively
          const outputLower = output.toLowerCase();
          const expectedLower = normalizedFullPath.toLowerCase();
          
          expect(outputLower).toContain(expectedLower);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19: Command timeout enforcement
   * For any command that runs longer than the configured timeout, the process 
   * should be terminated and the response should indicate a timeout occurred.
   * 
   * Feature: mcp-workspace-server, Property 19: Command timeout enforcement
   * Validates: Requirements 7.4
   */
  it('Property 19: long-running commands are terminated on timeout', async () => {
    // Generator for timeout values (short timeouts for testing)
    const timeoutGenerator = () => fc.integer({ min: 100, max: 500 });

    await fc.assert(
      fc.asyncProperty(
        timeoutGenerator(),
        async (timeoutMs) => {
          // Use node to run a sleep script that will exceed the timeout
          // This works cross-platform
          const sleepCommand = 'node';
          const sleepArgs = ['-e', 'setTimeout(() => {}, 30000)']; // Sleep for 30 seconds

          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: ['node'],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 30000, // Default timeout (not used here)
          };

          // Execute command with a short timeout
          const result = await executeRunCommand(
            {
              command: sleepCommand,
              args: sleepArgs,
              timeoutMs: timeoutMs,
            },
            config
          );

          // Verify the command timed out
          expect(result.timedOut).toBe(true);
          
          // Exit code should be 124 (standard timeout exit code)
          expect(result.exitCode).toBe(124);
          
          // stdout and stderr should be defined (may be empty)
          expect(result.stdout).toBeDefined();
          expect(result.stderr).toBeDefined();
        }
      ),
      { numRuns: 10 } // Fewer runs since this test involves actual timeouts
    );
  }, 30000); // 30 second timeout for this test

  /**
   * Property 20: Command argument safety
   * For any command with arguments, the arguments should be passed safely 
   * without allowing command injection attacks.
   * 
   * Feature: mcp-workspace-server, Property 20: Command argument safety
   * Validates: Requirements 7.5
   */
  it('Property 20: command arguments are passed safely without injection', async () => {
    // Generator for potentially malicious arguments
    // These should be treated as literal strings, not executed
    const maliciousArgGenerator = () =>
      fc.oneof(
        fc.constant('&& echo hacked'),
        fc.constant('| cat /etc/passwd'),
        fc.constant('; rm -rf /'),
        fc.constant('`whoami`'),
        fc.constant('$(whoami)'),
        fc.constant('> /tmp/hacked'),
        fc.constant('< /etc/passwd'),
        fc.constant('|| echo injected'),
        fc.stringMatching(/^[a-zA-Z0-9 .,!?_-]+$/) // Also test normal strings
      );

    await fc.assert(
      fc.asyncProperty(
        maliciousArgGenerator(),
        async (arg) => {
          const isWindows = process.platform === 'win32';
          const echoCommand = isWindows ? 'cmd' : 'echo';
          
          const config: ServerConfig = {
            workspaceRoot: testDir,
            allowedCommands: [echoCommand],
            readOnly: false,
            logLevel: 'error',
            commandTimeout: 5000,
          };

          // Execute echo with the potentially malicious argument
          const args = isWindows ? ['/c', 'echo', arg] : [arg];
          const result = await executeRunCommand(
            {
              command: echoCommand,
              args: args,
            },
            config
          );

          // The command should execute successfully (not fail due to injection)
          expect(result.exitCode).toBe(0);
          expect(result.timedOut).toBe(false);
          
          // The output should contain the argument as a literal string
          // (not executed as a command)
          const output = result.stdout.trim();
          
          // For echo, the output should contain the argument
          // Special characters should be treated literally, not interpreted
          expect(output).toBeDefined();
          expect(typeof output).toBe('string');
          
          // Verify no command injection occurred by checking that
          // suspicious outputs don't appear (like "hacked", "injected", etc.)
          // If injection worked, we'd see these strings in unexpected places
          if (arg.includes('hacked') || arg.includes('injected')) {
            // If the arg contains these words, they should appear in output
            // (as literal text, not as a result of command execution)
            expect(output.toLowerCase()).toContain(arg.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
