const { execFile } = require('child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const DESKTOP_INPUT_TIMEOUT_MS = 5000;
const DESKTOP_INPUT_MAX_DRAG_STEPS = 32;

function runPowerShellScript(script, timeout = DESKTOP_INPUT_TIMEOUT_MS) {
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  let tempDir = null;
  let args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand];
  if (encodedCommand.length > 24000) {
    tempDir = mkdtempSync(join(tmpdir(), 'desktop-pet-input-'));
    const tempScriptPath = join(tempDir, 'input.ps1');
    writeFileSync(tempScriptPath, script, 'utf8');
    args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath];
  }
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      args,
      {
        encoding: 'utf8',
        timeout,
        windowsHide: true,
      },
      (error, stdout) => {
        if (tempDir) {
          try {
            rmSync(tempDir, { recursive: true, force: true });
          } catch {
          }
        }
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

function normalizeDesktopInputAction(value) {
  const normalizedValue = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  switch (normalizedValue) {
    case 'move_mouse':
    case 'move_pointer':
    case 'set_cursor':
      return 'move_mouse';
    case 'double_click':
    case 'doubleclick':
      return 'double_click';
    case 'right_click':
    case 'context_click':
      return 'right_click';
    case 'click':
    case 'left_click':
      return 'click';
    case 'type':
    case 'type_text':
    case 'text':
      return 'type_text';
    case 'send_keys':
    case 'keys':
    case 'press_keys':
      return 'send_keys';
    case 'hotkey':
    case 'shortcut':
      return 'hotkey';
    case 'drag':
    case 'drag_mouse':
      return 'drag';
    default:
      return '';
  }
}

function normalizeButton(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return normalizedValue === 'right' || normalizedValue === 'middle' ? normalizedValue : 'left';
}

function normalizeNumber(value, fallback = null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback;
}

function normalizeDesktopInputCoordinateSpace(value) {
  return String(value || '').trim().toLowerCase() === 'native-screen'
    ? 'native-screen'
    : 'dip';
}

function normalizePositiveInteger(value, fallback, max) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.round(numberValue)));
}

function normalizeInputDelayMs(value, fallback, max) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(max, Math.round(numberValue)));
}

function escapeSendKeysText(value) {
  return String(value || '').replace(/[+^%~(){}\[\]]/g, '{$&}');
}

