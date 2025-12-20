/**
 * Code Formatting Tool
 * Format, lint, and analyze code using various tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

const execAsync = promisify(exec);

export interface CodeFormatArgs {
  operation: 'format' | 'lint' | 'analyze' | 'fix' | 'check';
  files?: string[];
  language?: 'javascript' | 'typescript' | 'python' | 'java' | 'go' | 'rust' | 'php' | 'css' | 'html' | 'json' | 'yaml';
  tool?: string;
  config?: string;
  fix?: boolean;
  workingDirectory?: string;
}

export const codeFormatTool: Tool = {
  name: 'code_format',
  description: 'Format, lint, and analyze code using various formatting tools',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['format', 'lint', 'analyze', 'fix', 'check'],
        description: 'Code formatting operation'
      },
      files: {
        type: 'array',
        description: 'Files to process (relative to workspace)',
        items: { type: 'string' }
      },
      language: {
        type: 'string',
        enum: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'php', 'css', 'html', 'json', 'yaml'],
        description: 'Programming language'
      },
      tool: {
        type: 'string',
        description: 'Specific tool to use (prettier, eslint, black, etc.)'
      },
      config: {
        type: 'string',
        description: 'Path to config file (relative to workspace)'
      },
      fix: {
        type: 'boolean',
        description: 'Automatically fix issues',
        default: false
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory (relative to workspace)'
      }
    },
    required: ['operation']
  }
};

export async function executeCodeFormat(
  args: CodeFormatArgs,
  config: ServerConfig
): Promise<{ message: string; output?: string; issues?: any[]; formatted?: boolean }> {
  const { operation, files, language, tool, config: configFile, workingDirectory } = args;

  // Check read-only mode for write operations
  if (config.readOnly && ['format', 'fix'].includes(operation)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Code formatting write operations not allowed in read-only mode'
    );
  }

  // Validate working directory
  let workDir = config.workspaceRoot;
  if (workingDirectory) {
    workDir = validatePath(workingDirectory, config.workspaceRoot);
  }

  // Validate files
  const validatedFiles: string[] = [];
  if (files) {
    for (const file of files) {
      const filePath = validatePath(file, config.workspaceRoot);
      if (fs.existsSync(filePath)) {
        validatedFiles.push(filePath);
      }
    }
  }

  try {
    switch (operation) {
      case 'format':
        return await formatCode(validatedFiles, language, tool, configFile, workDir, config);
      
      case 'lint':
        return await lintCode(validatedFiles, language, tool, configFile, workDir, config);
      
      case 'analyze':
        return await analyzeCode(validatedFiles, language, tool, workDir, config);
      
      case 'fix':
        return await fixCode(validatedFiles, language, tool, configFile, workDir, config);
      
      case 'check':
        return await checkCode(validatedFiles, language, tool, configFile, workDir, config);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Code formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function formatCode(
  files: string[],
  language?: string,
  tool?: string,
  configFile?: string,
  workDir?: string,
  _config?: ServerConfig
): Promise<{ message: string; output: string; formatted: boolean }> {
  const formatter = tool || getDefaultFormatter(language, files);
  
  if (!formatter) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Could not determine formatter to use');
  }

  // Check if formatter is available
  try {
    await execAsync(`${formatter} --version`, { timeout: 5000 });
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      `Formatter ${formatter} is not installed or not accessible`
    );
  }

  let command = buildFormatterCommand(formatter, files, configFile, true);
  
  const result = await execAsync(command, { cwd: workDir, timeout: 60000 });

  return {
    message: `Code formatted successfully using ${formatter}`,
    output: result.stdout + result.stderr,
    formatted: true
  };
}

async function lintCode(
  files: string[],
  language?: string,
  tool?: string,
  configFile?: string,
  workDir?: string,
  _config?: ServerConfig
): Promise<{ message: string; output: string; issues: any[] }> {
  const linter = tool || getDefaultLinter(language, files);
  
  if (!linter) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Could not determine linter to use');
  }

  // Check if linter is available
  try {
    await execAsync(`${linter} --version`, { timeout: 5000 });
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      `Linter ${linter} is not installed or not accessible`
    );
  }

  let command = buildLinterCommand(linter, files, configFile);
  
  try {
    const result = await execAsync(command, { cwd: workDir, timeout: 60000 });
    const issues = parseLinterOutput(result.stdout + result.stderr, linter);

    return {
      message: `Code linted successfully using ${linter}. Found ${issues.length} issues.`,
      output: result.stdout + result.stderr,
      issues
    };
  } catch (error: any) {
    // Linters often exit with non-zero code when issues are found
    const issues = parseLinterOutput(error.stdout + error.stderr, linter);
    
    return {
      message: `Code linted using ${linter}. Found ${issues.length} issues.`,
      output: error.stdout + error.stderr,
      issues
    };
  }
}

async function analyzeCode(
  files: string[],
  _language?: string,
  _tool?: string,
  _workDir?: string,
  _config?: ServerConfig
): Promise<{ message: string; output: string; analysis: any }> {
  // Simple code analysis
  const analysis: any = {
    files: files.length,
    totalLines: 0,
    totalSize: 0,
    languages: new Set(),
    issues: []
  };

  for (const file of files) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      const size = content.length;
      const ext = file.split('.').pop()?.toLowerCase();
      
      analysis.totalLines += lines;
      analysis.totalSize += size;
      
      if (ext) {
        analysis.languages.add(getLanguageFromExtension(ext));
      }

      // Basic code quality checks
      if (content.includes('TODO')) {
        analysis.issues.push({ file, type: 'todo', message: 'Contains TODO comments' });
      }
      if (content.includes('FIXME')) {
        analysis.issues.push({ file, type: 'fixme', message: 'Contains FIXME comments' });
      }
      if (lines > 1000) {
        analysis.issues.push({ file, type: 'large_file', message: `Large file (${lines} lines)` });
      }
    }
  }

  analysis.languages = Array.from(analysis.languages);

  return {
    message: `Code analysis completed. Analyzed ${analysis.files} files.`,
    output: JSON.stringify(analysis, null, 2),
    analysis
  };
}

async function fixCode(
  files: string[],
  language?: string,
  tool?: string,
  configFile?: string,
  workDir?: string,
  _config?: ServerConfig
): Promise<{ message: string; output: string; fixed: boolean }> {
  const fixer = tool || getDefaultFixer(language, files);
  
  if (!fixer) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Could not determine fixer to use');
  }

  // Check if fixer is available
  try {
    await execAsync(`${fixer} --version`, { timeout: 5000 });
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.COMMAND_NOT_ALLOWED,
      `Fixer ${fixer} is not installed or not accessible`
    );
  }

  let command = buildFixerCommand(fixer, files, configFile);
  
  const result = await execAsync(command, { cwd: workDir, timeout: 60000 });

  return {
    message: `Code fixed successfully using ${fixer}`,
    output: result.stdout + result.stderr,
    fixed: true
  };
}

async function checkCode(
  files: string[],
  language?: string,
  tool?: string,
  configFile?: string,
  workDir?: string,
  _config?: ServerConfig
): Promise<{ message: string; output: string; valid: boolean }> {
  // Combine linting and formatting check
  const lintResult = await lintCode(files, language, tool, configFile, workDir, _config);
  
  const valid = lintResult.issues.length === 0;

  return {
    message: `Code check completed. ${valid ? 'No issues found' : `Found ${lintResult.issues.length} issues`}.`,
    output: lintResult.output,
    valid
  };
}

function getDefaultFormatter(language?: string, files?: string[]): string | null {
  if (language) {
    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'css':
      case 'html':
      case 'json':
      case 'yaml':
        return 'prettier';
      case 'python':
        return 'black';
      case 'go':
        return 'gofmt';
      case 'rust':
        return 'rustfmt';
      case 'java':
        return 'google-java-format';
      case 'php':
        return 'php-cs-fixer';
    }
  }

  // Detect from file extensions
  if (files && files.length > 0) {
    const ext = files[0].split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'css':
      case 'html':
      case 'json':
      case 'yaml':
      case 'yml':
        return 'prettier';
      case 'py':
        return 'black';
      case 'go':
        return 'gofmt';
      case 'rs':
        return 'rustfmt';
      case 'java':
        return 'google-java-format';
      case 'php':
        return 'php-cs-fixer';
    }
  }

  return null;
}

function getDefaultLinter(language?: string, files?: string[]): string | null {
  if (language) {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'eslint';
      case 'python':
        return 'flake8';
      case 'go':
        return 'golint';
      case 'rust':
        return 'clippy';
      case 'java':
        return 'checkstyle';
      case 'php':
        return 'phpcs';
    }
  }

  // Detect from file extensions
  if (files && files.length > 0) {
    const ext = files[0].split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return 'eslint';
      case 'py':
        return 'flake8';
      case 'go':
        return 'golint';
      case 'rs':
        return 'clippy';
      case 'java':
        return 'checkstyle';
      case 'php':
        return 'phpcs';
    }
  }

  return null;
}

function getDefaultFixer(language?: string, files?: string[]): string | null {
  if (language) {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'eslint';
      case 'python':
        return 'autopep8';
      case 'go':
        return 'gofmt';
      case 'rust':
        return 'rustfmt';
    }
  }

  // Detect from file extensions
  if (files && files.length > 0) {
    const ext = files[0].split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return 'eslint';
      case 'py':
        return 'autopep8';
      case 'go':
        return 'gofmt';
      case 'rs':
        return 'rustfmt';
    }
  }

  return null;
}

function buildFormatterCommand(formatter: string, files: string[], configFile?: string, write: boolean = false): string {
  let command = formatter;
  
  switch (formatter) {
    case 'prettier':
      command += write ? ' --write' : ' --check';
      if (configFile) command += ` --config ${configFile}`;
      break;
    case 'black':
      if (!write) command += ' --check';
      break;
    case 'gofmt':
      if (write) command += ' -w';
      break;
    case 'rustfmt':
      if (!write) command += ' --check';
      break;
  }
  
  command += ` ${files.join(' ')}`;
  return command;
}

function buildLinterCommand(linter: string, files: string[], configFile?: string): string {
  let command = linter;
  
  switch (linter) {
    case 'eslint':
      command += ' --format json';
      if (configFile) command += ` --config ${configFile}`;
      break;
    case 'flake8':
      command += ' --format=json';
      if (configFile) command += ` --config=${configFile}`;
      break;
  }
  
  command += ` ${files.join(' ')}`;
  return command;
}

function buildFixerCommand(fixer: string, files: string[], configFile?: string): string {
  let command = fixer;
  
  switch (fixer) {
    case 'eslint':
      command += ' --fix';
      if (configFile) command += ` --config ${configFile}`;
      break;
    case 'autopep8':
      command += ' --in-place';
      break;
  }
  
  command += ` ${files.join(' ')}`;
  return command;
}

function parseLinterOutput(output: string, linter: string): any[] {
  const issues: any[] = [];
  
  try {
    switch (linter) {
      case 'eslint':
        const eslintResult = JSON.parse(output);
        for (const file of eslintResult) {
          for (const message of file.messages) {
            issues.push({
              file: file.filePath,
              line: message.line,
              column: message.column,
              severity: message.severity === 2 ? 'error' : 'warning',
              message: message.message,
              rule: message.ruleId
            });
          }
        }
        break;
      
      default:
        // Generic parsing for other linters
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim() && !line.startsWith('=')) {
            issues.push({
              message: line.trim(),
              severity: 'info'
            });
          }
        }
    }
  } catch (error) {
    // If JSON parsing fails, treat as plain text
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        issues.push({
          message: line.trim(),
          severity: 'info'
        });
      }
    }
  }
  
  return issues;
}

function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'css': 'css',
    'html': 'html',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml'
  };
  
  return languageMap[ext] || ext;
}