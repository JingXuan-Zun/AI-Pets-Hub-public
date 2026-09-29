const { BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');
const {
  createAreaSelectionFromRect,
  getAreaPickerContextSignature,
} = require('./areaPickerGeometry.cjs');

const AREA_PICKER_TOPMOST_WINDOW_LEVEL = 'pop-up-menu';
const MAIN_TOPMOST_RELATIVE_LEVEL = 1;
const AUX_TOPMOST_RELATIVE_LEVEL = 3;
const PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL = 4;
const AREA_PICKER_TOPMOST_RELATIVE_LEVEL = 5;
const PERSISTENT_AREA_BORDER_THICKNESS_PX = 3;
const AREA_PICKER_ESCAPE_ACCELERATOR = 'Esc';
function createAreaPickerService(options) {
  const {
    captureService,
    isQuitting,
    loadRenderer,
    windowManager,
  } = options;

  let areaPickerWindow = null;
  let pendingAreaPickerPromise = null;
  let pendingAreaPickerResolver = null;
  let pendingAreaPickerContext = null;
  let pendingAreaPickerContextSignature = '';
  let areaPickerRendererContextSignature = '';
  let areaPickerEscapeShortcutRegistered = false;
  let areaPickerReducedAuxTopmost = false;
  let persistentAreaBorderWindow = null;
  let persistentAreaCaptureOptions = null;

  const getSettingsWindow = () => windowManager.getSettingsWindow();
  const getChatWindow = () => windowManager.getChatWindow();
  const getMainWindow = () => windowManager.getMainWindow();


  function registerAreaPickerEscapeShortcut() {
    if (areaPickerEscapeShortcutRegistered) {
      return;
    }

    try {
      areaPickerEscapeShortcutRegistered = globalShortcut.register(
        AREA_PICKER_ESCAPE_ACCELERATOR,
        () => {
          if (pendingAreaPickerResolver) {
            resolveAreaPickerSelection(null);
          }
        },
      );
    } catch (_error) {
      areaPickerEscapeShortcutRegistered = false;
    }
  }

  function unregisterAreaPickerEscapeShortcut() {
    if (!areaPickerEscapeShortcutRegistered) {
      return;
    }

    try {
      globalShortcut.unregister(AREA_PICKER_ESCAPE_ACCELERATOR);
    } catch (_error) {
      // Ignore unregister failures when the shortcut is already gone.
    }

    areaPickerEscapeShortcutRegistered = false;
  }


function getNativeAreaPickerPowerShellScript(context) {
  const contextJson = JSON.stringify(context);

  return [
    '[Console]::InputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false',
    '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false',
    '$OutputEncoding = [Console]::OutputEncoding',
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    `$context = ConvertFrom-Json @'`,
    contextJson,
    `'@`,
    '$virtual = $context.virtualBounds',
    '$form = New-Object System.Windows.Forms.Form',
    '$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None',
    '$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual',
    '$form.Bounds = New-Object System.Drawing.Rectangle ([int]$virtual.x), ([int]$virtual.y), ([int]$virtual.width), ([int]$virtual.height)',
    '$form.ShowInTaskbar = $false',
    '$form.TopMost = $true',
    '$form.KeyPreview = $true',
    '$form.Cursor = [System.Windows.Forms.Cursors]::Cross',
    '$transparent = [System.Drawing.Color]::FromArgb(255, 0, 255)',
    '$form.BackColor = $transparent',
    '$form.TransparencyKey = $transparent',
    '$state = [PSCustomObject]@{ Dragging = $false; Start = $null; Current = $null; Result = $null }',
    '$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 52, 211, 153)), 2',
    '$displayPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 52, 211, 153)), 1',
    '$labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 8, 16, 23))',
    '$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 209, 250, 229))',
    '$hintBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 226, 232, 240))',
    '$font = New-Object System.Drawing.Font "Microsoft YaHei UI", 9',
    '$smallFont = New-Object System.Drawing.Font "Consolas", 8',
    'function Get-SelectionRect($a, $b) {',
    '  $left = [Math]::Min($a.X, $b.X)',
    '  $top = [Math]::Min($a.Y, $b.Y)',
    '  $width = [Math]::Abs($b.X - $a.X)',
    '  $height = [Math]::Abs($b.Y - $a.Y)',
    '  return New-Object System.Drawing.Rectangle $left, $top, $width, $height',
    '}',
    '$form.Add_Paint({',
    '  param($sender, $event)',
    '  $g = $event.Graphics',
    '  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias',
    '  foreach ($display in @($context.displays)) {',
    '    $rect = New-Object System.Drawing.Rectangle ([int]($display.x - $virtual.x)), ([int]($display.y - $virtual.y)), ([int]$display.width), ([int]$display.height)',
    '    $g.DrawRectangle($displayPen, $rect)',
    '    $label = if ($display.label) { [string]$display.label } else { [string]$display.sourceName }',
    '    $labelSize = $g.MeasureString($label, $font)',
    '    $labelRect = New-Object System.Drawing.RectangleF ($rect.Left + 8), ($rect.Top + 8), ([Math]::Max(72, $labelSize.Width + 18)), 26',
    '    $g.FillRectangle($labelBrush, $labelRect)',
    '    $g.DrawString($label, $font, $textBrush, ($labelRect.Left + 9), ($labelRect.Top + 5))',
    '  }',
    '  $hint = "拖动鼠标框选区域，松开应用；Esc 或右键取消"',
    '  $hintSize = $g.MeasureString($hint, $font)',
    '  $hintRect = New-Object System.Drawing.RectangleF 24, 24, ($hintSize.Width + 28), 34',
    '  $g.FillRectangle($labelBrush, $hintRect)',
    '  $g.DrawString($hint, $font, $hintBrush, ($hintRect.Left + 14), ($hintRect.Top + 8))',
    '  if ($state.Dragging -and $state.Start -and $state.Current) {',
    '    $selection = Get-SelectionRect $state.Start $state.Current',
    '    if ($selection.Width -gt 0 -and $selection.Height -gt 0) {',
    '      $g.DrawRectangle($borderPen, $selection)',
    '      $sizeText = "{0} x {1}" -f $selection.Width, $selection.Height',
    '      $sizeTextSize = $g.MeasureString($sizeText, $smallFont)',
    '      $sizeRect = New-Object System.Drawing.RectangleF $selection.Left, ([Math]::Max(0, $selection.Top - 26)), ($sizeTextSize.Width + 18), 22',
    '      $g.FillRectangle($labelBrush, $sizeRect)',
    '      $g.DrawString($sizeText, $smallFont, $textBrush, ($sizeRect.Left + 9), ($sizeRect.Top + 4))',
    '    }',
    '  }',
    '})',
    '$form.Add_MouseDown({',
    '  param($sender, $event)',
    '  if ($event.Button -eq [System.Windows.Forms.MouseButtons]::Right) { $state.Result = $null; $form.Close(); return }',
    '  if ($event.Button -ne [System.Windows.Forms.MouseButtons]::Left) { return }',
    '  $state.Dragging = $true',
    '  $state.Start = New-Object System.Drawing.Point $event.X, $event.Y',
    '  $state.Current = $state.Start',
    '  $form.Capture = $true',
    '  $form.Invalidate()',
    '})',
    '$form.Add_MouseMove({',
    '  param($sender, $event)',
    '  if (-not $state.Dragging) { return }',
    '  $state.Current = New-Object System.Drawing.Point $event.X, $event.Y',
    '  $form.Invalidate()',
    '})',
    '$form.Add_MouseUp({',
    '  param($sender, $event)',
    '  if (-not $state.Dragging) { return }',
    '  $state.Dragging = $false',
    '  $form.Capture = $false',
    '  $state.Current = New-Object System.Drawing.Point $event.X, $event.Y',
    '  $rect = Get-SelectionRect $state.Start $state.Current',
    '  if ($rect.Width -lt 8 -or $rect.Height -lt 8) { $state.Start = $null; $state.Current = $null; $form.Invalidate(); return }',
    '  $state.Result = [PSCustomObject]@{ x = $rect.Left; y = $rect.Top; width = $rect.Width; height = $rect.Height }',
    '  $form.Close()',
    '})',
    '$form.Add_KeyDown({',
    '  param($sender, $event)',
    '  if ($event.KeyCode -eq [System.Windows.Forms.Keys]::Escape) { $state.Result = $null; $form.Close() }',
    '})',
    '$form.Add_Shown({ $form.Activate() })',
    '[System.Windows.Forms.Application]::Run($form)',
    '$borderPen.Dispose(); $displayPen.Dispose(); $labelBrush.Dispose(); $textBrush.Dispose(); $hintBrush.Dispose(); $font.Dispose(); $smallFont.Dispose()',
    'if ($state.Result) { $state.Result | ConvertTo-Json -Compress }',
  ].join('\n');
}

function getNativeAreaPickerPollingPowerShellScript(context) {
  const contextJson = JSON.stringify(context);

  return [
    '[Console]::InputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false',
    '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false',
    '$OutputEncoding = [Console]::OutputEncoding',
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class DesktopPetMouse {',
    '  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }',
    '  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();',
    '  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);',
    '  [DllImport("user32.dll")] public static extern bool GetPhysicalCursorPos(out POINT lpPoint);',
    '  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);',
    '  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, UInt32 uFlags);',
    '}',
    '"@',
    'try { [void][DesktopPetMouse]::SetProcessDPIAware() } catch {}',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    `$context = ConvertFrom-Json @'`,
    contextJson,
    `'@`,
    '$virtual = if ($context.nativeVirtualBounds) { $context.nativeVirtualBounds } else { $context.virtualBounds }',
    '$VK_LBUTTON = 0x01',
    '$VK_RBUTTON = 0x02',
    '$VK_ESCAPE = 0x1B',
    '$HWND_TOPMOST = [IntPtr](-1)',
    '$SWP_NOACTIVATE = 0x0010',
    '$SWP_SHOWWINDOW = 0x0040',
    'function Test-KeyDown($key) { return (([DesktopPetMouse]::GetAsyncKeyState($key) -band 0x8000) -ne 0) }',
    'function Get-CursorPoint() {',
    '  $point = New-Object DesktopPetMouse+POINT',
    '  if ([DesktopPetMouse]::GetPhysicalCursorPos([ref]$point)) { return New-Object System.Drawing.Point ([int]$point.X), ([int]$point.Y) }',
    '  if ([DesktopPetMouse]::GetCursorPos([ref]$point)) { return New-Object System.Drawing.Point ([int]$point.X), ([int]$point.Y) }',
    '  $position = [System.Windows.Forms.Cursor]::Position',
    '  return New-Object System.Drawing.Point ([int]$position.X), ([int]$position.Y)',
    '}',
    'function Get-SelectionRect($a, $b) {',
    '  $left = [Math]::Min($a.X, $b.X)',
    '  $top = [Math]::Min($a.Y, $b.Y)',
    '  $width = [Math]::Abs($b.X - $a.X)',
    '  $height = [Math]::Abs($b.Y - $a.Y)',
    '  return New-Object System.Drawing.Rectangle $left, $top, $width, $height',
    '}',
    'function New-BorderWindow() {',
    '  $win = New-Object System.Windows.Forms.Form',
    '  $win.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None',
    '  $win.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual',
    '  $win.ShowInTaskbar = $false',
    '  $win.TopMost = $true',
    '  $win.BackColor = [System.Drawing.Color]::FromArgb(52, 211, 153)',
    '  $win.Opacity = 0.92',
    '  return $win',
    '}',
    '$top = New-BorderWindow',
    '$bottom = New-BorderWindow',
    '$left = New-BorderWindow',
    '$right = New-BorderWindow',
    '$hint = New-Object System.Windows.Forms.Form',
    '$hint.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None',
    '$hint.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual',
    '$hint.ShowInTaskbar = $false',
    '$hint.TopMost = $true',
    '$hint.BackColor = [System.Drawing.Color]::FromArgb(8, 16, 23)',
    '$hint.Opacity = 0.92',
    '$hint.Width = 330',
    '$hint.Height = 34',
    '$hint.Left = [int]$virtual.x + 24',
    '$hint.Top = [int]$virtual.y + 24',
    '$label = New-Object System.Windows.Forms.Label',
    '$label.Text = "Drag to select area. Esc / Right click cancels."',
    '$label.ForeColor = [System.Drawing.Color]::FromArgb(209, 250, 229)',
    '$label.BackColor = [System.Drawing.Color]::Transparent',
    '$label.Dock = [System.Windows.Forms.DockStyle]::Fill',
    '$label.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter',
    '$hint.Controls.Add($label)',
    '$hint.Show()',
    '[System.Windows.Forms.Application]::DoEvents()',
    'function Show-Border($rect) {',
    '  $thickness = 3',
    '  if ($rect.Width -lt 1 -or $rect.Height -lt 1) { return }',
    '  $borderWidth = [Math]::Max($thickness, $rect.Width)',
    '  $borderHeight = [Math]::Max($thickness, $rect.Height)',
    '  foreach ($win in @($top, $bottom, $left, $right)) { if (-not $win.Visible) { $win.Show() } }',
    '  [void][DesktopPetMouse]::SetWindowPos($top.Handle, $HWND_TOPMOST, $rect.Left, $rect.Top, $borderWidth, $thickness, $SWP_NOACTIVATE -bor $SWP_SHOWWINDOW)',
    '  [void][DesktopPetMouse]::SetWindowPos($bottom.Handle, $HWND_TOPMOST, $rect.Left, ($rect.Bottom - $thickness), $borderWidth, $thickness, $SWP_NOACTIVATE -bor $SWP_SHOWWINDOW)',
    '  [void][DesktopPetMouse]::SetWindowPos($left.Handle, $HWND_TOPMOST, $rect.Left, $rect.Top, $thickness, $borderHeight, $SWP_NOACTIVATE -bor $SWP_SHOWWINDOW)',
    '  [void][DesktopPetMouse]::SetWindowPos($right.Handle, $HWND_TOPMOST, ($rect.Right - $thickness), $rect.Top, $thickness, $borderHeight, $SWP_NOACTIVATE -bor $SWP_SHOWWINDOW)',
    '}',
    'while (Test-KeyDown $VK_LBUTTON) { Start-Sleep -Milliseconds 20; [System.Windows.Forms.Application]::DoEvents() }',
    '$cancelled = $false',
    'while (-not (Test-KeyDown $VK_LBUTTON)) {',
    '  if ((Test-KeyDown $VK_ESCAPE) -or (Test-KeyDown $VK_RBUTTON)) { $cancelled = $true; break }',
    '  Start-Sleep -Milliseconds 20',
    '  [System.Windows.Forms.Application]::DoEvents()',
    '}',
    'if ($cancelled) {',
    '  foreach ($win in @($top, $bottom, $left, $right, $hint)) { $win.Close(); $win.Dispose() }',
    '  exit',
    '}',
    '$start = Get-CursorPoint',
    '$current = $start',
    'while (Test-KeyDown $VK_LBUTTON) {',
    '  if ((Test-KeyDown $VK_ESCAPE) -or (Test-KeyDown $VK_RBUTTON)) { $cancelled = $true; break }',
    '  $current = Get-CursorPoint',
    '  $rect = Get-SelectionRect $start $current',
    '  Show-Border $rect',
    '  Start-Sleep -Milliseconds 16',
    '  [System.Windows.Forms.Application]::DoEvents()',
    '}',
    '$current = Get-CursorPoint',
    '$rect = Get-SelectionRect $start $current',
    'foreach ($win in @($top, $bottom, $left, $right, $hint)) { $win.Close(); $win.Dispose() }',
    'if ((-not $cancelled) -and $rect.Width -ge 8 -and $rect.Height -ge 8) {',
    '  [PSCustomObject]@{',
    '    coordinateSpace = "native"',
    '    x = [int]($rect.Left - [int]$virtual.x)',
    '    y = [int]($rect.Top - [int]$virtual.y)',
    '    width = [int]$rect.Width',
    '    height = [int]$rect.Height',
    '  } | ConvertTo-Json -Compress',
    '}',
  ].join('\n');
}

function createPersistentAreaBorderWindow() {
  const borderHtml = encodeURIComponent(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --border-width: 2px;
        --border-color: rgba(52, 211, 153, 0.98);
      }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
      body {
        box-sizing: border-box;
        border: var(--border-width) solid var(--border-color);
        background: transparent;
      }
    </style>
  </head>
  <body></body>
</html>`);
  const win = new BrowserWindow({
    x: -32000,
    y: -32000,
    width: 16,
    height: 16,
    frame: false,
    thickFrame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    roundedCorners: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    title: 'AI Desktop Pet Area Border',
    webPreferences: {
      backgroundThrottling: false,
      devTools: false,
    },
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  windowManager.keepWindowOnTop(win, PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, {
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
  win.webContents.once('did-finish-load', () => {
    refreshPersistentAreaBorder();
  });
  win.loadURL(`data:text/html;charset=utf-8,${borderHtml}`).catch(() => {});
  return win;
}

function destroyPersistentAreaBorder() {
  const win = persistentAreaBorderWindow;
  persistentAreaBorderWindow = null;
  persistentAreaCaptureOptions = null;

  if (win && !win.isDestroyed()) {
    win.destroy();
  }
}

function hidePersistentAreaBorder() {
  persistentAreaCaptureOptions = null;
  if (persistentAreaBorderWindow && !persistentAreaBorderWindow.isDestroyed()) {
    persistentAreaBorderWindow.hide();
  }
}

function ensurePersistentAreaBorderWindow() {
  if (persistentAreaBorderWindow && !persistentAreaBorderWindow.isDestroyed()) {
    return persistentAreaBorderWindow;
  }

  destroyPersistentAreaBorder();
  persistentAreaBorderWindow = createPersistentAreaBorderWindow();
  return persistentAreaBorderWindow;
}

function resolvePersistentAreaBorderRect(captureOptions) {
  if (captureOptions?.mode !== 'area' || !captureOptions.cropRect) {
    return null;
  }

  const cropRect = captureOptions.cropRect;
  const virtualBounds = captureService.getVirtualDisplayBounds();
  const basisX = Number.isFinite(captureOptions.cropBasisX)
    ? Number(captureOptions.cropBasisX)
    : virtualBounds.x;
  const basisY = Number.isFinite(captureOptions.cropBasisY)
    ? Number(captureOptions.cropBasisY)
    : virtualBounds.y;
  const width = Math.round(Number(cropRect.width ?? 0));
  const height = Math.round(Number(cropRect.height ?? 0));

  if (width < 8 || height < 8) {
    return null;
  }

  return {
    x: Math.round(basisX + Number(cropRect.x ?? 0)),
    y: Math.round(basisY + Number(cropRect.y ?? 0)),
    width,
    height,
  };
}

function resolvePersistentAreaBorderThickness(rect) {
  if (!rect) {
    return PERSISTENT_AREA_BORDER_THICKNESS_PX;
  }

  try {
    const matchedDisplay = screen.getDisplayMatching({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    });
    const scaleFactor = Number.isFinite(matchedDisplay?.scaleFactor) && matchedDisplay.scaleFactor > 0
      ? matchedDisplay.scaleFactor
      : 1;

    return Math.max(1, Math.round(PERSISTENT_AREA_BORDER_THICKNESS_PX / scaleFactor));
  } catch (_error) {
    return PERSISTENT_AREA_BORDER_THICKNESS_PX;
  }
}

function updatePersistentAreaBorderThickness(win, thickness) {
  if (!win || win.isDestroyed() || win.webContents.isLoadingMainFrame()) {
    return;
  }

  const safeThickness = Math.max(1, Math.round(thickness));
  win.webContents.executeJavaScript(
    `document.documentElement.style.setProperty('--border-width', '${safeThickness}px');`,
    true,
  ).catch(() => {});
}

function showPersistentAreaBorder(captureOptions) {
  const rect = resolvePersistentAreaBorderRect(captureOptions);
  if (!rect) {
    hidePersistentAreaBorder();
    return;
  }

  const win = ensurePersistentAreaBorderWindow();
  persistentAreaCaptureOptions = captureOptions;
  const thickness = resolvePersistentAreaBorderThickness(rect);
  win.setBounds({
    x: rect.x,
    y: rect.y,
    width: Math.max(8, rect.width),
    height: Math.max(8, rect.height),
  }, false);
  updatePersistentAreaBorderThickness(win, thickness);
  if (!win.isVisible()) {
    win.showInactive();
  }
  windowManager.scheduleKeepWindowOnTop(win, PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, {
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
}

function refreshPersistentAreaBorder() {
  if (persistentAreaCaptureOptions) {
    showPersistentAreaBorder(persistentAreaCaptureOptions);
  }
}

function syncPersistentAreaBorderFromSettingsAction(action) {
  if (!action || typeof action !== 'object') {
    return;
  }

  if (action.type === 'preview-capture-options' || action.type === 'start-screen-capture') {
    showPersistentAreaBorder(action.options);
    return;
  }

  if (action.type === 'stop-screen-capture') {
    hidePersistentAreaBorder();
  }
}

async function openNativeAreaPickerWindow() {
  return openAreaPickerWindow();
}

function restoreAuxWindowStack() {
  areaPickerReducedAuxTopmost = false;
  if (getSettingsWindow() && !getSettingsWindow().isDestroyed() && getSettingsWindow().isVisible()) {
    getSettingsWindow().focus();
    windowManager.scheduleKeepWindowOnTop(getSettingsWindow(), AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  } else if (getChatWindow() && !getChatWindow().isDestroyed() && getChatWindow().isVisible()) {
    getChatWindow().focus();
    windowManager.scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  } else if (getMainWindow() && !getMainWindow().isDestroyed() && getMainWindow().isVisible()) {
    windowManager.scheduleKeepWindowOnTop(getMainWindow(), MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
  }

  windowManager.scheduleWindowStackOnTop();
}

function reduceAuxWindowTopmostForAreaPicker() {
  if (areaPickerReducedAuxTopmost) {
    return;
  }

  areaPickerReducedAuxTopmost = true;

  if (getSettingsWindow() && !getSettingsWindow().isDestroyed() && getSettingsWindow().isVisible()) {
    getSettingsWindow().setAlwaysOnTop(false);
  }

  if (getChatWindow() && !getChatWindow().isDestroyed() && getChatWindow().isVisible()) {
    getChatWindow().setAlwaysOnTop(false);
  }
}

function syncAreaPickerWindowBounds() {
  if (
    !areaPickerWindow
    || areaPickerWindow.isDestroyed()
    || !pendingAreaPickerContext
    || !pendingAreaPickerContext.virtualBounds
  ) {
    return;
  }

  const nextBounds = pendingAreaPickerContext.virtualBounds;
  const currentBounds = areaPickerWindow.getBounds();
  if (
    currentBounds.x !== nextBounds.x
    || currentBounds.y !== nextBounds.y
    || currentBounds.width !== nextBounds.width
    || currentBounds.height !== nextBounds.height
  ) {
    areaPickerWindow.setBounds(nextBounds);
  }
}

function broadcastAreaPickerContext() {
  if (
    !areaPickerWindow
    || areaPickerWindow.isDestroyed()
    || !pendingAreaPickerContext
    || areaPickerWindow.webContents.isLoadingMainFrame()
  ) {
    return;
  }

  if (areaPickerRendererContextSignature === pendingAreaPickerContextSignature) {
    return;
  }

  areaPickerWindow.webContents.send('desktop-pet:area-picker-context', pendingAreaPickerContext);
  areaPickerRendererContextSignature = pendingAreaPickerContextSignature;
}

function showAreaPickerWindow() {
  if (!areaPickerWindow || areaPickerWindow.isDestroyed()) {
    return;
  }

  syncAreaPickerWindowBounds();
  reduceAuxWindowTopmostForAreaPicker();
  areaPickerWindow.show();
  areaPickerWindow.focus();
  windowManager.keepWindowOnTop(areaPickerWindow, AREA_PICKER_TOPMOST_RELATIVE_LEVEL, {
    bringToFront: true,
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });
}

function resolveAreaPickerSelection(selection = null) {
  const resolve = pendingAreaPickerResolver;

  pendingAreaPickerPromise = null;
  pendingAreaPickerResolver = null;
  unregisterAreaPickerEscapeShortcut();

  if (areaPickerWindow && !areaPickerWindow.isDestroyed()) {
    areaPickerWindow.hide();
  }

  if (typeof resolve === 'function') {
    resolve(selection);
  }

  setTimeout(() => {
    restoreAuxWindowStack();
  }, 0);
}

function ensureAreaPickerWindow() {
  if (areaPickerWindow && !areaPickerWindow.isDestroyed()) {
    syncAreaPickerWindowBounds();
    return areaPickerWindow;
  }

  if (!pendingAreaPickerContext?.virtualBounds) {
    return null;
  }

  const { virtualBounds } = pendingAreaPickerContext;
  const nextAreaPickerWindow = new BrowserWindow({
    x: virtualBounds.x,
    y: virtualBounds.y,
    width: virtualBounds.width,
    height: virtualBounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    roundedCorners: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    enableLargerThanScreen: true,
    show: false,
    title: 'AI Desktop Pet Area Picker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  areaPickerWindow = nextAreaPickerWindow;
  windowManager.scheduleKeepWindowOnTop(nextAreaPickerWindow, AREA_PICKER_TOPMOST_RELATIVE_LEVEL, {
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });

  nextAreaPickerWindow.webContents.once('did-finish-load', () => {
    if (areaPickerWindow !== nextAreaPickerWindow || nextAreaPickerWindow.isDestroyed()) {
      return;
    }

    areaPickerRendererContextSignature = '';
    broadcastAreaPickerContext();
    if (pendingAreaPickerResolver) {
      showAreaPickerWindow();
    }
  });

  nextAreaPickerWindow.once('ready-to-show', () => {
    if (areaPickerWindow !== nextAreaPickerWindow || nextAreaPickerWindow.isDestroyed()) {
      return;
    }

    if (pendingAreaPickerResolver) {
      showAreaPickerWindow();
    }
  });

  nextAreaPickerWindow.on('close', (event) => {
    if (isQuitting()) {
      return;
    }

    event.preventDefault();
    resolveAreaPickerSelection(null);
  });
  nextAreaPickerWindow.on('show', () => windowManager.keepWindowOnTop(nextAreaPickerWindow, AREA_PICKER_TOPMOST_RELATIVE_LEVEL, {
    bringToFront: true,
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  }));
  nextAreaPickerWindow.on('closed', () => {
    if (areaPickerWindow === nextAreaPickerWindow) {
      areaPickerWindow = null;
    }
    areaPickerRendererContextSignature = '';
    unregisterAreaPickerEscapeShortcut();

    if (pendingAreaPickerResolver) {
      resolveAreaPickerSelection(null);
    }
  });

  loadRenderer(nextAreaPickerWindow, { desktop: '1', panel: 'area-picker' });
  return nextAreaPickerWindow;
}

async function openAreaPickerWindow() {
  if (pendingAreaPickerPromise) {
    if (areaPickerWindow && !areaPickerWindow.isDestroyed()) {
      broadcastAreaPickerContext();
      showAreaPickerWindow();
    }

    return pendingAreaPickerPromise;
  }

  if (!pendingAreaPickerContext?.displays?.length) {
    const context = await captureService.buildAreaPickerContext();
    if (!context.displays.length) {
      return null;
    }

    pendingAreaPickerContext = context;
    pendingAreaPickerContextSignature = getAreaPickerContextSignature(context);
  }

  registerAreaPickerEscapeShortcut();
  pendingAreaPickerPromise = new Promise((resolve) => {
    pendingAreaPickerResolver = resolve;
  });

  const nextAreaPickerWindow = ensureAreaPickerWindow();
  if (!nextAreaPickerWindow) {
    resolveAreaPickerSelection(null);
    return null;
  }

  broadcastAreaPickerContext();
  if (!nextAreaPickerWindow.webContents.isLoadingMainFrame()) {
    showAreaPickerWindow();
  }

  return pendingAreaPickerPromise;
}

  function dispose() {
    unregisterAreaPickerEscapeShortcut();
    if (pendingAreaPickerResolver) {
      resolveAreaPickerSelection(null);
    }
    destroyPersistentAreaBorder();
  }

  return {
    cancelAreaPickerSelection: () => resolveAreaPickerSelection(null),
    dispose,
    getAreaPickerContext: () => pendingAreaPickerContext,
    getAreaPickerWindow: () => areaPickerWindow,
    getPersistentAreaBorderWindow: () => persistentAreaBorderWindow,
    openNativeAreaPickerWindow,
    refreshPersistentAreaBorder,
    submitAreaPickerSelection: (selection) => resolveAreaPickerSelection(selection ?? null),
    syncPersistentAreaBorderFromSettingsAction,
  };
}

module.exports = {
  createAreaPickerService,
};
