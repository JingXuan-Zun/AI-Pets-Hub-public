const desktopIconMetadataPowerShellBlock = String.raw`function Get-DesktopPetDesktopFolders {
  $folders = New-Object System.Collections.Generic.List[string]
  foreach ($kind in @('Desktop', 'CommonDesktopDirectory')) {
    try {
      $folder = [Environment]::GetFolderPath($kind)
      if (-not [string]::IsNullOrWhiteSpace($folder) -and (Test-Path -LiteralPath $folder)) {
        $folders.Add($folder)
      }
    } catch {}
  }

  $folders | Select-Object -Unique
}

function Get-DesktopPetShortcutTargetPath($entry) {
  $extension = [IO.Path]::GetExtension($entry.Name).ToLowerInvariant()
  if ($extension -ne '.lnk') {
    return ''
  }

  try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($entry.FullName)
    return [string]$shortcut.TargetPath
  } catch {
    return ''
  }
}

function New-DesktopPetFileMetadata($entry) {
  $extension = ''
  if (-not $entry.PSIsContainer) {
    $extension = [IO.Path]::GetExtension($entry.Name).TrimStart('.').ToLowerInvariant()
  }
  $rawExtension = if ($entry.PSIsContainer) { '' } else { [IO.Path]::GetExtension($entry.Name).ToLowerInvariant() }
  $isShortcut = @('.lnk', '.url', '.appref-ms') -contains $rawExtension
  $targetPath = Get-DesktopPetShortcutTargetPath $entry

  [pscustomobject]@{
    extension = $extension
    filePath = [string]$entry.FullName
    isDirectory = [bool]$entry.PSIsContainer
    isFile = -not [bool]$entry.PSIsContainer
    isShortcut = [bool]$isShortcut
    isSystemIcon = $false
    itemKind = if ($entry.PSIsContainer) { 'folder' } elseif ($isShortcut) { 'shortcut' } else { 'file' }
    path = [string]$entry.FullName
    targetPath = $targetPath
  }
}

function Add-DesktopPetMetadataCandidate($map, $key, $metadata) {
  if ([string]::IsNullOrWhiteSpace($key)) {
    return
  }

  $normalizedKey = $key.Trim().ToLowerInvariant()
  if (-not $map.ContainsKey($normalizedKey)) {
    $map[$normalizedKey] = New-Object System.Collections.Generic.List[object]
  }

  $map[$normalizedKey].Add($metadata)
}

function Get-DesktopPetFileMetadataMap {
  $map = @{}
  foreach ($folder in Get-DesktopPetDesktopFolders) {
    try {
      foreach ($entry in Get-ChildItem -LiteralPath $folder -Force -ErrorAction SilentlyContinue) {
        $metadata = New-DesktopPetFileMetadata $entry
        Add-DesktopPetMetadataCandidate $map $entry.Name $metadata
        if (-not $entry.PSIsContainer) {
          Add-DesktopPetMetadataCandidate $map ([IO.Path]::GetFileNameWithoutExtension($entry.Name)) $metadata
        }
      }
    } catch {}
  }

  return $map
}

function Find-DesktopPetFileMetadata($map, $name) {
  if ([string]::IsNullOrWhiteSpace($name)) {
    return $null
  }

  try {
    $normalizedName = ([string]$name).Trim().ToLowerInvariant()
    if (-not $map.ContainsKey($normalizedName)) {
      return $null
    }

    $matchValue = $map[$normalizedName]
    $matches = @($matchValue)
    if ($matches.Count -ne 1) {
      return $null
    }

    return $matches[0]
  } catch {
    return $null
  }
}

function Test-DesktopPetSystemIconName($name) {
  if ([string]::IsNullOrWhiteSpace($name)) {
    return $false
  }

  $normalizedName = $name.Trim().ToLowerInvariant()
  return @(
    'control panel',
    'network',
    'recycle bin',
    'this pc'
  ) -contains $normalizedName
}

function Add-DesktopPetIconProperty($icon, $name, $value) {
  if ($null -eq $value) {
    return
  }

  $icon | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force
}

function Resolve-DesktopPetIconMetadata($icons) {
  if ($null -eq $icons) {
    return @()
  }

  $metadataMap = Get-DesktopPetFileMetadataMap
  foreach ($icon in @($icons)) {
    try {
      $metadata = Find-DesktopPetFileMetadata $metadataMap $icon.name
      if ($null -ne $metadata) {
        foreach ($propertyName in @('extension', 'filePath', 'isDirectory', 'isFile', 'isShortcut', 'isSystemIcon', 'itemKind', 'path', 'targetPath')) {
          Add-DesktopPetIconProperty $icon $propertyName $metadata.$propertyName
        }
      } elseif (Test-DesktopPetSystemIconName $icon.name) {
        Add-DesktopPetIconProperty $icon 'isSystemIcon' $true
        Add-DesktopPetIconProperty $icon 'itemKind' 'system-icon'
      }
    } catch {}
  }

  return @($icons)
}

`;

module.exports = { desktopIconMetadataPowerShellBlock };
