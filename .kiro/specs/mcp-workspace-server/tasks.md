# Implementation Plan

- [x] 1. Initialize project structure and dependencies





  - Create package.json with TypeScript, Node.js, and MCP SDK dependencies
  - Set up tsconfig.json with strict type checking
  - Create directory structure: src/, src/tools/, src/utils/
  - Install dependencies: @modelcontextprotocol/sdk, typescript, @types/node
  - Install dev dependencies: vitest, fast-check, @types/fast-check
  - Configure build scripts in package.json
  - _Requirements: 12.1, 12.5_

- [x] 2. Implement configuration module





  - Create src/config.ts with ServerConfig interface
  - Implement loadConfig() function to read environment variables
  - Add validation for configuration values
  - Set appropriate defaults (workspace root = cwd, timeout = 300000ms)
  - Export typed config object
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 12.2, 12.3_

- [x] 2.1 Write unit tests for configuration loading


  - Test with various environment variable combinations
  - Test default values when env vars are missing
  - Test parsing of comma-separated command lists
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 3. Implement logging utility





  - Create src/utils/logging.ts with Logger class
  - Implement log levels: debug, info, warn, error
  - Add structured logging with metadata support
  - Respect MCP_LOG_LEVEL configuration
  - _Requirements: 8.5, 11.5_

- [x] 4. Implement path security utilities





  - Create src/utils/pathUtils.ts
  - Implement resolveSafePath() function with path validation
  - Implement isPathSafe() helper function
  - Implement normalizePath() to handle symbolic links
  - Add comprehensive path traversal detection (../, absolute paths, symlinks)
  - Throw descriptive errors for security violations
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 4.1 Write unit tests for path utilities


  - Test resolveSafePath with various valid paths
  - Test edge cases: empty paths, root path, deeply nested paths
  - Test specific traversal attempts: ../, absolute paths
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 4.2 Write property test for path sandboxing


  - **Property 1: Universal path sandboxing**
  - **Validates: Requirements 1.4, 2.2, 3.3, 4.4, 5.3, 6.3, 9.1, 9.2**
  - Generate various malicious paths and verify all are rejected
  - _Requirements: 1.4, 2.2, 3.3, 4.4, 5.3, 6.3, 9.1, 9.2_

- [x] 5. Implement file system utilities





  - Create src/utils/fsUtils.ts with FileInfo interface
  - Implement listDirectory() function (recursive and non-recursive)
  - Implement readFileContent() function
  - Implement writeFileAtomic() function with temp file + rename
  - Implement deleteFileOrDir() function
  - Implement ensureDirectory() function
  - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2, 3.5, 4.1, 4.2, 4.3, 5.1_

- [x] 5.1 Write unit tests for file system utilities


  - Test atomic write with simulated failures
  - Test directory listing with specific structures
  - Test file reading with various encodings
  - _Requirements: 1.1, 2.1, 3.1, 3.5_


- [x] 5.2 Write property test for write-read round trip

  - **Property 5: Write-read round trip**
  - **Validates: Requirements 3.1**
  - Generate random paths and content, write then read, verify content matches
  - _Requirements: 3.1_

- [x] 5.3 Write property test for atomic writes


  - **Property 8: Atomic write operations**
  - **Validates: Requirements 3.5**
  - Test that write failures leave no partial content
  - _Requirements: 3.5_

- [x] 6. Implement list_files tool





  - Create src/tools/listFiles.ts
  - Define ListFilesInput and ListFilesOutput interfaces
  - Implement tool handler with path validation using resolveSafePath
  - Support recursive and non-recursive listing
  - Return file metadata: name, relativePath, type, size, lastModified
  - Handle errors: security violations, not found
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 6.1 Write property test for file listing completeness


  - **Property 2: File listing completeness**
  - **Validates: Requirements 1.1**
  - Generate random directory structures, verify all entries returned with correct metadata
  - _Requirements: 1.1_

- [x] 6.2 Write property test for recursive listing


  - **Property 3: Recursive listing completeness**
  - **Validates: Requirements 1.2**
  - Generate nested directories, verify all nested items included
  - _Requirements: 1.2_

