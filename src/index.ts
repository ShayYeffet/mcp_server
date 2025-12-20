/**
 * MCP Workspace Server
 * Main entry point for the Model Context Protocol server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, ServerConfig } from './config.js';
import { Logger } from './utils/logging.js';
import { 
  classifyError, 
  logError, 
  formatErrorForUser,
  ErrorCode as WorkspaceErrorCode
} from './utils/errors.js';

// Import all tools
import { listFilesTool, executeListFiles } from './tools/listFiles.js';
import { readFileTool, executeReadFile } from './tools/readFile.js';
import { writeFileTool, executeWriteFile } from './tools/writeFile.js';
import { deleteFileTool, executeDeleteFile } from './tools/deleteFile.js';
import { createFolderTool, executeCreateFolder } from './tools/createFolder.js';
import { applyPatchTool, executeApplyPatch } from './tools/applyPatch.js';
import { runCommandTool, executeRunCommand } from './tools/runCommand.js';

// New advanced tools
import { searchFilesTool, executeSearchFiles } from './tools/searchFiles.js';
import { findFilesTool, executeFindFiles } from './tools/findFiles.js';
import { copyFileTool, executeCopyFile } from './tools/copyFile.js';
import { moveFileTool, executeMoveFile } from './tools/moveFile.js';
import { httpRequestTool, executeHttpRequest } from './tools/httpRequest.js';
import { gitStatusTool, executeGitStatus } from './tools/gitStatus.js';
import { gitDiffTool, executeGitDiff } from './tools/gitDiff.js';
import { systemInfoTool, executeSystemInfo } from './tools/systemInfo.js';

// Archive & compression tools
import { compressFilesTool, executeCompressFiles } from './tools/compressFiles.js';
import { extractArchiveTool, executeExtractArchive } from './tools/extractArchive.js';

// Process management tools
import { listProcessesTool, executeListProcesses } from './tools/listProcesses.js';
import { killProcessTool, executeKillProcess } from './tools/killProcess.js';

// Advanced Git tools
import { gitLogTool, executeGitLog } from './tools/gitLog.js';
import { gitBranchTool, executeGitBranch } from './tools/gitBranch.js';

// File utilities
import { getFileInfoTool, executeGetFileInfo } from './tools/getFileInfo.js';

// Database operations
import { databaseQueryTool, executeDatabaseQuery } from './tools/databaseQuery.js';

// Image processing
import { imageProcessTool, executeImageProcess } from './tools/imageProcess.js';

// PDF manipulation
import { pdfManipulateTool, executePdfManipulate } from './tools/pdfManipulate.js';

// Encryption/Decryption
import { encryptDecryptTool, executeEncryptDecrypt } from './tools/encryptDecrypt.js';

// Task scheduling
import { scheduleTaskTool, executeScheduleTask } from './tools/scheduleTask.js';

// Notifications
import { sendNotificationTool, executeSendNotification } from './tools/sendNotification.js';

// Text processing
import { textProcessTool, executeTextProcess } from './tools/textProcess.js';

// Data processing
import { csvProcessTool, executeCsvProcess } from './tools/csvProcess.js';
import { jsonProcessTool, executeJsonProcess } from './tools/jsonProcess.js';

// Web scraping
import { webScrapeTool, executeWebScrape } from './tools/webScrape.js';

// Docker management
import { dockerManageTool, executeDockerManage } from './tools/dockerManage.js';

// Cloud storage
import { cloudStorageTool, executeCloudStorage } from './tools/cloudStorage.js';

// Package management
import { packageManagerTool, executePackageManager } from './tools/packageManager.js';

// Code formatting
import { codeFormatTool, executeCodeFormat } from './tools/codeFormat.js';

/**
 * Main MCP Workspace Server class
 */
class WorkspaceMCPServer {
  private server: Server;
  private config: ServerConfig;
  private logger: Logger;

