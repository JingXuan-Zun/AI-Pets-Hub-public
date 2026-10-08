const { createLocalVoiceCancelledError } = require('./localVoiceRuntimeProcessUtils.cjs');

async function ensureModeWorkerReady(context, worker, signal) {
  const { createWorkerUnavailableError, getModeLabel, destroyModeWorker } = context;
  if (!worker || worker.destroyed) {
    throw createWorkerUnavailableError(getModeLabel, worker?.mode || 'tts', 'destroyed');
  }
  const { mode } = worker;
  if (signal?.aborted) {
    destroyModeWorker(worker, 'aborted_before_ready', createLocalVoiceCancelledError());
    throw createLocalVoiceCancelledError();
  }
  if (!worker.ready) {
    await Promise.race([
      worker.readyPromise,
      ...(signal ? [new Promise((_, reject) => {
        const abortListener = () => {
          destroyModeWorker(worker, 'aborted_during_startup', createLocalVoiceCancelledError());
          reject(createLocalVoiceCancelledError());
        };
        signal.addEventListener('abort', abortListener, { once: true });
        const removeAbortListener = () => signal.removeEventListener('abort', abortListener);
        worker.readyPromise.then(removeAbortListener, removeAbortListener);
      })] : []),
    ]);
  }
  return worker;
}

async function ensureModeWorker(context, candidate, mode, modelPath, signal) {
  const { buildModeWorkerKey, getModeWorkerPoolSize, buildModeWorkerSlotKey,
    modeWorkerPool, createModeWorker, ensureRunnerScriptPath, ensureModeWorkerReady } = context;
  const baseWorkerKey = buildModeWorkerKey(candidate, mode, modelPath);
  const poolSize = getModeWorkerPoolSize(mode);
  const workerKey = buildModeWorkerSlotKey(baseWorkerKey, poolSize, 0);
  let worker = modeWorkerPool.get(workerKey);
  if (!worker || worker.destroyed) {
    worker = createModeWorker(candidate, mode, modelPath, ensureRunnerScriptPath(), 0);
  }
  return ensureModeWorkerReady(worker, signal);
}

async function acquireModeWorker(context, candidate, mode, modelPath, signal) {
  const { buildModeWorkerKey, getModeWorkerPoolSize, getModeWorkers, createModeWorker,
    ensureRunnerScriptPath, getNextModeWorkerSlotIndex, selectLeastBusyModeWorker,
    ensureModeWorkerReady, releaseModeWorkerReservation } = context;
  const baseWorkerKey = buildModeWorkerKey(candidate, mode, modelPath);
  const poolSize = getModeWorkerPoolSize(mode);
  const workers = getModeWorkers(baseWorkerKey);
  const worker = workers.length < poolSize
    ? createModeWorker(candidate, mode, modelPath, ensureRunnerScriptPath(),
      getNextModeWorkerSlotIndex(baseWorkerKey, poolSize))
    : selectLeastBusyModeWorker(workers);
  worker.activeRequestCount += 1;
  try {
    await ensureModeWorkerReady(worker, signal);
    return { release: () => releaseModeWorkerReservation(worker), worker };
  } catch (error) {
    releaseModeWorkerReservation(worker);
    throw error;
  }
}

function createLocalVoiceWorkerAcquisition(context) {
  const ready = ensureModeWorkerReady.bind(null, context);
  const capabilities = { ...context, ensureModeWorkerReady: ready };
  return {
    ensureModeWorkerReady: ready,
    ensureModeWorker: ensureModeWorker.bind(null, capabilities),
    acquireModeWorker: acquireModeWorker.bind(null, capabilities),
  };
}

module.exports = { createLocalVoiceWorkerAcquisition };
