const { createTopLevelWindowEnumeratorPowerShell } = require('./topLevelWindowEnumeratorPowerShell.cjs');
const { windowControlGeometryScript } = require('./windowControlGeometryScript.cjs');
const { windowControlBoundsScript } = require('./windowControlBoundsScript.cjs');
const { windowControlApplyScript } = require('./windowControlApplyScript.cjs');

function createControlWindowScript({ payload }) {
  return [
    String.raw`
$ErrorActionPreference = 'Stop'
$payload = @'
`,
    String.raw`${JSON.stringify(payload)}`,
    String.raw`
'@ | ConvertFrom-Json
$query = [string]$payload.query
$requestedPid = [int64]$payload.pid
$requestedHwnd = [int64]$payload.hwnd
$fallbackToActiveWindow = [bool]$payload.fallbackToActiveWindow
$state = [string]$payload.state
$snap = [string]$payload.snap
$coordinateSpace = [string]$payload.coordinateSpace
$targetRole = [string]$payload.targetRole
$targetIndex = [int]$payload.targetIndex
$targetDisplayText = [string]$payload.targetDisplayText
$requestedX = if ($null -ne $payload.x) { [int]$payload.x } else { $null }
$requestedY = if ($null -ne $payload.y) { [int]$payload.y } else { $null }
$requestedWidth = if ($null -ne $payload.width) { [int]$payload.width } else { $null }
$requestedHeight = if ($null -ne $payload.height) { [int]$payload.height } else { $null }

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.Windows.Forms

`,
    String.raw`${createTopLevelWindowEnumeratorPowerShell()}`,
    windowControlGeometryScript,
    windowControlBoundsScript,
    windowControlApplyScript,
  ].join('');
}

module.exports = { createControlWindowScript };