  constructor() {
    // Load configuration
    this.config = loadConfig();
    
    // Initialize logger
    this.logger = new Logger(this.config.logLevel);
    
    // Create MCP server instance
    this.server = new Server(
      {
        name: 'ultimate-mcp-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.logger.info('MCP Workspace Server initialized', {
      workspaceRoot: this.config.workspaceRoot,
      readOnly: this.config.readOnly,
      allowedCommands: this.config.allowedCommands,
    });

    // Register tools and handlers
    this.registerTools();
    this.setupHandlers();
  }

  /**
   * Registers all available tools with the MCP server
   */
  private registerTools(): void {
    // Register list_tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Core file operations
          listFilesTool,
          readFileTool,
          writeFileTool,
          deleteFileTool,
          createFolderTool,
          applyPatchTool,
          runCommandTool,
          
          // Advanced file operations
          searchFilesTool,
          findFilesTool,
          copyFileTool,
          moveFileTool,
          getFileInfoTool,
          
          // Archive & compression
          compressFilesTool,
          extractArchiveTool,
          
          // Network operations
          httpRequestTool,
          
          // Git operations
          gitStatusTool,
          gitDiffTool,
          gitLogTool,
          gitBranchTool,
          
          // System operations
          systemInfoTool,
          listProcessesTool,
          killProcessTool,
          
          // Database operations
          databaseQueryTool,
          
          // Image processing
          imageProcessTool,
          
          // PDF manipulation
          pdfManipulateTool,
          
          // Encryption/Decryption
          encryptDecryptTool,
          
          // Task scheduling
          scheduleTaskTool,
          
          // Notifications
          sendNotificationTool,
          
          // Text processing
          textProcessTool,
          
          // Data processing
          csvProcessTool,
          jsonProcessTool,
          
          // Web scraping
          webScrapeTool,
          
          // Docker management
          dockerManageTool,
          
          // Cloud storage
          cloudStorageTool,
          
          // Package management
          packageManagerTool,
          
          // Code formatting
          codeFormatTool,
        ],
      };
    });

    this.logger.debug('Registered 36 tools');
  }

  /**
   * Sets up request handlers for tool execution
   */
  private setupHandlers(): void {
    // Register call_tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.debug('Tool invocation', { tool: name, args });

      try {
        const result = await this.handleToolCall(name, args || {});
        
        this.logger.debug('Tool execution successful', { tool: name });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return this.handleError(error, name, args);
      }
    });
  }

  /**
   * Routes tool calls to appropriate handlers
   * @param name - Tool name
   * @param args - Tool arguments
   * @returns Tool execution result
   */
  private async handleToolCall(name: string, args: unknown): Promise<unknown> {
    switch (name) {
      // Core file operations
      case 'list_files':
        return await executeListFiles(args as any, this.config);
      
      case 'read_file':
        return await executeReadFile(args as any, this.config);
      
      case 'write_file':
        return await executeWriteFile(args as any, this.config);
      
      case 'delete_file':
        return await executeDeleteFile(args as any, this.config);
      
      case 'create_folder':
        return await executeCreateFolder(args as any, this.config);
      
      case 'apply_patch':
        return await executeApplyPatch(args as any, this.config);
      
      case 'run_command':
        return await executeRunCommand(args as any, this.config);
      
      // Advanced file operations
      case 'search_files':
        return await executeSearchFiles(args as any, this.config);
      
      case 'find_files':
        return await executeFindFiles(args as any, this.config);
      
      case 'copy_file':
        return await executeCopyFile(args as any, this.config);
      
      case 'move_file':
        return await executeMoveFile(args as any, this.config);
      
      case 'get_file_info':
        return await executeGetFileInfo(args as any, this.config);
      
      // Archive & compression
      case 'compress_files':
        return await executeCompressFiles(args as any, this.config);
      
      case 'extract_archive':
        return await executeExtractArchive(args as any, this.config);
      
      // Network operations
      case 'http_request':
        return await executeHttpRequest(args as any, this.config);
      
      // Git operations
      case 'git_status':
        return await executeGitStatus(args as any, this.config);
      
      case 'git_diff':
        return await executeGitDiff(args as any, this.config);
      
      case 'git_log':
        return await executeGitLog(args as any, this.config);
      
      case 'git_branch':
        return await executeGitBranch(args as any, this.config);
      
      // System operations
      case 'system_info':
        return await executeSystemInfo(args as any, this.config);
      
      case 'list_processes':
        return await executeListProcesses(args as any, this.config);
      
      case 'kill_process':
        return await executeKillProcess(args as any, this.config);
      
      // Database operations
      case 'database_query':
        return await executeDatabaseQuery(args as any, this.config);
      
      // Image processing
      case 'image_process':
        return await executeImageProcess(args as any, this.config);
      
      // PDF manipulation
      case 'pdf_manipulate':
        return await executePdfManipulate(args as any, this.config);
      
      // Encryption/Decryption
      case 'encrypt_decrypt':
        return await executeEncryptDecrypt(args as any, this.config);
      
      // Task scheduling
      case 'schedule_task':
        return await executeScheduleTask(args as any, this.config);
      
      // Notifications
      case 'send_notification':
        return await executeSendNotification(args as any, this.config);
      
      // Text processing
      case 'text_process':
        return await executeTextProcess(args as any, this.config);
      
      // Data processing
      case 'csv_process':
        return await executeCsvProcess(args as any, this.config);
      
      case 'json_process':
        return await executeJsonProcess(args as any, this.config);
      
      // Web scraping
      case 'web_scrape':
        return await executeWebScrape(args as any, this.config);
      
      // Docker management
      case 'docker_manage':
        return await executeDockerManage(args as any, this.config);
      
      // Cloud storage
      case 'cloud_storage':
        return await executeCloudStorage(args as any, this.config);
      
      // Package management
      case 'package_manager':
        return await executePackageManager(args as any, this.config);
      
      // Code formatting
      case 'code_format':
        return await executeCodeFormat(args as any, this.config);
      
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  }

  /**
   * Handles errors and formats error responses
   * @param error - The error that occurred
   * @param toolName - Name of the tool that failed
   * @param input - The input that caused the error
   * @returns Formatted error response
   */
  private handleError(error: unknown, toolName: string, input?: unknown): never {
    // Classify the error into a WorkspaceError
    const workspaceError = classifyError(error, toolName);
    
    // Log the error with full context
    logError(this.logger, workspaceError, toolName, input);

    // Map WorkspaceError codes to MCP error codes
    let mcpErrorCode = ErrorCode.InternalError;
    
    switch (workspaceError.code) {
      case WorkspaceErrorCode.SECURITY_VIOLATION:
      case WorkspaceErrorCode.NOT_FOUND:
      case WorkspaceErrorCode.READ_ONLY_MODE:
      case WorkspaceErrorCode.COMMAND_NOT_ALLOWED:
      case WorkspaceErrorCode.PATCH_FAILED:
        mcpErrorCode = ErrorCode.InvalidRequest;
        break;
      
      case WorkspaceErrorCode.INVALID_INPUT:
        mcpErrorCode = ErrorCode.InvalidParams;
        break;
      
      case WorkspaceErrorCode.COMMAND_TIMEOUT:
      case WorkspaceErrorCode.FILESYSTEM_ERROR:
      case WorkspaceErrorCode.UNEXPECTED_ERROR:
        mcpErrorCode = ErrorCode.InternalError;
        break;
    }

    // Format user-friendly message
    const userMessage = formatErrorForUser(workspaceError);

    throw new McpError(mcpErrorCode, userMessage);
  }

  /**
   * Starts the MCP server listening on stdio
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.logger.info('MCP Workspace Server started and listening on stdio');
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const server = new WorkspaceMCPServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP Workspace Server:', error);
    process.exit(1);
  }
}

// Start the server
main();
