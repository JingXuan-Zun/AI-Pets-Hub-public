

const windowMoveMatchingScript = String.raw`function Test-DesktopPetWindowMatchesCandidate($processName, $title, $candidateQueries) {
  if ($null -eq $candidateQueries -or @($candidateQueries).Count -eq 0) {
    return $true
  }

  $normalizedProcess = Normalize-DesktopPetText $processName
  $normalizedTitle = Normalize-DesktopPetText $title
  foreach ($candidateQuery in $candidateQueries) {
    $normalizedQuery = Normalize-DesktopPetText $candidateQuery
    if (-not $normalizedQuery) {
      continue
    }

    if (
      $normalizedProcess -eq $normalizedQuery -or
      $normalizedTitle -eq $normalizedQuery -or
      $normalizedProcess.Contains($normalizedQuery) -or
      $normalizedTitle.Contains($normalizedQuery)
    ) {
      return $true
    }
  }

  return $false
}

function Get-DesktopPetWindowTitle($handle) {
  $length = [Math]::Max(1024, [DesktopPetWindowMove]::GetWindowTextLength($handle) + 1)
  $builder = New-Object System.Text.StringBuilder $length
  [void][DesktopPetWindowMove]::GetWindowText($handle, $builder, $builder.Capacity)
  return [string]$builder.ToString()
}

function Get-DesktopPetWindowBounds($handle) {
  $rect = New-Object DesktopPetWindowMoveRect
  $hasRect = [DesktopPetWindowMove]::GetWindowRect($handle, [ref]$rect)
  if (-not $hasRect) {
    return $null
  }

  return @{
    x = $rect.Left
    y = $rect.Top
    width = [Math]::Max(0, $rect.Right - $rect.Left)
    height = [Math]::Max(0, $rect.Bottom - $rect.Top)
  }
}

function Get-DesktopPetTopLevelWindows {
  $windows = @()
  foreach ($rawWindow in @([DesktopPetWindowMove]::EnumerateTopLevelWindows())) {
    $process = $null
    try {
      $process = Get-Process -Id ([int]$rawWindow.Pid) -ErrorAction Stop
    } catch {
      continue
    }

    $windows += [PSCustomObject]@{
      Bounds = @{
        x = [int]$rawWindow.X
        y = [int]$rawWindow.Y
        width = [int]$rawWindow.Width
        height = [int]$rawWindow.Height
      }
      Handle = [IntPtr]([int64]$rawWindow.Hwnd)
      Hwnd = [int64]$rawWindow.Hwnd
      Pid = [int]$rawWindow.Pid
      Process = $process
      ProcessName = [string]$process.ProcessName
      Title = [string]$rawWindow.Title
      TopLevelOrder = [int]$rawWindow.TopLevelOrder
    }
  }

  return @($windows)
}

function Test-DesktopPetBoundsInsideTarget($bounds) {
  if ($null -eq $bounds) {
    return $false
  }

  $centerX = [double]$bounds.x + ([double]$bounds.width / 2)
  $centerY = [double]$bounds.y + ([double]$bounds.height / 2)
  return $centerX -ge $targetX -and $centerX -lt ($targetX + $targetWidth) -and $centerY -ge $targetY -and $centerY -lt ($targetY + $targetHeight)
}

function Normalize-DesktopPetDisplayText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[^a-z0-9]+', ''
}

$screens = @([System.Windows.Forms.Screen]::AllScreens)
`;

module.exports = { windowMoveMatchingScript };
