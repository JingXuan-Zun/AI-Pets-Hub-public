const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createDesktopInputService } = require('../electron/desktopInputService.cjs');

type LabStrategy =
  | 'sendinput'
  | 'sendinput-long'
  | 'sendinput-double'
  | 'sendinput-mouseevent'
  | 'touch'
  | 'mouseevent'
  | 'enter'
  | 'space';

interface LabOptions {
  delaySeconds: number;
  fromCursor: boolean;
  strategy: LabStrategy;
  x: number | null;
  y: number | null;
}

function parseArgs(argv: string[]): LabOptions {
  const options: LabOptions = {
    delaySeconds: 0,
    fromCursor: false,
    strategy: 'sendinput',
    x: null,
    y: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--from-cursor') {
      options.fromCursor = true;
      continue;
    }
    if (arg === '--delay-seconds') {
      options.delaySeconds = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--strategy') {
      options.strategy = String(argv[index + 1] || '') as LabStrategy;
      index += 1;
      continue;
    }
    if (arg === '--x') {
      options.x = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--y') {
      options.y = Number(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readCursorPosition() {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CursorProbe {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }
  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT lpPoint);
}
"@
$point = New-Object CursorProbe+POINT
$ok = [CursorProbe]::GetCursorPos([ref]$point)
@{ ok = [bool]$ok; x = [int]$point.X; y = [int]$point.Y } | ConvertTo-Json -Compress
`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const stdout = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    },
  );
  const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
  if (!parsed.ok || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
    throw new Error('Failed to read current cursor position.');
  }
  return {
    x: Math.round(parsed.x),
    y: Math.round(parsed.y),
  };
}

function createRequest(strategy: LabStrategy, x: number, y: number) {
  const base = {
    action: 'click',
    button: 'left',
    coordinateSpace: 'native-screen',
    x,
    y,
  };

  switch (strategy) {
    case 'sendinput':
      return {
        ...base,
        holdMs: 60,
        intervalMs: 80,
        preClickDelayMs: 120,
      };
    case 'sendinput-long':
      return {
        ...base,
        holdMs: 260,
        intervalMs: 160,
        preClickDelayMs: 250,
      };
    case 'sendinput-double':
      return {
        ...base,
        action: 'double_click',
        holdMs: 90,
        intervalMs: 180,
        preClickDelayMs: 160,
      };
    case 'sendinput-mouseevent':
      return {
        ...base,
        forceMouseEventFallback: true,
        holdMs: 140,
        intervalMs: 160,
        preClickDelayMs: 180,
        repeat: 2,
      };
    case 'mouseevent':
      return {
        ...base,
        forceMouseEventFallback: true,
        holdMs: 180,
        intervalMs: 180,
        preClickDelayMs: 180,
      };
    case 'touch':
      return {
        ...base,
        forceTouchInjectionFallback: true,
        holdMs: 140,
        intervalMs: 160,
        preClickDelayMs: 180,
      };
    case 'enter':
      return {
        action: 'send_keys',
        keys: '{ENTER}',
      };
    case 'space':
      return {
        action: 'send_keys',
        keys: '{SPACE}',
      };
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

function formatWindow(value: any) {
  if (!value) {
    return 'unknown';
  }
  return [
    value.processName || 'unknown-process',
    value.pid ?? 'unknown-pid',
    value.hwnd ?? 'unknown-hwnd',
    value.elevated === null || value.elevated === undefined ? 'elevated=unknown' : `elevated=${value.elevated}`,
    value.title ? `title=${JSON.stringify(value.title)}` : '',
  ].filter(Boolean).join(' | ');
}

function formatAttempt(attempt: any) {
  return [
    `#${attempt?.index ?? '?'}`,
    `downSent=${attempt?.downSent ?? 'unknown'}`,
    `downOk=${attempt?.downOk ?? 'unknown'}`,
    `downLastError=${attempt?.downLastError ?? 'unknown'}`,
    `upSent=${attempt?.upSent ?? 'unknown'}`,
    `upOk=${attempt?.upOk ?? 'unknown'}`,
    `upLastError=${attempt?.upLastError ?? 'unknown'}`,
    `fallbackMouseEvent=${attempt?.fallbackMouseEventUsed ?? 'unknown'}`,
    `fgBeforeDown=${formatWindow(attempt?.foregroundBeforeDown)}`,
    `fgAfterUp=${formatWindow(attempt?.foregroundAfterUp)}`,
  ].join(' | ');
}

