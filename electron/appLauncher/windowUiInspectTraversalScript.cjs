

const windowUiInspectTraversalScript = String.raw`$targetWindow = $null
$targetHandle = [IntPtr]::Zero

if ($requestedHwnd -ne 0) {
  $targetWindow = $windows | Where-Object { [int64]$_.hwnd -eq $requestedHwnd } | Select-Object -First 1
  $targetHandle = [IntPtr]$requestedHwnd
} elseif (-not [string]::IsNullOrWhiteSpace($query)) {
  $windowMatches = @($windows | ForEach-Object {
    $score = Get-DesktopPetWindowMatchScore $_ $query
    if ($score -gt 0) {
      $_ | Add-Member -NotePropertyName matchScore -NotePropertyValue $score -Force
      $_
    }
  })
  $targetWindow = $windowMatches | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'topLevelOrder'; Ascending = $true } | Select-Object -First 1
  if ($null -ne $targetWindow -and $null -ne $targetWindow.handle) {
    $targetHandle = $targetWindow.handle
  }
} else {
  $targetHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
  if ($targetHandle -ne [IntPtr]::Zero) {
    $targetWindow = $windows | Where-Object { [int64]$_.hwnd -eq [int64]$targetHandle.ToInt64() } | Select-Object -First 1
  }
}

if ($null -eq $targetHandle -or $targetHandle -eq [IntPtr]::Zero) {
  @{
    controls = @()
    error = 'No matching window handle found.'
    matchedControls = @()
    ok = $false
    query = $query
    targetText = $targetText
    window = $null
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$root = [System.Windows.Automation.AutomationElement]::FromHandle($targetHandle)
if ($null -eq $root) {
  @{
    controls = @()
    error = 'UI Automation could not attach to the target window.'
    matchedControls = @()
    ok = $false
    query = $query
    targetText = $targetText
    window = $targetWindow
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$controls = New-Object System.Collections.ArrayList

function Add-DesktopPetUiControl($element, $depth, $parentIndex) {
  if ($controls.Count -ge $limit) {
    return -1
  }

  $record = New-DesktopPetUiControlRecord $element $depth $parentIndex $targetText $targetDescription
  $hasBounds = $null -ne $record.bounds
  $hasLabel = -not [string]::IsNullOrWhiteSpace($record.name) -or -not [string]::IsNullOrWhiteSpace($record.automationId)
  $interestingTypes = @('Window', 'Pane', 'Button', 'Edit', 'Text', 'ListItem', 'MenuItem', 'Hyperlink', 'TabItem', 'CheckBox', 'RadioButton', 'ComboBox', 'DataItem', 'TreeItem', 'Document')
  $isInteresting = $depth -eq 0 -or $interestingTypes -contains $record.controlType -or $record.actions.Count -gt 0 -or $record.matchScore -gt 0
  if (-not $isInteresting -or (-not $hasLabel -and -not $hasBounds -and $depth -gt 0)) {
    return $parentIndex
  }

  $record | Add-Member -NotePropertyName index -NotePropertyValue ([int]$controls.Count) -Force
  [void]$controls.Add($record)
  return [int]$record.index
}

function Visit-DesktopPetUiElement($element, $depth, $parentIndex) {
  if ($null -eq $element -or $controls.Count -ge $limit) {
    return
  }

  $currentIndex = Add-DesktopPetUiControl $element $depth $parentIndex
  if ($depth -ge $maxDepth) {
    return
  }

  $child = $null
  try { $child = $walker.GetFirstChild($element) } catch { $child = $null }
  while ($null -ne $child -and $controls.Count -lt $limit) {
    Visit-DesktopPetUiElement $child ($depth + 1) $currentIndex
    try { $child = $walker.GetNextSibling($child) } catch { $child = $null }
  }
}

Visit-DesktopPetUiElement $root 0 -1

$scoredControls = @($controls | Where-Object { [int]$_.matchScore -gt 0 })
$matchedControls = @($scoredControls | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'depth'; Ascending = $true }, @{ Expression = 'index'; Ascending = $true } | Select-Object -First 12)

@{
  controlCount = [int]$controls.Count
  controls = @($controls)
  matchedControls = @($matchedControls)
  ok = $true
  query = $query
  targetDescription = $targetDescription
  targetText = $targetText
  window = $targetWindow
} | ConvertTo-Json -Depth 9 -Compress
`;

module.exports = { windowUiInspectTraversalScript };
