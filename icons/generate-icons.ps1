# One-off: generates toolbar/store PNGs. Run from repo root: powershell -File icons/generate-icons.ps1
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

foreach ($size in @(16, 32, 48, 128)) {
  $s = $size
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bg = [System.Drawing.Color]::FromArgb(255, 26, 26, 36)
  $g.Clear($bg)

  $m = [Math]::Max(1, [int][Math]::Round($s * 0.14))
  $c1 = [System.Drawing.Color]::FromArgb(255, 245, 133, 41)
  $c2 = [System.Drawing.Color]::FromArgb(255, 221, 42, 123)
  $c3 = [System.Drawing.Color]::FromArgb(255, 129, 52, 175)

  $p0 = [System.Drawing.Point]::new($m, $m)
  $p1 = [System.Drawing.Point]::new($s - $m, $s - $m)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $p0, $p1, $c1, $c3
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend
  $blend.Colors = @($c1, $c2, $c3)
  $blend.Positions = @(0.0, 0.5, 1.0)
  $brush.InterpolationColors = $blend

  $r = [single]([Math]::Max(2.0, $s * 0.22))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddLine($r, 0, $s - $r, 0)
  $path.AddArc($s - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
  $path.AddLine($s, $r, $s, $s - $r)
  $path.AddArc($s - 2 * $r, $s - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $path.AddLine($s - $r, $s, $r, $s)
  $path.AddArc(0, $s - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $path.AddLine(0, $s - $r, 0, $r)
  $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
  $path.CloseFigure()

  $g.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()

  $out = Join-Path $dir ("icon{0}.png" -f $s)
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $out"
}
