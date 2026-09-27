param(
  [int]$DelaySeconds = 0,
  [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopUiaInvokeLabNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  public static object SnapshotWindow(IntPtr handle) {
    if (handle == IntPtr.Zero) {
      return new {
        hwnd = 0L,
        pid = 0,
        processName = "",
        title = ""
      };
    }

    uint pid;
    GetWindowThreadProcessId(handle, out pid);
    var titleBuilder = new StringBuilder(512);
    GetWindowText(handle, titleBuilder, titleBuilder.Capacity);
    string processName = "";
    try {
      processName = Process.GetProcessById((int)pid).ProcessName;
    } catch {
    }

    return new {
      hwnd = handle.ToInt64(),
      pid = (int)pid,
      processName = processName,
      title = titleBuilder.ToString()
    };
  }
}
"@

function Convert-UiaRect {
  param($Rect)

  if ($null -eq $Rect) {
    return $null
  }

  return @{
    x = [double]$Rect.X
    y = [double]$Rect.Y
    width = [double]$Rect.Width
    height = [double]$Rect.Height
  }
}

function Get-UiaElementSnapshot {
  param($Element)

  if ($null -eq $Element) {
    return $null
  }

  $current = $Element.Current
  return @{
    name = [string]$current.Name
    automationId = [string]$current.AutomationId
    className = [string]$current.ClassName
    frameworkId = [string]$current.FrameworkId
    controlType = if ($current.ControlType) { [string]$current.ControlType.ProgrammaticName } else { '' }
    processId = [int]$current.ProcessId
    nativeWindowHandle = [int]$current.NativeWindowHandle
    isEnabled = [bool]$current.IsEnabled
    isKeyboardFocusable = [bool]$current.IsKeyboardFocusable
    hasKeyboardFocus = [bool]$current.HasKeyboardFocus
    boundingRectangle = Convert-UiaRect $current.BoundingRectangle
  }
}

function Try-UiaPatternAction {
  param(
    $Element,
    [string]$Name,
    $Pattern,
    [scriptblock]$Action
  )

  $patternObject = $null
  $available = $false
  $ok = $false
  $errorText = ''
  try {
    $available = [bool]$Element.TryGetCurrentPattern($Pattern, [ref]$patternObject)
    if ($available -and $null -ne $patternObject) {
      & $Action $patternObject
      $ok = $true
    }
  } catch {
    $errorText = $_.Exception.Message
  }

  return @{
    name = $Name
    available = [bool]$available
    ok = [bool]$ok
    error = $errorText
  }
}

if ($DelaySeconds -gt 0) {
  Write-Host "Desktop UIA Invoke Lab waiting $DelaySeconds seconds before probing cursor..."
  Start-Sleep -Seconds $DelaySeconds
}

$point = New-Object DesktopUiaInvokeLabNative+POINT
$cursorOk = [DesktopUiaInvokeLabNative]::GetCursorPos([ref]$point)
$foregroundBefore = [DesktopUiaInvokeLabNative]::SnapshotWindow([DesktopUiaInvokeLabNative]::GetForegroundWindow())
$element = $null
$elementError = ''
if ($cursorOk) {
  try {
    $uiaPoint = New-Object System.Windows.Point ([double]$point.X), ([double]$point.Y)
    $element = [System.Windows.Automation.AutomationElement]::FromPoint($uiaPoint)
  } catch {
    $elementError = $_.Exception.Message
  }
}

$focusOk = $false
$focusError = ''
if ($null -ne $element) {
  try {
    $element.SetFocus()
    $focusOk = $true
  } catch {
    $focusError = $_.Exception.Message
  }
}

$actions = @()
if ($null -ne $element) {
  $actions += Try-UiaPatternAction $element 'InvokePattern.Invoke' ([System.Windows.Automation.InvokePattern]::Pattern) {
    param($patternObject)
    $patternObject.Invoke()
  }
  $actions += Try-UiaPatternAction $element 'LegacyIAccessiblePattern.DoDefaultAction' ([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern) {
    param($patternObject)
    $patternObject.DoDefaultAction()
  }
  $actions += Try-UiaPatternAction $element 'SelectionItemPattern.Select' ([System.Windows.Automation.SelectionItemPattern]::Pattern) {
    param($patternObject)
    $patternObject.Select()
  }
  $actions += Try-UiaPatternAction $element 'TogglePattern.Toggle' ([System.Windows.Automation.TogglePattern]::Pattern) {
    param($patternObject)
    $patternObject.Toggle()
  }
}

Start-Sleep -Milliseconds 300
$foregroundAfter = [DesktopUiaInvokeLabNative]::SnapshotWindow([DesktopUiaInvokeLabNative]::GetForegroundWindow())
$result = @{
  ok = $true
  cursor = @{
    ok = [bool]$cursorOk
    x = [int]$point.X
    y = [int]$point.Y
  }
  foregroundBefore = $foregroundBefore
  foregroundAfter = $foregroundAfter
  elementError = $elementError
  element = Get-UiaElementSnapshot $element
  focus = @{
    ok = [bool]$focusOk
    error = $focusError
  }
  actions = $actions
}

$json = $result | ConvertTo-Json -Depth 10
if ($OutputPath.Trim()) {
  $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  Write-Host "OutputPath=$OutputPath"
}
Write-Host 'DESKTOP_UIA_INVOKE_LAB_JSON_START'
Write-Host $json
Write-Host 'DESKTOP_UIA_INVOKE_LAB_JSON_END'
