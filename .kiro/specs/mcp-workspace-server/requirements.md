# Requirements Document

## Introduction

The MCP Workspace Server is a Model Context Protocol (MCP) server that gives LLMs like ChatGPT, Claude, Gemini, and others the ability to work with files and build projects just like an AI coding assistant. When users ask these LLMs to "build a web app" or "create a TypeScript project," this server provides the controlled, sandboxed file system access they need to actually create, modify, and manage project files. The server enables LLMs to read, write, and manage files within a designated workspace folder, and optionally execute safe build commands (like npm install or npm test), all while maintaining strict security boundaries to prevent unauthorized access outside the workspace.

## Glossary

- **MCP Server**: A server implementing the Model Context Protocol that exposes tools/capabilities to LLM clients over stdio
- **Workspace Root**: The designated folder that serves as the security boundary for all file operations
- **Sandboxing**: Security mechanism that restricts file operations to within the workspace root directory
- **Tool**: An MCP capability exposed to the LLM client (e.g., read_file, write_file)
- **Path Traversal**: A security vulnerability where an attacker attempts to access files outside the intended directory using relative paths like `../`
- **Stdio**: Standard input/output communication channel used for MCP protocol messages
- **Unified Diff**: A standard text format for representing differences between files

## Requirements

### Requirement 1

**User Story:** As an LLM client, I want to list files and directories in the workspace, so that I can understand the project structure before making changes.

#### Acceptance Criteria

1. WHEN the LLM requests to list files with a relative path THEN the MCP Server SHALL return all files and directories at that location with their names, relative paths, types, sizes, and last modified timestamps
2. WHEN the LLM requests a recursive listing THEN the MCP Server SHALL return all nested files and directories within the specified path
3. WHEN the LLM requests to list files without specifying a path THEN the MCP Server SHALL default to listing the workspace root directory
4. WHEN the LLM provides a path that attempts traversal outside the workspace THEN the MCP Server SHALL reject the request and return a security error
5. WHEN the LLM requests to list a non-existent directory THEN the MCP Server SHALL return a clear error message indicating the directory does not exist

### Requirement 2

**User Story:** As an LLM client, I want to read file contents from the workspace, so that I can analyze existing code and make informed modifications.

#### Acceptance Criteria

1. WHEN the LLM requests to read a file with a valid relative path THEN the MCP Server SHALL return the file content as UTF-8 text along with metadata including path, size, and last modified timestamp
2. WHEN the LLM attempts to read a file outside the workspace boundary THEN the MCP Server SHALL reject the request and return a security error
3. WHEN the LLM requests to read a non-existent file THEN the MCP Server SHALL return a clear error message indicating the file does not exist
4. WHEN the LLM requests to read a binary file THEN the MCP Server SHALL attempt to return the content or provide an appropriate error if the content cannot be represented as UTF-8

### Requirement 3

**User Story:** As an LLM client, I want to create or overwrite files in the workspace, so that I can generate new code or update existing files.

#### Acceptance Criteria

1. WHEN the LLM writes content to a valid relative path THEN the MCP Server SHALL create or overwrite the file with the provided content and return the path, bytes written, and creation status
2. WHEN the LLM writes to a path where parent directories do not exist and createDirectories is true THEN the MCP Server SHALL create all necessary parent directories before writing the file
3. WHEN the LLM attempts to write to a path outside the workspace boundary THEN the MCP Server SHALL reject the request and return a security error
4. WHEN the MCP Server is configured in read-only mode THEN the MCP Server SHALL reject all write requests with a clear error message
5. WHEN the LLM writes a file THEN the MCP Server SHALL perform the write operation atomically to prevent partial writes in case of errors

### Requirement 4

**User Story:** As an LLM client, I want to delete files and empty directories from the workspace, so that I can clean up unnecessary files during project restructuring.

#### Acceptance Criteria

1. WHEN the LLM requests to delete a file with a valid relative path THEN the MCP Server SHALL remove the file and return the path, deletion status, and type
2. WHEN the LLM requests to delete an empty directory THEN the MCP Server SHALL remove the directory and return confirmation
3. WHEN the LLM requests to delete a non-empty directory THEN the MCP Server SHALL reject the request and return a clear error message indicating the directory is not empty
4. WHEN the LLM attempts to delete a path outside the workspace boundary THEN the MCP Server SHALL reject the request and return a security error
5. WHEN the MCP Server is configured in read-only mode THEN the MCP Server SHALL reject all delete requests with a clear error message

### Requirement 5

**User Story:** As an LLM client, I want to create directories in the workspace, so that I can organize project files into a proper structure.

#### Acceptance Criteria

1. WHEN the LLM requests to create a directory with a valid relative path THEN the MCP Server SHALL create the directory and all necessary parent directories and return the path and creation status
2. WHEN the LLM requests to create a directory that already exists THEN the MCP Server SHALL return success without error
3. WHEN the LLM attempts to create a directory outside the workspace boundary THEN the MCP Server SHALL reject the request and return a security error
4. WHEN the MCP Server is configured in read-only mode THEN the MCP Server SHALL reject all directory creation requests with a clear error message

### Requirement 6

**User Story:** As an LLM client, I want to apply patches to existing files, so that I can make targeted modifications without rewriting entire files.

#### Acceptance Criteria

