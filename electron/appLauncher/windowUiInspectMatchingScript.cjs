

const windowUiInspectMatchingScript = String.raw`'))
$request = $requestJson | ConvertFrom-Json

function Normalize-DesktopPetUiText($value) {
  if ($null -eq $value) {
    return ''
  }

  return ([string]$value).Normalize([System.Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant() -replace '[\s\p{P}\p{S}_]+', ''
}

function Get-DesktopPetWindowMatchScore($window, $query) {
  $normalizedQuery = Normalize-DesktopPetUiText $query
  if ([string]::IsNullOrWhiteSpace($normalizedQuery)) {
    return 0
  }

  $parts = @(
    [string]$window.title,
    [string]$window.processName,
    [IO.Path]::GetFileNameWithoutExtension([string]$window.path),
    [string]$window.path
  )
  $best = 0
  foreach ($part in $parts) {
    $normalizedPart = Normalize-DesktopPetUiText $part
    if ([string]::IsNullOrWhiteSpace($normalizedPart)) {
      continue
    }
    if ($normalizedPart -eq $normalizedQuery) {
      $best = [Math]::Max($best, 100)
    } elseif ($normalizedPart.StartsWith($normalizedQuery)) {
      $best = [Math]::Max($best, 86)
    } elseif ($normalizedPart.Contains($normalizedQuery)) {
      $best = [Math]::Max($best, 74)
    } elseif ($normalizedQuery.Contains($normalizedPart)) {
      $best = [Math]::Max($best, 48)
    }
  }

  return $best
}

function Get-DesktopPetUiMatchScore($name, $automationId, $controlType, $targetText, $targetDescription) {
  $normalizedTarget = Normalize-DesktopPetUiText $targetText
  $normalizedDescription = Normalize-DesktopPetUiText $targetDescription
  $haystacks = @(
    Normalize-DesktopPetUiText $name,
    Normalize-DesktopPetUiText $automationId,
    Normalize-DesktopPetUiText $controlType
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  $best = 0
  foreach ($haystack in $haystacks) {
    if (-not [string]::IsNullOrWhiteSpace($normalizedTarget)) {
      if ($haystack -eq $normalizedTarget) {
        $best = [Math]::Max($best, 100)
      } elseif ($haystack.StartsWith($normalizedTarget)) {
        $best = [Math]::Max($best, 86)
      } elseif ($haystack.Contains($normalizedTarget)) {
        $best = [Math]::Max($best, 78)
      } elseif ($normalizedTarget.Contains($haystack)) {
        $best = [Math]::Max($best, 50)
      }
    }

    if (-not [string]::IsNullOrWhiteSpace($normalizedDescription) -and $normalizedDescription.Contains($haystack)) {
      $best = [Math]::Max($best, 45)
    }
  }

  return $best
}

function Get-DesktopPetUiSupportedActions($element) {
  $actions = New-Object System.Collections.Generic.List[string]
  try {
    foreach ($pattern in @($element.GetSupportedPatterns())) {
      $name = [string]$pattern.ProgrammaticName
      switch -Regex ($name) {
        'InvokePattern$' { if (-not $actions.Contains('invoke')) { $actions.Add('invoke') } }
        'ValuePattern$' { if (-not $actions.Contains('value')) { $actions.Add('value') } }
        'TextPattern$' { if (-not $actions.Contains('text')) { $actions.Add('text') } }
        'SelectionItemPattern$' { if (-not $actions.Contains('select')) { $actions.Add('select') } }
        'ExpandCollapsePattern$' { if (-not $actions.Contains('expand-collapse')) { $actions.Add('expand-collapse') } }
        'TogglePattern$' { if (-not $actions.Contains('toggle')) { $actions.Add('toggle') } }
        'ScrollItemPattern$' { if (-not $actions.Contains('scroll-into-view')) { $actions.Add('scroll-into-view') } }
      }
    }
  } catch {
  }

  return @($actions)
}

function Get-DesktopPetUiSelectionState($element) {
  try {
    $pattern = $element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    if ($null -ne $pattern) {
      return [PSCustomObject]@{
        isSelected = [bool]$pattern.Current.IsSelected
        selectionItem = $true
      }
    }
  } catch {
  }

  return [PSCustomObject]@{
    isSelected = $null
    selectionItem = $false
  }
}

function New-DesktopPetUiControlRecord($element, $depth, $parentIndex, $targetText, $targetDescription) {
  $current = $element.Current
  $name = ''
  $automationId = ''
  $className = ''
  $controlType = ''
  $isEnabled = $false
  $isOffscreen = $false
  $isKeyboardFocusable = $false
  $hasKeyboardFocus = $false
  $rect = $null
  try { $name = [string]$current.Name } catch {}
  try { $automationId = [string]$current.AutomationId } catch {}
  try { $className = [string]$current.ClassName } catch {}
  try { $controlType = ([string]$current.ControlType.ProgrammaticName) -replace '^ControlType\.', '' } catch {}
  try { $isEnabled = [bool]$current.IsEnabled } catch {}
  try { $isOffscreen = [bool]$current.IsOffscreen } catch {}
  try { $isKeyboardFocusable = [bool]$current.IsKeyboardFocusable } catch {}
  try { $hasKeyboardFocus = [bool]$current.HasKeyboardFocus } catch {}
  try { $rect = $current.BoundingRectangle } catch {}

  $bounds = $null
  $centerX = $null
  $centerY = $null
  if ($null -ne $rect -and -not $rect.IsEmpty -and $rect.Width -gt 1 -and $rect.Height -gt 1) {
    $bounds = @{
      coordinateSpace = 'native-screen'
      height = [int][Math]::Round($rect.Height)
      source = 'ui-automation'
      width = [int][Math]::Round($rect.Width)
      x = [int][Math]::Round($rect.Left)
      y = [int][Math]::Round($rect.Top)
    }
    $centerX = [int][Math]::Round($rect.Left + ($rect.Width / 2))
    $centerY = [int][Math]::Round($rect.Top + ($rect.Height / 2))
  }

  $supportedActions = @(Get-DesktopPetUiSupportedActions $element)
  $selectionState = Get-DesktopPetUiSelectionState $element
  if ($isKeyboardFocusable -and -not $supportedActions.Contains('focus')) {
    $supportedActions += 'focus'
  }
  $matchScore = Get-DesktopPetUiMatchScore $name $automationId $controlType $targetText $targetDescription

  return [PSCustomObject]@{
    actions = $supportedActions
    automationId = $automationId
    bounds = $bounds
    centerX = $centerX
    centerY = $centerY
    className = $className
    controlType = $controlType
    depth = [int]$depth
    enabled = [bool]$isEnabled
    hasKeyboardFocus = [bool]$hasKeyboardFocus
    keyboardFocusable = [bool]$isKeyboardFocusable
    matchScore = [int]$matchScore
    name = $name
    offscreen = [bool]$isOffscreen
    parentIndex = [int]$parentIndex
    selected = $selectionState.isSelected
    selectionItem = [bool]$selectionState.selectionItem
  }
}

$limit = [Math]::Max(1, [Math]::Min(200, [int]$request.limit))
$maxDepth = [Math]::Max(1, [Math]::Min(10, [int]$request.maxDepth))
$query = [string]$request.query
$targetText = [string]$request.targetText
$targetDescription = [string]$request.targetDescription
$requestedHwnd = [int64]$request.hwnd
$windows = @(Get-DesktopPetTopLevelWindows)
`;

module.exports = { windowUiInspectMatchingScript };
