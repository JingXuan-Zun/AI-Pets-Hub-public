$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WindowCaptureNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
"@

function Get-TargetProcess {
  param([int]$TargetPid, [int]$TimeoutMs)

  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
  while ([DateTime]::UtcNow -lt $deadline) {
    $target = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
    if ($target -and $target.MainWindowHandle -ne 0) {
      return $target
    }

    Start-Sleep -Milliseconds 200
  }

  throw "Unity runtime main window was not found for pid $TargetPid"
}

function Measure-BitmapSamples {
  param([System.Drawing.Bitmap]$Bitmap)

  $stepX = [Math]::Max(1, [Math]::Floor($Bitmap.Width / 24))
  $stepY = [Math]::Max(1, [Math]::Floor($Bitmap.Height / 24))
  $colors = New-Object 'System.Collections.Generic.HashSet[string]'
  $sampleCount = 0
  $nonBlackSampleCount = 0
  for ($y = 0; $y -lt $Bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $Bitmap.Width; $x += $stepX) {
      $pixel = $Bitmap.GetPixel($x, $y)
      $colors.Add("$($pixel.R),$($pixel.G),$($pixel.B)") | Out-Null
      if (($pixel.R + $pixel.G + $pixel.B) -gt 30) {
        $nonBlackSampleCount += 1
      }

      $sampleCount += 1
    }
  }

  return @{
    distinctSampleColors = $colors.Count
    nonBlackSampleCount = $nonBlackSampleCount
    sampleCount = $sampleCount
  }
}

function Save-BitmapEvidence {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$OutputPath,
    [hashtable]$Bounds
  )

  $directory = Split-Path -Parent $OutputPath
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $Bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sample = Measure-BitmapSamples -Bitmap $Bitmap
  return @{
    bounds = $Bounds
    distinctSampleColors = $sample.distinctSampleColors
    height = $Bitmap.Height
    nonBlackSampleCount = $sample.nonBlackSampleCount
    ok = $true
    path = $OutputPath
    sampleCount = $sample.sampleCount
    width = $Bitmap.Width
  }
}

function Resolve-CropRectangle {
  param([int]$Width, [int]$Height)

  if (-not $env:UNITY_QA_CROP_PATH) {
    return $null
  }

  $cssWidth = [double]$env:UNITY_QA_CROP_CSS_SCREEN_WIDTH
  $cssHeight = [double]$env:UNITY_QA_CROP_CSS_SCREEN_HEIGHT
  $scaleX = $Width / [Math]::Max(1.0, $cssWidth)
  $scaleY = $Height / [Math]::Max(1.0, $cssHeight)
  $left = ([double]$env:UNITY_QA_CROP_CENTER_X - [double]$env:UNITY_QA_CROP_EXTENT_LEFT - [double]$env:UNITY_QA_CROP_PADDING) * $scaleX
  $top = ([double]$env:UNITY_QA_CROP_CENTER_Y - [double]$env:UNITY_QA_CROP_EXTENT_TOP - [double]$env:UNITY_QA_CROP_PADDING) * $scaleY
  $right = ([double]$env:UNITY_QA_CROP_CENTER_X + [double]$env:UNITY_QA_CROP_EXTENT_RIGHT + [double]$env:UNITY_QA_CROP_PADDING) * $scaleX
  $bottom = ([double]$env:UNITY_QA_CROP_CENTER_Y + [double]$env:UNITY_QA_CROP_EXTENT_BOTTOM + [double]$env:UNITY_QA_CROP_PADDING) * $scaleY
  $x = [Math]::Max(0, [Math]::Floor($left))
  $y = [Math]::Max(0, [Math]::Floor($top))
  $cropRight = [Math]::Min($Width, [Math]::Ceiling($right))
  $cropBottom = [Math]::Min($Height, [Math]::Ceiling($bottom))
  $cropWidth = [Math]::Max(1, $cropRight - $x)
  $cropHeight = [Math]::Max(1, $cropBottom - $y)
  return New-Object System.Drawing.Rectangle $x, $y, $cropWidth, $cropHeight
}

function Save-CropEvidence {
  param([System.Drawing.Bitmap]$SourceBitmap)

  $cropRectangle = Resolve-CropRectangle -Width $SourceBitmap.Width -Height $SourceBitmap.Height
  if ($null -eq $cropRectangle) {
    return $null
  }

  $cropBitmap = $SourceBitmap.Clone($cropRectangle, $SourceBitmap.PixelFormat)
  try {
    return Save-BitmapEvidence -Bitmap $cropBitmap -OutputPath $env:UNITY_QA_CROP_PATH -Bounds @{
      bottom = $cropRectangle.Bottom
      left = $cropRectangle.Left
      right = $cropRectangle.Right
      top = $cropRectangle.Top
    }
  } finally {
    $cropBitmap.Dispose()
  }
}

try {
  $targetPid = [int]$env:UNITY_QA_TARGET_PID
  $timeoutMs = [int]$env:UNITY_QA_TIMEOUT_MS
  $target = Get-TargetProcess -TargetPid $targetPid -TimeoutMs $timeoutMs
  $rect = New-Object WindowCaptureNative+RECT
  if (-not [WindowCaptureNative]::GetWindowRect($target.MainWindowHandle, [ref]$rect)) {
    throw 'GetWindowRect failed'
  }

  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
    $evidence = Save-BitmapEvidence -Bitmap $bitmap -OutputPath $env:UNITY_QA_SCREENSHOT_PATH -Bounds @{
      bottom = $rect.Bottom
      left = $rect.Left
      right = $rect.Right
      top = $rect.Top
    }
    $evidence.crop = Save-CropEvidence -SourceBitmap $bitmap
    $evidence | ConvertTo-Json -Depth 5 -Compress
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
} catch {
  @{
    error = $_.Exception.Message
    ok = $false
    path = $env:UNITY_QA_SCREENSHOT_PATH
  } | ConvertTo-Json -Compress
  exit 1
}
