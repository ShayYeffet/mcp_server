# Create a proper self-contained EXE installer
# This embeds everything into a PowerShell-based EXE

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building EXE Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$currentDir = Get-Location
$outputExe = "$currentDir\Claude-MCP-Installer.exe"

# Check if dist exists
if (-not (Test-Path "$currentDir\dist")) {
    Write-Host "ERROR: dist folder not found!" -ForegroundColor Red
    Write-Host "Run 'npm run build' first" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "Collecting files..." -ForegroundColor Yellow

# Read and encode files as base64
$distFiles = @{}
Get-ChildItem "$currentDir\dist" -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring("$currentDir\dist\".Length)
    $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName))
    $distFiles[$relativePath] = $content
    Write-Host "  Encoded: dist\$relativePath" -ForegroundColor Gray
}

# Read package.json
$packageJson = Get-Content "$currentDir\package.json" -Raw
$packageJsonB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($packageJson))

# Read installer script
$installerBat = Get-Content "$currentDir\install-claude-mcp-complete.bat" -Raw
$installerBatB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($installerBat))

Write-Host "  Files encoded" -ForegroundColor Green
Write-Host ""

Write-Host "Creating self-extracting installer..." -ForegroundColor Yellow

# Create the embedded installer script
$installerScript = @"
# Claude MCP Self-Extracting Installer
`$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Claude MCP Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for admin
`$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not `$isAdmin) {
    Write-Host "This installer requires administrator privileges." -ForegroundColor Yellow
    Write-Host "Restarting as administrator..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"`$PSCommandPath`""
    exit
}

Write-Host "Extracting files..." -ForegroundColor Yellow

# Create temp directory
`$tempDir = "`$env:TEMP\mcp-installer-`$(Get-Random)"
New-Item -ItemType Directory -Path `$tempDir | Out-Null
New-Item -ItemType Directory -Path "`$tempDir\dist" | Out-Null

# Decode and write files
`$distFiles = @{
"@

# Add all dist files to the script
foreach ($file in $distFiles.Keys) {
    $installerScript += "`n    '$file' = '$($distFiles[$file])'"
}

$installerScript += @"

}

foreach (`$file in `$distFiles.Keys) {
    `$filePath = "`$tempDir\dist\`$file"
    `$fileDir = Split-Path `$filePath -Parent
    if (-not (Test-Path `$fileDir)) {
        New-Item -ItemType Directory -Path `$fileDir -Force | Out-Null
    }
    `$bytes = [Convert]::FromBase64String(`$distFiles[`$file])
    [IO.File]::WriteAllBytes(`$filePath, `$bytes)
}

# Write package.json
`$packageJsonContent = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$packageJsonB64'))
`$packageJsonContent | Out-File -FilePath "`$tempDir\package.json" -Encoding UTF8

# Write installer script
`$installerBatContent = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$installerBatB64'))
`$installerBatContent | Out-File -FilePath "`$tempDir\install-claude-mcp-complete.bat" -Encoding ASCII

Write-Host "Files extracted" -ForegroundColor Green
Write-Host ""

# Run the installer
Write-Host "Starting installation..." -ForegroundColor Yellow
Write-Host ""

Set-Location `$tempDir
Start-Process -FilePath "cmd.exe" -ArgumentList "/c install-claude-mcp-complete.bat" -Wait -NoNewWindow

# Cleanup
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Yellow
Set-Location `$env:TEMP
Remove-Item `$tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
"@

# Save the PowerShell script
$ps1File = "$env:TEMP\mcp-installer-script.ps1"
$installerScript | Out-File -FilePath $ps1File -Encoding UTF8

Write-Host "  Installer script created" -ForegroundColor Green
Write-Host ""

# Convert PS1 to EXE using PS2EXE (we'll use a simpler method)
Write-Host "Converting to EXE..." -ForegroundColor Yellow

# Check if ps2exe is available
if (Get-Command ps2exe -ErrorAction SilentlyContinue) {
    ps2exe -inputFile $ps1File -outputFile $outputExe -noConsole:$false -requireAdmin
} else {
    Write-Host ""
    Write-Host "Installing ps2exe module..." -ForegroundColor Yellow
    Install-Module -Name ps2exe -Force -Scope CurrentUser -ErrorAction SilentlyContinue
    
    if (Get-Command ps2exe -ErrorAction SilentlyContinue) {
        ps2exe -inputFile $ps1File -outputFile $outputExe -noConsole:$false -requireAdmin
    } else {
        Write-Host ""
        Write-Host "Could not install ps2exe automatically." -ForegroundColor Red
        Write-Host ""
        Write-Host "Manual installation:" -ForegroundColor Yellow
        Write-Host "  1. Open PowerShell as Administrator" -ForegroundColor White
        Write-Host "  2. Run: Install-Module -Name ps2exe -Force" -ForegroundColor White
        Write-Host "  3. Run this script again" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit
    }
}

if (Test-Path $outputExe) {
    $fileSize = (Get-Item $outputExe).Length / 1MB
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Created: Claude-MCP-Installer.exe" -ForegroundColor Cyan
    Write-Host "Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Features:" -ForegroundColor White
    Write-Host "  - Single EXE file" -ForegroundColor Green
    Write-Host "  - Source code hidden (only compiled code)" -ForegroundColor Green
    Write-Host "  - Self-contained installer" -ForegroundColor Green
    Write-Host ""
    Write-Host "To share:" -ForegroundColor Yellow
    Write-Host "  1. Send Claude-MCP-Installer.exe" -ForegroundColor White
    Write-Host "  2. Friend double-clicks it" -ForegroundColor White
    Write-Host "  3. Everything installs automatically" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Failed to create EXE" -ForegroundColor Red
}

# Cleanup
Remove-Item $ps1File -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done! Press Enter to exit"
Read-Host