- [x] 7. Implement read_file tool





  - Create src/tools/readFile.ts
  - Define ReadFileInput and ReadFileOutput interfaces
  - Implement tool handler with path validation
  - Read file as UTF-8 and return content with metadata
  - Handle errors: security violations, not found, binary files
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7.1 Write property test for file read completeness


  - **Property 4: File read completeness**
  - **Validates: Requirements 2.1**
  - Generate random files, read them, verify content and metadata correct
  - _Requirements: 2.1_

- [x] 8. Implement write_file tool





  - Create src/tools/writeFile.ts
  - Define WriteFileInput and WriteFileOutput interfaces
  - Implement tool handler with path validation
  - Support createDirectories option to create parent directories
  - Use writeFileAtomic for atomic writes
  - Check read-only mode and reject if enabled
  - Return path, bytesWritten, and created status
  - Handle errors: security violations, read-only mode
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8.1 Write property test for parent directory creation


  - **Property 6: Parent directory creation**
  - **Validates: Requirements 3.2**
  - Generate nested paths, write files, verify all parent directories created
  - _Requirements: 3.2_

- [x] 8.2 Write property test for read-only mode enforcement


  - **Property 7: Read-only mode enforcement**
  - **Validates: Requirements 3.4, 4.5, 5.4, 6.5, 8.4**
  - Test various write operations in read-only mode, verify all rejected
  - _Requirements: 3.4, 4.5, 5.4, 6.5, 8.4_

- [x] 9. Implement delete_file tool





  - Create src/tools/deleteFile.ts
  - Define DeleteFileInput and DeleteFileOutput interfaces
  - Implement tool handler with path validation
  - Support deleting files and empty directories only
  - Check read-only mode and reject if enabled
  - Return path, deleted status, and type
  - Handle errors: security violations, non-empty directory, read-only mode
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9.1 Write property test for file deletion


  - **Property 9: File deletion verification**
  - **Validates: Requirements 4.1**
  - Create random files, delete them, verify they no longer exist
  - _Requirements: 4.1_

- [x] 9.2 Write property test for empty directory deletion


  - **Property 10: Empty directory deletion**
  - **Validates: Requirements 4.2**
  - Create empty directories, delete them, verify success
  - _Requirements: 4.2_

- [x] 9.3 Write property test for non-empty directory protection


  - **Property 11: Non-empty directory protection**
  - **Validates: Requirements 4.3**
  - Create directories with content, verify deletion rejected
  - _Requirements: 4.3_

- [x] 10. Implement create_folder tool





  - Create src/tools/createFolder.ts
  - Define CreateFolderInput and CreateFolderOutput interfaces
  - Implement tool handler with path validation
  - Create directory with recursive option (create parents)
  - Check read-only mode and reject if enabled
  - Return path and created status
  - Handle errors: security violations, read-only mode
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10.1 Write property test for directory creation


  - **Property 12: Directory creation with parents**
  - **Validates: Requirements 5.1**
  - Generate nested paths, create directories, verify all parents created
  - _Requirements: 5.1_

- [x] 10.2 Write property test for directory creation idempotence

  - **Property 13: Directory creation idempotence**
  - **Validates: Requirements 5.2**
  - Create same directory multiple times, verify all succeed
  - _Requirements: 5.2_

- [x] 11. Implement apply_patch tool





  - Create src/tools/applyPatch.ts
  - Define ApplyPatchInput and ApplyPatchOutput interfaces
  - Implement simple patch format parser: <<<OLD\n...\n===\n...\n>>>NEW
  - Implement tool handler with path validation
  - Read current file, apply patch, write updated file
  - Check read-only mode and reject if enabled
  - Return path, oldSize, and newSize
  - Handle errors: security violations, patch mismatch, not found, read-only mode
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11.1 Write property test for patch application


  - **Property 14: Patch application correctness**
  - **Validates: Requirements 6.1**
  - Generate random files and patches, apply them, verify correct transformation
  - _Requirements: 6.1_

- [x] 11.2 Write property test for invalid patch rejection


  - **Property 15: Invalid patch rejection**
  - **Validates: Requirements 6.2**
  - Generate mismatched patches, verify rejection with clear errors
  - _Requirements: 6.2_

