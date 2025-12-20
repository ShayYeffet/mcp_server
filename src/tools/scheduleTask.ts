/**
 * Task Scheduler Tool
 * Schedule commands to run at specific times or intervals
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

const execAsync = promisify(exec);

export interface ScheduleTaskArgs {
  operation: 'create' | 'list' | 'delete' | 'run_now';
  name?: string;
  command?: string;
  schedule?: string;
  description?: string;
  workingDirectory?: string;
}

export const scheduleTaskTool: Tool = {
  name: 'schedule_task',
  description: 'Schedule commands to run at specific times using system task scheduler',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'list', 'delete', 'run_now'],
        description: 'Task scheduler operation'
      },
      name: {
        type: 'string',
        description: 'Task name (required for create/delete/run_now)'
      },
      command: {
        type: 'string',
        description: 'Command to execute (required for create)'
      },
      schedule: {
        type: 'string',
        description: 'Schedule in cron format or human readable (e.g., "daily", "weekly", "0 9 * * 1")'
      },
      description: {
        type: 'string',
        description: 'Task description'
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory for the command (relative to workspace)'
      }
    },
    required: ['operation']
  }
};

export async function executeScheduleTask(
  args: ScheduleTaskArgs,
  config: ServerConfig
): Promise<{ message: string; tasks?: any[]; result?: string }> {
  const { operation, name, command, schedule, description, workingDirectory } = args;

  // Check read-only mode for write operations
  if (config.readOnly && ['create', 'delete', 'run_now'].includes(operation)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Task scheduling operations not allowed in read-only mode'
    );
  }

  try {
    switch (operation) {
      case 'list':
        return await listScheduledTasks();
      
      case 'create':
        if (!name || !command) {
          throw new WorkspaceError(
            ErrorCode.INVALID_INPUT,
            'Task name and command are required for create operation'
          );
        }
        return await createScheduledTask(name, command, schedule, description, workingDirectory, config);
      
      case 'delete':
        if (!name) {
          throw new WorkspaceError(
            ErrorCode.INVALID_INPUT,
            'Task name is required for delete operation'
          );
        }
        return await deleteScheduledTask(name);
      
      case 'run_now':
        if (!name) {
          throw new WorkspaceError(
            ErrorCode.INVALID_INPUT,
            'Task name is required for run_now operation'
          );
        }
        return await runTaskNow(name);
      
      default:
        throw new WorkspaceError(
          ErrorCode.INVALID_INPUT,
          `Unknown operation: ${operation}`
        );
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Task scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function listScheduledTasks(): Promise<{ message: string; tasks: any[] }> {
  try {
    if (process.platform === 'win32') {
      // Windows Task Scheduler
      const result = await execAsync('schtasks /query /fo csv /v', { timeout: 10000 });
      const lines = result.stdout.split('\n').slice(1); // Skip header
      const tasks = lines
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(',');
          return {
            name: parts[0]?.replace(/"/g, ''),
            status: parts[3]?.replace(/"/g, ''),
            nextRun: parts[4]?.replace(/"/g, ''),
            lastRun: parts[5]?.replace(/"/g, '')
          };
        })
        .filter(task => task.name && !task.name.startsWith('\\Microsoft'));

      return {
        message: `Found ${tasks.length} scheduled tasks`,
        tasks
      };
    } else {
      // Unix cron jobs
      try {
        const result = await execAsync('crontab -l', { timeout: 5000 });
        const lines = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const tasks = lines.map((line, index) => ({
          name: `cron_job_${index + 1}`,
          schedule: line.split(' ').slice(0, 5).join(' '),
          command: line.split(' ').slice(5).join(' '),
          status: 'Enabled'
        }));

        return {
          message: `Found ${tasks.length} cron jobs`,
          tasks
        };
      } catch {
        return {
          message: 'No cron jobs found or crontab not accessible',
          tasks: []
        };
      }
    }
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to list scheduled tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function createScheduledTask(
  name: string,
  command: string,
  schedule: string | undefined,
  description: string | undefined,
  workingDirectory: string | undefined,
  config: ServerConfig
): Promise<{ message: string }> {
  // Validate working directory if provided
  let workDir = config.workspaceRoot;
  if (workingDirectory) {
    workDir = validatePath(workingDirectory, config.workspaceRoot);
  }

  // Default schedule if not provided
  const taskSchedule = schedule || 'daily';

  try {
    if (process.platform === 'win32') {
      // Windows Task Scheduler
      let scheduleParam = '/sc daily';
      
      // Parse schedule
      if (taskSchedule.includes('*')) {
        // Cron-like format - convert to Windows format (simplified)
        scheduleParam = '/sc daily'; // Default fallback
      } else {
        switch (taskSchedule.toLowerCase()) {
          case 'daily': scheduleParam = '/sc daily'; break;
          case 'weekly': scheduleParam = '/sc weekly'; break;
          case 'monthly': scheduleParam = '/sc monthly'; break;
          case 'hourly': scheduleParam = '/sc hourly'; break;
          default: scheduleParam = '/sc daily';
        }
      }

      const taskCommand = `schtasks /create /tn "${name}" ${scheduleParam} /tr "${command}" /f`;
      if (description) {
        // Note: Windows schtasks doesn't support description in basic command
      }

      await execAsync(taskCommand, { timeout: 10000, cwd: workDir });
      
      return {
        message: `Scheduled task '${name}' created successfully with ${taskSchedule} schedule`
      };
    } else {
      // Unix cron
      const cronSchedule = convertToCron(taskSchedule);
      const cronEntry = `${cronSchedule} cd "${workDir}" && ${command}`;
      
      // Get existing crontab
      let existingCron = '';
      try {
        const result = await execAsync('crontab -l', { timeout: 5000 });
        existingCron = result.stdout;
      } catch {
        // No existing crontab
      }

      // Add new entry
      const newCron = existingCron + `\n# ${name}${description ? ' - ' + description : ''}\n${cronEntry}\n`;
      
      // Write new crontab
      const tempFile = path.join('/tmp', `crontab_${Date.now()}`);
      fs.writeFileSync(tempFile, newCron);
      await execAsync(`crontab "${tempFile}"`, { timeout: 5000 });
      fs.unlinkSync(tempFile);

      return {
        message: `Cron job '${name}' created successfully with schedule: ${cronSchedule}`
      };
    }
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to create scheduled task: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function deleteScheduledTask(name: string): Promise<{ message: string }> {
  try {
    if (process.platform === 'win32') {
      // Windows Task Scheduler
      await execAsync(`schtasks /delete /tn "${name}" /f`, { timeout: 10000 });
      return {
        message: `Scheduled task '${name}' deleted successfully`
      };
    } else {
      // Unix cron - remove entries with the task name comment
      try {
        const result = await execAsync('crontab -l', { timeout: 5000 });
        const lines = result.stdout.split('\n');
        const filteredLines = [];
        let skipNext = false;

        for (const line of lines) {
          if (line.includes(`# ${name}`)) {
            skipNext = true;
            continue;
          }
          if (skipNext && line.trim() && !line.startsWith('#')) {
            skipNext = false;
            continue;
          }
          if (!skipNext) {
            filteredLines.push(line);
          }
        }

        const newCron = filteredLines.join('\n');
        const tempFile = path.join('/tmp', `crontab_${Date.now()}`);
        fs.writeFileSync(tempFile, newCron);
        await execAsync(`crontab "${tempFile}"`, { timeout: 5000 });
        fs.unlinkSync(tempFile);

        return {
          message: `Cron job '${name}' deleted successfully`
        };
      } catch (error) {
        throw new WorkspaceError(
          ErrorCode.NOT_FOUND,
          `Cron job '${name}' not found or could not be deleted`
        );
      }
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to delete scheduled task: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function runTaskNow(name: string): Promise<{ message: string; result: string }> {
  try {
    if (process.platform === 'win32') {
      // Windows Task Scheduler
      const result = await execAsync(`schtasks /run /tn "${name}"`, { timeout: 10000 });
      return {
        message: `Task '${name}' executed successfully`,
        result: result.stdout
      };
    } else {
      return {
        message: `Manual execution of cron jobs not supported on this platform`,
        result: 'Use the original command directly to test'
      };
    }
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to run task: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function convertToCron(schedule: string): string {
  // Convert human-readable schedule to cron format
  switch (schedule.toLowerCase()) {
    case 'daily': return '0 9 * * *';
    case 'weekly': return '0 9 * * 1';
    case 'monthly': return '0 9 1 * *';
    case 'hourly': return '0 * * * *';
    default:
      // Assume it's already in cron format or return daily default
      return schedule.includes('*') ? schedule : '0 9 * * *';
  }
}