// Her browser must not take the user's screen (user, 2026-11-05: while they used their own
// Chrome, her window jumped in front during a task). chrome-devtools needs the tab it works on
// to be the active one (select_page / new_page bring it to the front; a screenshot of a
// background tab hangs), so instead of blocking that, the window that had the focus before the
// call gets it back afterwards — but only when her browser took it. If the user switched
// windows themselves in the meantime, nothing is touched.

const FOCUS_TAKING_TOOLS = new Set(['select_page', 'new_page']);
const HER_PROFILE_MARKER = 'browser-search-profile';

const INTEROP = String.raw`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class DesktopPetHerBrowserFocus {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
`;

function snapshotScript() {
  return `${INTEROP}
$h = [DesktopPetHerBrowserFocus]::GetForegroundWindow()
$p = [uint32]0
[void][DesktopPetHerBrowserFocus]::GetWindowThreadProcessId($h, [ref]$p)
@{ hwnd = [int64]$h; pid = [int]$p } | ConvertTo-Json -Compress`;
}

function restoreScript(savedHwnd) {
  return `${INTEROP}
Start-Sleep -Milliseconds 150
$saved = [IntPtr]${Math.round(Number(savedHwnd)) || 0}
$now = [DesktopPetHerBrowserFocus]::GetForegroundWindow()
if ($now -eq $saved) { @{ restored = $false; reason = 'unchanged' } | ConvertTo-Json -Compress; exit 0 }
if (-not [DesktopPetHerBrowserFocus]::IsWindow($saved)) { @{ restored = $false; reason = 'saved-window-gone' } | ConvertTo-Json -Compress; exit 0 }
$p = [uint32]0
$thread = [DesktopPetHerBrowserFocus]::GetWindowThreadProcessId($now, [ref]$p)
$commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue).CommandLine
if (-not ([string]$commandLine).Contains('${HER_PROFILE_MARKER}')) { @{ restored = $false; reason = 'user-switched' } | ConvertTo-Json -Compress; exit 0 }
$current = [DesktopPetHerBrowserFocus]::GetCurrentThreadId()
$attached = [DesktopPetHerBrowserFocus]::AttachThreadInput($current, $thread, $true)
[DesktopPetHerBrowserFocus]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
[DesktopPetHerBrowserFocus]::keybd_event(0x12, 0, 0x0002, [UIntPtr]::Zero)
$ok = [DesktopPetHerBrowserFocus]::SetForegroundWindow($saved)
if ($attached) { [void][DesktopPetHerBrowserFocus]::AttachThreadInput($current, $thread, $false) }
@{ restored = [bool]$ok; reason = 'her-browser-took-focus' } | ConvertTo-Json -Compress`;
}

function parseJson(text) {
  try {
    return JSON.parse(String(text || '').trim() || '{}');
  } catch {
    return {};
  }
}

function createHerBrowserFocusGuard({ runPowerShellScript, log = () => {}, platform = process.platform }) {
  /** Runs one MCP tool call; gives the focus back when her browser took it during the call. */
  async function guard(request, call) {
    if (platform !== 'win32' || !FOCUS_TAKING_TOOLS.has(String(request?.name || ''))) return call();
    const before = parseJson(await runPowerShellScript(snapshotScript(), 5000).catch(() => ''));
    const result = await call();
    if (before.hwnd) {
      const restored = parseJson(await runPowerShellScript(restoreScript(before.hwnd), 5000).catch(() => ''));
      if (restored.reason && restored.reason !== 'unchanged') log('her browser focus', { reason: restored.reason, restored: Boolean(restored.restored), tool: request.name });
    }
    return result;
  }

  return { guard };
}

module.exports = { FOCUS_TAKING_TOOLS, createHerBrowserFocusGuard, restoreScript, snapshotScript };
