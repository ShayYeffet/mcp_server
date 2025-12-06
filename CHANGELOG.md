# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-06

### Added
- Initial release of MCP Workspace Server
- Secure sandboxed file system access for LLMs
- Seven core tools: list_files, read_file, write_file, delete_file, create_folder, apply_patch, run_command
- Comprehensive path traversal protection
- Command execution with allowlist security
- Read-only mode support
- Atomic file write operations
- Custom patch format for targeted file modifications
- Configurable logging with multiple levels
- Environment variable configuration
- Full TypeScript implementation with strict types
- Comprehensive test suite (109 tests)
- Property-based testing with fast-check
- Support for Claude Desktop, Cline, and other MCP clients
- Detailed documentation and examples

### Security
- Path sandboxing prevents access outside workspace
- Command allowlist prevents arbitrary command execution
- Symbolic link resolution and validation
- Atomic write operations prevent partial file corruption
- Input validation for all operations

[1.0.0]: https://github.com/YOUR_USERNAME/mcp-workspace-server/releases/tag/v1.0.0
