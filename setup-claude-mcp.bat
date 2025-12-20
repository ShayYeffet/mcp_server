@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Claude Desktop MCP Setup Wizard
echo ========================================
echo.

REM Step 1: Ask for MCP server location
echo Step 1: MCP Server Location
echo --------------------------------
echo Where is your MCP server located?
echo (This should be the folder containing dist/index.js)
echo.
set /p "MCP_SERVER_PATH=Enter full path to MCP server folder: "

REM Validate MCP server path
if not exist "%MCP_SERVER_PATH%\dist\index.js" (
    echo.
    echo ERROR: Could not find dist/index.js in the specified path!
    echo Please make sure you entered the correct path.
    pause
    exit /b 1
)

echo.
echo ✓ MCP server found at: %MCP_SERVER_PATH%
echo.

REM Step 2: Check if Claude Desktop is installed
echo Step 2: Checking Claude Desktop Installation
echo --------------------------------
set "CLAUDE_CONFIG_DIR=%APPDATA%\Claude"

if exist "%LOCALAPPDATA%\Programs\Claude\Claude.exe" (
    echo ✓ Claude Desktop is installed
) else (
    echo.
    echo WARNING: Claude Desktop does not appear to be installed!
    echo.
    echo Would you like to:
    echo   1. Continue anyway (I'll install it later)
    echo   2. Exit and install Claude Desktop first
    echo.
    set /p "INSTALL_CHOICE=Enter choice (1 or 2): "
    
    if "!INSTALL_CHOICE!"=="2" (
        echo.
        echo Please download Claude Desktop from:
        echo https://claude.ai/download
        echo.
        echo Run this script again after installation.
        pause
        exit /b 0
    )
)

echo.

REM Step 3: Ask for workspace directory
echo Step 3: Workspace Directory
echo --------------------------------
echo Which directory do you want to use as your workspace?
echo (This is where Claude can read/write files)
echo.
set /p "WORKSPACE_PATH=Enter full path to workspace folder: "

REM Validate workspace path
if not exist "%WORKSPACE_PATH%" (
    echo.
    echo WARNING: Directory does not exist!
    echo Would you like to create it? (Y/N)
    set /p "CREATE_DIR=Enter choice: "
    
    if /i "!CREATE_DIR!"=="Y" (
        mkdir "%WORKSPACE_PATH%"
        echo ✓ Directory created
    ) else (
        echo.
        echo ERROR: Workspace directory must exist!
        pause
        exit /b 1
    )
)

echo.
echo ✓ Workspace set to: %WORKSPACE_PATH%
echo.

REM Step 4: Create Claude config
echo Step 4: Creating Claude Configuration
echo --------------------------------

REM Create config directory if it doesn't exist
if not exist "%CLAUDE_CONFIG_DIR%" (
    mkdir "%CLAUDE_CONFIG_DIR%"
    echo ✓ Created config directory
)

REM Backup existing config if it exists
if exist "%CLAUDE_CONFIG_DIR%\claude_desktop_config.json" (
    echo.
    echo Found existing configuration!
    echo Creating backup...
    copy "%CLAUDE_CONFIG_DIR%\claude_desktop_config.json" "%CLAUDE_CONFIG_DIR%\claude_desktop_config.json.backup" >nul
    echo ✓ Backup created: claude_desktop_config.json.backup
)

REM Convert paths to use forward slashes for JSON
set "MCP_SERVER_JSON=%MCP_SERVER_PATH:\=/%"
set "WORKSPACE_JSON=%WORKSPACE_PATH:\=/%"

REM Create the config file
(
echo {
echo   "mcpServers": {
echo     "workspace": {
echo       "command": "node",
echo       "args": [
echo         "%MCP_SERVER_JSON%/dist/index.js"
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

echo.
echo ✓ Configuration file created successfully!
echo.

REM Step 5: Summary
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Configuration Summary:
echo ----------------------
echo MCP Server:    %MCP_SERVER_PATH%\dist\index.js
echo Workspace:     %WORKSPACE_PATH%
echo Config File:   %CLAUDE_CONFIG_DIR%\claude_desktop_config.json
echo.
echo Next Steps:
echo -----------
echo 1. Close Claude Desktop if it's running
echo 2. Start Claude Desktop
echo 3. Look for the hammer icon (🔨) to see your MCP tools
echo 4. Try asking: "List files in my workspace"
echo.
echo If you need to change settings, run this script again!
echo.
pause
