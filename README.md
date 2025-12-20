# 🏆 ULTIMATE MCP Workspace Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Tools](https://img.shields.io/badge/Tools-36-brightgreen.svg)](https://github.com/ShayYeffet/ultimate_mcp_server)
[![Categories](https://img.shields.io/badge/Categories-15+-blue.svg)](https://github.com/ShayYeffet/ultimate_mcp_server)

**The Most Comprehensive MCP Server Ever Created** - 36 professional tools across 15+ categories for development, DevOps, data processing, and automation. Transform Claude Desktop into the ultimate development environment!

## 🌟 Ultimate Features

- 🏆 **36 Comprehensive Tools**: The most complete MCP server available
- 🔒 **Enterprise Security**: Military-grade sandboxing and path validation
- 🚀 **15+ Categories**: File ops, Git, Docker, cloud storage, databases, and more
- 🌐 **Multi-Platform**: Windows, macOS, and Linux support
- ☁️ **Multi-Cloud**: AWS S3, Google Cloud, Azure integration
- 🐳 **DevOps Ready**: Docker management, package managers, CI/CD tools
- 📊 **Data Processing**: CSV, JSON, databases, web scraping, image processing
- 🔐 **Security Suite**: Encryption, hashing, secure key generation
- ⏰ **Automation**: Task scheduling, notifications, webhooks
- 🎨 **Code Quality**: Formatting, linting, analysis tools
- ✅ **Production Ready**: 109+ passing tests, comprehensive error handling

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
   git clone https://github.com/ShayYeffet/ultimate_mcp_server.git
   cd ultimate_mcp_server
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
         "args": ["/ABSOLUTE/PATH/TO/ultimate_mcp_server/dist/index.js"],
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
         "args": ["/ABSOLUTE/PATH/TO/ultimate_mcp_server/dist/index.js"],
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
"args": ["/ABSOLUTE/PATH/TO/ultimate_mcp_server/dist/index.js"]
```

**Replace with:**
- **Windows**: `"C:\\Users\\YourName\\path\\to\\ultimate_mcp_server\\dist\\index.js"`
- **macOS/Linux**: `"/home/username/path/to/ultimate_mcp_server/dist/index.js"`

**How to find it:**
```bash
# In the ultimate_mcp_server directory, run:
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
      "args": ["C:\\Users\\John\\ultimate_mcp_server\\dist\\index.js"],
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
      "args": ["/home/jane/ultimate_mcp_server/dist/index.js"],
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
      "args": ["/Users/alex/ultimate_mcp_server/dist/index.js"],
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
      "args": ["C:\\ultimate_mcp_server\\dist\\index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "C:\\projects\\project-a",
        "MCP_ALLOWED_COMMANDS": "npm,git"
      }
    },
    "project-b": {
      "command": "node",
      "args": ["C:\\ultimate_mcp_server\\dist\\index.js"],
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

## 🛠️ Ultimate Tool Arsenal - 36 Tools

### 📁 Core File Operations (7 Tools)
- **list_files** - List directory contents with filtering and sorting
- **read_file** - Read file contents with encoding support  
- **write_file** - Create or update files atomically
- **delete_file** - Delete files or directories safely
- **create_folder** - Create directories with parent creation
- **apply_patch** - Apply unified diff patches to files
- **run_command** - Execute shell commands securely

### 🔍 Advanced File Operations (5 Tools)
- **search_files** - Grep-like text search across files with patterns
- **find_files** - Find files by name, pattern, size, date, extension
- **copy_file** - Copy files and directories recursively
- **move_file** - Move or rename files and folders
- **get_file_info** - Detailed file metadata, checksums, permissions

### 📦 Archive & Compression (2 Tools)
- **compress_files** - Create ZIP/TAR/GZ archives with compression
- **extract_archive** - Extract compressed archives safely

### 🌐 Network Operations (1 Tool)
- **http_request** - Full HTTP client with all methods, headers, timeouts

### 🔧 Git Operations (4 Tools)
- **git_status** - Repository status, changes, branch information
- **git_diff** - Show differences between commits, branches, files
- **git_log** - View commit history with filters and formatting
- **git_branch** - Branch management, creation, deletion, listing

### 💻 System Operations (3 Tools)
- **system_info** - CPU, memory, disk, network, OS information
- **list_processes** - Show running processes with resource usage
- **kill_process** - Terminate processes by PID or name

### 🗄️ Database Operations (1 Tool)
- **database_query** - Execute SQL queries on SQLite databases

### 🖼️ Image Processing (1 Tool)
- **image_process** - Resize, crop, rotate, convert image formats

### 📄 PDF Manipulation (1 Tool)
- **pdf_manipulate** - Extract text, get info, merge, split PDFs

### 🔐 Encryption & Security (1 Tool)
- **encrypt_decrypt** - AES-256 encryption, hashing (SHA-256/512, MD5), key generation

### ⏰ Task Scheduling (1 Tool)
- **schedule_task** - Schedule commands with cron/Windows Task Scheduler

### 📢 Notifications (1 Tool)
- **send_notification** - System notifications, webhooks, email alerts

### 📝 Text Processing (1 Tool)
- **text_process** - Analyze, transform, extract patterns, compare, generate text

### 📊 Data Processing (2 Tools)
- **csv_process** - Read, write, transform, analyze, filter, merge, split CSV files
- **json_process** - Parse, validate, transform, merge, extract, minify, prettify JSON

### 🕷️ Web Scraping (1 Tool)
- **web_scrape** - Fetch HTML, extract elements, links, images, text, metadata

### 🐳 Docker Management (1 Tool)
- **docker_manage** - Manage containers, images, networks, volumes, logs, exec

### ☁️ Cloud Storage (1 Tool)
- **cloud_storage** - Upload, download, list, delete files on AWS S3, GCP, Azure

### 📦 Package Management (1 Tool)
- **package_manager** - Install, uninstall, update packages with npm, yarn, pip, composer, gem, cargo, go

### 🎨 Code Formatting (1 Tool)
- **code_format** - Format, lint, analyze, fix code with prettier, eslint, black, etc.

## 💡 Example Commands

### Development Workflow
```
"Search for all TODO comments in TypeScript files"
"Show git status and list all modified files"
"Format all JavaScript files with prettier"
"Create a ZIP archive of the src folder"
"Run npm install and build the project"
```

### System Administration
```
"Show system information including CPU and memory usage"
"List all processes using more than 100MB of memory"
"Schedule a daily backup at 2 AM"
"Send a notification when the deployment completes"
"Kill the process using port 3000"
```

### Data & Content Processing
```
"Query the database for all users created this month"
"Resize all images in this folder to 800x600"
"Extract text from this PDF and save to a file"
"Analyze this CSV file and show statistics"
"Scrape product data from this website"
```

### Cloud & DevOps
```
"Upload build artifacts to AWS S3"
"List all running Docker containers"
"Install dependencies with npm and pip"
"Make a POST request to the API with this data"
"Encrypt sensitive files with AES-256"
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

- **Issues**: [GitHub Issues](https://github.com/ShayYeffet/ultimate_mcp_server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ShayYeffet/ultimate_mcp_server/discussions)

---

**⭐ If you find this project useful, please consider giving it a star on GitHub!**
