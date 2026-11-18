// Warm PowerShell workers (2026-11-08, task speed).
//
// Every desktop tool used to start a new powershell.exe: ~0.45 s of startup plus compiling its
// Add-Type interop each time, while the real work was often tens of milliseconds. One tool step
// ran 4–5 of these in a row (look at windows, act, look again, read the window), so starting
// PowerShell alone cost about 2 s per step.
//
// A worker is one long-lived powershell.exe that reads scripts from stdin and runs each in a fresh
// STA runspace on its own thread: variables never leak from one script to the next, `exit` ends
// only that script, and Add-Type types compiled once stay loaded. A script that runs past its
// timeout kills its worker (a new one starts on the next call). Callers fall back to spawning
// powershell.exe themselves when `run` returns null (host disabled, not Windows, or broken).

const childProcess = require('child_process');

const WORKER_SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $out = ''
  $err = ''
  $exitCode = 0
  $rs = $null
  $ps = $null
  try {
    $code = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line))
    $rs = [runspacefactory]::CreateRunspace()
    $rs.ApartmentState = 'STA'
    $rs.ThreadOptions = 'UseCurrentThread'
    $rs.Open()
    $ps = [powershell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript($code)
    $collected = New-Object 'System.Management.Automation.PSDataCollection[psobject]'
    try {
      $ps.Invoke($null, $collected)
    } catch {
      $ex = $_.Exception
      while ($null -ne $ex -and $ex -isnot [System.Management.Automation.ExitException]) { $ex = $ex.InnerException }
      if ($null -ne $ex) {
        try { $exitCode = [int]$ex.Argument } catch { $exitCode = 0 }
      } else {
        $exitCode = 1
        $inner = $_.Exception
        while ($null -ne $inner.InnerException) { $inner = $inner.InnerException }
        $err = $inner.Message
      }
    }
    $out = ($collected | Out-String -Width 4096)
    if ($ps.Streams.Error.Count -gt 0) {
      $streamErrors = ($ps.Streams.Error | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
      $err = if ($err) { $err + [Environment]::NewLine + $streamErrors } else { $streamErrors }
    }
  } catch {
    $exitCode = 1
    $err = $_.Exception.Message
  } finally {
    if ($null -ne $ps) { $ps.Dispose() }
    if ($null -ne $rs) { $rs.Dispose() }
  }
  $payload = @{ err = [string]$err; exitCode = $exitCode; out = [string]$out } | ConvertTo-Json -Compress
  [Console]::Out.WriteLine([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload)))
  [Console]::Out.Flush()
}
`;

// A runspace inside the worker cannot report `exit 1`: the script just stops. Scripts that signal
// failure with an exit code therefore keep running in their own powershell.exe.
const NON_ZERO_EXIT = /\bexit\s+(?:[1-9]\d*|\$|\(|-)/i;

function usesExitCode(script) {
  return NON_ZERO_EXIT.test(String(script));
}

// Each worker holds 100–180 MB once UI Automation / Forms / WinRT are loaded, so the pool is small
// and a worker is replaced after a number of scripts.
const DEFAULT_POOL_SIZE = 2;
const SCRIPTS_PER_WORKER = 100;
const IDLE_SHUTDOWN_MS = 5 * 60 * 1000;
const MAX_CONSECUTIVE_WORKER_FAILURES = 3;

function createWorker({ spawn, onExit }) {
  const encoded = Buffer.from(WORKER_SCRIPT, 'utf16le').toString('base64');
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const worker = { busy: false, child, dead: false, pending: null, runs: 0, stdout: '' };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    worker.stdout += chunk;
    let newline;
    while ((newline = worker.stdout.indexOf('\n')) >= 0) {
      const line = worker.stdout.slice(0, newline).trim();
      worker.stdout = worker.stdout.slice(newline + 1);
      if (!line || !worker.pending) continue;
      const { resolve } = worker.pending;
      worker.pending = null;
      try {
        resolve(JSON.parse(Buffer.from(line, 'base64').toString('utf8')));
      } catch (error) {
        resolve({ err: `PowerShell host returned unreadable output: ${error.message}`, exitCode: 1, out: '' });
      }
    }
  });
  child.stderr.on('data', () => {});
  const fail = (reason) => {
    if (worker.dead) return;
    worker.dead = true;
    if (worker.pending) {
      worker.pending.reject(reason);
      worker.pending = null;
    }
    onExit(worker);
  };
  child.on('error', (error) => fail(error));
  child.on('exit', (code, signal) => fail(Object.assign(new Error(`PowerShell host worker exited (${code ?? signal})`), { hostWorkerExited: true })));
  child.stdin.on('error', () => {});
  // Idle workers must not keep the app (or a test run) from exiting; a running job's timeout
  // timer keeps the process alive while it waits.
  child.unref();
  for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.unref?.();
  return worker;
}

function createPowerShellHost(options = {}) {
  const platform = options.platform ?? process.platform;
  const spawn = options.spawn ?? childProcess.spawn;
  const poolSize = Math.max(1, options.poolSize ?? DEFAULT_POOL_SIZE);
  const log = options.log ?? (() => {});
  const workers = new Set();
  const queue = [];
  let disabled = platform !== 'win32' || process.env.DESKTOP_PET_POWERSHELL_HOST === '0';
  let consecutiveFailures = 0;
  let idleTimer = null;

  const scheduleIdleShutdown = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (queue.length || [...workers].some((worker) => worker.busy)) return scheduleIdleShutdown();
      shutdown();
    }, IDLE_SHUTDOWN_MS);
    idleTimer.unref?.();
  };

  const removeWorker = (worker) => {
    workers.delete(worker);
  };

  const pump = () => {
    while (queue.length) {
      let worker = [...workers].find((item) => !item.busy && !item.dead);
      if (!worker && workers.size < poolSize) {
        worker = createWorker({ spawn, onExit: removeWorker });
        workers.add(worker);
      }
      if (!worker) return;
      const job = queue.shift();
      runOnWorker(worker, job);
    }
  };

  function runOnWorker(worker, job) {
    worker.busy = true;
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.busy = false;
      worker.runs += 1;
      if (!worker.dead && worker.runs >= SCRIPTS_PER_WORKER) {
        worker.dead = true;
        workers.delete(worker);
        try { worker.child.stdin.end(); } catch { /* ignore */ }
      }
      callback();
      pump();
    };
    const timer = setTimeout(() => {
      finish(() => {
        worker.pending = null;
        // Retire it right away so no other script is handed to a dying process.
        worker.dead = true;
        workers.delete(worker);
        try { worker.child.kill(); } catch { /* already gone */ }
        job.reject(Object.assign(new Error(`PowerShell script timed out after ${job.timeoutMs} ms`), { code: null, killed: true, signal: 'SIGTERM', stderr: '', stdout: '' }));
      });
    }, job.timeoutMs);
    worker.pending = {
      reject: (reason) => finish(() => {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_WORKER_FAILURES) {
          disabled = true;
          log('powershell host disabled after repeated worker failures', { reason: String(reason?.message ?? reason) });
        }
        // The worker broke (not the script): let the caller spawn powershell.exe as before.
        job.resolve(null);
      }),
      resolve: (result) => finish(() => {
        consecutiveFailures = 0;
        if (result.exitCode) {
          job.reject(Object.assign(new Error(String(result.err || `PowerShell exited with code ${result.exitCode}`).trim()), {
            code: result.exitCode, stderr: result.err || '', stdout: result.out || '',
          }));
          return;
        }
        job.resolve({ stderr: result.err || '', stdout: result.out || '' });
      }),
    };
    try {
      worker.child.stdin.write(`${Buffer.from(job.script, 'utf8').toString('base64')}\n`);
    } catch (error) {
      worker.pending.reject(error);
    }
  }

  /**
   * Runs a script on a warm worker. Resolves { stdout, stderr }, rejects like execFile does
   * (non-zero exit / timeout), or resolves null when the host cannot be used — then the caller
   * runs powershell.exe the old way.
   */
  function run(script, { timeoutMs = 10_000 } = {}) {
    if (disabled || usesExitCode(script)) return Promise.resolve(null);
    scheduleIdleShutdown();
    return new Promise((resolve, reject) => {
      queue.push({ reject, resolve, script: String(script), timeoutMs: Math.max(100, Number(timeoutMs) || 10_000) });
      pump();
    });
  }

  /** Starts the workers ahead of the first call so it is fast too. */
  function warm() {
    if (disabled) return;
    scheduleIdleShutdown();
    while (workers.size < poolSize) workers.add(createWorker({ spawn, onExit: removeWorker }));
  }

  function shutdown() {
    for (const worker of workers) {
      worker.dead = true;
      try { worker.child.kill(); } catch { /* ignore */ }
    }
    workers.clear();
  }

  return {
    isEnabled: () => !disabled,
    run,
    shutdown,
    warm,
  };
}

const REGISTRY_KEY = Symbol.for('desktop-pet.powershell-host');

/**
 * Starts the shared host and registers it where the PowerShell runners look for it. Called once
 * by the app on Windows; plain-node checks never call it, so their mocked execFile stays in use.
 */
function installSharedPowerShellHost(options = {}) {
  if (process.platform !== 'win32' || globalThis[REGISTRY_KEY]) return globalThis[REGISTRY_KEY] ?? null;
  const host = createPowerShellHost(options);
  globalThis[REGISTRY_KEY] = host;
  return host;
}

module.exports = { createPowerShellHost, installSharedPowerShellHost, usesExitCode };
