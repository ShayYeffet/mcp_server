/**
 * Package Manager Tool
 * Manage packages with npm, yarn, pip, composer, etc.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

const execAsync = promisify(exec);

export interface PackageManagerArgs {
  manager: 'npm' | 'yarn' | 'pip' | 'composer' | 'gem' | 'cargo' | 'go';
  operation: 'install' | 'uninstall' | 'update' | 'list' | 'info' | 'search' | 'init' | 'run';
  packages?: string[];
  script?: string;
  global?: boolean;
  dev?: boolean;
  save?: boolean;
  workingDirectory?: string;
  version?: string;
}

export const packageManagerTool: Tool = {
  name: 'package_manager',
  description: 'Manage packages with npm, yarn, pip, composer, and other package managers',
  inputSchema: {
    type: 'object',
    properties: {
      manager: {
        type: 'string',
        enum: ['npm', 'yarn', 'pip', 'composer', 'gem', 'cargo', 'go'],
        description: 'Package manager to use'
      },
      operation: {
        type: 'string',
        enum: ['install', 'uninstall', 'update', 'list', 'info', 'search', 'init', 'run'],
        description: 'Package manager operation'
      },
      packages: {
        type: 'array',
        description: 'Package names to install/uninstall/search',
        items: { type: 'string' }
      },
      script: {
        type: 'string',
        description: 'Script name to run (for run operation)'
      },
      global: {
        type: 'boolean',
        description: 'Install globally',
        default: false
      },
      dev: {
        type: 'boolean',
        description: 'Install as dev dependency',
        default: false
      },
      save: {
        type: 'boolean',
        description: 'Save to package file',
        default: true
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory (relative to workspace)'
      },
      version: {
        type: 'string',
        description: 'Specific version to install'
      }
    },
    required: ['manager', 'operation']
  }
};

export async function executePackageManager(
  args: PackageManagerArgs,
  config: ServerConfig
): Promise<{ message: string; output?: string; packages?: any[] }> {
  const { manager, operation, packages, script, global = false, dev = false, save = true, workingDirectory, version } = args;

  // Check read-only mode for write operations
  if (config.readOnly && ['install', 'uninstall', 'update', 'init'].includes(operation)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Package manager write operations not allowed in read-only mode'
    );
  }

  // Validate working directory
  let workDir = config.workspaceRoot;
  if (workingDirectory) {
    workDir = validatePath(workingDirectory, config.workspaceRoot);
  }

  try {
    // Check if package manager is available
    await checkPackageManager(manager);

    switch (operation) {
      case 'install':
        return await installPackages(manager, packages || [], global, dev, save, version, workDir);
      
      case 'uninstall':
        return await uninstallPackages(manager, packages || [], global, workDir);
      
      case 'update':
        return await updatePackages(manager, packages, workDir);
      
      case 'list':
        return await listPackages(manager, global, workDir);
      
      case 'info':
        return await getPackageInfo(manager, packages?.[0] || '', workDir);
      
      case 'search':
        return await searchPackages(manager, packages?.[0] || '', workDir);
      
      case 'init':
        return await initProject(manager, workDir);
      
      case 'run':
        return await runScript(manager, script || '', workDir);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Package manager operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function checkPackageManager(manager: string): Promise<void> {
  try {
    await execAsync(`${manager} --version`, { timeout: 5000 });
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      `Package manager ${manager} is not installed or not accessible`
    );
  }
}

async function installPackages(
  manager: string,
  packages: string[],
  global: boolean,
  dev: boolean,
  save: boolean,
  version?: string,
  workDir?: string
): Promise<{ message: string; output: string }> {
  if (packages.length === 0) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'At least one package name is required for install');
  }

  let command = '';
  const packageList = packages.map(pkg => version ? `${pkg}@${version}` : pkg).join(' ');

  switch (manager) {
    case 'npm':
      command = `npm install ${packageList}`;
      if (global) command += ' -g';
      if (dev) command += ' --save-dev';
      if (!save) command += ' --no-save';
      break;
    
    case 'yarn':
      command = `yarn add ${packageList}`;
      if (global) command = `yarn global add ${packageList}`;
      if (dev) command += ' --dev';
      break;
    
    case 'pip':
      command = `pip install ${packageList}`;
      if (global) command += ' --user';
      break;
    
    case 'composer':
      command = `composer require ${packageList}`;
      if (dev) command += ' --dev';
      break;
    
    case 'gem':
      command = `gem install ${packageList}`;
      break;
    
    case 'cargo':
      command = `cargo install ${packageList}`;
      break;
    
    case 'go':
      command = `go install ${packageList}`;
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unsupported package manager: ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 120000 });

  return {
    message: `Successfully installed packages: ${packages.join(', ')}`,
    output: result.stdout + result.stderr
  };
}

async function uninstallPackages(
  manager: string,
  packages: string[],
  global: boolean,
  workDir?: string
): Promise<{ message: string; output: string }> {
  if (packages.length === 0) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'At least one package name is required for uninstall');
  }

  let command = '';
  const packageList = packages.join(' ');

  switch (manager) {
    case 'npm':
      command = `npm uninstall ${packageList}`;
      if (global) command += ' -g';
      break;
    
    case 'yarn':
      command = global ? `yarn global remove ${packageList}` : `yarn remove ${packageList}`;
      break;
    
    case 'pip':
      command = `pip uninstall ${packageList} -y`;
      break;
    
    case 'composer':
      command = `composer remove ${packageList}`;
      break;
    
    case 'gem':
      command = `gem uninstall ${packageList}`;
      break;
    
    case 'cargo':
      command = `cargo uninstall ${packageList}`;
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unsupported package manager: ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 60000 });

  return {
    message: `Successfully uninstalled packages: ${packages.join(', ')}`,
    output: result.stdout + result.stderr
  };
}

async function updatePackages(
  manager: string,
  packages?: string[],
  workDir?: string
): Promise<{ message: string; output: string }> {
  let command = '';
  const packageList = packages?.join(' ') || '';

  switch (manager) {
    case 'npm':
      command = packages ? `npm update ${packageList}` : 'npm update';
      break;
    
    case 'yarn':
      command = packages ? `yarn upgrade ${packageList}` : 'yarn upgrade';
      break;
    
    case 'pip':
      command = packages ? `pip install --upgrade ${packageList}` : 'pip list --outdated';
      break;
    
    case 'composer':
      command = packages ? `composer update ${packageList}` : 'composer update';
      break;
    
    case 'gem':
      command = packages ? `gem update ${packageList}` : 'gem update';
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Update not supported for ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 120000 });

  return {
    message: packages ? `Updated packages: ${packages.join(', ')}` : 'Updated all packages',
    output: result.stdout + result.stderr
  };
}

async function listPackages(
  manager: string,
  global: boolean,
  workDir?: string
): Promise<{ message: string; packages: any[] }> {
  let command = '';

  switch (manager) {
    case 'npm':
      command = global ? 'npm list -g --depth=0' : 'npm list --depth=0';
      break;
    
    case 'yarn':
      command = global ? 'yarn global list' : 'yarn list --depth=0';
      break;
    
    case 'pip':
      command = 'pip list';
      break;
    
    case 'composer':
      command = 'composer show';
      break;
    
    case 'gem':
      command = 'gem list';
      break;
    
    case 'cargo':
      command = 'cargo install --list';
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `List not supported for ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 30000 });
  const packages = parsePackageList(result.stdout, manager);

  return {
    message: `Listed ${packages.length} packages`,
    packages
  };
}

async function getPackageInfo(
  manager: string,
  packageName: string,
  workDir?: string
): Promise<{ message: string; output: string }> {
  if (!packageName) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Package name is required for info operation');
  }

  let command = '';

  switch (manager) {
    case 'npm':
      command = `npm info ${packageName}`;
      break;
    
    case 'yarn':
      command = `yarn info ${packageName}`;
      break;
    
    case 'pip':
      command = `pip show ${packageName}`;
      break;
    
    case 'composer':
      command = `composer show ${packageName}`;
      break;
    
    case 'gem':
      command = `gem info ${packageName}`;
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Info not supported for ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 30000 });

  return {
    message: `Retrieved info for package: ${packageName}`,
    output: result.stdout
  };
}

async function searchPackages(
  manager: string,
  query: string,
  workDir?: string
): Promise<{ message: string; output: string }> {
  if (!query) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Search query is required');
  }

  let command = '';

  switch (manager) {
    case 'npm':
      command = `npm search ${query}`;
      break;
    
    case 'yarn':
      command = `yarn search ${query}`;
      break;
    
    case 'pip':
      command = `pip search ${query}`;
      break;
    
    case 'gem':
      command = `gem search ${query}`;
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Search not supported for ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 30000 });

  return {
    message: `Search results for: ${query}`,
    output: result.stdout
  };
}

async function initProject(
  manager: string,
  workDir?: string
): Promise<{ message: string; output: string }> {
  let command = '';

  switch (manager) {
    case 'npm':
      command = 'npm init -y';
      break;
    
    case 'yarn':
      command = 'yarn init -y';
      break;
    
    case 'composer':
      command = 'composer init --no-interaction';
      break;
    
    case 'cargo':
      command = 'cargo init';
      break;
    
    case 'go':
      command = 'go mod init';
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Init not supported for ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 30000 });

  return {
    message: `Initialized ${manager} project`,
    output: result.stdout + result.stderr
  };
}

async function runScript(
  manager: string,
  script: string,
  workDir?: string
): Promise<{ message: string; output: string }> {
  if (!script) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Script name is required for run operation');
  }

  let command = '';

  switch (manager) {
    case 'npm':
      command = `npm run ${script}`;
      break;
    
    case 'yarn':
      command = `yarn run ${script}`;
      break;
    
    case 'composer':
      command = `composer run-script ${script}`;
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Run script not supported for ${manager}`);
  }

  const result = await execAsync(command, { cwd: workDir, timeout: 120000 });

  return {
    message: `Executed script: ${script}`,
    output: result.stdout + result.stderr
  };
}

function parsePackageList(output: string, manager: string): any[] {
  const packages: any[] = [];
  const lines = output.split('\n').filter(line => line.trim());

  switch (manager) {
    case 'npm':
    case 'yarn':
      for (const line of lines) {
        const match = line.match(/^[├└─\s]*([^@\s]+)@([^\s]+)/);
        if (match) {
          packages.push({
            name: match[1],
            version: match[2]
          });
        }
      }
      break;
    
    case 'pip':
      for (const line of lines.slice(2)) { // Skip header
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          packages.push({
            name: parts[0],
            version: parts[1]
          });
        }
      }
      break;
    
    default:
      // Generic parsing
      for (const line of lines) {
        if (line.trim()) {
          packages.push({ name: line.trim() });
        }
      }
  }

  return packages;
}