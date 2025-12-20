# 🔧 Claude Desktop MCP Connection Troubleshooting Guide

## 🚀 Quick Setup Verification

### 1. Rebuild the Server
```bash
npm run build
```

### 2. Restart Claude Desktop
- **Completely close** Claude Desktop (check Task Manager to ensure it's not running)
- **Reopen** Claude Desktop

### 3. Verify Connection
- Look for the **🔨 hammer icon** in the chat interface
- Try asking: "List all available tools"

---

## 🔍 Common Connection Issues & Solutions

### Issue 1: No Hammer Icon (🔨) Appears

**Symptoms:**
- Claude Desktop opens normally
- No hammer icon in the chat interface
- No MCP tools available

**Solutions:**

1. **Check Configuration File Exists:**
   ```powershell
   Test-Path "$env:APPDATA\Claude\claude_desktop_config.json"
   ```
   Should return `True`

2. **Verify Configuration Content:**
   ```powershell
   Get-Content "$env:APPDATA\Claude\claude_desktop_config.json"
   ```
   Should show your MCP server configuration

3. **Check Paths Are Correct:**
   - Server path: `C:\Users\YOUR_USERNAME\...\mcp_server\dist\index.js`
   - Workspace path: Your project directory
   - Both paths must exist and be absolute

4. **Restart Claude Desktop Completely:**
   - Close Claude Desktop
   - Open Task Manager (Ctrl+Shift+Esc)
   - End any "Claude" processes
   - Reopen Claude Desktop

---

### Issue 2: Connection Errors in Claude

**Symptoms:**
- Hammer icon appears but shows errors
- "Failed to connect to MCP server" messages
- Tools don't work

**Solutions:**

1. **Verify Node.js is Installed:**
   ```powershell
   node --version
   ```
   Should show v18.0.0 or higher

2. **Check Server Builds Successfully:**
   ```powershell
   cd C:\Users\YOUR_USERNAME\...\mcp_server
   npm run build
   ```
   Should complete without errors

3. **Test Server Manually:**
   ```powershell
   $env:MCP_WORKSPACE_ROOT="C:\Your\Workspace\Path"
   $env:MCP_ALLOWED_COMMANDS="npm,git,node"
   node dist/index.js
   ```
   Should start without errors

4. **Check Workspace Path Exists:**
   ```powershell
   Test-Path "C:\Your\Workspace\Path"
   ```
   Should return `True`

---

### Issue 3: "Path Outside Workspace" Errors

**Symptoms:**
- Server connects but file operations fail
- "Security violation" or "path outside workspace" errors

**Solutions:**

1. **Verify Workspace Path in Config:**
   - Open: `%APPDATA%\Claude\claude_desktop_config.json`
   - Check `MCP_WORKSPACE_ROOT` is correct
   - Must be an absolute path (e.g., `C:\Users\...`)

2. **Use Correct Path Format:**
   - Windows: Use double backslashes `C:\\Users\\...`
   - Or forward slashes: `C:/Users/...`

3. **Ensure Workspace Directory Exists:**
   ```powershell
   mkdir "C:\Your\Workspace\Path" -Force
   ```

---

### Issue 4: JSON Parse Errors

**Symptoms:**
- "Could not load app settings" error
- "Invalid JSON" messages

**Solutions:**

1. **Validate JSON Syntax:**
   - Copy config content
   - Paste into https://jsonlint.com/
   - Update any syntax errors

2. **Common JSON Mistakes:**
   - Missing commas between properties
   - Trailing commas (not allowed in JSON)
   - Single quotes instead of double quotes
   - Unescaped backslashes in paths

3. **Correct Path Format:**
   ```json
   "args": ["C:\\Users\\YourName\\mcp_server\\dist\\index.js"]
   ```
   OR
   ```json
   "args": ["C:/Users/YourName/mcp_server/dist/index.js"]
   ```

---

## 📋 Configuration Checklist

Use this checklist to verify your setup:

- [ ] Node.js v18+ installed (`node --version`)
- [ ] Claude Desktop installed
- [ ] MCP server built successfully (`npm run build`)
- [ ] `dist/index.js` file exists
- [ ] Configuration file exists at `%APPDATA%\Claude\claude_desktop_config.json`
- [ ] Server path in config is absolute and correct
- [ ] Workspace path in config exists
- [ ] JSON syntax is valid (no trailing commas, proper quotes)
- [ ] Claude Desktop completely restarted
- [ ] No Claude processes running in Task Manager

---

## 🔧 Manual Configuration Template

If you need to manually create or update your configuration:

**Location:** `%APPDATA%\Claude\claude_desktop_config.json`

**Template:**
```json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": [
        "C:/Users/YOUR_USERNAME/path/to/mcp_server/dist/index.js"
      ],
      "env": {
        "MCP_WORKSPACE_ROOT": "C:/Users/YOUR_USERNAME/your/workspace/path",
        "MCP_ALLOWED_COMMANDS": "npm,git,node,python,pip",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

**Replace:**
- `YOUR_USERNAME` with your Windows username
- `path/to/mcp_server` with actual server location
- `your/workspace/path` with your project directory

---

## 🧪 Testing Your Setup

### Test 1: Server Starts
```powershell
cd C:\path\to\mcp_server
$env:MCP_WORKSPACE_ROOT="C:\your\workspace"
$env:MCP_ALLOWED_COMMANDS="npm,git,node"
node dist/index.js
```
**Expected:** Server starts, shows initialization message

### Test 2: Configuration Valid
```powershell
Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" | ConvertFrom-Json
```
**Expected:** No errors, shows configuration object

### Test 3: Paths Exist
```powershell
Test-Path "C:\path\to\mcp_server\dist\index.js"
Test-Path "C:\your\workspace"
```
**Expected:** Both return `True`

---

## 📞 Still Having Issues?

If you've tried all the above and still can't connect:

1. **Check Claude Desktop Logs:**
   - Location: `%APPDATA%\Claude\logs`
   - Look for error messages

2. **Enable Debug Logging:**
   - In config, set: `"MCP_LOG_LEVEL": "debug"`
   - Restart Claude Desktop
   - Check logs for detailed information

3. **Verify Permissions:**
   - Ensure you have read/write access to workspace
   - Run Claude Desktop as administrator (if needed)

4. **Reinstall Dependencies:**
   ```powershell
   cd C:\path\to\mcp_server
   Remove-Item node_modules -Recurse -Force
   npm install
   npm run build
   ```

---

## ✅ Success Indicators

You'll know it's working when:

1. **🔨 Hammer icon** appears in Claude Desktop chat
2. Asking "List all available tools" shows 40 tools
3. File operations work: "List files in my workspace"
4. No error messages in Claude Desktop

---

## 🎯 Current Configuration

**Your Configuration:**
- **Server Path:** `C:\Users\sy020\Kiro_projects\mcp_server\dist\index.js`
- **Workspace:** `C:\Users\sy020\projects_with_claude\peleAI`
- **Allowed Commands:** npm, git, node
- **Status:** ✅ Ready to use

**Next Steps:**
1. Restart Claude Desktop completely
2. Look for the hammer icon (🔨)
3. Try: "List all 36 available tools"

---

*Last Updated: December 20, 2025*  
*Ultimate MCP Server Troubleshooting Guide* ✅
