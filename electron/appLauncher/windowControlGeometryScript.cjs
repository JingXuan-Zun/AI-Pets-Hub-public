

const windowControlGeometryScript = String.raw`

function Get-DesktopPetWindowBounds($handle) {
  $rect = New-Object DesktopPetWindowRect
  $hasRect = [DesktopPetTopLevelWindowEnumerator]::GetWindowRect($handle, [ref]$rect)
  if (-not $hasRect) {
    return $null
  }

  return @{
    x = [int]$rect.Left
    y = [int]$rect.Top
    width = [Math]::Max(0, [int]($rect.Right - $rect.Left))
    height = [Math]::Max(0, [int]($rect.Bottom - $rect.Top))
  }
}

function Get-DesktopPetWindowState($handle) {
  if ([DesktopPetTopLevelWindowEnumerator]::IsIconic($handle)) {
    return 'minimized'
  }

  if ([DesktopPetTopLevelWindowEnumerator]::IsZoomed($handle)) {
    return 'maximized'
  }

  return 'normal'
}

function Normalize-DesktopPetDisplayText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Trim().ToLowerInvariant() -replace '[^a-z0-9]+', ''
}

function Resolve-DesktopPetTargetScreen($fallbackBounds) {
  $screens = @([System.Windows.Forms.Screen]::AllScreens)
  $targetScreen = $null

  if ($targetRole -eq 'primary') {
    $targetScreen = $screens | Where-Object { $_.Primary } | Select-Object -First 1
  } elseif ($targetRole -eq 'secondary') {
    $targetScreen = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
  } elseif ($targetIndex -gt 0 -and $targetIndex -le $screens.Count) {
    $targetScreen = $screens[$targetIndex - 1]
  } elseif (-not [string]::IsNullOrWhiteSpace($targetDisplayText)) {
    $normalizedDisplayText = Normalize-DesktopPetDisplayText $targetDisplayText
    $targetScreen = $screens | Where-Object {
      $deviceName = Normalize-DesktopPetDisplayText $_.DeviceName
      $deviceName -eq $normalizedDisplayText -or $deviceName.Contains($normalizedDisplayText) -or $normalizedDisplayText.Contains($deviceName)
    } | Select-Object -First 1
  }

  if ($null -eq $targetScreen -and $null -ne $fallbackBounds) {
    $centerX = [double]$fallbackBounds.x + ([double]$fallbackBounds.width / 2)
    $centerY = [double]$fallbackBounds.y + ([double]$fallbackBounds.height / 2)
    $targetScreen = $screens | Where-Object {
      $centerX -ge $_.Bounds.X -and $centerX -lt ($_.Bounds.X + $_.Bounds.Width) -and $centerY -ge $_.Bounds.Y -and $centerY -lt ($_.Bounds.Y + $_.Bounds.Height)
    } | Select-Object -First 1
  }

  if ($null -eq $targetScreen) {
    $targetScreen = $screens | Where-Object { $_.Primary } | Select-Object -First 1
  }

  return $targetScreen
}

function Convert-DesktopPetScreenSummary($screen) {
  if ($null -eq $screen) {
    return $null
  }

  return @{
    deviceName = [string]$screen.DeviceName
    primary = [bool]$screen.Primary
    bounds = @{
      x = [int]$screen.Bounds.X
      y = [int]$screen.Bounds.Y
      width = [int]$screen.Bounds.Width
      height = [int]$screen.Bounds.Height
    }
    workArea = @{
      x = [int]$screen.WorkingArea.X
      y = [int]$screen.WorkingArea.Y
      width = [int]$screen.WorkingArea.Width
      height = [int]$screen.WorkingArea.Height
    }
  }
}

`;

module.exports = { windowControlGeometryScript };
