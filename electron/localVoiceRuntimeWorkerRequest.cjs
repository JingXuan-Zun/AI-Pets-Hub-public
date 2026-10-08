const { createLocalVoiceCancelledError } = require('./localVoiceRuntimeProcessUtils.cjs');

function createPendingRequest(worker, signal, resolve, reject, buildWorkerRequestResult) {
  const requestId = `${worker.mode}-${++worker.nextRequestId}`;
  let settled = false;
  let abortListener = null;
  const abortCleanup = () => {
    if (signal && abortListener) {
      signal.removeEventListener('abort', abortListener);
      abortListener = null;
    }
  };
  const completeResolve = (parsed) => {
    if (settled) return;
    settled = true;
    resolve(buildWorkerRequestResult(worker, parsed));
  };
  const completeReject = (error) => {
    if (settled) return;
    settled = true;
    reject(error);
  };
  return {
    requestId, abortCleanup, completeResolve, completeReject,
    setAbortListener(listener) { abortListener = listener; },
  };
}

function registerPendingRequest(worker, signal, request, destroyModeWorker) {
  worker.pending.set(request.requestId, {
    resolve: request.completeResolve,
    reject: request.completeReject,
    abortCleanup: request.abortCleanup,
  });
  if (signal) {
    const listener = () => destroyModeWorker(worker, 'request_aborted', createLocalVoiceCancelledError());
    request.setAbortListener(listener);
    signal.addEventListener('abort', listener, { once: true });
  }
}

function rejectRequestWrite(worker, request, error, stage, context) {
  const { writeRuntimeLog, getModeLabel, buildJsonError } = context;
  if (worker.pending.has(request.requestId)) {
    worker.pending.delete(request.requestId);
  }
  request.abortCleanup();
  writeRuntimeLog(`${getModeLabel(worker.mode)} worker request ${stage} failed`, {
    requestId: request.requestId,
    error: buildJsonError(error),
  });
  request.completeReject(error);
}

function writeWorkerRequest(worker, payload, request, context) {
  const { buildWorkerRequestInput } = context;
  try {
    worker.process.stdin.write(buildWorkerRequestInput(request.requestId, payload), 'utf8', (error) => {
      if (!error) return;
      rejectRequestWrite(worker, request, error, 'write', context);
    });
  } catch (error) {
    rejectRequestWrite(worker, request, error, 'send', context);
  }
}

async function requestModeWorker(context, worker, payload, signal) {
  const { createWorkerUnavailableError, getModeLabel, destroyModeWorker, buildWorkerRequestResult,
    writeRuntimeLog, describeRuntimeCandidate, getModeWorkerPoolSize, summarizeWorkerPayload } = context;
  if (!worker || worker.destroyed || !worker.process.stdin || worker.process.stdin.destroyed) {
    throw createWorkerUnavailableError(getModeLabel, worker?.mode || 'tts', 'stdin_unavailable');
  }
  if (signal?.aborted) {
    destroyModeWorker(worker, 'request_aborted_before_send', createLocalVoiceCancelledError());
    throw createLocalVoiceCancelledError();
  }
  return await new Promise((resolve, reject) => {
    const request = createPendingRequest(worker, signal, resolve, reject, buildWorkerRequestResult);
    registerPendingRequest(worker, signal, request, destroyModeWorker);
    writeRuntimeLog(`${getModeLabel(worker.mode)} worker request sent`, {
      requestId: request.requestId,
      runtime: describeRuntimeCandidate(worker.candidate),
      poolSlot: worker.slotIndex + 1,
      poolSize: getModeWorkerPoolSize(worker.mode),
      ...summarizeWorkerPayload(payload),
    });
    writeWorkerRequest(worker, payload, request, context);
  });
}

function createLocalVoiceWorkerRequest(context) {
  return { requestModeWorker: requestModeWorker.bind(null, context) };
}

module.exports = { createLocalVoiceWorkerRequest };
