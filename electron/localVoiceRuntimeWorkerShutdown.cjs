const {
  getWorkerForceTerminateDelayMs,
  isChildProcessRunning,
  terminateChildProcess,
} = require('./localVoiceRuntimeProcessUtils.cjs');

function rejectPendingRequests(worker, reason, customError, createError, getModeLabel) {
  const pendingEntries = [...worker.pending.entries()];
  worker.pending.clear();
  pendingEntries.forEach(([, pending]) => {
    if (typeof pending.abortCleanup === 'function') {
      pending.abortCleanup();
    }
    pending.reject(customError ?? createError(getModeLabel, worker.mode, reason));
  });
}

function closeWorkerInput(worker) {
  try {
    if (worker.process.stdin && !worker.process.stdin.destroyed) {
      worker.process.stdin.end();
    }
  } catch {
    // Ignore stdin shutdown failures.
  }
}

function requestProcessShutdown(worker, reason, delayMs, capabilities) {
  const { isRunning, terminate, setTimer, writeRuntimeLog, getModeLabel } = capabilities;
  closeWorkerInput(worker);
  if (isRunning(worker.process) && delayMs > 0) {
    const fallbackTimer = setTimer(() => {
      if (!isRunning(worker.process)) {
        return;
      }
      writeRuntimeLog(`${getModeLabel(worker.mode)} worker force terminate fallback`, {
        reason,
        modelPath: worker.modelPath,
        delayMs,
      });
      terminate(worker.process);
    }, delayMs);
    if (typeof fallbackTimer.unref === 'function') {
      fallbackTimer.unref();
    }
  } else {
    terminate(worker.process);
  }
  writeRuntimeLog(`${getModeLabel(worker.mode)} worker shutdown requested`, {
    reason,
    modelPath: worker.modelPath,
    forceTerminateDelayMs: delayMs,
  });
}

function createLocalVoiceWorkerShutdown({
  modeWorkerPool,
  createWorkerUnavailableError,
  getModeLabel,
  writeRuntimeLog,
  getDelay = getWorkerForceTerminateDelayMs,
  isRunning = isChildProcessRunning,
  terminate = terminateChildProcess,
  setTimer = setTimeout,
}) {
  const capabilities = { isRunning, terminate, setTimer, writeRuntimeLog, getModeLabel };
  function destroyModeWorker(worker, reason = 'dispose', customError = null) {
    if (!worker || worker.destroyed) {
      return;
    }
    worker.destroyed = true;
    worker.shutdownReason = reason;
    if (modeWorkerPool.get(worker.key) === worker) {
      modeWorkerPool.delete(worker.key);
    }
    rejectPendingRequests(worker, reason, customError, createWorkerUnavailableError, getModeLabel);
    const delayMs = getDelay(reason);
    requestProcessShutdown(worker, reason, delayMs, capabilities);
  }
  return { destroyModeWorker };
}

module.exports = { createLocalVoiceWorkerShutdown };
