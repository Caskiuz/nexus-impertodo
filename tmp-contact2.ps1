Add-Type -AssemblyName System.Drawing

$meta = Get-Content -Raw -Path 'tmp-stock/meta.json' | ConvertFrom-Json
$systems = @('acr10','acr7','sbs45','pu','polu','sil','cem','ais','epx')
$elements = @('losa-no-transitable','losa-transitable','nave','cisterna','muro','piso')

function Make-Sheet($slugs, $outFile) {
  $list = @($meta | Where-Object { $slugs -contains $_.slug })
  $cols = 4
  $cellW = 300
  $cellH = 210
  $imgW = 280
  $imgH = 168
  $rows = [Math]::Ceiling($list.Count / $cols)
  $bmp = New-Object System.Drawing.Bitmap(($cols * $cellW), ($rows * $cellH))
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(245, 247, 250))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $font = New-Object System.Drawing.Font('Arial', 10, [System.Drawing.FontStyle]::Bold)
  $small = New-Object System.Drawing.Font('Arial', 8.5, [System.Drawing.FontStyle]::Regular)
  $brush = [System.Drawing.Brushes]::Black
  $i = 0
  foreach ($m in $list) {
    $x = ($i % $cols) * $cellW + 10
    $y = [Math]::Floor($i / $cols) * $cellH + 8
    $path = Resolve-Path -LiteralPath $m.file -ErrorAction SilentlyContinue
    if ($path) {
      try {
        $img = [System.Drawing.Image]::FromFile($path.Path)
        $g.DrawImage($img, $x, $y, $imgW, $imgH)
        $img.Dispose()
      } catch {}
    }
    $label = "$($m.slug)-$($m.i)"
    $g.DrawString($label, $font, $brush, $x, ($y + $imgH + 2))
    $credit = [string]$m.photographer
    if ($credit.Length -gt 34) { $credit = $credit.Substring(0, 34) }
    $g.DrawString($credit, $small, $brush, ($x + 70), ($y + $imgH + 4))
    $i++
  }
  $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "sheet $outFile ($($list.Count))"
}

Make-Sheet $systems 'tmp-stock/sheet-sistemas.jpg'
Make-Sheet $elements 'tmp-stock/sheet-elementos.jpg'