function splitHotkey(value) {
  return String(value || '')
    .split(/[+\s,]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const VIRTUAL_KEY_BY_NAME = {
  alt: 0x12,
  backspace: 0x08,
  ctrl: 0x11,
  control: 0x11,
  delete: 0x2e,
  down: 0x28,
  end: 0x23,
  enter: 0x0d,
  esc: 0x1b,
  escape: 0x1b,
  home: 0x24,
  left: 0x25,
  pagedown: 0x22,
  pageup: 0x21,
  pgdn: 0x22,
  pgup: 0x21,
  right: 0x27,
  shift: 0x10,
  space: 0x20,
  tab: 0x09,
  up: 0x26,
  win: 0x5b,
  windows: 0x5b,
};

for (let index = 1; index <= 12; index += 1) {
  VIRTUAL_KEY_BY_NAME[`f${index}`] = 0x70 + index - 1;
}

function virtualKeyFromToken(token) {
  if (VIRTUAL_KEY_BY_NAME[token]) {
    return VIRTUAL_KEY_BY_NAME[token];
  }

  if (/^[a-z]$/i.test(token)) {
    return token.toUpperCase().charCodeAt(0);
  }

  if (/^[0-9]$/u.test(token)) {
    return token.charCodeAt(0);
  }

  return null;
}

function createBaseInputPowerShell(prefixBody) {
  return String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class DesktopPetInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public MOUSEINPUT mi;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
    public uint time;
    public UIntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct TOKEN_ELEVATION {
    public int TokenIsElevated;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int left;
    public int top;
    public int right;
    public int bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINTER_INFO {
    public uint pointerType;
    public uint pointerId;
    public uint frameId;
    public uint pointerFlags;
    public IntPtr sourceDevice;
    public IntPtr hwndTarget;
    public POINT ptPixelLocation;
    public POINT ptHimetricLocation;
    public POINT ptPixelLocationRaw;
    public POINT ptHimetricLocationRaw;
    public uint dwTime;
    public uint historyCount;
    public int inputData;
    public uint dwKeyStates;
    public ulong PerformanceCount;
    public int ButtonChangeType;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINTER_TOUCH_INFO {
    public POINTER_INFO pointerInfo;
    public uint touchFlags;
    public uint touchMask;
    public RECT rcContact;
    public RECT rcContactRaw;
    public uint orientation;
    public uint pressure;
  }

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT point);

  [DllImport("user32.dll")]
  public static extern IntPtr GetAncestor(IntPtr hWnd, uint gaFlags);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool InitializeTouchInjection(uint maxCount, uint dwMode);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool InjectTouchInput(uint count, POINTER_TOUCH_INFO[] contacts);

  [DllImport("advapi32.dll", SetLastError=true)]
  public static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

  [DllImport("advapi32.dll", SetLastError=true)]
  public static extern bool GetTokenInformation(IntPtr TokenHandle, int TokenInformationClass, out TOKEN_ELEVATION TokenInformation, int TokenInformationLength, out int ReturnLength);

  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool CloseHandle(IntPtr hObject);

  public static bool TryIsProcessElevated(int pid, out bool elevated) {
    elevated = false;
    IntPtr token = IntPtr.Zero;
    try {
      var process = Process.GetProcessById(pid);
      if (!OpenProcessToken(process.Handle, 0x0008, out token)) {
        return false;
      }

      TOKEN_ELEVATION elevation;
      int returnLength;
      if (!GetTokenInformation(token, 20, out elevation, Marshal.SizeOf(typeof(TOKEN_ELEVATION)), out returnLength)) {
        return false;
      }

      elevated = elevation.TokenIsElevated != 0;
      return true;
    } catch {
      return false;
    } finally {
      if (token != IntPtr.Zero) {
        CloseHandle(token);
      }
    }
  }

  public static INPUT CreateMouseInput(uint flags) {
    INPUT input = new INPUT();
    input.type = 0;
    input.mi = new MOUSEINPUT();
    input.mi.dwFlags = flags;
    return input;
  }

  public static INPUT CreateAbsoluteMouseMove(int x, int y) {
    const int SM_XVIRTUALSCREEN = 76;
    const int SM_YVIRTUALSCREEN = 77;
    const int SM_CXVIRTUALSCREEN = 78;
    const int SM_CYVIRTUALSCREEN = 79;
    int left = GetSystemMetrics(SM_XVIRTUALSCREEN);
    int top = GetSystemMetrics(SM_YVIRTUALSCREEN);
    int width = Math.Max(1, GetSystemMetrics(SM_CXVIRTUALSCREEN));
    int height = Math.Max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN));
    int absoluteX = (int)Math.Round((x - left) * 65535.0 / Math.Max(1, width - 1));
    int absoluteY = (int)Math.Round((y - top) * 65535.0 / Math.Max(1, height - 1));
    INPUT input = CreateMouseInput(0x0001 | 0x8000);
    input.mi.dx = Math.Max(0, Math.Min(65535, absoluteX));
    input.mi.dy = Math.Max(0, Math.Min(65535, absoluteY));
    return input;
  }

  public static POINTER_TOUCH_INFO CreatePrimaryTouch(uint id, int x, int y, uint flags, IntPtr hwndTarget) {
    POINTER_TOUCH_INFO contact = new POINTER_TOUCH_INFO();
    contact.pointerInfo.pointerType = 2;
    contact.pointerInfo.pointerId = id;
    contact.pointerInfo.frameId = 0;
    contact.pointerInfo.pointerFlags = flags;
    contact.pointerInfo.sourceDevice = IntPtr.Zero;
    contact.pointerInfo.hwndTarget = hwndTarget;
    contact.pointerInfo.ptPixelLocation.X = x;
    contact.pointerInfo.ptPixelLocation.Y = y;
    contact.pointerInfo.ptHimetricLocation.X = 0;
    contact.pointerInfo.ptHimetricLocation.Y = 0;
    contact.pointerInfo.ptPixelLocationRaw.X = x;
    contact.pointerInfo.ptPixelLocationRaw.Y = y;
    contact.pointerInfo.ptHimetricLocationRaw.X = 0;
    contact.pointerInfo.ptHimetricLocationRaw.Y = 0;
    contact.pointerInfo.dwTime = 0;
    contact.pointerInfo.historyCount = 1;
    contact.pointerInfo.inputData = 0;
    contact.pointerInfo.dwKeyStates = 0;
    contact.pointerInfo.PerformanceCount = 0;
    contact.pointerInfo.ButtonChangeType = 0;
    contact.touchFlags = 0;
    contact.touchMask = 0x00000001 | 0x00000002 | 0x00000004;
    contact.rcContact.left = x - 3;
    contact.rcContact.right = x + 3;
    contact.rcContact.top = y - 3;
    contact.rcContact.bottom = y + 3;
    contact.rcContactRaw = contact.rcContact;
    contact.orientation = 90;
    contact.pressure = 512;
    return contact;
  }
}
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
${prefixBody}
`;
}

function escapePowerShellSingleQuotedString(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function createForegroundGuardPowerShell(options, action) {
  const expectedHwnd = normalizeNumber(options.expectedForegroundHwnd ?? options.expectedHwnd ?? options.hwnd ?? options.windowHandle);
  const expectedPid = normalizeNumber(options.expectedForegroundPid ?? options.expectedPid ?? options.pid);
  const expectedTitle = String(options.expectedForegroundTitle ?? options.windowTitle ?? options.title ?? '').trim();
  const expectedProcessName = String(options.expectedForegroundProcessName ?? options.processName ?? '').trim();
  if (expectedHwnd === null && expectedPid === null && !expectedTitle && !expectedProcessName) {
    return '';
  }

  return String.raw`
$expectedForegroundHwnd = ${expectedHwnd === null ? '0' : Math.round(expectedHwnd)}
$expectedForegroundPid = ${expectedPid === null ? '0' : Math.round(expectedPid)}
$expectedForegroundTitle = '${escapePowerShellSingleQuotedString(expectedTitle)}'
$expectedForegroundProcessName = '${escapePowerShellSingleQuotedString(expectedProcessName)}'
$foregroundGuard = Get-DesktopPetInputForegroundSnapshot
$foregroundGuardOk = $true
$foregroundGuardReason = ''
if ($expectedForegroundHwnd -gt 0 -and [int64]$foregroundGuard.hwnd -ne [int64]$expectedForegroundHwnd) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected hwnd $expectedForegroundHwnd but foreground hwnd was $($foregroundGuard.hwnd)"
} elseif ($expectedForegroundPid -gt 0 -and [int]$foregroundGuard.pid -ne [int]$expectedForegroundPid) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected pid $expectedForegroundPid but foreground pid was $($foregroundGuard.pid)"
} elseif ($expectedForegroundProcessName.Length -gt 0 -and [string]::Compare([string]$foregroundGuard.processName, $expectedForegroundProcessName, $true) -ne 0) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected process $expectedForegroundProcessName but foreground process was $($foregroundGuard.processName)"
} elseif ($expectedForegroundTitle.Length -gt 0 -and -not ([string]$foregroundGuard.title).ToLowerInvariant().Contains($expectedForegroundTitle.ToLowerInvariant())) {
  $foregroundGuardOk = $false
  $foregroundGuardReason = "expected title containing $expectedForegroundTitle but foreground title was $($foregroundGuard.title)"
}
if (-not $foregroundGuardOk) {
  @{ ok = $false; action = '${escapePowerShellSingleQuotedString(action)}'; error = 'target_window_not_foreground'; foregroundBefore = $foregroundGuard; expectedForeground = @{ hwnd = $expectedForegroundHwnd; pid = $expectedForegroundPid; processName = $expectedForegroundProcessName; title = $expectedForegroundTitle }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; failureClassification = 'target_window_not_foreground'; foregroundProtectionOk = $false; foregroundProtectionReason = $foregroundGuardReason } } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}
