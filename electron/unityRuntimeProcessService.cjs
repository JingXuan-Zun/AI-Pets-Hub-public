const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_UNITY_RUNTIME_EXE_NAME = 'AI Desktop Pet Unity Runtime.exe';
const DEFAULT_UNITY_RUNTIME_LAUNCH_ARGS = [
  '--desktop-pet-window-overlay',
  '-screen-fullscreen',
  '0',
  '-force-glcore',
  '-popupwindow',
];

function isChildProcessRunning(child) {
  return Boolean(
    child
    && typeof child.pid === 'number'
    && child.exitCode == null
    && child.signalCode == null,
  );
}

function pathExists(targetPath) {
  if (!targetPath) {
    return false;
  }

  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function terminateChildProcess(child) {
  if (!isChildProcessRunning(child)) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      if (typeof killer.unref === 'function') {
        killer.unref();
      }
      return;
    } catch {
      // Fall through to the default kill behavior.
    }
  }

  try {
    child.kill('SIGKILL');
  } catch {
    // Ignore shutdown races.
  }
}

function resolveUnityRuntimeExecutableCandidates({ app, projectRoot }) {
  const candidates = [];
  const envExecutablePath = (process.env.DESKTOP_PET_UNITY_RUNTIME_EXE || '').trim();
  if (envExecutablePath) {
    candidates.push(envExecutablePath);
  }

  const resourcesPath = process.resourcesPath || '';
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, 'unity-runtime', DEFAULT_UNITY_RUNTIME_EXE_NAME));
  }

  if (app?.isPackaged && process.execPath) {
    candidates.push(path.join(path.dirname(process.execPath), 'resources', 'unity-runtime', DEFAULT_UNITY_RUNTIME_EXE_NAME));
  }

  if (projectRoot) {
    candidates.push(path.join(projectRoot, 'release', 'unity-runtime', DEFAULT_UNITY_RUNTIME_EXE_NAME));
    candidates.push(path.join(projectRoot, 'unity-runtime', DEFAULT_UNITY_RUNTIME_EXE_NAME));
  }

  return [...new Set(candidates.filter(Boolean))];
}

function createUnityRuntimeProcessService({
  app,
  log,
  projectRoot,
} = {}) {
  let child = null;
  let status = {
    executablePath: null,
    lastError: null,
    lastExitAt: null,
    lastStartedAt: null,
    pid: null,
    running: false,
  };

  function setStatus(nextPartial) {
    status = {
      ...status,
      ...nextPartial,
    };
    return status;
  }

  function resolveExecutablePath() {
    const candidates = resolveUnityRuntimeExecutableCandidates({ app, projectRoot });
    return candidates.find((candidate) => pathExists(candidate)) ?? null;
  }

  function getStatus() {
    return {
      ...status,
      running: isChildProcessRunning(child),
    };
  }

  function ensureStarted(reason = 'unity_command') {
    if (isChildProcessRunning(child)) {
      return {
        ...getStatus(),
        ok: true,
        started: false,
      };
    }

    const executablePath = resolveExecutablePath();
    if (!executablePath) {
      const lastError = 'Unity runtime executable was not found. Build it with npm run unity:build-runtime, then run npm run dist:win.';
      setStatus({
        executablePath: null,
        lastError,
        pid: null,
        running: false,
      });
      log?.('unity runtime executable missing', {
        reason,
      });
      return {
        ...getStatus(),
        ok: false,
        started: false,
      };
    }

    try {
      child = spawn(executablePath, DEFAULT_UNITY_RUNTIME_LAUNCH_ARGS, {
        cwd: path.dirname(executablePath),
        detached: false,
        stdio: 'ignore',
        windowsHide: false,
      });

      const startedAt = Date.now();
      setStatus({
        executablePath,
        lastError: null,
        lastStartedAt: startedAt,
        pid: child.pid ?? null,
        running: true,
      });

      child.on('error', (error) => {
        setStatus({
          lastError: error instanceof Error ? error.message : String(error),
          pid: null,
          running: false,
        });
        log?.('unity runtime process error', error?.stack || error);
      });

      child.on('exit', (code, signal) => {
        const exitedPid = child?.pid ?? null;
        child = null;
        setStatus({
          lastError: code === 0 || code == null ? null : `Unity runtime exited with code ${code}`,
          lastExitAt: Date.now(),
          pid: null,
          running: false,
        });
        log?.('unity runtime process exited', {
          code,
          pid: exitedPid,
          signal,
        });
      });

      if (typeof child.unref === 'function') {
        child.unref();
      }

      log?.('unity runtime process started', {
        args: DEFAULT_UNITY_RUNTIME_LAUNCH_ARGS,
        executablePath,
        pid: child.pid ?? null,
        reason,
      });

      return {
        ...getStatus(),
        ok: true,
        started: true,
      };
    } catch (error) {
      setStatus({
        executablePath,
        lastError: error instanceof Error ? error.message : String(error),
        pid: null,
        running: false,
      });
      log?.('unity runtime spawn failed', error?.stack || error);
      return {
        ...getStatus(),
        ok: false,
        started: false,
      };
    }
  }

  function dispose() {
    terminateChildProcess(child);
    child = null;
    setStatus({
      pid: null,
      running: false,
    });
  }

  return {
    dispose,
    ensureStarted,
    getStatus,
  };
}

module.exports = {
  DEFAULT_UNITY_RUNTIME_EXE_NAME,
  DEFAULT_UNITY_RUNTIME_LAUNCH_ARGS,
  createUnityRuntimeProcessService,
};
