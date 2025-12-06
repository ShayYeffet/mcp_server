# Design Document

## Overview

The MCP Workspace Server is a TypeScript-based Node.js application that implements the Model Context Protocol (MCP) to provide LLMs with secure, sandboxed file system access. The server exposes a set of tools (capabilities) that allow LLMs to perform common file operations and execute safe build commands within a designated workspace directory.

The architecture follows a modular design with clear separation between:
- MCP protocol handling and server setup
- Tool implementations (file operations)
- Security and path validation utilities
- Configuration management
- Logging and error handling

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client (LLM)                     │
│              (ChatGPT, Claude, Gemini, etc.)            │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol over stdio
                     │ (JSON-RPC messages)
┌────────────────────▼────────────────────────────────────┐
│                  MCP Server (index.ts)                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Tool Registry & Request Router           │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────┴──────────────────────────┐  │
│  │                    Tools Layer                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │list_files│  │read_file │  │write_file    │   │  │
│  │  └──────────┘  └──────────┘  └──────────────┘   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │delete_   │  │create_   │  │apply_patch   │   │  │
│  │  │file      │  │folder    │  │              │   │  │
│  │  └──────────┘  └──────────┘  └──────────────┘   │  │
│  │  ┌──────────┐                                    │  │
│  │  │run_      │                                    │  │
│  │  │command   │                                    │  │
│  │  └──────────┘                                    │  │
│  └───────────────────────┬──────────────────────────┘  │
│                          │                              │
│  ┌───────────────────────▼──────────────────────────┐  │
│  │              Utilities Layer                     │  │
│  │  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ pathUtils    │  │ fsUtils      │             │  │
│  │  │ (sandboxing) │  │ (file ops)   │             │  │
│  │  └──────────────┘  └──────────────┘             │  │
│  │  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ config       │  │ logging      │             │  │
│  │  └──────────────┘  └──────────────┘             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Workspace Directory  │
              │   (Sandboxed Access)  │
              └───────────────────────┘
```

### Communication Flow

1. **MCP Client → Server**: Client sends JSON-RPC request over stdin with tool name and parameters
2. **Server → Tool**: Server validates request, routes to appropriate tool handler
3. **Tool → Utilities**: Tool uses path validation and file system utilities
4. **Utilities → Filesystem**: After security checks, operations are performed on workspace
5. **Server → Client**: Server sends JSON-RPC response over stdout with results or errors

### Technology Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js LTS (v18+)
- **Package Manager**: npm
- **MCP SDK**: @modelcontextprotocol/sdk
- **Protocol**: Model Context Protocol over stdio (JSON-RPC)
- **Build Tool**: TypeScript compiler (tsc)

## Components and Interfaces

### 1. Configuration Module (`config.ts`)

**Purpose**: Centralized configuration management from environment variables.

```typescript
interface ServerConfig {
  workspaceRoot: string;
  allowedCommands: string[];
  readOnly: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  commandTimeout: number;
}

function loadConfig(): ServerConfig;
```

**Configuration Sources**:
- `MCP_WORKSPACE_ROOT`: Workspace directory path (default: current working directory)
- `MCP_ALLOWED_COMMANDS`: Comma-separated list of allowed commands
- `MCP_READ_ONLY`: Boolean flag to disable write operations
- `MCP_LOG_LEVEL`: Logging verbosity level
- `MCP_COMMAND_TIMEOUT`: Command execution timeout in milliseconds (default: 300000)

### 2. Path Utilities Module (`utils/pathUtils.ts`)

**Purpose**: Security-critical path validation and sandboxing.

```typescript
/**
 * Resolves a requested path relative to workspace root and validates
 * it stays within the workspace boundary.
 * @throws Error if path escapes workspace
 */
function resolveSafePath(workspaceRoot: string, requestedPath: string): string;

/**
 * Checks if a resolved path is within the workspace boundary
 */
function isPathSafe(workspaceRoot: string, resolvedPath: string): boolean;

/**
 * Normalizes a path and resolves symbolic links
 */
function normalizePath(path: string): string;
```

**Security Implementation**:
1. Join workspace root with requested path
2. Resolve to absolute path (handles `.`, `..`, symbolic links)
3. Normalize path separators
4. Verify resolved path starts with workspace root
5. Throw descriptive error if validation fails

### 3. File System Utilities Module (`utils/fsUtils.ts`)

**Purpose**: Helper functions for common file operations.

```typescript
interface FileInfo {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
}