`;
}

function createMouseEventScript(options) {
  const x = normalizeNumber(options.nativeScreenX);
  const y = normalizeNumber(options.nativeScreenY);
  if (x === null || y === null) {
    return null;
  }

  const button = normalizeButton(options.button);
  const isRight = button === 'right';
  const isMiddle = button === 'middle';
  const downFlag = isMiddle ? '0x0020' : isRight ? '0x0008' : '0x0002';
  const upFlag = isMiddle ? '0x0040' : isRight ? '0x0010' : '0x0004';
  const clicks = options.action === 'double_click'
    ? 2
    : normalizePositiveInteger(options.repeat ?? options.clickCount, 1, 4);
  const preClickDelayMs = normalizeInputDelayMs(options.preClickDelayMs, 80, 1000);
  const holdMs = normalizeInputDelayMs(options.holdMs ?? options.clickHoldMs, 40, 1000);
  const intervalMs = normalizeInputDelayMs(options.intervalMs ?? options.clickIntervalMs, 80, 1000);
  const forceMouseEventFallback = Boolean(options.forceMouseEventFallback);
  const forceTouchInjectionFallback = !isRight && !isMiddle && Boolean(options.forceTouchInjectionFallback);
  const keyboardFallback = String(options.keyboardFallback || options.fallbackKey || '').trim();
  const shouldKeyboardFallback = Boolean(keyboardFallback);
  const expectedTargetHwnd = normalizeNumber(options.expectedForegroundHwnd ?? options.expectedHwnd ?? options.hwnd ?? options.windowHandle) ?? 0;

  return createBaseInputPowerShell(String.raw`
