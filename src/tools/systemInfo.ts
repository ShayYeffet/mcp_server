/**
 * System Info Tool
 * Get system information and resource usage
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as os from 'os';
// fs not needed for basic system info
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface SystemInfoArgs {
  includeProcesses?: boolean;
  includeNetwork?: boolean;
  includeDisk?: boolean;
}

export interface SystemInfoResult {
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    version: string;
  };
  cpu: {
    model: string;
    cores: number;
    speed: number;
    usage?: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk?: DiskInfo[];
  network?: NetworkInterface[];
  processes?: ProcessInfo[];
}

export interface DiskInfo {
  filesystem: string;
  size: number;
  used: number;
  available: number;
  usagePercent: number;
  mountpoint: string;
}

export interface NetworkInterface {
  name: string;
  address: string;
  family: string;
  internal: boolean;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

export const systemInfoTool: Tool = {
  name: 'system_info',
  description: 'Get system information and resource usage',
  inputSchema: {
    type: 'object',
    properties: {
      includeProcesses: {
        type: 'boolean',
        description: 'Include running processes information',
        default: false
      },
      includeNetwork: {
        type: 'boolean',
        description: 'Include network interfaces information',
        default: true
      },
      includeDisk: {
        type: 'boolean',
        description: 'Include disk usage information',
        default: true
      }
    }
  }
};

export async function executeSystemInfo(
  args: SystemInfoArgs,
  _config: ServerConfig
): Promise<SystemInfoResult> {
  const { includeProcesses = false, includeNetwork = true, includeDisk = true } = args;

  try {
    // Basic system info
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const result: SystemInfoResult = {
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        version: os.version()
      },
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: Math.round((usedMem / totalMem) * 100)
      }
    };

    // Get CPU usage
    try {
      const cpuUsage = await getCpuUsage();
      result.cpu.usage = cpuUsage;
    } catch {
      // CPU usage calculation failed
    }

    // Network interfaces
    if (includeNetwork) {
      const networkInterfaces = os.networkInterfaces();
      result.network = [];
      
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          for (const iface of interfaces) {
            result.network.push({
              name,
              address: iface.address,
              family: iface.family,
              internal: iface.internal
            });
          }
        }
      }
    }

    // Disk usage
    if (includeDisk) {
      try {
        result.disk = await getDiskUsage();
      } catch {
        // Disk usage failed
      }
    }

    // Process information
    if (includeProcesses) {
      try {
        result.processes = await getProcessInfo();
      } catch {
        // Process info failed
      }
    }

    return result;
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to get system info: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startMeasure = os.cpus();
    
    setTimeout(() => {
      const endMeasure = os.cpus();
      
      let totalIdle = 0;
      let totalTick = 0;
      
      for (let i = 0; i < startMeasure.length; i++) {
        const startCpu = startMeasure[i];
        const endCpu = endMeasure[i];
        
        const startTotal = Object.values(startCpu.times).reduce((acc, time) => acc + time, 0);
        const endTotal = Object.values(endCpu.times).reduce((acc, time) => acc + time, 0);
        
        const idle = endCpu.times.idle - startCpu.times.idle;
        const total = endTotal - startTotal;
        
        totalIdle += idle;
        totalTick += total;
      }
      
      const usage = 100 - Math.round((totalIdle / totalTick) * 100);
      resolve(usage);
    }, 1000);
  });
}

async function getDiskUsage(): Promise<DiskInfo[]> {
  const disks: DiskInfo[] = [];
  
  if (os.platform() === 'win32') {
    // Windows
    try {
      const result = await execAsync('wmic logicaldisk get size,freespace,caption', {
        timeout: 10000
      });
      
      const lines = result.stdout.trim().split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const [caption, freeSpace, size] = parts;
          if (caption && freeSpace && size) {
            const sizeNum = parseInt(size, 10);
            const freeNum = parseInt(freeSpace, 10);
            const usedNum = sizeNum - freeNum;
            
            disks.push({
              filesystem: caption,
              size: sizeNum,
              used: usedNum,
              available: freeNum,
              usagePercent: Math.round((usedNum / sizeNum) * 100),
              mountpoint: caption
            });
          }
        }
      }
    } catch {
      // Windows disk info failed
    }
  } else {
    // Unix-like systems
    try {
      const result = await execAsync('df -h', { timeout: 10000 });
      const lines = result.stdout.trim().split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 6) {
          const [filesystem, size, used, available, usagePercent, mountpoint] = parts;
          
          disks.push({
            filesystem,
            size: parseSize(size),
            used: parseSize(used),
            available: parseSize(available),
            usagePercent: parseInt(usagePercent.replace('%', ''), 10),
            mountpoint
          });
        }
      }
    } catch {
      // Unix disk info failed
    }
  }
  
  return disks;
}

async function getProcessInfo(): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];
  
  try {
    if (os.platform() === 'win32') {
      // Windows
      const result = await execAsync('tasklist /fo csv', { timeout: 15000 });
      const lines = result.stdout.trim().split('\n').slice(1); // Skip header
      
      for (const line of lines.slice(0, 20)) { // Limit to top 20
        const parts = line.split('","').map(part => part.replace(/"/g, ''));
        if (parts.length >= 5) {
          const [name, pid, , , memory] = parts;
          processes.push({
            pid: parseInt(pid, 10),
            name,
            cpu: 0, // Windows tasklist doesn't provide CPU easily
            memory: parseMemory(memory)
          });
        }
      }
    } else {
      // Unix-like systems
      const result = await execAsync('ps aux --sort=-%cpu | head -21', { timeout: 15000 });
      const lines = result.stdout.trim().split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const pid = parseInt(parts[1], 10);
          const cpu = parseFloat(parts[2]);
          const memory = parseFloat(parts[3]);
          const name = parts.slice(10).join(' ');
          
          processes.push({
            pid,
            name,
            cpu,
            memory
          });
        }
      }
    }
  } catch {
    // Process info failed
  }
  
  return processes;
}

function parseSize(sizeStr: string): number {
  const units: Record<string, number> = {
    'K': 1024,
    'M': 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024
  };
  
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/i);
  if (match) {
    const [, num, unit] = match;
    const multiplier = units[unit.toUpperCase()] || 1;
    return Math.round(parseFloat(num) * multiplier);
  }
  
  return parseInt(sizeStr, 10) || 0;
}

function parseMemory(memStr: string): number {
  // Parse memory string like "1,234 K" or "1,234,567"
  const cleaned = memStr.replace(/[,\s]/g, '');
  return parseInt(cleaned, 10) || 0;
}