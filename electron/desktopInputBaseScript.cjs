const { DESKTOP_INPUT_NATIVE_INTEROP } = require('./desktopInputNativeInterop.cjs');

const DESKTOP_INPUT_POWERSHELL_PREFIX = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
${DESKTOP_INPUT_NATIVE_INTEROP}
"@
function Get-DesktopPetInputForegroundSnapshot {
  $handle = [DesktopPetInput]::GetForegroundWindow()
  if ($handle -eq [IntPtr]::Zero) {
    return @{
      hwnd = 0
      pid = 0
      processName = ''
      title = ''
      elevated = $null
    }
  }

  $pidValue = [uint32]0
  [void][DesktopPetInput]::GetWindowThreadProcessId($handle, [ref]$pidValue)
  $titleBuilder = New-Object System.Text.StringBuilder 512
  [void][DesktopPetInput]::GetWindowText($handle, $titleBuilder, $titleBuilder.Capacity)
  $processName = ''
  $elevated = $null
  try {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction Stop
    $processName = [string]$process.ProcessName
    $elevatedValue = $false
    if ([DesktopPetInput]::TryIsProcessElevated([int]$pidValue, [ref]$elevatedValue)) {
      $elevated = [bool]$elevatedValue
    }
  } catch {
  }

  return @{
    hwnd = [int64]$handle.ToInt64()
    pid = [int]$pidValue
    processName = $processName
    title = [string]$titleBuilder.ToString()
    elevated = $elevated
  }
}

function Test-DesktopPetInputCurrentProcessElevated {
  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return [bool]$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch {
    return $null
  }
}
`;

function createBaseInputPowerShell(prefixBody) {
  return String.raw`${DESKTOP_INPUT_POWERSHELL_PREFIX}${prefixBody}
`;
}

module.exports = { createBaseInputPowerShell };