$processElevated = Test-DesktopPetInputCurrentProcessElevated
$foregroundBefore = Get-DesktopPetInputForegroundSnapshot
${createForegroundGuardPowerShell(options, options.action)}
$targetElevated = $foregroundBefore.elevated
$integrityMismatch = ($processElevated -eq $false -and $targetElevated -eq $true)
if ($integrityMismatch) {
  @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; processElevated = $processElevated; foregroundBefore = $foregroundBefore; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = @('permission_preflight'); failureClassification = 'integrity_level_mismatch'; permissionStatus = 'target_requires_elevation'; foregroundStable = $true; targetElevated = $targetElevated; totalElapsedMs = 0; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} }; error = 'target_requires_elevation' } | ConvertTo-Json -Depth 10 -Compress
  exit 0
}
$diagnosticStartedAt = [Diagnostics.Stopwatch]::StartNew()
$inputPlan = @('SetCursorPos', 'SendInputDownUp')
if (${forceMouseEventFallback ? '$true' : '$false'}) {
  $inputPlan += 'mouse_event_supplement'
} else {
  $inputPlan += 'mouse_event_on_sendinput_failure'
}
if (${forceTouchInjectionFallback ? '$true' : '$false'}) {
  $inputPlan += 'touch_injection_supplement'
}
if (${shouldKeyboardFallback ? '$true' : '$false'}) {
  $inputPlan += 'keyboard_fallback:${keyboardFallback.replace(/'/g, "''")}'
}
$inputBackendStageResults = @()
$cursorBefore = New-Object DesktopPetInput+POINT
$cursorBeforeOk = [DesktopPetInput]::GetCursorPos([ref]$cursorBefore)
$moveStartedAt = [Diagnostics.Stopwatch]::StartNew()
$cursorSet = [DesktopPetInput]::SetCursorPos(${x}, ${y})
$moveStartedAt.Stop()
$cursorSetError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
$inputBackendStageResults += @{ stage = 'SetCursorPos'; ok = [bool]$cursorSet; elapsedMs = [int]$moveStartedAt.ElapsedMilliseconds; lastError = [int]$cursorSetError }
Start-Sleep -Milliseconds ${preClickDelayMs}
$point = New-Object DesktopPetInput+POINT
$cursorVerified = $false
if ([DesktopPetInput]::GetCursorPos([ref]$point)) {
  $cursorVerified = ([Math]::Abs([int]$point.X - ${x}) -le 2 -and [Math]::Abs([int]$point.Y - ${y}) -le 2)
}
$inputBackendStageResults += @{ stage = 'CursorVerify'; ok = [bool]$cursorVerified; x = [int]$point.X; y = [int]$point.Y }
$pointWindow = [IntPtr]::Zero
$pointRootWindow = [IntPtr]::Zero
$pointWindowMatchesTarget = $null
if ($cursorVerified) {
  $pointWindow = [DesktopPetInput]::WindowFromPoint($point)
  if ($pointWindow -ne [IntPtr]::Zero) {
    $pointRootWindow = [DesktopPetInput]::GetAncestor($pointWindow, 2)
    if ($pointRootWindow -eq [IntPtr]::Zero) {
      $pointRootWindow = $pointWindow
    }
  }
  if (${expectedTargetHwnd} -gt 0) {
    $pointWindowMatchesTarget = ([int64]$pointRootWindow.ToInt64() -eq [int64]${expectedTargetHwnd})
    $inputBackendStageResults += @{ stage = 'PointWindowVerify'; ok = [bool]$pointWindowMatchesTarget; pointHwnd = [int64]$pointWindow.ToInt64(); pointRootHwnd = [int64]$pointRootWindow.ToInt64(); expectedHwnd = [int64]${expectedTargetHwnd}; x = [int]$point.X; y = [int]$point.Y }
  } else {
    $inputBackendStageResults += @{ stage = 'PointWindowObserve'; ok = $true; pointHwnd = [int64]$pointWindow.ToInt64(); pointRootHwnd = [int64]$pointRootWindow.ToInt64(); expectedHwnd = 0; x = [int]$point.X; y = [int]$point.Y }
  }
}
if ($cursorVerified -and ${expectedTargetHwnd} -gt 0 -and $pointWindowMatchesTarget -ne $true) {
  $diagnosticStartedAt.Stop()
  @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; cursorSet = $cursorSet; cursorVerified = $cursorVerified; sendInput = $false; sendInputAllOk = $false; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $true; x = [int]$point.X; y = [int]$point.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; failureClassification = 'target_hit_test_mismatch'; stageResults = $inputBackendStageResults; pointWindowHwnd = [int64]$pointWindow.ToInt64(); pointRootWindowHwnd = [int64]$pointRootWindow.ToInt64(); expectedTargetHwnd = [int64]${expectedTargetHwnd}; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} } } | ConvertTo-Json -Depth 10 -Compress
  exit 0
}
$virtualMoveSent = 0
$virtualMoveError = 0
if (-not $cursorVerified) {
  $absoluteMove = [DesktopPetInput]::CreateAbsoluteMouseMove(${x}, ${y})
  $virtualMoveSent = [DesktopPetInput]::SendInput(1, @($absoluteMove), [Runtime.InteropServices.Marshal]::SizeOf([type][DesktopPetInput+INPUT]))
  $virtualMoveError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Start-Sleep -Milliseconds 40
  $virtualPoint = New-Object DesktopPetInput+POINT
  if ([DesktopPetInput]::GetCursorPos([ref]$virtualPoint)) {
    $cursorVerified = ([Math]::Abs([int]$virtualPoint.X - ${x}) -le 2 -and [Math]::Abs([int]$virtualPoint.Y - ${y}) -le 2)
    $point = $virtualPoint
  }
  $inputBackendStageResults += @{ stage = 'VirtualAbsoluteMove'; ok = [bool]$cursorVerified; sent = [int]$virtualMoveSent; lastError = [int]$virtualMoveError; x = [int]$point.X; y = [int]$point.Y }
}
if (-not $cursorVerified) {
  $diagnosticStartedAt.Stop()
  @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; cursorSet = $cursorSet; cursorVerified = $false; sendInput = $false; sendInputAllOk = $false; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $true; x = [int]$point.X; y = [int]$point.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; failureClassification = 'cursor_target_not_reached'; stageResults = $inputBackendStageResults; setCursorLastError = [int]$cursorSetError; virtualMoveSent = [int]$virtualMoveSent; virtualMoveLastError = [int]$virtualMoveError; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} } } | ConvertTo-Json -Depth 10 -Compress
  exit 0
}
$pointWindow = [DesktopPetInput]::WindowFromPoint($point)
$pointRootWindow = [DesktopPetInput]::GetAncestor($pointWindow, 2)
if ($pointRootWindow -eq [IntPtr]::Zero) {
  $pointRootWindow = $pointWindow
}
if (${expectedTargetHwnd} -gt 0) {
  $pointWindowMatchesTarget = ([int64]$pointRootWindow.ToInt64() -eq [int64]${expectedTargetHwnd})
  $inputBackendStageResults += @{ stage = 'PointWindowVerify'; ok = [bool]$pointWindowMatchesTarget; pointHwnd = [int64]$pointWindow.ToInt64(); pointRootHwnd = [int64]$pointRootWindow.ToInt64(); expectedHwnd = [int64]${expectedTargetHwnd}; x = [int]$point.X; y = [int]$point.Y }
  if ($pointWindowMatchesTarget -ne $true) {
    $diagnosticStartedAt.Stop()
    @{ ok = $false; action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; cursorSet = $cursorSet; cursorVerified = $cursorVerified; sendInput = $false; sendInputAllOk = $false; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $true; x = [int]$point.X; y = [int]$point.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; failureClassification = 'target_hit_test_mismatch'; stageResults = $inputBackendStageResults; pointWindowHwnd = [int64]$pointWindow.ToInt64(); pointRootWindowHwnd = [int64]$pointRootWindow.ToInt64(); expectedTargetHwnd = [int64]${expectedTargetHwnd}; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'} } } | ConvertTo-Json -Depth 10 -Compress
    exit 0
  }
}
$sendInputOk = $false
$sendInputAllOk = $true
$sendInputAttempts = @()
for ($i = 0; $i -lt ${clicks}; $i++) {
  $foregroundBeforeDown = Get-DesktopPetInputForegroundSnapshot
  $cursorBeforeDown = New-Object DesktopPetInput+POINT
  $cursorBeforeDownOk = [DesktopPetInput]::GetCursorPos([ref]$cursorBeforeDown)
  $down = [DesktopPetInput]::CreateMouseInput(${downFlag})
  $up = [DesktopPetInput]::CreateMouseInput(${upFlag})
  $downStartedAt = [Diagnostics.Stopwatch]::StartNew()
  $sentDown = [DesktopPetInput]::SendInput(1, @($down), [Runtime.InteropServices.Marshal]::SizeOf([type][DesktopPetInput+INPUT]))
  $downError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  $downStartedAt.Stop()
  $foregroundAfterDown = Get-DesktopPetInputForegroundSnapshot
  $cursorAfterDown = New-Object DesktopPetInput+POINT
  $cursorAfterDownOk = [DesktopPetInput]::GetCursorPos([ref]$cursorAfterDown)
  Start-Sleep -Milliseconds ${holdMs}
  $foregroundBeforeUp = Get-DesktopPetInputForegroundSnapshot
  $cursorBeforeUp = New-Object DesktopPetInput+POINT
  $cursorBeforeUpOk = [DesktopPetInput]::GetCursorPos([ref]$cursorBeforeUp)
  $upStartedAt = [Diagnostics.Stopwatch]::StartNew()
  $sentUp = [DesktopPetInput]::SendInput(1, @($up), [Runtime.InteropServices.Marshal]::SizeOf([type][DesktopPetInput+INPUT]))
  $upError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  $upStartedAt.Stop()
  $foregroundAfterUp = Get-DesktopPetInputForegroundSnapshot
  $cursorAfterUp = New-Object DesktopPetInput+POINT
  $cursorAfterUpOk = [DesktopPetInput]::GetCursorPos([ref]$cursorAfterUp)
  $attemptOk = ($sentDown -eq 1 -and $sentUp -eq 1)
  $fallbackMouseEventUsed = $false
  if ($sentDown -eq 1 -and $sentUp -eq 1 -and -not ${forceMouseEventFallback ? '$true' : '$false'}) {
    $sendInputOk = $true
  } else {
    if ($sentDown -ne 1 -or $sentUp -ne 1) {
      $sendInputAllOk = $false
    }
    $fallbackMouseEventUsed = $true
    [DesktopPetInput]::mouse_event(${downFlag}, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds ${holdMs}
    [DesktopPetInput]::mouse_event(${upFlag}, 0, 0, 0, [UIntPtr]::Zero)
    if ($sentDown -eq 1 -and $sentUp -eq 1) {
      $sendInputOk = $true
    }
  }
  $inputBackendStageResults += @{ stage = 'SendInputDownUp'; index = $i + 1; ok = [bool]$attemptOk; downSent = [int]$sentDown; upSent = [int]$sentUp; downLastError = [int]$downError; upLastError = [int]$upError }
  if ($fallbackMouseEventUsed) {
    $mouseEventReason = 'sendinput_failure'
    if ($sentDown -eq 1 -and $sentUp -eq 1) {
      $mouseEventReason = 'forced_supplement'
    }
    $inputBackendStageResults += @{ stage = 'mouse_event'; index = $i + 1; ok = $true; reason = $mouseEventReason }
  }
  $touchInjectionResult = $null
  if (${forceTouchInjectionFallback ? '$true' : '$false'}) {
    $touchPoint = New-Object DesktopPetInput+POINT
    $touchPointOk = [DesktopPetInput]::GetCursorPos([ref]$touchPoint)
    $touchTarget = [IntPtr]::Zero
    if ($touchPointOk) {
      $touchTarget = [DesktopPetInput]::WindowFromPoint($touchPoint)
    }
    $touchInitOk = [DesktopPetInput]::InitializeTouchInjection(1, 1)
    $touchInitError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $touchDownOk = $false
    $touchDownError = $null
    $touchUpOk = $false
    $touchUpError = $null
    if ($touchPointOk -and $touchInitOk) {
      $touchDownFlags = 0x00000002 -bor 0x00000004 -bor 0x00000010 -bor 0x00002000 -bor 0x00010000
      $touchDown = [DesktopPetInput]::CreatePrimaryTouch(1, [int]$touchPoint.X, [int]$touchPoint.Y, [uint32]$touchDownFlags, $touchTarget)
      $touchDownOk = [DesktopPetInput]::InjectTouchInput(1, @($touchDown))
      $touchDownError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      Start-Sleep -Milliseconds ${holdMs}
      $touchUpFlags = 0x00000002 -bor 0x00002000 -bor 0x00040000
      $touchUp = [DesktopPetInput]::CreatePrimaryTouch(1, [int]$touchPoint.X, [int]$touchPoint.Y, [uint32]$touchUpFlags, $touchTarget)
      $touchUpOk = [DesktopPetInput]::InjectTouchInput(1, @($touchUp))
      $touchUpError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    }
    $touchInjectionResult = @{
      stage = 'touch_injection'
      index = $i + 1
      ok = [bool]($touchDownOk -and $touchUpOk)
      cursorOk = [bool]$touchPointOk
      x = [int]$touchPoint.X
      y = [int]$touchPoint.Y
      targetHwnd = [int64]$touchTarget.ToInt64()
      initOk = [bool]$touchInitOk
      initLastError = [int]$touchInitError
      downOk = [bool]$touchDownOk
      downLastError = if ($touchDownError -eq $null) { $null } else { [int]$touchDownError }
      upOk = [bool]$touchUpOk
      upLastError = if ($touchUpError -eq $null) { $null } else { [int]$touchUpError }
    }
    $inputBackendStageResults += $touchInjectionResult
  }
  $sendInputAttempts += @{
    index = $i + 1
    downSent = [int]$sentDown
    downOk = ($sentDown -eq 1)
    downLastError = [int]$downError
    downElapsedMs = [int]$downStartedAt.ElapsedMilliseconds
    foregroundBeforeDown = $foregroundBeforeDown
    foregroundAfterDown = $foregroundAfterDown
    foregroundBeforeUp = $foregroundBeforeUp
    foregroundAfterUp = $foregroundAfterUp
    cursorBeforeDown = @{ ok = $cursorBeforeDownOk; x = [int]$cursorBeforeDown.X; y = [int]$cursorBeforeDown.Y }
    cursorAfterDown = @{ ok = $cursorAfterDownOk; x = [int]$cursorAfterDown.X; y = [int]$cursorAfterDown.Y }
    cursorBeforeUp = @{ ok = $cursorBeforeUpOk; x = [int]$cursorBeforeUp.X; y = [int]$cursorBeforeUp.Y }
    cursorAfterUp = @{ ok = $cursorAfterUpOk; x = [int]$cursorAfterUp.X; y = [int]$cursorAfterUp.Y }
    upSent = [int]$sentUp
    upOk = ($sentUp -eq 1)
    upLastError = [int]$upError
    upElapsedMs = [int]$upStartedAt.ElapsedMilliseconds
    ok = $attemptOk
    fallbackMouseEventUsed = $fallbackMouseEventUsed
    touchInjection = $touchInjectionResult
  }
  Start-Sleep -Milliseconds ${intervalMs}
}
$keyboardFallbackUsed = $false
if (${shouldKeyboardFallback ? '$true' : '$false'}) {
  $keyboardFallbackUsed = $true
  $fallbackKey = '${keyboardFallback.replace(/'/g, "''")}'
  if ($fallbackKey -eq 'enter') {
    [DesktopPetInput]::keybd_event(0x0D, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [DesktopPetInput]::keybd_event(0x0D, 0, 0x0002, [UIntPtr]::Zero)
    $inputBackendStageResults += @{ stage = 'KeyboardFallback'; ok = $true; key = 'enter' }
  } elseif ($fallbackKey -eq 'space') {
    [DesktopPetInput]::keybd_event(0x20, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [DesktopPetInput]::keybd_event(0x20, 0, 0x0002, [UIntPtr]::Zero)
    $inputBackendStageResults += @{ stage = 'KeyboardFallback'; ok = $true; key = 'space' }
  } else {
    $inputBackendStageResults += @{ stage = 'KeyboardFallback'; ok = $false; key = $fallbackKey; reason = 'unsupported_key' }
  }
}
$cursorAfter = New-Object DesktopPetInput+POINT
$cursorAfterOk = [DesktopPetInput]::GetCursorPos([ref]$cursorAfter)
$foregroundAfter = Get-DesktopPetInputForegroundSnapshot
$diagnosticStartedAt.Stop()
$foregroundStable = ($foregroundBefore.hwnd -ne 0 -and $foregroundBefore.hwnd -eq $foregroundAfter.hwnd)
$failureClassification = if (-not $cursorSet -and -not $cursorVerified) { 'cursor_move_failed' } elseif (-not $cursorVerified) { 'cursor_not_verified' } elseif (-not $sendInputAllOk) { 'sendinput_failed' } elseif (-not $foregroundStable) { 'foreground_changed' } elseif ($sendInputOk -and $foregroundStable) { 'injected_no_effect_possible' } else { 'unknown' }
@{ ok = [bool]($cursorVerified -and $sendInputOk); action = '${options.action}'; x = ${x}; y = ${y}; button = '${button}'; clickCount = ${clicks}; preClickDelayMs = ${preClickDelayMs}; holdMs = ${holdMs}; intervalMs = ${intervalMs}; cursorSet = $cursorSet; cursorVerified = $cursorVerified; sendInput = $sendInputOk; sendInputAllOk = $sendInputAllOk; sendInputAttempts = $sendInputAttempts; processElevated = $processElevated; cursorBefore = @{ ok = $cursorBeforeOk; x = [int]$cursorBefore.X; y = [int]$cursorBefore.Y }; cursorAfter = @{ ok = $cursorAfterOk; x = [int]$cursorAfter.X; y = [int]$cursorAfter.Y }; inputDiagnostics = @{ backendName = 'DesktopInputBackend'; inputPlan = $inputPlan; stageResults = $inputBackendStageResults; failureClassification = $failureClassification; foregroundStable = $foregroundStable; keyboardFallbackUsed = $keyboardFallbackUsed; keyboardFallback = '${keyboardFallback.replace(/'/g, "''")}'; moveElapsedMs = [int]$moveStartedAt.ElapsedMilliseconds; totalElapsedMs = [int]$diagnosticStartedAt.ElapsedMilliseconds; downUpStrategy = 'SendInput'; fallbackStrategy = 'mouse_event_on_sendinput_failure'; forceMouseEventFallback = ${forceMouseEventFallback ? '$true' : '$false'}; forceTouchInjectionFallback = ${forceTouchInjectionFallback ? '$true' : '$false'}; virtualMoveSent = [int]$virtualMoveSent; virtualMoveLastError = [int]$virtualMoveError } } | ConvertTo-Json -Depth 10 -Compress
`);
}

function createMoveMouseScript(options) {
  const x = normalizeNumber(options.nativeScreenX);
  const y = normalizeNumber(options.nativeScreenY);
  if (x === null || y === null) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
[void][DesktopPetInput]::SetCursorPos(${x}, ${y})
@{ ok = $true; action = 'move_mouse'; x = ${x}; y = ${y} } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createDragScript(options) {
  const fromX = normalizeNumber(options.fromNativeScreenX);
  const fromY = normalizeNumber(options.fromNativeScreenY);
  const toX = normalizeNumber(options.toNativeScreenX);
  const toY = normalizeNumber(options.toNativeScreenY);
  if (fromX === null || fromY === null || toX === null || toY === null) {
    return null;
  }

  const steps = normalizePositiveInteger(options.steps, 12, DESKTOP_INPUT_MAX_DRAG_STEPS);
  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'drag')}
[void][DesktopPetInput]::SetCursorPos(${fromX}, ${fromY})
Start-Sleep -Milliseconds 80
[DesktopPetInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
for ($i = 1; $i -le ${steps}; $i++) {
  $x = [int](${fromX} + ((${toX} - ${fromX}) * $i / ${steps}))
  $y = [int](${fromY} + ((${toY} - ${fromY}) * $i / ${steps}))
  [void][DesktopPetInput]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 20
}
[DesktopPetInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
@{ ok = $true; action = 'drag'; fromX = ${fromX}; fromY = ${fromY}; toX = ${toX}; toY = ${toY}; steps = ${steps} } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createTextScript(options) {
  const text = String(options.text ?? options.value ?? '').slice(0, 2000);
  if (!text) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'type_text')}
$text = @'
${JSON.stringify(escapeSendKeysText(text))}
'@ | ConvertFrom-Json
[System.Windows.Forms.SendKeys]::SendWait($text)
@{ ok = $true; action = 'type_text'; textLength = $text.Length } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createSendKeysScript(options) {
  const keys = String(options.keys ?? options.sequence ?? '').trim().slice(0, 400);
  if (!keys) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'send_keys')}
$keys = @'
${JSON.stringify(keys)}
'@ | ConvertFrom-Json
[System.Windows.Forms.SendKeys]::SendWait($keys)
@{ ok = $true; action = 'send_keys'; keys = $keys } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createHotkeyScript(options) {
  const tokens = splitHotkey(options.hotkey ?? options.keys ?? options.sequence);
  const virtualKeys = tokens.map(virtualKeyFromToken).filter((value) => value !== null);
  if (!virtualKeys.length || virtualKeys.length !== tokens.length) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'hotkey')}
$keys = @(${virtualKeys.join(',')})
foreach ($key in $keys) {
  [DesktopPetInput]::keybd_event([byte]$key, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 25
}
for ($i = $keys.Length - 1; $i -ge 0; $i--) {
  [DesktopPetInput]::keybd_event([byte]$keys[$i], 0, 0x0002, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 25
}
@{ ok = $true; action = 'hotkey'; hotkey = '${tokens.join('+')}' } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createDesktopInputScript(action, request) {
  switch (action) {
    case 'move_mouse':
      return createMoveMouseScript(request);
    case 'click':
    case 'double_click':
    case 'right_click':
      return createMouseEventScript({
        ...request,
        action,
        button: action === 'right_click' ? 'right' : request.button,
      });
    case 'drag':
      return createDragScript(request);
    case 'type_text':
      return createTextScript(request);
    case 'send_keys':
      return createSendKeysScript(request);
    case 'hotkey':
      return createHotkeyScript(request);
    default:
      return null;
  }
}

function createDesktopInputService({ log, screen } = {}) {
  function convertDipPointToNativeScreenPoint(point) {
    if (
      screen
      && typeof screen.dipToScreenPoint === 'function'
      && Number.isFinite(point?.x)
      && Number.isFinite(point?.y)
    ) {
      try {
        const convertedPoint = screen.dipToScreenPoint({
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
        if (
          convertedPoint
          && Number.isFinite(convertedPoint.x)
          && Number.isFinite(convertedPoint.y)
        ) {
          return {
            x: Math.round(convertedPoint.x),
            y: Math.round(convertedPoint.y),
          };
        }
      } catch (error) {
        log?.('desktop input coordinate conversion failed', error?.stack || error);
      }
    }

    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
  }

  function resolveInputNativeScreenPoint(request, xKeys, yKeys) {
    let x = null;
    let y = null;
    for (const key of xKeys) {
      const value = normalizeNumber(request?.[key]);
      if (value !== null) {
        x = value;
        break;
      }
    }
    for (const key of yKeys) {
      const value = normalizeNumber(request?.[key]);
      if (value !== null) {
        y = value;
        break;
      }
    }
    if (x === null || y === null) {
      return null;
    }

    if (normalizeDesktopInputCoordinateSpace(request?.coordinateSpace) === 'native-screen') {
      return { x, y };
    }

    return convertDipPointToNativeScreenPoint({ x, y });
  }

  function createNativeScreenInputRequest(action, request) {
    const nextRequest = {
      ...request,
      coordinateSpace: 'native-screen',
    };
    if (action === 'drag') {
      const fromPoint = resolveInputNativeScreenPoint(
        request,
        ['fromX', 'x', 'fromNativeScreenX', 'nativeScreenX'],
        ['fromY', 'y', 'fromNativeScreenY', 'nativeScreenY'],
      );
      const toPoint = resolveInputNativeScreenPoint(
        request,
        ['toX', 'targetX', 'endX', 'toNativeScreenX'],
        ['toY', 'targetY', 'endY', 'toNativeScreenY'],
      );
      if (!fromPoint || !toPoint) {
        return nextRequest;
      }

      return {
        ...nextRequest,
        fromNativeScreenX: fromPoint.x,
        fromNativeScreenY: fromPoint.y,
        toNativeScreenX: toPoint.x,
        toNativeScreenY: toPoint.y,
      };
    }

    const point = resolveInputNativeScreenPoint(
      request,
      ['x', 'nativeScreenX'],
      ['y', 'nativeScreenY'],
    );
    return point
      ? {
          ...nextRequest,
          nativeScreenX: point.x,
          nativeScreenY: point.y,
        }
      : nextRequest;
  }

  async function executeDesktopInput(request = {}) {
    const action = normalizeDesktopInputAction(request?.action ?? request?.inputAction ?? request?.operation);
    if (!action) {
      return {
        ok: false,
        error: 'Unsupported desktop input action.',
        supportedActions: ['move_mouse', 'click', 'double_click', 'right_click', 'type_text', 'send_keys', 'hotkey', 'drag'],
      };
    }

    if (process.platform !== 'win32') {
      return {
        ok: false,
        action,
        error: 'Desktop input primitives are currently only implemented on Windows.',
      };
    }

    const nativeScreenRequest = createNativeScreenInputRequest(action, request);
    const script = createDesktopInputScript(action, nativeScreenRequest);
    if (!script) {
      return {
        ok: false,
        action,
        error: 'Missing or invalid desktop input parameters.',
      };
    }

    try {
      const stdout = await runPowerShellScript(script, DESKTOP_INPUT_TIMEOUT_MS);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      log?.('desktop input executed', {
        action,
        coordinateSpace: 'native-screen',
        ok: Boolean(parsed?.ok),
      });
      return {
        ...parsed,
        action,
        ok: Boolean(parsed?.ok),
      };
    } catch (error) {
      return {
        ok: false,
        action,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    executeDesktopInput,
    _createNativeScreenInputRequest: createNativeScreenInputRequest,
  };
}

module.exports = {
  createDesktopInputService,
  _createDesktopInputScript: createDesktopInputScript,
};
