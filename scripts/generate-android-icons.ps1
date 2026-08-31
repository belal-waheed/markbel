Add-Type -AssemblyName System.Drawing

$sourceLogo = "d:\dev\apps\projects\web\markbel\public\logo.png"
if (-not (Test-Path $sourceLogo)) {
    Write-Error "Source logo not found at $sourceLogo"
    exit 1
}

$androidRes = "d:\dev\apps\projects\web\markbel\android\app\src\main\res"

# Standard sizes for legacy launcher icons (width x height)
$launcherSizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

# Standard sizes for adaptive icon foregrounds (width x height)
$foregroundSizes = @{
    "mipmap-mdpi"    = 108
    "mipmap-hdpi"    = 162
    "mipmap-xhdpi"   = 216
    "mipmap-xxhdpi"  = 324
    "mipmap-xxxhdpi" = 432
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($sourceLogo)

function Resize-And-Save {
    param(
        [System.Drawing.Bitmap]$source,
        [int]$targetWidth,
        [int]$targetHeight,
        [string]$outputPath,
        [float]$innerScale = 1.0
    )

    $destBmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $drawWidth = [int]($targetWidth * $innerScale)
    $drawHeight = [int]($targetHeight * $innerScale)
    $drawX = [int](($targetWidth - $drawWidth) / 2)
    $drawY = [int](($targetHeight - $drawHeight) / 2)

    $g.DrawImage($source, $drawX, $drawY, $drawWidth, $drawHeight)
    $g.Dispose()

    $destBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Host "Generated: $outputPath ($targetWidth x $targetHeight)"
}

# 1. Generate Legacy Launcher Icons & Round Icons
foreach ($folder in $launcherSizes.Keys) {
    $size = $launcherSizes[$folder]
    $dir = Join-Path $androidRes $folder
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    $iconPath = Join-Path $dir "ic_launcher.png"
    $roundPath = Join-Path $dir "ic_launcher_round.png"

    Resize-And-Save -source $srcBmp -targetWidth $size -targetHeight $size -outputPath $iconPath -innerScale 0.92
    Resize-And-Save -source $srcBmp -targetWidth $size -targetHeight $size -outputPath $roundPath -innerScale 0.92
}

# 2. Generate Adaptive Icon Foregrounds (with 68% safe zone scale to prevent launcher cropping)
foreach ($folder in $foregroundSizes.Keys) {
    $size = $foregroundSizes[$folder]
    $dir = Join-Path $androidRes $folder
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    $fgPath = Join-Path $dir "ic_launcher_foreground.png"
    Resize-And-Save -source $srcBmp -targetWidth $size -targetHeight $size -outputPath $fgPath -innerScale 0.68
}

# 3. Generate Splash Screen Images
$splashDirs = @(
    "drawable",
    "drawable-land-hdpi", "drawable-land-mdpi", "drawable-land-xhdpi", "drawable-land-xxhdpi", "drawable-land-xxxhdpi",
    "drawable-port-hdpi", "drawable-port-mdpi", "drawable-port-xhdpi", "drawable-port-xxhdpi", "drawable-port-xxxhdpi"
)

foreach ($sDir in $splashDirs) {
    $dir = Join-Path $androidRes $sDir
    if (Test-Path $dir) {
        $splashPath = Join-Path $dir "splash.png"
        Resize-And-Save -source $srcBmp -targetWidth 480 -targetHeight 480 -outputPath $splashPath -innerScale 0.85
    }
}

$srcBmp.Dispose()
Write-Host "All Android icons and splash assets successfully generated from Markbel logo!"
