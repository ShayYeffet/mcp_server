@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   ULTIMATE MCP SERVER INSTALLER v2.0
echo ========================================
echo.
echo This will install:
echo   - Node.js (if needed)
echo   - Claude Desktop
echo   - ULTIMATE MCP Server (40 Tools!)
echo   - Complete Configuration
echo.
pause

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: This script needs Administrator privileges!
    echo Right-click the file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM Step 1: Check/Install Node.js
echo.
echo Step 1: Checking Node.js Installation
echo ========================================
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js is not installed!
    echo.
    echo Downloading Node.js installer...
    
    REM Download Node.js installer
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\nodejs-installer.msi'"
    
    echo Installing Node.js...
    msiexec /i "%TEMP%\nodejs-installer.msi" /qn /norestart
    
    echo Waiting for installation to complete...
    timeout /t 30 /nobreak >nul
    
    REM Refresh environment variables
    call refreshenv >nul 2>&1
    
    echo ✓ Node.js installed
) else (
    echo ✓ Node.js is already installed
)
echo.

REM Step 2: Check/Install Claude Desktop
echo Step 2: Checking Claude Desktop Installation
echo ========================================
if exist "%LOCALAPPDATA%\Programs\Claude\Claude.exe" (
    echo ✓ Claude Desktop is already installed
) else (
    echo Claude Desktop is not installed!
    echo.
    echo Downloading Claude Desktop...
    
    REM Download Claude Desktop installer
    powershell -Command "Invoke-WebRequest -Uri 'https://storage.googleapis.com/osprey-downloads-c02f6a0d-347c-492b-a752-3e0651722e97/nest-win-x64/Claude-Setup-x64.exe' -OutFile '%TEMP%\claude-installer.exe'"
    
    echo Installing Claude Desktop...
    start /wait "" "%TEMP%\claude-installer.exe" /S
    
    echo ✓ Claude Desktop installed
)
echo.

REM Step 3: Install MCP Server
echo Step 3: Installing ULTIMATE MCP Server (40 Tools)
echo ========================================
echo.
echo Where would you like to install the MCP server?
echo (Recommended: %USERPROFILE%\ultimate_mcp_server)
echo.
set /p "INSTALL_DIR=Enter installation path (or press Enter for default): "

if "%INSTALL_DIR%"=="" (
    set "INSTALL_DIR=%USERPROFILE%\ultimate_mcp_server"
)

echo.
echo Installing to: %INSTALL_DIR%
echo.

REM Create installation directory
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

REM Check if MCP server files are bundled with this script
if exist "%~dp0package.json" (
    echo Copying MCP server files...
    xcopy /E /I /Y "%~dp0*" "%INSTALL_DIR%" >nul
) else (
    echo.
    echo ERROR: MCP server files not found!
    echo.
    echo Please make sure this installer is in the same folder as:
    echo   - package.json
    echo   - src/
    echo   - tsconfig.json
    echo.
    pause
    exit /b 1
)

REM Install dependencies and build
echo Installing dependencies...
cd /d "%INSTALL_DIR%"
call npm install >nul 2>&1

echo Building MCP server...
call npm run build >nul 2>&1

if not exist "%INSTALL_DIR%\dist\index.js" (
    echo.
    echo ERROR: Build failed! dist/index.js not found.
    echo.
    pause
    exit /b 1
)

echo ✓ ULTIMATE MCP Server (40 tools) installed and built successfully
echo.

REM Step 4: Configure Workspace
echo Step 4: Workspace Configuration
echo ========================================
echo.
echo Which directory should be your workspace?
echo (This is where Claude can read/write files)
echo.
echo Recommended: %USERPROFILE%\Documents\claude-workspace
echo.
set /p "WORKSPACE_PATH=Enter workspace path (or press Enter for default): "

if "%WORKSPACE_PATH%"=="" (
    set "WORKSPACE_PATH=%USERPROFILE%\Documents\claude-workspace"
)

REM Create workspace if it doesn't exist
if not exist "%WORKSPACE_PATH%" (
    mkdir "%WORKSPACE_PATH%"
    echo ✓ Created workspace directory
)

echo ✓ Workspace: %WORKSPACE_PATH%
echo.

REM Step 5: Create Claude Configuration
echo Step 5: Creating Claude Configuration
echo ========================================

set "CLAUDE_CONFIG_DIR=%APPDATA%\Claude"

REM Create config directory
if not exist "%CLAUDE_CONFIG_DIR%" (
    mkdir "%CLAUDE_CONFIG_DIR%"
)

REM Backup existing config
if exist "%CLAUDE_CONFIG_DIR%\claude_desktop_config.json" (
    copy "%CLAUDE_CONFIG_DIR%\claude_desktop_config.json" "%CLAUDE_CONFIG_DIR%\claude_desktop_config.json.backup" >nul
    echo ✓ Backed up existing configuration
)

REM Convert paths for JSON
set "INSTALL_JSON=%INSTALL_DIR:\=/%"
set "WORKSPACE_JSON=%WORKSPACE_PATH:\=/%"

REM Create config file
(
echo {
echo   "mcpServers": {
echo     "workspace": {
echo       "command": "node",
echo       "args": [
echo         "%INSTALL_JSON%/dist/index.js"
echo       ],
echo       "env": {
echo         "MCP_WORKSPACE_ROOT": "%WORKSPACE_JSON%",
echo         "MCP_ALLOWED_COMMANDS": "npm,git,node,python,pip",
echo         "MCP_LOG_LEVEL": "info"
echo       }
echo     }
echo   }
echo }
) > "%CLAUDE_CONFIG_DIR%\claude_desktop_config.json"

echo ✓ Configuration created
echo.

REM Create desktop shortcut for workspace
echo Creating desktop shortcut to workspace...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Claude Workspace.lnk'); $Shortcut.TargetPath = '%WORKSPACE_PATH%'; $Shortcut.Save()"
echo ✓ Desktop shortcut created
echo.

REM Final Summary
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo Installation Summary:
echo ---------------------
echo MCP Server:     %INSTALL_DIR%
echo Workspace:      %WORKSPACE_PATH%
echo Config File:    %CLAUDE_CONFIG_DIR%\claude_desktop_config.json
echo.
echo Next Steps:
echo -----------
echo 1. Launch Claude Desktop from Start Menu
echo 2. Look for the hammer icon (🔨) in the chat
echo 3. Try: "List all 40 available tools"
echo 4. Try: "Show system information"
echo 5. Try: "Search for files in my workspace"
echo 6. Your workspace folder is on your Desktop
echo.
echo Enjoy the ULTIMATE MCP Server with 40 tools!
echo.
pause
