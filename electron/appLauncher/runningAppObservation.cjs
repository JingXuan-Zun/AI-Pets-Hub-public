const { createTopLevelWindowEnumeratorPowerShell } = require('./topLevelWindowEnumeratorPowerShell.cjs');
const { normalizeSearchText } = require('./appSearchMatching.cjs');

function createRunningAppObservation({ runPowerShellScript, normalizeRunningAppWindow, enrichWindowDisplay }) {
  async function listRunningApps(request = {}) {
    const query = String(request?.query || request?.target || request?.name || '').trim();
    const includeWindows = request?.includeWindows !== false;
    const limit = Math.max(1, Math.min(80, Math.round(Number(request?.limit ?? 40))));

    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'Running app/window listing is currently only implemented on Windows.',
        query,
        apps: [],
        activeWindow: null,
        count: 0,
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
${createTopLevelWindowEnumeratorPowerShell()}

$windowDiagnostics = Get-DesktopPetTopLevelWindowDiagnostics
$foregroundHandle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
$foregroundHwnd = $(if ($foregroundHandle -eq [IntPtr]::Zero) { 0 } else { [int64]$foregroundHandle.ToInt64() })
$windows = @($windowDiagnostics.windows) | ForEach-Object {
  $windowHwnd = [int64]$_.hwnd
  [PSCustomObject]@{
    active = ($windowHwnd -eq $foregroundHwnd)
    bounds = $_.bounds
    hwnd = $windowHwnd
    pid = $_.pid
    processName = $_.processName
    title = $_.title
    path = $_.path
    topLevelOrder = $_.topLevelOrder
    visible = [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible([IntPtr]([int64]$windowHwnd))
  }
} | Sort-Object -Property processName,title
@{
  enumeratedCount = $windowDiagnostics.enumeratedCount
  filteredOut = @($windowDiagnostics.filteredOut)
  windows = @($windows)
} | ConvertTo-Json -Depth 6 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 2600);
      const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
      const rawWindows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.windows) ? parsed.windows : [];
      const windows = rawWindows
        .map(normalizeRunningAppWindow)
        .filter(Boolean)
        .map(enrichWindowDisplay);
      const activeWindow = windows.find((item) => item.active) ?? null;
      const windowEnumeration = !Array.isArray(parsed)
        ? {
          enumeratedCount: Number.isFinite(Number(parsed?.enumeratedCount)) ? Math.round(Number(parsed.enumeratedCount)) : null,
          filteredOut: Array.isArray(parsed?.filteredOut) ? parsed.filteredOut.slice(0, 24) : [],
        }
        : null;
      const normalizedQuery = normalizeSearchText(query);
      const filteredWindows = normalizedQuery
        ? windows.filter((item) => (
          normalizeSearchText(item.processName).includes(normalizedQuery)
          || normalizeSearchText(item.title).includes(normalizedQuery)
          || normalizeSearchText(item.executablePath).includes(normalizedQuery)
        ))
        : windows;

      if (includeWindows) {
        return {
          ok: true,
          apps: filteredWindows.slice(0, limit),
          activeWindow,
          count: filteredWindows.length,
          query,
          windowEnumeration,
        };
      }

      const groupedApps = [];
      const byProcessName = new Map();
      filteredWindows.forEach((item) => {
        const key = item.processName.toLowerCase();
        const current = byProcessName.get(key);
        if (!current) {
          byProcessName.set(key, {
            executablePath: item.executablePath,
            displayIds: item.displayId ? [item.displayId] : [],
            displays: item.display ? [item.display] : [],
            processName: item.processName,
            titles: item.title ? [item.title] : [],
            windowCount: 1,
          });
          return;
        }

        current.windowCount += 1;
        if (item.title && !current.titles.includes(item.title)) {
          current.titles.push(item.title);
        }
        if (item.displayId && !current.displayIds.includes(item.displayId)) {
          current.displayIds.push(item.displayId);
        }
        if (item.display && !current.displays.some((display) => display.id === item.display.id)) {
          current.displays.push(item.display);
        }
      });
      byProcessName.forEach((item) => groupedApps.push(item));

      return {
        ok: true,
        apps: groupedApps.slice(0, limit),
        activeWindow,
        count: groupedApps.length,
        query,
        windowEnumeration,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        query,
        apps: [],
        activeWindow: null,
        count: 0,
      };
    }
  }

  async function getActiveWindowInfo() {
    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'Active window lookup is currently only implemented on Windows.',
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
${createTopLevelWindowEnumeratorPowerShell()}

$handle = [DesktopPetTopLevelWindowEnumerator]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) {
  @{ ok = $false; error = 'No foreground window handle.' } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}