async function listDirectory(
  dirPath: string,
  recursive: boolean
): Promise<FileInfo[]>;

async function readFileContent(filePath: string): Promise<{
  content: string;
  size: number;
  lastModified: string;
}>;

async function writeFileAtomic(
  filePath: string,
  content: string,
  createDirs: boolean
): Promise<{ bytesWritten: number; created: boolean }>;

async function deleteFileOrDir(path: string): Promise<{
  deleted: boolean;
  type: 'file' | 'directory';
}>;

async function ensureDirectory(dirPath: string): Promise<boolean>;
```

### 4. Logging Module (`utils/logging.ts`)

**Purpose**: Structured logging with configurable levels.

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  constructor(level: LogLevel);
  debug(message: string, meta?: object): void;
  info(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  error(message: string, meta?: object): void;
}
```

### 5. Tool Implementations (`tools/*.ts`)

Each tool is implemented as a separate module with a consistent interface:

```typescript
interface ToolHandler<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: object; // JSON Schema
  execute(input: TInput, config: ServerConfig): Promise<TOutput>;
}
```

#### Tool: `list_files`

```typescript
interface ListFilesInput {
  path?: string;
  recursive?: boolean;
}

interface ListFilesOutput {
  files: FileInfo[];
  path: string;
}
```

#### Tool: `read_file`

```typescript
interface ReadFileInput {
  path: string;
}

interface ReadFileOutput {
  content: string;
  path: string;
  size: number;
  lastModified: string;
}
```

#### Tool: `write_file`

```typescript
interface WriteFileInput {
  path: string;
  content: string;
  createDirectories?: boolean;
}

interface WriteFileOutput {
  path: string;
  bytesWritten: number;
  created: boolean;
}
```

#### Tool: `delete_file`

```typescript
interface DeleteFileInput {
  path: string;
}

interface DeleteFileOutput {
  path: string;
  deleted: boolean;
  type: 'file' | 'directory';
}
```

#### Tool: `create_folder`

```typescript
interface CreateFolderInput {
  path: string;
}

interface CreateFolderOutput {
  path: string;
  created: boolean;
}
```

#### Tool: `apply_patch`

```typescript
interface ApplyPatchInput {
  path: string;
  patch: string; // Simple replace format: "<<<OLD\n...\n===\n...\n>>>NEW"
}

interface ApplyPatchOutput {
  path: string;
  oldSize: number;
  newSize: number;
}
```

**Patch Format**: To simplify implementation, we'll use a custom format:
```
<<<OLD
old content to find
===
new content to replace with
>>>NEW
```

#### Tool: `run_command`

```typescript
interface RunCommandInput {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}

interface RunCommandOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}
```

### 6. MCP Server (`index.ts`)

**Purpose**: Main entry point, MCP server initialization, and tool registration.

```typescript
class WorkspaceMCPServer {
  private server: Server;
  private config: ServerConfig;
  private logger: Logger;

  constructor();
  
  private registerTools(): void;
  private handleToolCall(name: string, args: unknown): Promise<unknown>;
  private handleError(error: Error): ErrorResponse;
  
  async start(): Promise<void>;
}
```

**Initialization Flow**:
1. Load configuration from environment
2. Initialize logger
3. Create MCP server instance
4. Register all tools with schemas
5. Set up error handlers
6. Start listening on stdio

## Data Models

### Configuration Model

```typescript
interface ServerConfig {
  workspaceRoot: string;        // Absolute path to workspace
  allowedCommands: string[];    // Whitelist of executable commands
  readOnly: boolean;            // Disable write operations
  logLevel: LogLevel;           // Logging verbosity
  commandTimeout: number;       // Max command execution time (ms)
}
```

### File Information Model

```typescript
interface FileInfo {
  name: string;                 // File or directory name
  relativePath: string;         // Path relative to workspace root
  type: 'file' | 'directory';   // Entry type
  size?: number;                // Size in bytes (files only)
  lastModified?: string;        // ISO 8601 timestamp
}
```

### Error Model

