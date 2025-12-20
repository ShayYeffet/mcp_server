# Simple installer builder - packages everything into a zip
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building MCP Installer Package" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$currentDir = Get-Location
$packageDir = "$currentDir\installer-package"
$outputZip = "$currentDir\Claude-MCP-Installer.zip"

# Clean up old package
if (Test-Path $packageDir) {
    Remove-Item $packageDir -Recurse -Force
}
if (Test-Path $outputZip) {
    Remove-Item $outputZip -Force
}

# Create package directory
New-Item -ItemType Directory -Path $packageDir | Out-Null

Write-Host "Collecting files..." -ForegroundColor Yellow

# Copy installer script
Copy-Item "$currentDir\install-claude-mcp-complete.bat" $packageDir

# Copy only compiled code (hide source)
if (Test-Path "$currentDir\dist") {
    Copy-Item "$currentDir\dist" $packageDir -Recurse
    Write-Host "  Copied compiled code (source hidden)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: dist folder not found!" -ForegroundColor Red
    Write-Host "  Run 'npm run build' first" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Copy necessary config files
Copy-Item "$currentDir\package.json" $packageDir -ErrorAction SilentlyContinue
Copy-Item "$currentDir\package-lock.json" $packageDir -ErrorAction SilentlyContinue

# Create simple README
$readmeContent = @"
# Claude MCP Installer

## Installation

1. Right-click 'install-claude-mcp-complete.bat'
2. Select 'Run as administrator'
3. Follow the prompts
4. Launch Claude Desktop

The MCP server will be installed and configured automatically.
Your source code is protected - only compiled code is included.
"@

$readmeContent | Out-File -FilePath "$packageDir\README.txt" -Encoding UTF8

Write-Host "  Files collected" -ForegroundColor Green
Write-Host ""

# Create ZIP archive
Write-Host "Creating installer package..." -ForegroundColor Yellow
Compress-Archive -Path "$packageDir\*" -DestinationPath $outputZip -Force

if (Test-Path $outputZip) {
    $fileSize = (Get-Item $outputZip).Length / 1MB
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Created: Claude-MCP-Installer.zip" -ForegroundColor Cyan
    Write-Host "Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "What's included:" -ForegroundColor White
    Write-Host "  - Complete installer" -ForegroundColor Green
    Write-Host "  - Compiled code only (source hidden)" -ForegroundColor Green
    Write-Host "  - Configuration files" -ForegroundColor Green
    Write-Host ""
    Write-Host "To share:" -ForegroundColor Yellow
    Write-Host "  1. Send Claude-MCP-Installer.zip to your friend" -ForegroundColor White
    Write-Host "  2. They unzip it" -ForegroundColor White
    Write-Host "  3. They run install-claude-mcp-complete.bat as admin" -ForegroundColor White
    Write-Host "  4. Everything installs automatically" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Failed to create package" -ForegroundColor Red
}

# Cleanup
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item $packageDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done! Press Enter to exit"
Read-Host
