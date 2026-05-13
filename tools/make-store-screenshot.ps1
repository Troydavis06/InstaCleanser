# Builds a 1280x800 PNG for Chrome Web Store from extension screenshot(s).
# Run from repo root: powershell -File tools/make-store-screenshot.ps1
param(
  [string]$Source = "",
  [string]$Out = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $Source) { $Source = Join-Path $repoRoot "assets\icMain.png" }
if (-not $Out) { $Out = Join-Path $repoRoot "assets\store-marquee-1280x800.png" }

Add-Type -AssemblyName System.Drawing

$W = 1280
$H = 800
$canvas = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bg = [System.Drawing.Color]::FromArgb(255, 18, 18, 24)
$g.Clear($bg)

if (-not (Test-Path $Source)) {
  throw "Source not found: $Source"
}

$srcPath = (Resolve-Path $Source).Path
$src = [System.Drawing.Image]::FromFile($srcPath)
try {
  $scale = [Math]::Min($W / $src.Width, $H / $src.Height)
  $nw = [int]([Math]::Round($src.Width * $scale))
  $nh = [int]([Math]::Round($src.Height * $scale))
  $x = [int](($W - $nw) / 2)
  $y = [int](($H - $nh) / 2)
  $dest = New-Object System.Drawing.Rectangle $x, $y, $nw, $nh
  $g.DrawImage($src, $dest, 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel)
}
finally {
  $src.Dispose()
}

$outDir = Split-Path $Out -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$canvas.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$canvas.Dispose()
Write-Host "Wrote $Out (${W}x${H})"
