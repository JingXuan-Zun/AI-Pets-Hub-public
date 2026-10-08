

const windowUiInvokeControlScoringScript = String.raw`function Get-DesktopPetUiControlRequestScore($record, $request) {
  $score = 0
  $targetText = [string]$request.targetText
  $targetDescription = [string]$request.targetDescription
  $automationId = [string]$request.automationId
  $controlType = [string]$request.controlType
  $requestedUiAction = Normalize-DesktopPetRequestedUiAction $request.uiAction
  $pointX = $request.x
  $pointY = $request.y

  if (-not [string]::IsNullOrWhiteSpace($targetText)) {
    $score = [Math]::Max($score, Get-DesktopPetUiTextScore $record.name $targetText)
    $score = [Math]::Max($score, Get-DesktopPetUiTextScore $record.automationId $targetText)
    $score = [Math]::Max($score, Get-DesktopPetUiTextScore $record.controlType $targetText)
  }
  if (-not [string]::IsNullOrWhiteSpace($targetDescription)) {
    $score = [Math]::Max($score, [int]((Get-DesktopPetUiTextScore $record.name $targetDescription) * 0.7))
    $score = [Math]::Max($score, [int]((Get-DesktopPetUiTextScore $record.automationId $targetDescription) * 0.7))
  }
  if (-not [string]::IsNullOrWhiteSpace($automationId)) {
    $score = [Math]::Max($score, (Get-DesktopPetUiTextScore $record.automationId $automationId) + 30)
  }
  if (-not [string]::IsNullOrWhiteSpace($controlType)) {
    $score = [Math]::Max($score, (Get-DesktopPetUiTextScore $record.controlType $controlType) + 10)
  }
  if ($null -ne $pointX -and $null -ne $pointY -and $null -ne $record.bounds) {
    $x = [double]$pointX
    $y = [double]$pointY
    $left = [double]$record.bounds.x
    $top = [double]$record.bounds.y
    $right = $left + [double]$record.bounds.width
    $bottom = $top + [double]$record.bounds.height
    if ($x -ge $left -and $x -le $right -and $y -ge $top -and $y -le $bottom) {
      $score = [Math]::Max($score, 92)
    } elseif ($null -ne $record.centerX -and $null -ne $record.centerY) {
      $distance = [Math]::Sqrt([Math]::Pow(([double]$record.centerX - $x), 2) + [Math]::Pow(([double]$record.centerY - $y), 2))
      if ($distance -le 48) {
        $score = [Math]::Max($score, [int](80 - $distance))
      }
    }
  }

  if (Test-DesktopPetUiActionSupported $record $requestedUiAction) {
    $score += 36
  } elseif (@($record.actions) -contains 'invoke') {
    $score += 16
  }
  if ($record.enabled) {
    $score += 8
  }
  if ($record.offscreen) {
    $score -= 80
  }

  return [int]$score
}

$limit = [Math]::Max(1, [Math]::Min(250, [int]$request.limit))
$maxDepth = [Math]::Max(1, [Math]::Min(10, [int]$request.maxDepth))
$query = [string]$request.query
$requestedHwnd = [int64]$request.hwnd
$windows = @(Get-DesktopPetTopLevelWindows)
$targetWindow = $null
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
    candidates = @()
    control = $null
    error = 'No matching window handle found.'
    invoked = $false
    ok = $false
    query = $query
    window = $null
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$root = [System.Windows.Automation.AutomationElement]::FromHandle($targetHandle)
if ($null -eq $root) {
  @{
    candidates = @()
    control = $null
    error = 'UI Automation could not attach to the target window.'
    invoked = $false
    ok = $false
    query = $query
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

  $record = New-DesktopPetUiControlRecord $element $depth $parentIndex
  $hasBounds = $null -ne $record.bounds
  $hasLabel = -not [string]::IsNullOrWhiteSpace($record.name) -or -not [string]::IsNullOrWhiteSpace($record.automationId)
  $interestingTypes = @('Window', 'Pane', 'Button', 'Edit', 'Text', 'ListItem', 'MenuItem', 'Hyperlink', 'TabItem', 'CheckBox', 'RadioButton', 'ComboBox', 'DataItem', 'TreeItem', 'Document')
  $isInteresting = $depth -eq 0 -or $interestingTypes -contains $record.controlType -or $record.actions.Count -gt 0
  if (-not $isInteresting -or (-not $hasLabel -and -not $hasBounds -and $depth -gt 0)) {
    return $parentIndex
  }

  $record | Add-Member -NotePropertyName index -NotePropertyValue ([int]$controls.Count) -Force
  $record | Add-Member -NotePropertyName matchScore -NotePropertyValue (Get-DesktopPetUiControlRequestScore $record $request) -Force
  [void]$controls.Add($record)
  return [int]$record.index
}

`;

module.exports = { windowUiInvokeControlScoringScript };