- [x] 12. Implement run_command tool





  - Create src/tools/runCommand.ts
  - Define RunCommandInput and RunCommandOutput interfaces
  - Implement tool handler with command allowlist validation
  - Use child_process.spawn with array arguments (prevent injection)
  - Support cwd parameter (validated with resolveSafePath)
  - Implement timeout mechanism
  - Collect stdout, stderr, and exit code
  - Return exitCode, stdout, stderr, and timedOut flag
  - Handle errors: command not allowed, timeout, execution failures
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12.1 Write property test for allowed command execution


  - **Property 16: Allowed command execution**
  - **Validates: Requirements 7.1**
  - Test various allowed commands, verify execution and output capture
  - _Requirements: 7.1_

- [x] 12.2 Write property test for disallowed command rejection


  - **Property 17: Disallowed command rejection**
  - **Validates: Requirements 7.2**
  - Test various disallowed commands, verify rejection
  - _Requirements: 7.2_

- [x] 12.3 Write property test for command working directory


  - **Property 18: Command working directory**
  - **Validates: Requirements 7.3**
  - Test commands with various cwd values, verify correct execution location
  - _Requirements: 7.3_

- [x] 12.4 Write property test for command timeout


  - **Property 19: Command timeout enforcement**
  - **Validates: Requirements 7.4**
  - Test long-running commands, verify timeout and termination
  - _Requirements: 7.4_

- [x] 12.5 Write property test for command argument safety


  - **Property 20: Command argument safety**
  - **Validates: Requirements 7.5**
  - Test various malicious argument patterns, verify safe handling
  - _Requirements: 7.5_

- [x] 13. Implement MCP server setup





  - Create src/index.ts as main entry point
  - Import MCP SDK and create Server instance
  - Load configuration using loadConfig()
  - Initialize logger
  - Register all tools with their schemas:
    - list_files
    - read_file
    - write_file
    - delete_file
    - create_folder
    - apply_patch
    - run_command
  - Implement tool request router
  - Set up error handling middleware
  - Start server listening on stdio
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 13.1 Write property test for MCP protocol response format


  - **Property 21: MCP protocol response format**
  - **Validates: Requirements 10.2**
  - Test various tool invocations, verify responses properly formatted
  - _Requirements: 10.2_

- [x] 13.2 Write property test for error response format


  - **Property 22: Error response format**
  - **Validates: Requirements 10.3**
  - Trigger various errors, verify error responses properly formatted
  - _Requirements: 10.3_

- [x] 13.3 Write property test for malformed request handling


  - **Property 23: Malformed request handling**
  - **Validates: Requirements 10.4**
  - Send various malformed requests, verify server handles gracefully
  - _Requirements: 10.4_

- [x] 14. Implement comprehensive error handling





  - Add error classification logic (security, not found, read-only, etc.)
  - Implement error code constants
  - Create error response formatter
  - Add error logging with full context
  - Ensure all tools use consistent error handling
  - Implement user-friendly error messages
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 14.1 Write property test for security error messages


  - **Property 24: Security error messages**
  - **Validates: Requirements 11.1**
  - Trigger security violations, verify error messages are clear
  - _Requirements: 11.1_

- [x] 14.2 Write property test for not-found error messages


  - **Property 25: Not-found error messages**
  - **Validates: Requirements 11.2**
  - Test operations on non-existent files, verify error messages
  - _Requirements: 11.2_

- [x] 14.3 Write property test for read-only error messages


  - **Property 26: Read-only error messages**
  - **Validates: Requirements 11.3**
  - Test write operations in read-only mode, verify error messages
  - _Requirements: 11.3_

- [x] 14.4 Write property test for command failure information


  - **Property 27: Command failure information**
  - **Validates: Requirements 11.4**
  - Run failing commands, verify exit code and output captured
  - _Requirements: 11.4_

- [x] 14.5 Write property test for unexpected error handling


  - **Property 28: Unexpected error handling**
  - **Validates: Requirements 11.5**
  - Trigger unexpected errors, verify logging and user-friendly messages
  - _Requirements: 11.5_

- [x] 15. Create comprehensive README





  - Write overview section explaining the server's purpose
  - Document installation steps (clone, npm install, npm run build)
  - Document all environment variables with examples
  - Provide running instructions with example commands
  - Show example MCP client configuration (JSON format)
  - Include usage examples: creating projects, writing files, running commands
  - Add security notes about sandboxing and path safety
  - Document the custom patch format
  - Add troubleshooting section
  - _Requirements: All requirements (documentation)_

- [x] 16. Final checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
