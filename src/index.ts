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
        name: 'mcp-workspace-server',
        version: '1.0.0',
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
          listFilesTool,
          readFileTool,
          writeFileTool,
          deleteFileTool,
          createFolderTool,
          applyPatchTool,
          runCommandTool,
        ],
      };
    });

    this.logger.debug('Registered 7 tools');
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
