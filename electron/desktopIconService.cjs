const { desktopIconListViewMoveInteropCSharp } = require('./desktopIcons/desktopIconListViewMoveInterop.cjs');
const { desktopIconListViewMoveExecuteCSharp } = require('./desktopIcons/desktopIconListViewMoveExecute.cjs');
const { desktopIconListViewMoveWindowLookupCSharp } = require('./desktopIcons/desktopIconListViewMoveWindowLookup.cjs');
const { desktopIconFolderViewMoveInteropCSharp } = require('./desktopIcons/desktopIconFolderViewMoveInterop.cjs');
const { desktopIconFolderViewMoveExecuteCSharp } = require('./desktopIcons/desktopIconFolderViewMoveExecute.cjs');
const { desktopIconFolderViewMoveAccessCSharp } = require('./desktopIcons/desktopIconFolderViewMoveAccess.cjs');
const { desktopIconFolderViewInteropCSharp } = require('./desktopIcons/desktopIconFolderViewInterop.cjs');
const { desktopIconFolderViewReadCSharp } = require('./desktopIcons/desktopIconFolderViewRead.cjs');
const { desktopIconFolderViewAccessCSharp } = require('./desktopIcons/desktopIconFolderViewAccess.cjs');
const { desktopIconListViewInteropCSharp } = require('./desktopIcons/desktopIconListViewInterop.cjs');
const { desktopIconListViewReadCSharp } = require('./desktopIcons/desktopIconListViewRead.cjs');
const { desktopIconListViewWindowLookupCSharp } = require('./desktopIcons/desktopIconListViewWindowLookup.cjs');
const { desktopIconReadOnlyFallbackPowerShellBlock } = require('./desktopIcons/desktopIconReadOnlyFallbackScript.cjs');
const { desktopIconMetadataPowerShellBlock } = require('./desktopIcons/desktopIconMetadataScript.cjs');
const { createDesktopIconMover } = require('./desktopIcons/desktopIconMover.cjs');
const { createDesktopIconListController } = require('./desktopIcons/desktopIconListController.cjs');
const { createDesktopIconReader } = require('./desktopIcons/desktopIconReader.cjs');
const { normalizeDesktopIcon } = require('./desktopIcons/desktopIconNormalization.cjs');
const { createDesktopIconFileFallbackReader } = require('./desktopIcons/desktopIconFileFallback.cjs');
const { compactDesktopIconPowerShellError, createDesktopIconPowerShellRunner } = require('./desktopIcons/desktopIconPowerShell.cjs');
const { createDesktopIconGeometry } = require('./desktopIcons/desktopIconGeometry.cjs');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function getDesktopIconFolderViewReaderPowerShellBlock() {
  return String.raw`
function Get-DesktopPetFolderViewIcons {
  try {
    Add-Type -TypeDefinition @"
${desktopIconFolderViewInteropCSharp}${desktopIconFolderViewReadCSharp}${desktopIconFolderViewAccessCSharp}"@

    return [DesktopPetDesktopIconFolderViewReader]::GetIcons()
  } catch {
    return @()
  }
}
`;
}

function getDesktopIconPowerShellScript(options = {}) {
  const includeReadOnlyPositionFallback = Boolean(options?.includeReadOnlyPositionFallback);
  return String.raw`
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$IncludeReadOnlyPositionFallback = ${includeReadOnlyPositionFallback ? '$true' : '$false'}

Add-Type -TypeDefinition @"
${desktopIconListViewInteropCSharp}${desktopIconListViewReadCSharp}${desktopIconListViewWindowLookupCSharp}"@

$icons = [DesktopPetDesktopIconReader]::GetIcons()
${getDesktopIconFolderViewReaderPowerShellBlock()}
if (@($icons).Count -eq 0) {
  $folderViewIcons = Get-DesktopPetFolderViewIcons
  if (@($folderViewIcons).Count -gt 0) {
    $icons = $folderViewIcons
  }
}
${desktopIconReadOnlyFallbackPowerShellBlock}${desktopIconMetadataPowerShellBlock}$icons = Resolve-DesktopPetIconMetadata $icons
if ($null -eq $icons) {
  @() | ConvertTo-Json -Depth 4 -Compress
} else {
  @($icons) | ConvertTo-Json -Depth 4 -Compress
}
`;
}