```typescript
interface MCPError {
  code: string;                 // Error code (e.g., 'SECURITY_VIOLATION')
  message: string;              // Human-readable error message
  details?: object;             // Additional error context
}
```

**Error Codes**:
- `SECURITY_VIOLATION`: Path outside workspace
- `NOT_FOUND`: File or directory not found
- `READ_ONLY_MODE`: Write operation in read-only mode
- `COMMAND_NOT_ALLOWED`: Command not in allowlist
- `COMMAND_TIMEOUT`: Command exceeded timeout
- `INVALID_INPUT`: Invalid parameters
- `FILESYSTEM_ERROR`: General file system error
- `PATCH_FAILED`: Patch could not be applied


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Universal path sandboxing

*For any* tool and any path parameter, when the resolved path falls outside the workspace root, the operation should be rejected with a security error.

**Validates: Requirements 1.4, 2.2, 3.3, 4.4, 5.3, 6.3, 9.1, 9.2**

### Property 2: File listing completeness

*For any* directory in the workspace, listing that directory should return all files and directories it contains, each with name, relative path, type, size (for files), and last modified timestamp.

**Validates: Requirements 1.1**

### Property 3: Recursive listing completeness

*For any* directory in the workspace, listing with recursive=true should return all nested files and directories at any depth within that directory.

**Validates: Requirements 1.2**

### Property 4: File read completeness

*For any* file in the workspace, reading that file should return its complete content as UTF-8 text along with path, size, and last modified metadata.

**Validates: Requirements 2.1**

### Property 5: Write-read round trip

*For any* valid path and content, writing the content to that path then immediately reading it back should return the exact same content.

**Validates: Requirements 3.1**

### Property 6: Parent directory creation

*For any* nested path where parent directories don't exist, writing a file with createDirectories=true should create all necessary parent directories before writing the file.

**Validates: Requirements 3.2**

### Property 7: Read-only mode enforcement

*For any* write, delete, patch, or create operation, when the server is in read-only mode, the operation should be rejected with a clear error message.

**Validates: Requirements 3.4, 4.5, 5.4, 6.5, 8.4**

### Property 8: Atomic write operations

*For any* file write operation, either the complete content is written successfully or no partial content exists (atomicity guarantee).

**Validates: Requirements 3.5**

### Property 9: File deletion verification

*For any* file in the workspace, deleting that file should result in the file no longer existing in the filesystem.

**Validates: Requirements 4.1**

### Property 10: Empty directory deletion

*For any* empty directory in the workspace, deleting that directory should succeed and the directory should no longer exist.

**Validates: Requirements 4.2**

### Property 11: Non-empty directory protection

*For any* directory containing files or subdirectories, attempting to delete that directory should be rejected with a clear error message.

**Validates: Requirements 4.3**

### Property 12: Directory creation with parents

*For any* nested directory path, creating that directory should create all necessary parent directories and the target directory.

**Validates: Requirements 5.1**

### Property 13: Directory creation idempotence

*For any* directory path, creating the directory multiple times should succeed each time without error (idempotent operation).

**Validates: Requirements 5.2**

### Property 14: Patch application correctness

*For any* file and valid patch, applying the patch should transform the file content according to the patch specification and return correct old and new sizes.

**Validates: Requirements 6.1**

### Property 15: Invalid patch rejection

*For any* file and patch where the old content doesn't match, the patch application should be rejected with a descriptive error explaining the mismatch.

**Validates: Requirements 6.2**

### Property 16: Allowed command execution

*For any* command in the allowed commands list, executing that command should run it in the workspace and return exit code, stdout, and stderr.

**Validates: Requirements 7.1**

### Property 17: Disallowed command rejection

*For any* command not in the allowed commands list, attempting to execute it should be rejected with a clear error message.

**Validates: Requirements 7.2**

### Property 18: Command working directory

*For any* allowed command and relative working directory path, the command should execute in that directory relative to the workspace root.

**Validates: Requirements 7.3**

### Property 19: Command timeout enforcement

*For any* command that runs longer than the configured timeout, the process should be terminated and the response should indicate a timeout occurred.

**Validates: Requirements 7.4**

### Property 20: Command argument safety

*For any* command with arguments, the arguments should be passed safely without allowing command injection attacks.

**Validates: Requirements 7.5**

### Property 21: MCP protocol response format

