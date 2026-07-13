# History Broom Release Packager (Windows 11 / PowerShell)
# Automatically validates project files, reads manifest version, and packages files for Chrome Web Store.

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   History Broom Release Package Builder   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Locate and validate manifest.json
$manifestPath = Join-Path $PSScriptRoot "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Error "CRITICAL ERROR: manifest.json not found in root directory!"
}

try {
    $manifestContent = Get-Content -Raw -Path $manifestPath
    $manifest = ConvertFrom-Json $manifestContent
} catch {
    Write-Error ("CRITICAL ERROR: manifest.json is not a valid JSON file! Detail: {0}" -f $_)
}

$version = $manifest.version
$name = $manifest.name
Write-Host ("Detected extension: {0} (v{1})" -f $name, $version) -ForegroundColor Green

# 2. Define list of production files to package
$filesToPackage = @(
    "manifest.json",
    "background.js",
    "matching.js",
    "popup.html",
    "popup.js",
    "onboarding.html",
    "onboarding.js",
    "icon16.png",
    "icon48.png",
    "icon128.png"
)

# 3. Verify all files exist
Write-Host "Checking required files..." -ForegroundColor Gray
$missingFiles = 0
$resolvedFiles = @()

foreach ($file in $filesToPackage) {
    $fullPath = Join-Path $PSScriptRoot $file
    if (-not (Test-Path $fullPath)) {
        Write-Host ("  [X] Missing: {0}" -f $file) -ForegroundColor Red
        $missingFiles++
    } else {
        Write-Host ("  [OK] Verified: {0}" -f $file) -ForegroundColor Gray
        $resolvedFiles += $fullPath
    }
}

if ($missingFiles -gt 0) {
    Write-Error ("CRITICAL ERROR: {0} required file(s) are missing. Packaging aborted." -f $missingFiles)
}

# 4. Define zip output file name
$zipName = ("historybroom-{0}.zip" -f $version)
$zipPath = Join-Path $PSScriptRoot $zipName

# Delete previous bundle if it exists
if (Test-Path $zipPath) {
    Write-Host ("Removing existing archive: {0}..." -f $zipName) -ForegroundColor Yellow
    Remove-Item $zipPath -Force
}

# 5. Compress files
Write-Host ("Compressing files into {0}..." -f $zipName) -ForegroundColor Gray
try {
    Compress-Archive -Path $resolvedFiles -DestinationPath $zipPath -Force
    Write-Host ("Package created successfully at: {0}" -f $zipPath) -ForegroundColor Green
} catch {
    Write-Error ("CRITICAL ERROR: Failed to compress files! Detail: {0}" -f $_)
}

# 6. Verify zip content structure
Write-Host "Verifying archive integrity..." -ForegroundColor Gray
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    
    $manifestFound = $false
    Write-Host "Package contents:" -ForegroundColor Gray
    foreach ($entry in $zip.Entries) {
        Write-Host ("  - {0} ({1} bytes)" -f $entry.FullName, $entry.Length) -ForegroundColor DarkGray
        if ($entry.FullName -eq "manifest.json") {
            $manifestFound = $true
        }
    }
    $zip.Dispose()
    
    if (-not $manifestFound) {
        Write-Error "CRITICAL ERROR: manifest.json was not found at the root level of the ZIP archive!"
    }
    Write-Host "Structure verification passed (manifest.json is at root)." -ForegroundColor Green
} catch {
    Write-Error ("CRITICAL ERROR: Archive verification failed! Detail: {0}" -f $_)
}

# 7. Print size summary
$fileInfo = Get-Item $zipPath
$sizeKB = [Math]::Round($fileInfo.Length / 1KB, 2)
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Package build complete!" -ForegroundColor Green
Write-Host ("File Name: {0}" -f $zipName) -ForegroundColor White
Write-Host ("File Size: {0} KB" -f $sizeKB) -ForegroundColor White
Write-Host "Status: Ready for publishing!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
