const { spawn } = require('child_process');

function buildJsonError(errorMessage) {
  return errorMessage instanceof Error ? errorMessage.message : String(errorMessage || 'unknown_error');
}

function createLocalVoiceCancelledError() {
  const error = new Error('local_voice_cancelled');
  error.name = 'AbortError';
  return error;
}

function isLocalVoiceCancelledError(error) {
  return error instanceof Error
    && (error.name === 'AbortError' || error.message === 'local_voice_cancelled');
}

function isChildProcessRunning(child) {
  return Boolean(
    child
    && typeof child.pid === 'number'
    && child.exitCode == null
    && child.signalCode == null,
  );
}

function terminateChildProcess(child) {
  if (!isChildProcessRunning(child)) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      const killer = spawn(
        'taskkill',
        ['/PID', String(child.pid), '/T', '/F'],
        {
          windowsHide: true,
          stdio: 'ignore',
        },
      );
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
    // Ignore termination failures for already-exited children.
  }
}

function getWorkerForceTerminateDelayMs(reason) {
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';

  if (!normalizedReason || normalizedReason.startsWith('closed_')) {
    return 0;
  }

  if (normalizedReason === 'spawn_error') {
    return 0;
  }

  if (normalizedReason.includes('request_aborted') || normalizedReason.includes('aborted')) {
    return 6000;
  }

  if (normalizedReason === 'runtime_dispose') {
    return 12000;
  }

  return 8000;
}

function extractMissingModuleName(errorMessage) {
  if (typeof errorMessage !== 'string') {
    return null;
  }

  const match = errorMessage.match(/No module named ['"]([^'"]+)['"]/i);
  return match?.[1] ?? null;
}

module.exports = {
  buildJsonError,
  createLocalVoiceCancelledError,
  extractMissingModuleName,
  getWorkerForceTerminateDelayMs,
  isChildProcessRunning,
  isLocalVoiceCancelledError,
  terminateChildProcess,
};
