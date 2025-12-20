/**
 * List Processes Tool
 * Show running processes with detailed information
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface ListProcessesArgs {
  sortBy?: 'cpu' | 'memory' | 'pid' | 'name';
  limit?: number;
  filter?: string;
  includeSystem?: boolean;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  memoryMB: number;
  user: string;
  status: string;
  startTime: string;
  command: string;
}

export const listProcessesTool: Tool = {
  name: 'list_processes',
  description: 'List running processes with CPU, memory, and other details',
  inputSchema: {
    type: 'object',
    properties: {
      sortBy: {
        type: 'string',
        enum: ['cpu', 'memory', 'pid', 'name'],
        description: 'Sort processes by field',
        default: 'cpu'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of processes to return',
        default: 20
      },
      filter: {
        type: 'string',
        description: 'Filter processes by name (case-insensitive)'
      },
      includeSystem: {
        type: 'boolean',
        description: 'Include system processes',
        default: false
      }
    }
  }
};

export async function executeListProcesses(
  args: ListProcessesArgs,
  _config: ServerConfig
): Promise<{ processes: ProcessInfo[]; totalProcesses: number }> {
  const { sortBy = 'cpu', limit = 20, filter, includeSystem = false } = args;

  try {
    const processes = await getProcessList(includeSystem);
    
    // Filter processes if requested
    let filteredProcesses = processes;
    if (filter) {
      const filterLower = filter.toLowerCase();
      filteredProcesses = processes.filter(p => 
        p.name.toLowerCase().includes(filterLower) ||
        p.command.toLowerCase().includes(filterLower)
      );
    }

    // Sort processes
    filteredProcesses.sort((a, b) => {
      switch (sortBy) {
        case 'cpu':
          return b.cpu - a.cpu;
        case 'memory':
          return b.memory - a.memory;
        case 'pid':
          return a.pid - b.pid;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return b.cpu - a.cpu;
      }
    });

    // Limit results
    const limitedProcesses = filteredProcesses.slice(0, limit);

    return {
      processes: limitedProcesses,
      totalProcesses: processes.length
    };
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to list processes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function getProcessList(includeSystem: boolean): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];
  
  if (os.platform() === 'win32') {
    // Windows
    const command = 'wmic process get ProcessId,Name,PageFileUsage,UserModeTime,KernelModeTime,CommandLine /format:csv';
    
    try {
      const result = await execAsync(command, { timeout: 15000 });
      const lines = result.stdout.trim().split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.split(',');
        if (parts.length >= 6) {
          const [, commandLine, , name, pageFileUsage, pid, ] = parts;
          
          if (pid && name) {
            const pidNum = parseInt(pid, 10);
            const memoryKB = parseInt(pageFileUsage || '0', 10);
            
            // Skip system processes if not requested
            if (!includeSystem && isSystemProcess(name)) {
              continue;
            }
            
            processes.push({
              pid: pidNum,
              name: name || 'Unknown',
              cpu: 0, // Windows doesn't provide easy CPU calculation
              memory: 0, // Percentage not easily available
              memoryMB: Math.round(memoryKB / 1024),
              user: 'Unknown',
              status: 'Running',
              startTime: 'Unknown',
              command: commandLine || name || 'Unknown'
            });
          }
        }
      }
    } catch (error) {
      // Fallback to tasklist
      try {
        const result = await execAsync('tasklist /fo csv', { timeout: 15000 });
        const lines = result.stdout.trim().split('\n').slice(1);
        
        for (const line of lines) {
          const parts = line.split('","').map(part => part.replace(/"/g, ''));
          if (parts.length >= 5) {
            const [name, pid, , , memory] = parts;
            
            if (!includeSystem && isSystemProcess(name)) {
              continue;
            }
            
            processes.push({
              pid: parseInt(pid, 10),
              name,
              cpu: 0,
              memory: 0,
              memoryMB: parseMemoryString(memory),
              user: 'Unknown',
              status: 'Running',
              startTime: 'Unknown',
              command: name
            });
          }
        }
      } catch {
        throw new Error('Failed to get process list on Windows');
      }
    }
  } else {
    // Unix-like systems
    try {
      const result = await execAsync('ps aux', { timeout: 15000 });
      const lines = result.stdout.trim().split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const user = parts[0];
          const pid = parseInt(parts[1], 10);
          const cpu = parseFloat(parts[2]);
          const memory = parseFloat(parts[3]);
          const status = parts[7];
          const startTime = parts[8];
          const command = parts.slice(10).join(' ');
          const name = parts[10].split('/').pop() || 'Unknown';
          
          // Skip system processes if not requested
          if (!includeSystem && isSystemProcess(name)) {
            continue;
          }
          
          // Calculate memory in MB (rough estimate)
          const totalMemMB = os.totalmem() / (1024 * 1024);
          const memoryMB = Math.round((memory / 100) * totalMemMB);
          
          processes.push({
            pid,
            name,
            cpu,
            memory,
            memoryMB,
            user,
            status,
            startTime,
            command
          });
        }
      }
    } catch (error) {
      throw new Error('Failed to get process list on Unix system');
    }
  }
  
  return processes;
}

function isSystemProcess(name: string): boolean {
  const systemProcesses = [
    'System', 'Registry', 'smss.exe', 'csrss.exe', 'wininit.exe', 'winlogon.exe',
    'services.exe', 'lsass.exe', 'svchost.exe', 'spoolsv.exe', 'explorer.exe',
    'kernel', 'kthreadd', 'migration', 'rcu_', 'watchdog', 'systemd', 'init'
  ];
  
  const nameLower = name.toLowerCase();
  return systemProcesses.some(sysProc => 
    nameLower.includes(sysProc.toLowerCase()) || 
    nameLower.startsWith('[') // Kernel threads on Linux
  );
}

function parseMemoryString(memStr: string): number {
  // Parse memory strings like "1,234 K" or "1,234,567"
  const cleaned = memStr.replace(/[,\s]/g, '');
  const match = cleaned.match(/(\d+)([KMG])?/i);
  
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2]?.toUpperCase();
    
    switch (unit) {
      case 'K': return Math.round(num / 1024);
      case 'M': return num;
      case 'G': return num * 1024;
      default: return Math.round(num / 1024); // Assume KB
    }
  }
  
  return 0;
}