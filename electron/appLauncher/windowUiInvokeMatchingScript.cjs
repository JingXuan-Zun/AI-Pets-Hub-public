

const windowUiInvokeMatchingScript = String.raw`'))
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

function Get-DesktopPetUiTextScore($haystack, $needle) {
  $normalizedHaystack = Normalize-DesktopPetUiText $haystack
  $normalizedNeedle = Normalize-DesktopPetUiText $needle
  if ([string]::IsNullOrWhiteSpace($normalizedHaystack) -or [string]::IsNullOrWhiteSpace($normalizedNeedle)) {
    return 0
  }

  if ($normalizedHaystack -eq $normalizedNeedle) {
    return 100
  }
  if ($normalizedHaystack.StartsWith($normalizedNeedle)) {
    return 86
  }
  if ($normalizedHaystack.Contains($normalizedNeedle)) {
    return 78
  }
  if ($normalizedNeedle.Contains($normalizedHaystack)) {
    return 50
  }

  return 0
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

function Normalize-DesktopPetRequestedUiAction($value) {
  $text = (Normalize-DesktopPetUiText $value)
  switch ($text) {
    'auto' { return 'auto' }
    'invoke' { return 'invoke' }
    'click' { return 'invoke' }
    'select' { return 'select' }
    'selectitem' { return 'select' }
    'toggle' { return 'toggle' }
    'check' { return 'toggle' }
    'uncheck' { return 'toggle' }
    'expand' { return 'expand' }
    'expandcontrol' { return 'expand' }
    'collapse' { return 'collapse' }
    'collapsecontrol' { return 'collapse' }
    'focus' { return 'focus' }
    'focuscontrol' { return 'focus' }
    'setfocus' { return 'focus' }
    'keyboardfocus' { return 'focus' }
    'scroll' { return 'scroll_into_view' }
    'scrollintoview' { return 'scroll_into_view' }
    'scrollitem' { return 'scroll_into_view' }
    'scrollitemintoview' { return 'scroll_into_view' }
    'setvalue' { return 'set_value' }
    'value' { return 'set_value' }
    'settext' { return 'set_value' }
    default { return $text }
  }
}

function Test-DesktopPetUiActionSupported($record, $uiAction) {
  $actions = @($record.actions)
  switch ($uiAction) {
    'auto' { return $actions.Count -gt 0 }
    'invoke' { return $actions -contains 'invoke' }
    'select' { return $actions -contains 'select' }
    'toggle' { return $actions -contains 'toggle' }
    'expand' { return $actions -contains 'expand-collapse' }
    'collapse' { return $actions -contains 'expand-collapse' }
    'focus' { return [bool]$record.keyboardFocusable -and [bool]$record.enabled -and -not [bool]$record.offscreen }
    'scroll_into_view' { return $actions -contains 'scroll-into-view' }
    'set_value' { return $actions -contains 'value' }
    default { return $false }
  }
}

function Resolve-DesktopPetUiAction($record, $requestedAction, $value) {
  $actions = @($record.actions)
  if ($requestedAction -ne 'auto') {
    return $requestedAction
  }

  if ($actions -contains 'invoke') {
    return 'invoke'
  }
  if ($actions -contains 'select') {
    return 'select'
  }
  if ($actions -contains 'toggle') {
    return 'toggle'
  }
  if ($actions -contains 'expand-collapse') {
    return 'expand'
  }
  if ([bool]$record.keyboardFocusable) {
    return 'focus'
  }
  if ($actions -contains 'scroll-into-view') {
    return 'scroll_into_view'
  }
  if (($actions -contains 'value') -and -not [string]::IsNullOrWhiteSpace([string]$value)) {
    return 'set_value'
  }

  return ''
}

`;

module.exports = { windowUiInvokeMatchingScript };