*For any* tool invocation, the response should be properly formatted according to MCP protocol specifications.

**Validates: Requirements 10.2**

### Property 22: Error response format

*For any* error during tool execution, the error response should be properly formatted with a descriptive message according to MCP protocol.

**Validates: Requirements 10.3**

### Property 23: Malformed request handling

*For any* malformed or invalid request, the server should return an error response without crashing.

**Validates: Requirements 10.4**

### Property 24: Security error messages

*For any* operation that fails due to path traversal or security violation, the error message should clearly indicate the path is outside the workspace.

**Validates: Requirements 11.1**

### Property 25: Not-found error messages

*For any* operation on a non-existent file or directory, the error message should clearly indicate what was not found.

**Validates: Requirements 11.2**

### Property 26: Read-only error messages

*For any* write operation in read-only mode, the error message should clearly indicate that write operations are disabled.

**Validates: Requirements 11.3**

### Property 27: Command failure information

*For any* command that fails (non-zero exit code), the response should include the exit code, stdout, and stderr to aid debugging.

**Validates: Requirements 11.4**

### Property 28: Unexpected error handling

*For any* unexpected error, the server should log the error details and return a user-friendly error message without exposing internal details.

**Validates: Requirements 11.5**

## Error Handling

### Error Categories

1. **Security Errors** (`SECURITY_VIOLATION`)
   - Path traversal attempts
   - Access outside workspace
   - Symbolic link escapes
   - Response: Clear message indicating security boundary violation

2. **Not Found Errors** (`NOT_FOUND`)
   - File doesn't exist
   - Directory doesn't exist
   - Response: Specific message about what wasn't found

3. **Permission Errors** (`READ_ONLY_MODE`)
   - Write operations in read-only mode
   - Delete operations in read-only mode
   - Response: Clear message that writes are disabled

4. **Validation Errors** (`INVALID_INPUT`)
   - Missing required parameters
   - Invalid parameter types
   - Response: Specific message about validation failure

5. **Command Errors** (`COMMAND_NOT_ALLOWED`, `COMMAND_TIMEOUT`)
   - Command not in allowlist
   - Command execution timeout
   - Response: Clear message with command name and reason

6. **Filesystem Errors** (`FILESYSTEM_ERROR`)
   - Permission denied
   - Disk full
   - I/O errors
   - Response: User-friendly message with underlying cause

7. **Patch Errors** (`PATCH_FAILED`)
   - Old content doesn't match
   - Invalid patch format
   - Response: Descriptive message explaining why patch failed

### Error Handling Strategy

1. **Catch all errors** at tool execution boundary
2. **Classify errors** into appropriate categories
3. **Log errors** with full details (stack trace, context)
4. **Return user-friendly messages** to client (no internal details)
5. **Never crash** - always return proper error response
6. **Include context** - what operation, what path, what went wrong

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      path?: string;
      operation?: string;
      reason?: string;
    };
  };
}
```

## Testing Strategy

### Unit Testing

The project will use **Vitest** as the testing framework for unit tests. Unit tests will cover:

1. **Path Utilities**
   - Test `resolveSafePath` with various valid paths
   - Test edge cases: empty paths, root path, deeply nested paths
   - Test specific traversal attempts: `../`, absolute paths, symlinks

2. **File System Utilities**
   - Test atomic write with simulated failures
   - Test directory listing with specific structures
   - Test file reading with various encodings

3. **Configuration Loading**
   - Test with specific environment variable combinations
   - Test default values when env vars are missing
   - Test parsing of comma-separated command lists

4. **Tool Implementations**
   - Test each tool with specific valid inputs
   - Test error cases: missing files, invalid paths
   - Test tool response format compliance

5. **Error Handling**
   - Test specific error scenarios for each error code
   - Test error message formatting
   - Test that errors don't crash the server

### Property-Based Testing

The project will use **fast-check** for property-based testing in TypeScript. Property-based tests will:

- Run a minimum of **100 iterations** per property
- Use smart generators that constrain inputs to valid ranges
- Tag each test with the property number from this design document

**Property Test Implementation Requirements**:
- Each property-based test MUST include a comment: `// Property N: [property description]`
- Tests should generate random but valid inputs (paths, content, commands)
- Tests should verify the property holds across all generated inputs
- Tests should use appropriate generators:
  - `fc.string()` for file content
  - Custom path generators for valid relative paths
  - Custom generators for directory structures
  - `fc.array()` for command arguments

