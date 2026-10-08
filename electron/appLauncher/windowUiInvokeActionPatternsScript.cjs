

const windowUiInvokeActionPatternsScript = String.raw`function Invoke-DesktopPetUiControlAction($record, $requestedAction, $value) {
  $resolvedAction = Resolve-DesktopPetUiAction $record $requestedAction $value
  if ([string]::IsNullOrWhiteSpace($resolvedAction) -or -not (Test-DesktopPetUiActionSupported $record $resolvedAction)) {
    return [PSCustomObject]@{
      applied = $false
      error = "Matched UI Automation control does not support action '$requestedAction'."
      method = ''
      resolvedAction = $resolvedAction
    }
  }

  try {
    switch ($resolvedAction) {
      'invoke' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $pattern.Invoke()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-invoke-pattern'; resolvedAction = $resolvedAction }
      }
      'select' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $pattern.Select()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-selection-item-pattern'; resolvedAction = $resolvedAction }
      }
      'toggle' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
        $pattern.Toggle()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-toggle-pattern'; resolvedAction = $resolvedAction }
      }
      'expand' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
        $pattern.Expand()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-expand-collapse-pattern.expand'; resolvedAction = $resolvedAction }
      }
      'collapse' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
        $pattern.Collapse()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-expand-collapse-pattern.collapse'; resolvedAction = $resolvedAction }
      }
      'focus' {
        $record.element.SetFocus()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-automation-element.set-focus'; resolvedAction = $resolvedAction }
      }
      'scroll_into_view' {
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern)
        $pattern.ScrollIntoView()
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-scroll-item-pattern.scroll-into-view'; resolvedAction = $resolvedAction }
      }
      'set_value' {
        if ([string]::IsNullOrWhiteSpace([string]$value)) {
          return [PSCustomObject]@{
            applied = $false
            error = 'UI Automation set_value needs a non-empty value.'
            method = 'uia-value-pattern'
            resolvedAction = $resolvedAction
          }
        }
        $pattern = $record.element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $pattern.SetValue([string]$value)
        return [PSCustomObject]@{ applied = $true; error = ''; method = 'uia-value-pattern'; resolvedAction = $resolvedAction }
      }
      default {
        return [PSCustomObject]@{
          applied = $false
          error = "Unsupported UI Automation action '$resolvedAction'."
          method = ''
          resolvedAction = $resolvedAction
        }
      }
    }
  } catch {
    return [PSCustomObject]@{
      applied = $false
      error = $_.Exception.Message
      method = ''
      resolvedAction = $resolvedAction
    }
  }
}

function New-DesktopPetUiControlRecord($element, $depth, $parentIndex) {
  $current = $element.Current
  $name = ''
  $currentAutomationId = ''
  $className = ''
  $currentControlType = ''
  $isEnabled = $false
  $isOffscreen = $false
  $isKeyboardFocusable = $false
  $hasKeyboardFocus = $false
  $rect = $null
  try { $name = [string]$current.Name } catch {}
  try { $currentAutomationId = [string]$current.AutomationId } catch {}
  try { $className = [string]$current.ClassName } catch {}
  try { $currentControlType = ([string]$current.ControlType.ProgrammaticName) -replace '^ControlType\.', '' } catch {}
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

  return [PSCustomObject]@{
    actions = $supportedActions
    automationId = $currentAutomationId
    bounds = $bounds
    centerX = $centerX
    centerY = $centerY
    className = $className
    controlType = $currentControlType
    depth = [int]$depth
    element = $element
    enabled = [bool]$isEnabled
    hasKeyboardFocus = [bool]$hasKeyboardFocus
    keyboardFocusable = [bool]$isKeyboardFocusable
    name = $name
    offscreen = [bool]$isOffscreen
    parentIndex = [int]$parentIndex
    selected = $selectionState.isSelected
    selectionItem = [bool]$selectionState.selectionItem
  }
}

function Export-DesktopPetUiControlRecord($record) {
  if ($null -eq $record) {
    return $null
  }

  return [PSCustomObject]@{
    actions = @($record.actions)
    automationId = [string]$record.automationId
    bounds = $record.bounds
    centerX = $record.centerX
    centerY = $record.centerY
    className = [string]$record.className
    controlType = [string]$record.controlType
    depth = [int]$record.depth
    enabled = [bool]$record.enabled
    hasKeyboardFocus = [bool]$record.hasKeyboardFocus
    index = [int]$record.index
    keyboardFocusable = [bool]$record.keyboardFocusable
    matchScore = [int]$record.matchScore
    name = [string]$record.name
    offscreen = [bool]$record.offscreen
    parentIndex = [int]$record.parentIndex
    selected = $record.selected
    selectionItem = [bool]$record.selectionItem
  }
}

`;

module.exports = { windowUiInvokeActionPatternsScript };