$hwnd = [int64]$handle.ToInt64()
$window = @(Get-DesktopPetTopLevelWindows | Where-Object { [int64]$_.hwnd -eq $hwnd } | Select-Object -First 1)
$source = 'top-level-window-enumerator'

if ($null -eq $window) {
  $pidValue = [uint32]0
  [void][DesktopPetTopLevelWindowEnumerator]::GetWindowThreadProcessId($handle, [ref]$pidValue)
  $process = $null
  $processPath = ''
  try {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction Stop
    try { $processPath = [string]$process.Path } catch { $processPath = '' }
  } catch {
    $process = $null
  }
  $rect = New-Object DesktopPetWindowRect
  $hasRect = [DesktopPetTopLevelWindowEnumerator]::GetWindowRect($handle, [ref]$rect)
  $window = [PSCustomObject]@{
    bounds = $(if ($hasRect) {
      @{
        x = $rect.Left
        y = $rect.Top
        width = [Math]::Max(0, $rect.Right - $rect.Left)
        height = [Math]::Max(0, $rect.Bottom - $rect.Top)
      }
    } else { $null })
    executablePath = $processPath
    hwnd = $hwnd
    path = $processPath
    pid = [int]$pidValue
    processName = $(if ($process) { [string]$process.ProcessName } else { '' })
    title = [DesktopPetTopLevelWindowEnumerator]::ReadWindowText($handle)
    topLevelOrder = -1
  }
  $source = 'foreground-window-fallback'
}

@{
  ok = $true
  active = $true
  bounds = $window.bounds
  executablePath = $window.executablePath
  hwnd = $window.hwnd
  path = $window.path
  pid = $window.pid
  processName = $window.processName
  source = $source
  title = $window.title
  topLevelOrder = $window.topLevelOrder
  visible = [DesktopPetTopLevelWindowEnumerator]::IsWindowVisible($handle)
} | ConvertTo-Json -Depth 6 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 1800);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const normalizedWindow = normalizeRunningAppWindow(parsed);
      return enrichWindowDisplay({
        ok: Boolean(parsed?.ok),
        active: Boolean(parsed?.active),
        bounds: normalizedWindow?.bounds ?? null,
        coordinateSpace: normalizedWindow?.coordinateSpace ?? null,
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        executablePath: normalizedWindow?.executablePath ?? '',
        hwnd: normalizedWindow?.hwnd ?? null,
        nativeBounds: normalizedWindow?.nativeBounds ?? null,
        nativeCoordinateSpace: normalizedWindow?.nativeCoordinateSpace ?? null,
        pid: normalizedWindow?.pid ?? null,
        processName: normalizedWindow?.processName ?? '',
        source: typeof parsed?.source === 'string' ? parsed.source : undefined,
        title: normalizedWindow?.title ?? '',
        topLevelOrder: Number.isFinite(Number(parsed?.topLevelOrder)) ? Math.round(Number(parsed.topLevelOrder)) : undefined,
        visible: Boolean(parsed?.visible),
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { listRunningApps, getActiveWindowInfo };
}

module.exports = { createRunningAppObservation };
