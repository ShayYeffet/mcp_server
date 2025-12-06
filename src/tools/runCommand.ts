/**
 * run_command tool implementation
 * Provides safe command execution capabilities within the workspace
 */

import { spawn } from 'child_process';
import { ServerConfig } from '../config.js';
import { resolveSafePath } from '../utils/pathUtils.js';
import { createCommandNotAllowedError, classifyError } from '../utils/errors.js';

/**
 * Input parameters for run_command tool
 */
export interface RunCommandInput {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}

/**
 * Output from run_command tool
 */
export interface RunCommandOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Tool metadata for MCP registration
 */
export const runCommandTool = {
  name: 'run_command',
  description: 'Execute an allowed command in the workspace. Only commands in the allowlist can be executed.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Command to execute (must be in allowed commands list)',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Command arguments as an array',
        default: [],
      },
      cwd: {
        type: 'string',
        description: 'Working directory relative to workspace root',
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout in milliseconds (defaults to server configured timeout)',
      },
    },
    required: ['command'],
  },
};

/**
 * Executes the run_command tool
 * @param input - Tool input parameters
 * @param config - Server configuration
 * @returns Command execution results
 */
export async function executeRunCommand(
  input: RunCommandInput,
  config: ServerConfig
): Promise<RunCommandOutput> {
  const command = input.command;
  const args = input.args ?? [];
  const timeoutMs = input.timeoutMs ?? config.commandTimeout;

  // Validate command is in allowlist
  if (!config.allowedCommands.includes(command)) {
    throw createCommandNotAllowedError(command, config.allowedCommands);
  }

  // Resolve working directory if specified
  let workingDirectory = config.workspaceRoot;
  if (input.cwd) {
    try {
      workingDirectory = await resolveSafePath(config.workspaceRoot, input.cwd);
    } catch (error: unknown) {
      throw classifyError(error, 'run_command');
    }
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let exitCode: number | null = null;

    // Spawn the process with array arguments to prevent injection
    const childProcess = spawn(command, args, {
      cwd: workingDirectory,
      shell: false, // Prevent shell interpretation
      windowsHide: true,
    });

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      childProcess.kill('SIGTERM');
      
      // Force kill after 1 second if still running
      setTimeout(() => {
        if (childProcess.exitCode === null) {
          childProcess.kill('SIGKILL');
        }
      }, 1000);
    }, timeoutMs);

    // Collect stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Collect stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process exit
    childProcess.on('close', (code: number | null) => {
      clearTimeout(timeoutHandle);
      
      // If killed by signal and we timed out, use special exit code
      if (timedOut) {
        exitCode = 124; // Standard timeout exit code
      } else {
        exitCode = code ?? 1; // Default to 1 if code is null
      }

      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
      });
    });

    // Handle spawn errors
    childProcess.on('error', (error: Error) => {
      clearTimeout(timeoutHandle);
      
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + `\nError spawning process: ${error.message}`,
        timedOut: false,
      });
    });
  });
}
