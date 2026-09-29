function createRuntimeLogger(log) {
  return (message, details) => {
    if (typeof log === 'function') {
      log(details === undefined ? message : `${message} ${JSON.stringify(details)}`);
    }
  };
}

function createRuntimeRootHelpers({ createPythonEnv, ensureDir, runtimeRoot }) {
  function ensureRuntimeRoot() {
    ensureDir(runtimeRoot);
    return runtimeRoot;
  }

  function getSharedOptions() {
    return {
      cwd: ensureRuntimeRoot(),
      env: createPythonEnv(),
    };
  }

  return {
    ensureRuntimeRoot,
    getSharedOptions,
  };
}

function cancelActiveSynthesisRequests({ activeSynthesisRequests, reason = 'manual_cancel', writeRuntimeLog }) {
  const cancellableRequests = [...activeSynthesisRequests.values()].filter((request) => (
    request
    && request.controller
    && !request.controller.signal.aborted
  ));

  if (cancellableRequests.length === 0) {
    return false;
  }

  cancellableRequests.forEach((request) => {
    request.cancelReason = reason;
    request.controller.abort();
  });

  if (typeof writeRuntimeLog === 'function') {
    writeRuntimeLog('请求取消本地语音合成', {
      requestIds: cancellableRequests.map((request) => request.id),
      reason,
      count: cancellableRequests.length,
    });
  }

  return true;
}

module.exports = {
  cancelActiveSynthesisRequests,
  createRuntimeLogger,
  createRuntimeRootHelpers,
};