function printResult(strategy: LabStrategy, request: Record<string, unknown>, result: any) {
  console.log(`Desktop Input Lab`);
  console.log(`strategy=${strategy}`);
  console.log(`request=${JSON.stringify(request)}`);
  console.log(`ok=${Boolean(result?.ok)}`);
  if (result?.error) {
    console.log(`error=${result.error}`);
  }
  console.log(`action=${result?.action ?? request.action ?? 'unknown'}`);
  console.log(`point=${result?.x ?? request.x ?? 'n/a'},${result?.y ?? request.y ?? 'n/a'}`);
  console.log(`cursorSet=${result?.cursorSet ?? 'unknown'}`);
  console.log(`cursorVerified=${result?.cursorVerified ?? 'unknown'}`);
  console.log(`sendInput=${result?.sendInput ?? 'unknown'}`);
  console.log(`sendInputAllOk=${result?.sendInputAllOk ?? 'unknown'}`);
  console.log(`foregroundBefore=${formatWindow(result?.foregroundBefore)}`);
  console.log(`foregroundAfter=${formatWindow(result?.foregroundAfter)}`);
  console.log(`inputPlan=${Array.isArray(result?.inputDiagnostics?.inputPlan) ? result.inputDiagnostics.inputPlan.join(' -> ') : 'unknown'}`);
  console.log(`inputClassification=${result?.inputDiagnostics?.failureClassification ?? 'unknown'}`);
  console.log(`foregroundStable=${result?.inputDiagnostics?.foregroundStable ?? 'unknown'}`);
  console.log(`keyboardFallbackUsed=${result?.inputDiagnostics?.keyboardFallbackUsed ?? 'unknown'}`);
  console.log(`timing=${JSON.stringify({
    moveElapsedMs: result?.inputDiagnostics?.moveElapsedMs ?? null,
    totalElapsedMs: result?.inputDiagnostics?.totalElapsedMs ?? null,
  })}`);
  if (Array.isArray(result?.sendInputAttempts)) {
    console.log('attempts:');
    for (const attempt of result.sendInputAttempts) {
      console.log(`- ${formatAttempt(attempt)}`);
    }
  }
  if (Array.isArray(result?.inputDiagnostics?.stageResults)) {
    console.log('stages:');
    for (const stage of result.inputDiagnostics.stageResults) {
      console.log(`- ${JSON.stringify(stage)}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (Number.isFinite(options.delaySeconds) && options.delaySeconds > 0) {
    console.log(`Desktop Input Lab waiting ${options.delaySeconds}s before reading cursor/executing...`);
    await sleep(Math.round(options.delaySeconds * 1000));
  }

  const strategies: LabStrategy[] = [
    'sendinput',
    'sendinput-long',
    'sendinput-double',
    'sendinput-mouseevent',
    'touch',
    'mouseevent',
    'enter',
    'space',
  ];
  if (!strategies.includes(options.strategy)) {
    throw new Error(`Unsupported strategy "${options.strategy}". Supported: ${strategies.join(', ')}`);
  }

  const point = options.fromCursor
    ? readCursorPosition()
    : {
        x: options.x,
        y: options.y,
      };
  if ((options.strategy !== 'enter' && options.strategy !== 'space') && (!Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('Provide --from-cursor or --x <native-screen-x> --y <native-screen-y>.');
  }

  const request = createRequest(options.strategy, Number(point.x ?? 0), Number(point.y ?? 0));
  const service = createDesktopInputService();
  const result = await service.executeDesktopInput(request);
  printResult(options.strategy, request, result);

  const outputPath = resolve(process.cwd(), `desktop-input-lab-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify({
    request,
    result,
    strategy: options.strategy,
  }, null, 2));
  console.log(`json=${outputPath}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
