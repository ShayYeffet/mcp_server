# Quick Start Guide

Get up and running with MCP Workspace Server in 5 minutes!

## Step 1: Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/mcp-workspace-server.git
cd mcp-workspace-server

# Install and build
npm install
npm run build
```

## Step 2: Choose Your AI Client

### Option A: Claude Desktop (Easiest)

1. **Find the config file location:**
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Create/edit the file:**

```json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["REPLACE_WITH_FULL_PATH_TO/mcp-workspace-server/dist/index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "REPLACE_WITH_YOUR_PROJECT_PATH",
        "MCP_ALLOWED_COMMANDS": "npm,git,node"
      }
    }
  }
}
```

3. **Replace the paths:**
   - First path: Where you cloned this repo
   - Second path: Your project folder where AI can work

4. **Restart Claude Desktop**

### Option B: Cline (VS Code)

1. **Install Cline** from VS Code extensions

2. **Open Settings** (Ctrl+, or Cmd+,)

3. **Search "Cline"** → Find "MCP Servers"

4. **Add configuration:**

```json
{
  "cline.mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["REPLACE_WITH_FULL_PATH_TO/mcp-workspace-server/dist/index.js"],
      "env": {
        "MCP_WORKSPACE_ROOT": "REPLACE_WITH_YOUR_PROJECT_PATH",
        "MCP_ALLOWED_COMMANDS": "npm,git,node"
      }
    }
  }
}
```

5. **Reload VS Code**

## Step 3: Test It! (1 minute)

Ask your AI:

```
"List all files in my workspace"
```

```
"Create a new file called test.txt with the content 'Hello from MCP!'"
```

```
"Read the test.txt file"
```

If it works, you're done! 🎉

## Common Issues

### "Path outside workspace" error
- Make sure `MCP_WORKSPACE_ROOT` is an absolute path
- Don't use relative paths like `./my-project`

### "Command not allowed" error
- Add the command to `MCP_ALLOWED_COMMANDS`
- Example: `"npm,git,python,node"`

### "Could not load app settings" (Claude)
- Check JSON syntax at jsonlint.com
- Use double backslashes on Windows: `C:\\Users\\...`

## What's Next?

- Read the full [README.md](README.md) for detailed configuration
- Check out [examples](README.md#-complete-configuration-examples)
- Learn about [security features](README.md#-security)

## Need Help?

- [Open an issue](https://github.com/YOUR_USERNAME/mcp-workspace-server/issues)
- [Read troubleshooting guide](README.md#-troubleshooting)
