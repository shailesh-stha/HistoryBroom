Add-Type -AssemblyName System.Drawing

$srcPath = "N:\_work\HistoryBroom\promo_banner.jpg"

if (Test-Path $srcPath) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    
    # 1. Generate Small Promo (440x280)
    $smallBmp = New-Object System.Drawing.Bitmap(440, 280)
    $smallGraph = [System.Drawing.Graphics]::FromImage($smallBmp)
    $smallGraph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $smallGraph.DrawImage($src, 0, 0, 440, 280)
    $smallBmp.Save("N:\_work\HistoryBroom\promo_small_440x280.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    # 2. Generate Marquee Promo (1400x560)
    $marqBmp = New-Object System.Drawing.Bitmap(1400, 560)
    $marqGraph = [System.Drawing.Graphics]::FromImage($marqBmp)
    $marqGraph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    # To fit 1280x800 into 1400x560, we scale it up and crop the top/bottom
    $marqGraph.DrawImage($src, 0, -100, 1400, 875) 
    $marqBmp.Save("N:\_work\HistoryBroom\promo_marquee_1400x560.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $smallGraph.Dispose()
    $smallBmp.Dispose()
    $marqGraph.Dispose()
    $marqBmp.Dispose()
    $src.Dispose()
    
    Write-Host "Success: Generated 440x280 and 1400x560 promo tiles."
} else {
    Write-Host "Error: promo_banner.jpg not found."
}
