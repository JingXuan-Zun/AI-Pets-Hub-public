const { execFile } = require('child_process');

const DWM_BORDER_COMMAND_TIMEOUT_MS = 5000;

function resolveNativeWindowHandleDecimal(nativeWindowHandle) {
  if (!Buffer.isBuffer(nativeWindowHandle) || nativeWindowHandle.length < 4) {
    return null;
  }

  if (nativeWindowHandle.length >= 8) {
    return nativeWindowHandle.readBigUInt64LE(0).toString(10);
  }

  return BigInt(nativeWindowHandle.readUInt32LE(0)).toString(10);
}

function createDisableDwmBorderPowerShell(nativeWindowHandleDecimal) {
  const normalizedHandle = String(nativeWindowHandleDecimal ?? '').trim();
  if (!/^\d+$/u.test(normalizedHandle) || normalizedHandle === '0') {
    throw new Error('Invalid native window handle.');
  }

  return String.raw`
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class DesktopPetDwmBorderRuntime
{
    private const int DwmwaBorderColor = 34;
    private const uint DwmwaColorNone = 0xFFFFFFFE;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(
        IntPtr hWnd,
        int attribute,
        ref uint value,
        int valueSize
    );

    public static int Disable(long nativeWindowHandle)
    {
        var color = DwmwaColorNone;
        return DwmSetWindowAttribute(
            new IntPtr(nativeWindowHandle),
            DwmwaBorderColor,
            ref color,
            Marshal.SizeOf<uint>()
        );
    }
}
'@

[DesktopPetDwmBorderRuntime]::Disable([Int64]${normalizedHandle})
`.trim();
}

function summarizeProcessOutput(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, 400);
}

function disableDwmSystemBorderForWindow(browserWindow, options = {}) {
  const {
    execFileImpl = execFile,
    platform = process.platform,
    timeoutMs = DWM_BORDER_COMMAND_TIMEOUT_MS,
  } = options;

  if (platform !== 'win32') {
    return Promise.resolve({ applied: false, reason: 'unsupported-platform' });
  }
  if (
    !browserWindow
    || typeof browserWindow.isDestroyed !== 'function'
    || browserWindow.isDestroyed()
    || typeof browserWindow.getNativeWindowHandle !== 'function'
  ) {
    return Promise.resolve({ applied: false, reason: 'window-unavailable' });
  }

  let nativeWindowHandleDecimal;
  let script;
  try {
    nativeWindowHandleDecimal = resolveNativeWindowHandleDecimal(
      browserWindow.getNativeWindowHandle(),
    );
    script = createDisableDwmBorderPowerShell(nativeWindowHandleDecimal);
  } catch (error) {
    return Promise.resolve({
      applied: false,
      error: summarizeProcessOutput(error?.message || error),
      reason: 'invalid-window-handle',
    });
  }

  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFileImpl(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand],
      {
        encoding: 'utf8',
        timeout: timeoutMs,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            applied: false,
            error: summarizeProcessOutput(stderr || stdout || error.message),
            nativeWindowHandle: nativeWindowHandleDecimal,
            reason: 'command-failed',
          });
          return;
        }

        const resultCode = Number.parseInt(String(stdout ?? '').trim(), 10);
        resolve({
          applied: resultCode === 0,
          nativeWindowHandle: nativeWindowHandleDecimal,
          reason: resultCode === 0 ? 'applied' : 'dwm-rejected',
          resultCode: Number.isFinite(resultCode) ? resultCode : null,
        });
      },
    );
  });
}

module.exports = {
  createDisableDwmBorderPowerShell,
  disableDwmSystemBorderForWindow,
  resolveNativeWindowHandleDecimal,
};
