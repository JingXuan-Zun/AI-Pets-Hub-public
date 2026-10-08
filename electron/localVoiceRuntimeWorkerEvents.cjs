const { createLineReporter } = require('./localVoiceRuntimeCommandUtils.cjs');

function resolveWorkerReady(parsed, context) {
  const { worker, mode, modelPath, writeRuntimeLog, getModeLabel,
    buildWorkerReadyLogDetails, getModeWorkerPoolSize } = context;
  worker.ready = true;
  writeRuntimeLog(`${getModeLabel(mode)} worker ready`, {
    ...buildWorkerReadyLogDetails(parsed, modelPath),
    poolSlot: worker.slotIndex + 1,
    poolSize: getModeWorkerPoolSize(mode),
  });
  worker._resolveReady?.(worker);
}

function resolveWorkerResponse(parsed, requestId, context) {
  const { worker, mode, writeRuntimeLog, getModeLabel,
    getModeWorkerPoolSize, summarizeWorkerResponse } = context;
  const pending = worker.pending.get(requestId);
  worker.pending.delete(requestId);
  pending.abortCleanup?.();
  writeRuntimeLog(`${getModeLabel(mode)} worker ${parsed?.ok ? 'request completed' : 'request failed'}`, {
    requestId,
    poolSlot: worker.slotIndex + 1,
    poolSize: getModeWorkerPoolSize(mode),
    ...summarizeWorkerResponse(parsed),
  });
  pending.resolve(parsed);
}

function dispatchWorkerOutput(line, context) {
  const { worker, mode, parseJsonFromCommandOutput, writeRuntimeLog,
    getModeLabel, getWorkerResponseRequestId } = context;
  let parsed = null;
  try {
    parsed = parseJsonFromCommandOutput(line);
  } catch {
    writeRuntimeLog(`${getModeLabel(mode)} worker output`, line);
    return;
  }
  if (parsed?.event === 'ready') {
    resolveWorkerReady(parsed, context);
    return;
  }
  const requestId = getWorkerResponseRequestId(parsed);
  if (requestId && worker.pending.has(requestId)) {
    resolveWorkerResponse(parsed, requestId, context);
    return;
  }
  writeRuntimeLog(`${getModeLabel(mode)} worker message`, parsed);
}

function attachWorkerEvents(context, stdoutReporter, stderrReporter) {
  const { child, worker, mode, destroyModeWorker, createWorkerUnavailableError,
    getModeLabel, buildWorkerExitReason } = context;
  child.stdout.on('data', (chunk) => stdoutReporter.push(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => stderrReporter.push(chunk.toString('utf8')));
  child.once('error', (error) => {
    stdoutReporter.flush();
    stderrReporter.flush();
    worker.startError = error;
    worker._rejectReady?.(error);
    destroyModeWorker(worker, 'spawn_error', error);
  });
  child.once('close', (exitCode, signal) => {
    stdoutReporter.flush();
    stderrReporter.flush();
    const exitError = worker.startError
      ?? createWorkerUnavailableError(getModeLabel, mode, buildWorkerExitReason(exitCode, signal));
    if (!worker.ready) worker._rejectReady?.(exitError);
    if (!worker.destroyed) destroyModeWorker(worker, `closed_${exitCode ?? 'unknown'}`, exitError);
  });
}

function createLocalVoiceWorkerEvents(context) {
  const stdoutReporter = createLineReporter((line) => dispatchWorkerOutput(line, context));
  const stderrReporter = createLineReporter((line) => {
    context.writeRuntimeLog(`${context.getModeLabel(context.mode)} worker stderr`, line);
  });
  return { attach: () => attachWorkerEvents(context, stdoutReporter, stderrReporter) };
}

module.exports = { createLocalVoiceWorkerEvents };
