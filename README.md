# MCP Workspace Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

A secure, sandboxed Model Context Protocol (MCP) server that gives LLMs like Claude, ChatGPT, and local models (via Ollama) controlled file system access to build and manage projects.

## 🌟 Features

- 🔒 **Secure Sandboxing**: All file operations strictly confined to a designated workspace directory
- 📁 **Complete File Operations**: Read, write, list, delete files and directories
- 🔧 **Command Execution**: Run allowed build and test commands (npm, git, etc.)
- 🛡️ **Path Traversal Protection**: Comprehensive security against directory escape attempts
- 🔄 **Atomic Operations**: Safe file writes that prevent partial updates
- 📝 **Patch Support**: Apply targeted file modifications without rewriting entire files
- 🚫 **Read-Only Mode**: Optional mode to prevent any write operations
- 📊 **Structured Logging**: Configurable logging for debugging and monitoring
- ✅ **Fully Tested**: 109 passing tests including property-based tests

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration Guide](#configuration-guide)
- [Usage with Different AI Clients](#usage-with-different-ai-clients)
- [Available Tools](#available-tools)
- [Security](#security)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Installation

### Prerequisites

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- An MCP-compatible client (Claude Desktop, Cline, etc.)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ShayYeffet/mcp_workspace_server.git
   cd mcp_workspace_server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Verify installation**
   ```bash
   npm test
   ```

You should see all 109 tests passing! ✅

## ⚡ Quick Start

### For Claude Desktop Users

1. **Find your Claude config file:**
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Create or edit the file** with this configuration:

   ```json
   {
     "mcpServers": {
       "workspace": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/mcp_workspace_server/dist/index.js"],
         "env": {
           "MCP_WORKSPACE_ROOT": "/path/to/your/project",
           "MCP_ALLOWED_COMMANDS": "npm,git,node",
           "MCP_LOG_LEVEL": "info"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

4. **Test it!** Ask Claude:
   ```
   "List all files in my workspace"
   "Create a new file called test.txt with 'Hello World'"
   ```

### For Cline (VS Code) Users

1. **Install Cline** extension from VS Code marketplace

2. **Open VS Code Settings** (`Ctrl+,` or `Cmd+,`)

3. **Search for "Cline"** and find "MCP Servers" section

4. **Add this configuration** (or edit `settings.json`):

   ```json
   {
     "cline.mcpServers": {
       "workspace": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/mcp_workspace_server/dist/index.js"],
         "env": {
           "MCP_WORKSPACE_ROOT": "/path/to/your/project",
           "MCP_ALLOWED_COMMANDS": "npm,git,node"
         }
       }
     }
   }
   ```

5. **Reload VS Code** and start using Cline!

## ⚙️ Configuration Guide

### 🔧 What You MUST Change

When setting up the MCP server, you **must customize** these values in your config file:

#### 1. **Path to the Server** (Required)

```json
"args": ["/ABSOLUTE/PATH/TO/mcp_workspace_server/dist/index.js"]
```

**Replace with:**
- **Windows**: `"C:\\Users\\YourName\\path\\to\\mcp_workspace_server\\dist\\index.js"`
- **macOS/Linux**: `"/home/username/path/to/mcp_workspace_server/dist/index.js"`

**How to find it:**
```bash
# In the mcp_workspace_server directory, run:
pwd  # macOS/Linux
cd   # Windows
```

#### 2. **Workspace Root Directory** (Required)

```json
"MCP_WORKSPACE_ROOT": "/path/to/your/project"
```

**This is THE MOST IMPORTANT setting!** This directory is where the AI can read/write files.

**Examples:**
- **Your web project**: `"C:\\Users\\YourName\\projects\\my-website"`
- **Your app**: `"/home/username/projects/my-app"`
- **A test folder**: `"C:\\Users\\YourName\\ai-workspace"`

⚠️ **Security Note**: The AI can ONLY access files inside this directory. Choose carefully!

#### 3. **Allowed Commands** (Recommended)

```json
"MCP_ALLOWED_COMMANDS": "npm,git,node"
```

**Customize based on your needs:**
- **Web development**: `"npm,git,node,yarn"`
- **Python projects**: `"python,pip,git"`
- **No commands**: `""` (empty string - disables command execution)
- **Multiple commands**: `"npm,git,python,node,cargo,go"`

⚠️ **Security Note**: Only list commands you trust the AI to run!

### 📝 Optional Configuration

#### Read-Only Mode

Prevent ALL write operations (useful for analysis only):

```json
"MCP_READ_ONLY": "true"
```

#### Logging Level

Control how much logging you see:

```json
"MCP_LOG_LEVEL": "debug"  // Options: debug, info, warn, error
```

#### Command Timeout

Set maximum time for commands (in milliseconds):

```json
"MCP_COMMAND_TIMEOUT": "600000"  // 10 minutes
```

### 📋 Complete Configuration Examples

#### Example 1: Web Development Project

```json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["C:\\Users\\John\\mcp_workspace_server\\dist\\index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "C:\\Users\\John\\projects\\my-react-app",
        "MCP_ALLOWED_COMMANDS": "npm,git,node,yarn",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

#### Example 2: Python Data Science Project

```json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["/home/jane/mcp_workspace_server/dist/index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "/home/jane/projects/data-analysis",
        "MCP_ALLOWED_COMMANDS": "python,pip,git,jupyter",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

#### Example 3: Read-Only Code Review

```json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["/Users/alex/mcp_workspace_server/dist/index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "/Users/alex/code-to-review",
        "MCP_ALLOWED_COMMANDS": "",
        "MCP_READ_ONLY": "true",
        "MCP_LOG_LEVEL": "warn"
      }
    }
  }
}
```

#### Example 4: Multiple Workspaces

You can configure multiple MCP servers for different projects:

```json
{
  "mcpServers": {
    "project-a": {
      "command": "node",
      "args": ["C:\\mcp_workspace_server\\dist\\index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "C:\\projects\\project-a",
        "MCP_ALLOWED_COMMANDS": "npm,git"
      }
    },
    "project-b": {
      "command": "node",
      "args": ["C:\\mcp_workspace_server\\dist\\index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "C:\\projects\\project-b",
        "MCP_ALLOWED_COMMANDS": "python,pip"
      }
    }
  }
}
```

## 🤖 Usage with Different AI Clients

### Claude Desktop

- **Best for**: General use, easiest setup
- **Supports**: Claude models only
- **Config location**: See [Quick Start](#quick-start)

### Cline (VS Code Extension)

- **Best for**: Coding workflows, integrated development
- **Supports**: Claude, OpenAI, Ollama, and more
- **Config location**: VS Code Settings → Cline → MCP Servers

### Open WebUI

- **Best for**: Web-based interface with Ollama
- **Supports**: Ollama models
- **Setup**: Configure in Open WebUI settings under MCP/Tools section

### Custom Integration

You can integrate this server with any MCP-compatible client. The server communicates via stdio using the MCP protocol.

## 🛠️ Available Tools

The server exposes these tools to AI clients:

### `list_files`
List files and directories in the workspace.

**Parameters:**
- `path` (optional): Relative path to list
- `recursive` (optional): Include nested directories

**Example:**
```
"List all TypeScript files in the src directory"
```

### `read_file`
Read the contents of a file.

**Parameters:**
- `path` (required): Relative path to the file

**Example:**
```
"Read the package.json file"
```

### `write_file`
Create or overwrite a file.

**Parameters:**
- `path` (required): Relative path for the file
- `content` (required): File content
- `createDirectories` (optional): Create parent directories

**Example:**
```
"Create a new file src/utils/helper.ts with a function to format dates"
```

### `delete_file`
Delete a file or empty directory.

**Parameters:**
- `path` (required): Relative path to delete

**Example:**
```
"Delete the old-config.json file"
```

### `create_folder`
Create a directory and its parents.

**Parameters:**
- `path` (required): Relative path for the directory

**Example:**
```
"Create a folder structure: src/components/ui"
```

### `apply_patch`
Apply a patch to modify an existing file.

**Parameters:**
- `path` (required): Relative path to the file
- `patch` (required): Patch in custom format

**Patch Format:**
```
<<<OLD
old content to replace
===
new content
>>>NEW
```

**Example:**
```
"Change the port from 3000 to 8080 in the config file"
```

### `run_command`
Execute an allowed command.

**Parameters:**
- `command` (required): Command name (must be in allowed list)
- `args` (optional): Command arguments
- `cwd` (optional): Working directory
- `timeoutMs` (optional): Timeout override

**Example:**
```
"Run npm install"
"Run the tests with npm test"
```

## 🔒 Security

### Sandboxing

All file operations are strictly sandboxed to the `MCP_WORKSPACE_ROOT` directory:

✅ **Allowed:**
```
read_file("src/index.ts")
write_file("output/data.json", content)
```

❌ **Blocked:**
```
read_file("../../../etc/passwd")
read_file("/etc/passwd")
write_file("C:\\Windows\\System32\\file.txt", content)
```

### Protection Mechanisms

1. **Path Resolution**: All paths resolved to absolute paths and validated
2. **Boundary Checking**: Resolved paths must start with workspace root
3. **Traversal Detection**: `../` sequences that escape workspace are blocked
4. **Absolute Path Blocking**: Absolute paths outside workspace rejected
5. **Symbolic Link Resolution**: Symlinks resolved and validated
6. **Command Allowlist**: Only explicitly allowed commands can execute
7. **Argument Safety**: Command arguments passed as arrays (no shell injection)

### Best Practices

- ✅ Use a dedicated workspace directory for AI operations
- ✅ Only allow commands you trust
- ✅ Use read-only mode for code review/analysis
- ✅ Regularly review what the AI is doing
- ✅ Keep the workspace separate from system directories
- ❌ Don't set workspace root to `/` or `C:\`
- ❌ Don't allow dangerous commands like `rm`, `del`, `format`

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Test Structure

- **Unit Tests**: Test individual functions and modules (26 tests)
- **Property-Based Tests**: Use fast-check to verify properties across random inputs (83 tests)
- **Integration Tests**: Test full MCP protocol communication

All 109 tests validate the correctness properties defined in the design specification.

## 🐛 Troubleshooting

### Server Won't Start

**Problem**: Claude/Cline shows connection errors

**Solutions:**
1. Verify Node.js is installed: `node --version` (should be 18+)
2. Check the server path in config is correct and absolute
3. Ensure the project is built: `npm run build`
4. Check that `dist/index.js` exists

### Security Errors

**Problem**: "Path outside workspace" errors

**Solutions:**
1. Ensure `MCP_WORKSPACE_ROOT` is an absolute path
2. Use relative paths in requests (no leading `/`)
3. Avoid `../` to navigate outside workspace
4. Check for symbolic links pointing outside workspace

### Command Not Allowed

**Problem**: "Command not allowed" errors

**Solutions:**
1. Add command to `MCP_ALLOWED_COMMANDS`: `"npm,git,python"`
2. Use only the command name, not full path
3. Ensure commands are comma-separated without spaces

### Command Timeout

**Problem**: Commands killed before completing

**Solutions:**
1. Increase `MCP_COMMAND_TIMEOUT` (value in milliseconds)
2. For long builds: `"MCP_COMMAND_TIMEOUT": "1800000"` (30 min)
3. Check if command is actually hanging

### File Not Found

**Problem**: AI can't find files that exist

**Solutions:**
1. Verify `MCP_WORKSPACE_ROOT` points to correct directory
2. Use relative paths from workspace root
3. Check file actually exists: `ls` or `dir` in workspace

### JSON Parse Error (Claude Desktop)

**Problem**: "Could not load app settings" or "invalid JSON"

**Solutions:**
1. Validate JSON syntax at [jsonlint.com](https://jsonlint.com/)
2. Ensure all paths use double backslashes on Windows: `C:\\Users\\...`
3. Check for trailing commas (not allowed in JSON)
4. Verify file encoding is UTF-8 without BOM

## 📚 Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MCP_WORKSPACE_ROOT` | string | `process.cwd()` | **REQUIRED**: Absolute path to workspace directory |
| `MCP_ALLOWED_COMMANDS` | string | `""` | Comma-separated list of allowed commands |
| `MCP_READ_ONLY` | boolean | `false` | Disable all write operations |
| `MCP_LOG_LEVEL` | string | `"info"` | Logging level: debug, info, warn, error |
| `MCP_COMMAND_TIMEOUT` | number | `300000` | Command timeout in milliseconds (5 min default) |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Make your changes
5. Run tests: `npm test`
6. Build: `npm run build`
7. Submit a PR

### Guidelines

- Ensure all tests pass
- Add tests for new features
- Follow TypeScript strict mode
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built following the [Model Context Protocol](https://modelcontextprotocol.io/) specification
- Tested with [fast-check](https://github.com/dubzzz/fast-check) for property-based testing
- Inspired by the need for secure AI-filesystem interaction

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ShayYeffet/mcp_workspace_server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ShayYeffet/mcp_workspace_server/discussions)

---

**⭐ If you find this project useful, please consider giving it a star on GitHub!**
