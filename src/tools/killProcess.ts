/**
 * Kill Process Tool
 * Terminate running processes by PID or name
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface KillProcessArgs {
  pid?: number;
  name?: string;
  signal?: string;
  force?: boolean;
}

export const killProcessTool: Tool = {
  name: 'kill_process',
  description: 'Terminate running processes by PID or name',
  inputSchema: {
    type: 'object',
    properties: {
      pid: {
        type: 'number',
        description: 'Process ID to terminate'
      },
      name: {
        type: 'string',
        description: 'Process name to terminate (will kill all matching processes)'
      },
      signal: {
        type: 'string',
        description: 'Signal to send (TERM, KILL, etc.)',
        default: 'TERM'
      },
      force: {
        type: 'boolean',
        description: 'Force kill (equivalent to SIGKILL)',
        default: false
      }
    }
  }
};

export async function executeKillProcess(
  args: KillProcessArgs,
  _config: ServerConfig
): Promise<{ success: boolean; message: string; killedProcesses: number }> {
  const { pid, name, signal = 'TERM', force = false } = args;

  if (!pid && !name) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Must specify either pid or name');
  }

  try {
    let killedProcesses = 0;
    let message = '';

    if (pid) {
      // Kill by PID
      const success = await killByPid(pid, force ? 'KILL' : signal);
      if (success) {
        killedProcesses = 1;
        message = `Successfully terminated process ${pid}`;
      } else {
        throw new WorkspaceError(ErrorCode.NOT_FOUND, `Process ${pid} not found or could not be terminated`);
      }
    } else if (name) {
      // Kill by name
      const pids = await findProcessesByName(name);
      
      if (pids.length === 0) {
        throw new WorkspaceError(ErrorCode.NOT_FOUND, `No processes found with name: ${name}`);
      }

      // Prevent killing critical system processes
      if (isCriticalProcess(name)) {
        throw new WorkspaceError(
          ErrorCode.SECURITY_VIOLATION,
          `Cannot kill critical system process: ${name}`
        );
      }

      let successCount = 0;
      for (const processPid of pids) {
        const success = await killByPid(processPid, force ? 'KILL' : signal);
        if (success) successCount++;
      }

      killedProcesses = successCount;
      message = `Terminated ${successCount} of ${pids.length} processes named '${name}'`;
    }

    return {
      success: killedProcesses > 0,
      message,
      killedProcesses
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to kill process: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function killByPid(pid: number, signal: string): Promise<boolean> {
  try {
    if (os.platform() === 'win32') {
      // Windows
      const command = signal === 'KILL' || signal === 'SIGKILL' 
        ? `taskkill /F /PID ${pid}`
        : `taskkill /PID ${pid}`;
      
      await execAsync(command, { timeout: 10000 });
      return true;
    } else {
      // Unix-like systems
      const killSignal = signal.startsWith('SIG') ? signal : `SIG${signal}`;
      await execAsync(`kill -${killSignal} ${pid}`, { timeout: 10000 });
      return true;
    }
  } catch (error) {
    return false;
  }
}

async function findProcessesByName(name: string): Promise<number[]> {
  const pids: number[] = [];
  
  try {
    if (os.platform() === 'win32') {
      // Windows
      const result = await execAsync(`tasklist /fi "imagename eq ${name}" /fo csv`, { timeout: 10000 });
      const lines = result.stdout.trim().split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const parts = line.split('","').map(part => part.replace(/"/g, ''));
        if (parts.length >= 2) {
          const pid = parseInt(parts[1], 10);
          if (!isNaN(pid)) {
            pids.push(pid);
          }
        }
      }
    } else {
      // Unix-like systems
      const result = await execAsync(`pgrep -f "${name}"`, { timeout: 10000 });
      const lines = result.stdout.trim().split('\n');
      
      for (const line of lines) {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid)) {
          pids.push(pid);
        }
      }
    }
  } catch (error) {
    // No processes found or command failed
  }
  
  return pids;
}

function isCriticalProcess(name: string): boolean {
  const criticalProcesses = [
    // Windows critical processes
    'System', 'Registry', 'smss.exe', 'csrss.exe', 'wininit.exe', 'winlogon.exe',
    'services.exe', 'lsass.exe', 'explorer.exe', 'dwm.exe',
    
    // Unix critical processes
    'init', 'kernel', 'kthreadd', 'systemd', 'launchd', 'sshd', 'networkd'
  ];
  
  const nameLower = name.toLowerCase();
  return criticalProcesses.some(critical => 
    nameLower === critical.toLowerCase() ||
    nameLower.includes(critical.toLowerCase())
  );
}