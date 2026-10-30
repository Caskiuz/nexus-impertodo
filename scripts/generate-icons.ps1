Add-Type -AssemblyName System.Drawing

function New-ImpertodoIcon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0f2438'))

  $m = [double]$size * 0.285
  $w = [double]$size * 0.43
  $r = [double]$size * 0.10
  $d = $r * 2

  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddArc($m, $m, $d, $d, 180, 90)
  $gp.AddArc(($m + $w - $d), $m, $d, $d, 270, 90)
  $gp.AddArc(($m + $w - $d), ($m + $w - $d), $d, $d, 0, 90)
  $gp.AddArc($m, ($m + $w - $d), $d, $d, 90, 90)
  $gp.CloseFigure()

  $rect = New-Object System.Drawing.RectangleF($m, $m, $w, $w)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.ColorTranslator]::FromHtml('#F4B81E'), [System.Drawing.ColorTranslator]::FromHtml('#e0a800'), 45)
  $g.FillPath($brush, $gp)

  $fontSize = [float]($size * 0.29)
  $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rectAll = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#141414'))
  $g.DrawString('I', $font, $textBrush, $rectAll, $sf)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "icon $path ($size)"
}

New-Item -ItemType Directory -Force -Path "public/icons" | Out-Null
New-ImpertodoIcon 512 "public/icons/icon-512.png"
New-ImpertodoIcon 512 "public/icons/maskable-512.png"
New-ImpertodoIcon 192 "public/icons/icon-192.png"
New-ImpertodoIcon 180 "public/icons/apple-touch-icon.png"
New-ImpertodoIcon 32 "public/icons/favicon-32.png"
