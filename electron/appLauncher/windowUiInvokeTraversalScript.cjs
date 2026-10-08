

const windowUiInvokeTraversalScript = String.raw`function Visit-DesktopPetUiElement($element, $depth, $parentIndex) {
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
$rankedControls = @($scoredControls | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'depth'; Ascending = $true }, @{ Expression = 'index'; Ascending = $true })
$targetControl = $rankedControls | Select-Object -First 1
$candidateExports = @($rankedControls | Select-Object -First 8 | ForEach-Object { Export-DesktopPetUiControlRecord $_ })

if ($null -eq $targetControl) {
  @{
    candidates = $candidateExports
    control = $null
    error = 'No matching UI Automation control found.'
    invoked = $false
    ok = $false
    query = $query
    window = $targetWindow
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

$requestedUiAction = Normalize-DesktopPetRequestedUiAction $request.uiAction
$actionResult = Invoke-DesktopPetUiControlAction $targetControl $requestedUiAction $request.value

if (-not $actionResult.applied) {
  @{
    candidates = $candidateExports
    control = (Export-DesktopPetUiControlRecord $targetControl)
    error = $actionResult.error
    invoked = $false
    method = $actionResult.method
    ok = $false
    query = $query
    resolvedAction = $actionResult.resolvedAction
    uiAction = $requestedUiAction
    window = $targetWindow
  } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

Start-Sleep -Milliseconds 120
$postActionControl = New-DesktopPetUiControlRecord $targetControl.element $targetControl.depth $targetControl.parentIndex
$postActionControl | Add-Member -NotePropertyName index -NotePropertyValue ([int]$targetControl.index) -Force
$postActionControl | Add-Member -NotePropertyName matchScore -NotePropertyValue ([int]$targetControl.matchScore) -Force
@{
  candidates = $candidateExports
  control = (Export-DesktopPetUiControlRecord $postActionControl)
  invoked = $true
  method = $actionResult.method
  ok = $true
  query = $query
  resolvedAction = $actionResult.resolvedAction
  uiAction = $requestedUiAction
  window = $targetWindow
} | ConvertTo-Json -Depth 8 -Compress
exit 0
`;

module.exports = { windowUiInvokeTraversalScript };