1. WHEN the LLM provides a valid patch for an existing file THEN the MCP Server SHALL apply the patch and return the path, old size, and new size
2. WHEN the LLM provides a patch that cannot be applied cleanly THEN the MCP Server SHALL reject the patch and return a descriptive error message explaining why the patch failed
3. WHEN the LLM attempts to patch a file outside the workspace boundary THEN the MCP Server SHALL reject the request and return a security error
4. WHEN the LLM attempts to patch a non-existent file THEN the MCP Server SHALL return a clear error message indicating the file does not exist
5. WHEN the MCP Server is configured in read-only mode THEN the MCP Server SHALL reject all patch requests with a clear error message

### Requirement 7

**User Story:** As an LLM client, I want to execute allowed build and test commands in the workspace, so that I can validate generated code and build projects.

#### Acceptance Criteria

1. WHEN the LLM requests to run a command that is in the allowed commands list THEN the MCP Server SHALL execute the command in the workspace directory and return the exit code, stdout, and stderr
2. WHEN the LLM requests to run a command that is not in the allowed commands list THEN the MCP Server SHALL reject the request and return a clear error message
3. WHEN the LLM specifies a working directory relative to the workspace root THEN the MCP Server SHALL execute the command in that directory
4. WHEN a command execution exceeds the configured timeout THEN the MCP Server SHALL terminate the process and return the output collected up to that point along with a timeout indication
5. WHEN the LLM requests to run a command with arguments THEN the MCP Server SHALL pass the arguments safely to prevent command injection

### Requirement 8

**User Story:** As a system administrator, I want to configure the workspace root and security settings via environment variables, so that I can control the server's behavior without modifying code.

#### Acceptance Criteria

1. WHEN the MCP_WORKSPACE_ROOT environment variable is set THEN the MCP Server SHALL use that path as the workspace root directory
2. WHEN the MCP_WORKSPACE_ROOT environment variable is not set THEN the MCP Server SHALL default to the current working directory as the workspace root
3. WHEN the MCP_ALLOWED_COMMANDS environment variable is set THEN the MCP Server SHALL parse the comma-separated list and allow only those commands for execution
4. WHEN the MCP_READ_ONLY environment variable is set to true THEN the MCP Server SHALL disable all write, delete, and patch operations
5. WHEN the MCP_LOG_LEVEL environment variable is set THEN the MCP Server SHALL use that log level for all logging operations

### Requirement 9

**User Story:** As a security-conscious user, I want all file operations to be strictly sandboxed to the workspace root, so that the LLM cannot access or modify files outside the designated workspace.

#### Acceptance Criteria

1. WHEN any tool receives a file path parameter THEN the MCP Server SHALL resolve and validate the path against the workspace root before performing any operation
2. WHEN a path resolution results in a location outside the workspace root THEN the MCP Server SHALL reject the operation and return a security error
3. WHEN a path contains traversal sequences like "../" that would escape the workspace THEN the MCP Server SHALL detect and reject the path
4. WHEN a path is an absolute path outside the workspace root THEN the MCP Server SHALL reject the path
5. WHEN a path contains symbolic links that point outside the workspace THEN the MCP Server SHALL reject the path

### Requirement 10

**User Story:** As an MCP client developer, I want the server to communicate over stdio using the MCP protocol, so that I can integrate it with any MCP-compatible client.

#### Acceptance Criteria

1. WHEN the MCP Server starts THEN the MCP Server SHALL listen for MCP protocol messages on stdin and write responses to stdout
2. WHEN the MCP Server receives a tool invocation request THEN the MCP Server SHALL execute the requested tool and return the result in MCP protocol format
3. WHEN the MCP Server encounters an error during tool execution THEN the MCP Server SHALL return a properly formatted error response with a descriptive message
4. WHEN the MCP Server receives a malformed request THEN the MCP Server SHALL return an error response without crashing
5. WHEN the MCP Server starts THEN the MCP Server SHALL register all available tools with their schemas for client discovery

### Requirement 11

**User Story:** As a developer, I want clear error messages for all failure scenarios, so that I can understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN any operation fails due to a security violation THEN the MCP Server SHALL return an error message that clearly indicates a path is outside the workspace
2. WHEN any operation fails due to a missing file or directory THEN the MCP Server SHALL return an error message that clearly indicates what was not found
3. WHEN any operation fails due to read-only mode THEN the MCP Server SHALL return an error message that clearly indicates write operations are disabled
4. WHEN a command execution fails THEN the MCP Server SHALL return the exit code and both stdout and stderr to help diagnose the issue
5. WHEN any unexpected error occurs THEN the MCP Server SHALL log the error details and return a user-friendly error message to the client

### Requirement 12

**User Story:** As a developer, I want the project to be built with TypeScript and include proper type definitions, so that the codebase is maintainable and type-safe.

#### Acceptance Criteria

1. WHEN the project is built using npm run build THEN the TypeScript compiler SHALL compile all source files without errors
2. WHEN any function is defined THEN the function SHALL have explicit type annotations for parameters and return values
3. WHEN configuration is loaded THEN the configuration object SHALL have a typed interface defining all available options
4. WHEN tool schemas are defined THEN the schemas SHALL use TypeScript types that match the MCP protocol requirements
5. WHEN the project is structured THEN the source code SHALL be organized into logical modules including tools, utils, and configuration
