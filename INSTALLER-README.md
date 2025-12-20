# 🏆 ULTIMATE MCP Server Installer

One-click installer for Claude Desktop with the ULTIMATE MCP Workspace Server (40 Tools!).

## Quick Start

### For New Users (Complete Installation)

1. **Right-click** `install-claude-mcp-complete.bat`
2. Select **"Run as administrator"**
3. Follow the prompts
4. Launch Claude Desktop

**What gets installed:**
- Node.js (if needed)
- Claude Desktop
- ULTIMATE MCP Workspace Server (40 Tools!)
- Complete configuration files
- Desktop workspace shortcut

### For Existing Users (Configuration Only)

If you already have Claude Desktop and Node.js installed:

1. **Double-click** `setup-claude-mcp.bat`
2. Enter your MCP server path
3. Enter your workspace path
4. Restart Claude Desktop

## After Installation

1. Open Claude Desktop
2. Look for the **🔨 hammer icon** in the chat
3. Try: *"List all 40 available tools"*
4. Try: *"Show system information"*
5. Try: *"Search for files in my workspace"*

Your workspace folder shortcut will be on your Desktop.

## Cleanup

After installation completes, you can safely delete:
- The zip file
- The unzipped folder

Everything is copied to a permanent location during installation.

## Troubleshooting

**"Access denied" error?**
- Right-click the `.bat` file and select "Run as administrator"

**MCP tools not showing?**
- Restart Claude Desktop completely
- Check that the hammer icon (🔨) appears in the chat interface

**Need to change workspace?**
- Run `setup-claude-mcp.bat` again to reconfigure

## What is MCP?

Model Context Protocol (MCP) allows Claude to interact with your local files and run commands safely within a designated workspace. This ULTIMATE version provides 40 comprehensive tools across 15+ categories including file operations, Git integration, Docker management, cloud storage, database queries, image processing, encryption, and much more!

## Files Included

- `install-claude-mcp-complete.bat` - Full installer (requires admin)
- `setup-claude-mcp.bat` - Configuration only (no admin needed)
- `create-installer-package.bat` - Creates shareable package

---

**Questions?** The installer will guide you through each step with clear prompts.
