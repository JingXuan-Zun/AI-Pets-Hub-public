const { spawn } = require('child_process');
const { createLocalVoiceWorkerEvents } = require('./localVoiceRuntimeWorkerEvents.cjs');

function buildWorkerArgs(scriptPath, mode, modelPath) {
  const args = [scriptPath, '--worker-mode', '--mode', mode];
  args.push(mode === 'tts' ? '--tts-model-path' : '--stt-model-path', modelPath);
  return args;
}

function spawnWorker(candidate, workerArgs, context) {
  return context.spawnProcess(
    candidate.executable,
    [...candidate.args, ...workerArgs],
    {
      ...context.getSharedOptions(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
}

function createWorkerState({ workerKey, baseWorkerKey, slotIndex, mode, modelPath, candidate, child }) {
  return {
    key: workerKey,
    baseKey: baseWorkerKey,
    slotIndex,
    mode,
    modelPath,
    candidate,
    process: child,
    pending: new Map(),
    activeRequestCount: 0,
    nextRequestId: 0,
    destroyed: false,
    shutdownReason: 'running',
    ready: false,
    startError: null,
    readyPromise: null,
  };
}

function createModeWorker(context, candidate, mode, modelPath, scriptPath, slotIndex = 0) {
  const { buildModeWorkerKey, getModeWorkerPoolSize, buildModeWorkerSlotKey,
    modeWorkerPool, parseJsonFromCommandOutput, writeRuntimeLog, getModeLabel,
    buildWorkerReadyLogDetails, getWorkerResponseRequestId, summarizeWorkerResponse,
    destroyModeWorker, createWorkerUnavailableError, buildWorkerExitReason,
    describeRuntimeCandidate, createEvents } = context;
  const baseWorkerKey = buildModeWorkerKey(candidate, mode, modelPath);
  const poolSize = getModeWorkerPoolSize(mode);
  const workerKey = buildModeWorkerSlotKey(baseWorkerKey, poolSize, slotIndex);
  const child = spawnWorker(candidate, buildWorkerArgs(scriptPath, mode, modelPath), context);
  const worker = createWorkerState({ workerKey, baseWorkerKey, slotIndex, mode, modelPath, candidate, child });
  modeWorkerPool.set(workerKey, worker);
  const workerEvents = createEvents({
    child, worker, mode, modelPath,
    parseJsonFromCommandOutput, writeRuntimeLog, getModeLabel,
    buildWorkerReadyLogDetails, getModeWorkerPoolSize,
    getWorkerResponseRequestId, summarizeWorkerResponse,
    destroyModeWorker, createWorkerUnavailableError, buildWorkerExitReason,
  });
  worker.readyPromise = new Promise((resolve, reject) => {
    worker._resolveReady = resolve;
    worker._rejectReady = reject;
  });
  workerEvents.attach();
  writeRuntimeLog(`${getModeLabel(mode)} worker starting`, {
    runtime: describeRuntimeCandidate(candidate),
    modelPath,
    poolSlot: slotIndex + 1,
    poolSize,
  });
  return worker;
}

function createLocalVoiceWorkerCreator(context) {
  const capabilities = { spawnProcess: spawn, createEvents: createLocalVoiceWorkerEvents, ...context };
  return { createModeWorker: createModeWorker.bind(null, capabilities) };
}

module.exports = { createLocalVoiceWorkerCreator };
