Add-Type -AssemblyName System.Drawing

$srcPath = "N:\_work\HistoryBroom\sc_1.png"
$destPath = "N:\_work\HistoryBroom\screenshot_ready.png"

if (Test-Path $srcPath) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $bmp = New-Object System.Drawing.Bitmap(1280, 800)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Fill background with a nice dark color to match dark mode popup
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 20, 22, 26))
    
    # Calculate center position
    $x = [math]::Round((1280 - $src.Width) / 2)
    $y = [math]::Round((800 - $src.Height) / 2)
    
    # Draw the original screenshot in the center
    $graphics.DrawImage($src, $x, $y, $src.Width, $src.Height)
    
    # Save the new 1280x800 image
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $src.Dispose()
    $graphics.Dispose()
    $bmp.Dispose()
    
    Write-Host "Success: Created screenshot_ready.png (1280x800)"
} else {
    Write-Host "Error: sc_1.png not found."
}
