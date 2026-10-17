Add-Type -AssemblyName System.Drawing

function Optimize-Jpeg($inputPath, $outputPath, $targetWidth, $targetHeight, $quality) {
    $tempCopy = $inputPath + ".tmp"
    [System.IO.File]::Copy($inputPath, $tempCopy, $true)
    $src = [System.Drawing.Bitmap]::new($tempCopy)

    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = [System.Drawing.Imaging.EncoderParameters]::new(1)
    $ep.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)

    $dest = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)

    $scale = [Math]::Min($targetWidth / $src.Width, $targetHeight / $src.Height)
    $w = [int]($src.Width * $scale)
    $h = [int]($src.Height * $scale)
    $x = [int](($targetWidth - $w) / 2)
    $y = [int](($targetHeight - $h) / 2)

    $g.DrawImage($src, $x, $y, $w, $h)

    $dest.Save($outputPath, $enc, $ep)

    $g.Dispose()
    $dest.Dispose()
    $src.Dispose()
    [System.IO.File]::Delete($tempCopy)
    Write-Host ("Optimized $outputPath : " + (Get-Item $outputPath).Length + " bytes")
}

function Optimize-CropJpeg($inputPath, $outputPath, $targetWidth, $targetHeight, $quality) {
    $tempCopy = $inputPath + ".tmp"
    [System.IO.File]::Copy($inputPath, $tempCopy, $true)
    $src = [System.Drawing.Bitmap]::new($tempCopy)

    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = [System.Drawing.Imaging.EncoderParameters]::new(1)
    $ep.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)

    $dest = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Black)

    $scale = [Math]::Max($targetWidth / $src.Width, $targetHeight / $src.Height)
    $w = [int]($src.Width * $scale)
    $h = [int]($src.Height * $scale)
    $x = [int](($targetWidth - $w) / 2)
    $y = [int](($targetHeight - $h) / 2)

    $g.DrawImage($src, $x, $y, $w, $h)

    $dest.Save($outputPath, $enc, $ep)

    $g.Dispose()
    $dest.Dispose()
    $src.Dispose()
    [System.IO.File]::Delete($tempCopy)
    Write-Host ("Optimized $outputPath : " + (Get-Item $outputPath).Length + " bytes")
}

Optimize-Jpeg "public/icon.jpeg" "public/icon.jpeg" 512 512 85
Optimize-CropJpeg "public/og-image.jpg" "public/og-image.jpg" 1200 630 85
Optimize-CropJpeg "public/login-bg.jpeg" "public/login-bg.jpeg" 1080 1920 80
