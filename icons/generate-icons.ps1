# Generates the toolbar/store PNGs. Run from repo root:
#   powershell -File icons/generate-icons.ps1
#
# The mark is the same one used as the site favicon (see the data-URI in
# site/index.html): a solid --accent rounded square with a white figure.
# Keep the two in sync -- if the favicon path changes, change it here too.
#
# Geometry is authored on a 32x32 grid and scaled, so it matches the favicon's
# viewBox 1:1. The glyph is scaled up slightly at 16px, where a head drawn at
# true proportion collapses into a blob.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# --accent, dark theme value (#d81b60). Solid, so it reads on light and dark
# browser chrome alike.
$accent = [System.Drawing.Color]::FromArgb(255, 216, 27, 96)

function New-RoundedRect {
  param([single]$s, [single]$r)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc(0, 0, $d, $d, 180, 90)
  $p.AddArc($s - $d, 0, $d, $d, 270, 90)
  $p.AddArc($s - $d, $s - $d, $d, $d, 0, 90)
  $p.AddArc(0, $s - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

foreach ($size in @(16, 32, 48, 128)) {
  $s = [single]$size

  # 4x supersample, then downscale: System.Drawing's antialiasing alone leaves
  # the 16px corners chewed up.
  $ss = 4
  $S = [int]($size * $ss)

  $bmp = New-Object System.Drawing.Bitmap $S, $S
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded square, radius 0.25 of the side (rx=8 on the 32-unit grid).
  $bg = New-RoundedRect -s ([single]$S) -r ([single]($S * 0.25))
  $brush = New-Object System.Drawing.SolidBrush $accent
  $g.FillPath($brush, $bg)
  $brush.Dispose()
  $bg.Dispose()

  # Figure, authored on the 32-unit grid.
  $u = $S / 32.0
  $scale = if ($size -le 16) { 1.1 } else { 1.0 }

  # Scale about the glyph's own bounding-box centre -- it spans x 8..24 and
  # y 2..22 on the 32-unit grid, so (16,12). Scaling about anything else (the
  # square's centre, or the baseline) pushes the head off the top edge.
  $gx = 16.0 * $u
  $gy = 12.0 * $u

  function P {
    param([single]$x, [single]$y)
    $nx = $gx + ($x * $u - $gx) * $scale
    $ny = $gy + ($y * $u - $gy) * $scale
    return [System.Drawing.PointF]::new($nx, $ny)
  }

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

  # Shoulders: M8 22 c0-6 4-10 8-10 s8 4 8 10 H8 z
  $body = New-Object System.Drawing.Drawing2D.GraphicsPath
  $body.AddBezier((P 8 22), (P 8 16), (P 12 12), (P 16 12))
  $body.AddBezier((P 16 12), (P 20 12), (P 24 16), (P 24 22))
  $body.AddLine((P 24 22), (P 8 22))
  $body.CloseFigure()
  $g.FillPath($white, $body)
  $body.Dispose()

  # Head: circle centred (16,6), r 4.
  $head = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tl = P 12 2
  $br = P 20 10
  $head.AddEllipse($tl.X, $tl.Y, $br.X - $tl.X, $br.Y - $tl.Y)
  $g.FillPath($white, $head)
  $head.Dispose()

  $white.Dispose()
  $g.Dispose()

  # Downsample to the real size.
  $out = New-Object System.Drawing.Bitmap $size, $size
  $og = [System.Drawing.Graphics]::FromImage($out)
  $og.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $og.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $og.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $og.Clear([System.Drawing.Color]::Transparent)
  $og.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), 0, 0, $S, $S, [System.Drawing.GraphicsUnit]::Pixel)

  $path = Join-Path $dir ("icon{0}.png" -f $size)
  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $og.Dispose()
  $out.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $path"
}