**Example Property Test Structure**:
```typescript
// Property 5: Write-read round trip
test('writing then reading returns same content', () => {
  fc.assert(
    fc.property(
      fc.tuple(validPathGenerator(), fc.string()),
      async ([path, content]) => {
        await writeFile(path, content);
        const result = await readFile(path);
        expect(result.content).toBe(content);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests will verify:
- Full MCP protocol communication over stdio
- Tool invocation through MCP server
- End-to-end workflows (create project, write files, run commands)
- Error propagation through the full stack

### Test Organization

```
tests/
├── unit/
│   ├── pathUtils.test.ts
│   ├── fsUtils.test.ts
│   ├── config.test.ts
│   └── tools/
│       ├── listFiles.test.ts
│       ├── readFile.test.ts
│       └── ...
├── property/
│   ├── sandboxing.property.test.ts
│   ├── fileOperations.property.test.ts
│   ├── commands.property.test.ts
│   └── errorHandling.property.test.ts
└── integration/
    ├── mcpProtocol.test.ts
    └── workflows.test.ts
```

## Security Considerations

### Path Traversal Prevention

1. **Always use `resolveSafePath`** before any filesystem operation
2. **Resolve symbolic links** to their real paths
3. **Normalize paths** to handle `.` and `..`
4. **Verify final path** starts with workspace root
5. **Reject on any violation** with clear error

### Command Injection Prevention

1. **Use allowlist** - only permit explicitly allowed commands
2. **Use spawn with array args** - never use shell string concatenation
3. **Validate command name** against allowlist before execution
4. **Pass arguments as array** - prevents shell interpretation
5. **Set working directory** explicitly - prevent directory traversal

### Read-Only Mode

1. **Check mode** at start of every write operation
2. **Fail fast** - reject before any filesystem access
3. **Clear error messages** - explain that writes are disabled
4. **Apply to all write operations** - write, delete, patch, create

### Resource Limits

1. **Command timeout** - prevent infinite-running processes
2. **Buffer limits** - prevent memory exhaustion from large outputs
3. **File size limits** - consider adding max file size for reads/writes
4. **Rate limiting** - consider adding request rate limits

## Deployment and Configuration

### Installation

```bash
npm install
npm run build
```

### Running the Server

```bash
# With environment variables
MCP_WORKSPACE_ROOT=/path/to/workspace \
MCP_ALLOWED_COMMANDS="npm install,npm test,npm run build" \
MCP_READ_ONLY=false \
MCP_LOG_LEVEL=info \
node dist/index.js
```

### MCP Client Configuration

Example configuration for an MCP client (e.g., in `mcp.json`):

```json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["/path/to/mcp-workspace-server/dist/index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "/path/to/project/workspace",
        "MCP_ALLOWED_COMMANDS": "npm install,npm test,npm run build,git status",
        "MCP_READ_ONLY": "false",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

### Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MCP_WORKSPACE_ROOT` | string | `process.cwd()` | Absolute path to workspace directory |
| `MCP_ALLOWED_COMMANDS` | string | `""` | Comma-separated list of allowed commands |
| `MCP_READ_ONLY` | boolean | `false` | Disable all write operations |
| `MCP_LOG_LEVEL` | string | `"info"` | Logging level: debug, info, warn, error |
| `MCP_COMMAND_TIMEOUT` | number | `300000` | Command timeout in milliseconds |

## Performance Considerations

1. **Async Operations**: All file operations use async/await for non-blocking I/O
2. **Streaming**: Consider streaming for large file reads/writes
3. **Caching**: Consider caching file metadata for repeated list operations
4. **Batch Operations**: Consider adding batch read/write tools for efficiency
5. **Memory Management**: Limit buffer sizes for command output

## Future Enhancements

1. **File watching** - Tool to watch for file changes
2. **Search capabilities** - Tool to search file contents
3. **Archive operations** - Tools to create/extract zip/tar files
4. **Git integration** - Tools for basic git operations
5. **Template support** - Tool to apply file templates
6. **Diff tool** - Tool to compare files
7. **File size limits** - Configurable max file sizes
8. **Batch operations** - Read/write multiple files in one call
