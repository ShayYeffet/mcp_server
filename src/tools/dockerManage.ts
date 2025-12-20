/**
 * Docker Management Tool
 * Manage Docker containers, images, networks, and volumes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface DockerManageArgs {
  operation: 'list' | 'start' | 'stop' | 'restart' | 'remove' | 'logs' | 'exec' | 'build' | 'pull' | 'push' | 'inspect';
  target: 'containers' | 'images' | 'networks' | 'volumes';
  name?: string;
  image?: string;
  command?: string;
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string>;
  dockerfile?: string;
  tag?: string;
  all?: boolean;
  follow?: boolean;
  lines?: number;
}

export const dockerManageTool: Tool = {
  name: 'docker_manage',
  description: 'Manage Docker containers, images, networks, and volumes',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['list', 'start', 'stop', 'restart', 'remove', 'logs', 'exec', 'build', 'pull', 'push', 'inspect'],
        description: 'Docker operation to perform'
      },
      target: {
        type: 'string',
        enum: ['containers', 'images', 'networks', 'volumes'],
        description: 'Docker resource type'
      },
      name: {
        type: 'string',
        description: 'Container/image/network/volume name or ID'
      },
      image: {
        type: 'string',
        description: 'Docker image name for container operations'
      },
      command: {
        type: 'string',
        description: 'Command to run in container'
      },
      ports: {
        type: 'array',
        description: 'Port mappings (e.g., ["8080:80", "3000:3000"])',
        items: { type: 'string' }
      },
      volumes: {
        type: 'array',
        description: 'Volume mappings (e.g., ["/host/path:/container/path"])',
        items: { type: 'string' }
      },
      environment: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' }
      },
      dockerfile: {
        type: 'string',
        description: 'Path to Dockerfile for build operation'
      },
      tag: {
        type: 'string',
        description: 'Image tag'
      },
      all: {
        type: 'boolean',
        description: 'Include stopped containers/unused images',
        default: false
      },
      follow: {
        type: 'boolean',
        description: 'Follow log output',
        default: false
      },
      lines: {
        type: 'number',
        description: 'Number of log lines to show',
        default: 100
      }
    },
    required: ['operation', 'target']
  }
};

export async function executeDockerManage(
  args: DockerManageArgs,
  config: ServerConfig
): Promise<{ message: string; data?: any; logs?: string }> {
  const { operation, target, name, image, command, ports, volumes, environment, dockerfile, tag, all = false, follow = false, lines = 100 } = args;

  // Check if Docker is available
  try {
    await execAsync('docker --version', { timeout: 5000 });
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      'Docker is not installed or not accessible'
    );
  }

  // Check read-only mode for write operations
  if (config.readOnly && ['start', 'stop', 'restart', 'remove', 'build', 'pull', 'push'].includes(operation)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Docker write operations not allowed in read-only mode'
    );
  }

  try {
    switch (operation) {
      case 'list':
        return await listDockerResources(target, all);
      
      case 'start':
        return await startContainer(name, image, command, ports, volumes, environment);
      
      case 'stop':
        return await stopContainer(name!);
      
      case 'restart':
        return await restartContainer(name!);
      
      case 'remove':
        return await removeDockerResource(target, name!);
      
      case 'logs':
        return await getContainerLogs(name!, follow, lines);
      
      case 'exec':
        return await execInContainer(name!, command!);
      
      case 'build':
        return await buildImage(dockerfile!, tag);
      
      case 'pull':
        return await pullImage(image!);
      
      case 'push':
        return await pushImage(image!);
      
      case 'inspect':
        return await inspectDockerResource(target, name!);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Docker operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function listDockerResources(target: string, all: boolean): Promise<{ message: string; data: any[] }> {
  let command = '';
  
  switch (target) {
    case 'containers':
      command = `docker ps ${all ? '-a' : ''} --format "table {{.ID}}\\t{{.Image}}\\t{{.Command}}\\t{{.CreatedAt}}\\t{{.Status}}\\t{{.Ports}}\\t{{.Names}}"`;
      break;
    case 'images':
      command = `docker images ${all ? '-a' : ''} --format "table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.CreatedAt}}\\t{{.Size}}"`;
      break;
    case 'networks':
      command = 'docker network ls --format "table {{.ID}}\\t{{.Name}}\\t{{.Driver}}\\t{{.Scope}}"';
      break;
    case 'volumes':
      command = 'docker volume ls --format "table {{.Driver}}\\t{{.Name}}"';
      break;
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown target: ${target}`);
  }

  const result = await execAsync(command, { timeout: 10000 });
  const lines = result.stdout.trim().split('\n');
  
  // Parse the table output
  const data = lines.slice(1).map(line => {
    const parts = line.split('\t');
    return parts.reduce((obj, part, index) => {
      obj[`field_${index}`] = part;
      return obj;
    }, {} as any);
  });

  return {
    message: `Listed ${data.length} ${target}`,
    data
  };
}

async function startContainer(
  name?: string,
  image?: string,
  command?: string,
  ports?: string[],
  volumes?: string[],
  environment?: Record<string, string>
): Promise<{ message: string; data: any }> {
  if (!name && !image) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Either container name or image is required');
  }

  let dockerCommand = 'docker run -d';
  
  // Add name
  if (name) {
    dockerCommand += ` --name ${name}`;
  }
  
  // Add port mappings
  if (ports) {
    for (const port of ports) {
      dockerCommand += ` -p ${port}`;
    }
  }
  
  // Add volume mappings
  if (volumes) {
    for (const volume of volumes) {
      dockerCommand += ` -v ${volume}`;
    }
  }
  
  // Add environment variables
  if (environment) {
    for (const [key, value] of Object.entries(environment)) {
      dockerCommand += ` -e ${key}="${value}"`;
    }
  }
  
  // Add image
  if (image) {
    dockerCommand += ` ${image}`;
  }
  
  // Add command
  if (command) {
    dockerCommand += ` ${command}`;
  }

  const result = await execAsync(dockerCommand, { timeout: 30000 });
  const containerId = result.stdout.trim();

  return {
    message: `Container started successfully`,
    data: { containerId, name: name || containerId.substring(0, 12) }
  };
}

async function stopContainer(name: string): Promise<{ message: string }> {
  await execAsync(`docker stop ${name}`, { timeout: 30000 });
  
  return {
    message: `Container ${name} stopped successfully`
  };
}

async function restartContainer(name: string): Promise<{ message: string }> {
  await execAsync(`docker restart ${name}`, { timeout: 30000 });
  
  return {
    message: `Container ${name} restarted successfully`
  };
}

async function removeDockerResource(target: string, name: string): Promise<{ message: string }> {
  let command = '';
  
  switch (target) {
    case 'containers':
      command = `docker rm -f ${name}`;
      break;
    case 'images':
      command = `docker rmi ${name}`;
      break;
    case 'networks':
      command = `docker network rm ${name}`;
      break;
    case 'volumes':
      command = `docker volume rm ${name}`;
      break;
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown target: ${target}`);
  }

  await execAsync(command, { timeout: 30000 });
  
  return {
    message: `${target.slice(0, -1)} ${name} removed successfully`
  };
}

async function getContainerLogs(name: string, follow: boolean, lines: number): Promise<{ message: string; logs: string }> {
  const command = `docker logs ${follow ? '-f' : ''} --tail ${lines} ${name}`;
  
  const result = await execAsync(command, { timeout: follow ? 60000 : 10000 });
  
  return {
    message: `Retrieved logs for container ${name}`,
    logs: result.stdout + result.stderr
  };
}

async function execInContainer(name: string, command: string): Promise<{ message: string; data: string }> {
  const dockerCommand = `docker exec ${name} ${command}`;
  
  const result = await execAsync(dockerCommand, { timeout: 30000 });
  
  return {
    message: `Executed command in container ${name}`,
    data: result.stdout
  };
}

async function buildImage(dockerfile: string, tag?: string): Promise<{ message: string }> {
  let command = `docker build -f ${dockerfile}`;
  
  if (tag) {
    command += ` -t ${tag}`;
  }
  
  command += ' .';
  
  await execAsync(command, { timeout: 300000 }); // 5 minutes timeout for builds
  
  return {
    message: `Image built successfully${tag ? ` with tag ${tag}` : ''}`
  };
}

async function pullImage(image: string): Promise<{ message: string }> {
  await execAsync(`docker pull ${image}`, { timeout: 300000 });
  
  return {
    message: `Image ${image} pulled successfully`
  };
}

async function pushImage(image: string): Promise<{ message: string }> {
  await execAsync(`docker push ${image}`, { timeout: 300000 });
  
  return {
    message: `Image ${image} pushed successfully`
  };
}

async function inspectDockerResource(target: string, name: string): Promise<{ message: string; data: any }> {
  let command = '';
  
  switch (target) {
    case 'containers':
      command = `docker inspect ${name}`;
      break;
    case 'images':
      command = `docker image inspect ${name}`;
      break;
    case 'networks':
      command = `docker network inspect ${name}`;
      break;
    case 'volumes':
      command = `docker volume inspect ${name}`;
      break;
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown target: ${target}`);
  }

  const result = await execAsync(command, { timeout: 10000 });
  const data = JSON.parse(result.stdout);
  
  return {
    message: `Inspected ${target.slice(0, -1)} ${name}`,
    data: data[0] || data
  };
}