function getDesktopIconFolderViewMovePowerShellScript({ index, nativeScreenX, nativeScreenY }) {
  const targetIndex = Math.max(0, Math.round(Number(index)));
  const targetX = Math.round(Number(nativeScreenX));
  const targetY = Math.round(Number(nativeScreenY));

  return String.raw`
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$TargetIndex = ${targetIndex}
$ScreenX = ${targetX}
$ScreenY = ${targetY}

Add-Type -TypeDefinition @"
${desktopIconFolderViewMoveInteropCSharp}${desktopIconFolderViewMoveExecuteCSharp}${desktopIconFolderViewMoveAccessCSharp}"@

$ok = [DesktopPetDesktopIconFolderViewMover]::MoveIcon($TargetIndex, $ScreenX, $ScreenY)
@{ ok = $ok } | ConvertTo-Json -Depth 4 -Compress
`;
}

function getDesktopIconMovePowerShellScript({ index, nativeScreenX, nativeScreenY }) {
  const targetIndex = Math.max(0, Math.round(Number(index)));
  const targetX = Math.round(Number(nativeScreenX));
  const targetY = Math.round(Number(nativeScreenY));

  return String.raw`
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$TargetIndex = ${targetIndex}
$ScreenX = ${targetX}
$ScreenY = ${targetY}

Add-Type -TypeDefinition @"
${desktopIconListViewMoveInteropCSharp}${desktopIconListViewMoveExecuteCSharp}${desktopIconListViewMoveWindowLookupCSharp}"@

$ok = [DesktopPetDesktopIconMover]::MoveIcon($TargetIndex, $ScreenX, $ScreenY)
@{ ok = $ok } | ConvertTo-Json -Depth 4 -Compress
`;
}

function createDesktopIconService({ app, log, screen } = {}) {
  const runPowerShellScript = createDesktopIconPowerShellRunner({ app, fs, path, execFile });
  let cachedIcons = [];
  let cacheUpdatedAt = 0;
  let pendingRequest = null;

  function logMessage(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  const { petToScreenCoordinate, attachDesktopIconCoordinateSpaces, selectDesktopIconCoordinateSpace, normalizeDesktopIconCoordinateSpaceOption }
    = createDesktopIconGeometry({ screen, logMessage });
  const listDesktopFileFallbackIcons = createDesktopIconFileFallbackReader({
    app, fs, path, logMessage, normalizeDesktopIcon, attachDesktopIconCoordinateSpaces,
  });
  const { fetchDesktopIcons, resolveDesktopIconReadFallbacks } = createDesktopIconReader({
    runPowerShellScript, getDesktopIconPowerShellScript, normalizeDesktopIcon, attachDesktopIconCoordinateSpaces,
    listDesktopFileFallbackIcons, logMessage,
  });

  const listDesktopIcons = createDesktopIconListController({
    state: {
      get cachedIcons() { return cachedIcons; },
      set cachedIcons(value) { cachedIcons = value; },
      get cacheUpdatedAt() { return cacheUpdatedAt; },
      set cacheUpdatedAt(value) { cacheUpdatedAt = value; },
      get pendingRequest() { return pendingRequest; },
      set pendingRequest(value) { pendingRequest = value; },
    },
    fetchDesktopIcons, resolveDesktopIconReadFallbacks, logMessage,
    normalizeDesktopIconCoordinateSpaceOption, selectDesktopIconCoordinateSpace,
  });

  const moveDesktopIcon = createDesktopIconMover({
    listDesktopIcons, normalizeDesktopIconCoordinateSpaceOption, petToScreenCoordinate,
    getDesktopIconFolderViewMovePowerShellScript, getDesktopIconMovePowerShellScript,
    runPowerShellScript, invalidate, compactDesktopIconPowerShellError, logMessage,
  });

  function invalidate() {
    cacheUpdatedAt = 0;
  }

  return {
    invalidate,
    listDesktopIcons,
    moveDesktopIcon,
  };
}

module.exports = {
  createDesktopIconService,
};
