Add-Type -AssemblyName System.Drawing

$src = "public/img/fotos/src"
$dst = "public/img/fotos"
New-Item -ItemType Directory -Force -Path $dst | Out-Null

$files = Get-ChildItem -Path $src -Filter *.png -ErrorAction SilentlyContinue
if (-not $files) { Write-Host "No hay PNG en $src"; exit 0 }

$targetW = 1200
$targetH = 750

foreach ($f in $files) {
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $scale = [Math]::Max($targetW / $img.Width, $targetH / $img.Height)
    $w = [int][Math]::Round($img.Width * $scale)
    $h = [int][Math]::Round($img.Height * $scale)
    $x = [int][Math]::Round(($w - $targetW) / 2)
    $y = [int][Math]::Round(($h - $targetH) / 2)

    $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH)), (New-Object System.Drawing.Rectangle($x, $y, $targetW, $targetH)), [System.Drawing.GraphicsUnit]::Pixel)

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)

    $out = Join-Path $dst ($f.BaseName + ".jpg")
    $bmp.Save($out, $codec, $params)

    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
    $size = (Get-Item $out).Length / 1024
    Write-Host ("optimizado {0} ({1:N0} KB)" -f $out, $size)
  } catch {
    Write-Host ("error con {0}: {1}" -f $f.Name, $_.Exception.Message)
  }
}
