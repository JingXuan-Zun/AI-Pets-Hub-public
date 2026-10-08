const { createLocalVoiceRuntimeWorkerUtils } = require('./localVoiceRuntimeWorkerUtils.cjs');
const { createLocalVoiceWorkerShutdown } = require('./localVoiceRuntimeWorkerShutdown.cjs');
const { createLocalVoiceWorkerCreator } = require('./localVoiceRuntimeWorkerCreator.cjs');
const { createLocalVoiceWorkerRequest } = require('./localVoiceRuntimeWorkerRequest.cjs');
const { createLocalVoiceWorkerAcquisition } = require('./localVoiceRuntimeWorkerAcquisition.cjs');

function assembleWorkerUtils(context) {
  const {
    bundledPythonPath, describeRuntimeCandidate, getModeEnvDirectory, isPathInside,
    normalizeComparablePath, portableExecutableDir, projectRoot, runtimeRoot,
    splitOutputLines, takeTail,
  } = context;
  const {
    buildModeWorkerKey,
    buildWorkerExitReason,
    buildWorkerReadyLogDetails,
    buildWorkerRequestInput,
    buildWorkerRequestResult,
    createWorkerUnavailableError,
    describeRuntimeEnvironment,
    getWorkerModeModelPath,
    getWorkerResponseRequestId,
    parseRunnerPayload,
    summarizeWorkerPayload,
    summarizeWorkerResponse,
  } = createLocalVoiceRuntimeWorkerUtils({
    bundledPythonPath,
    describeRuntimeCandidate,
    getModeEnvDirectory,
    isPathInside,
    normalizeComparablePath,
    portableExecutableDir,
    projectRoot,
    runtimeRoot,
    splitOutputLines,
    takeTail,
  });
  return {
    buildModeWorkerKey, buildWorkerExitReason, buildWorkerReadyLogDetails, buildWorkerRequestInput,
    buildWorkerRequestResult, createWorkerUnavailableError, describeRuntimeEnvironment, getWorkerModeModelPath,
    getWorkerResponseRequestId, parseRunnerPayload, summarizeWorkerPayload, summarizeWorkerResponse,
  };
}

function assembleShutdown(context) {
  const {
    modeWorkerPool, createWorkerUnavailableError, getModeLabel, writeRuntimeLog,
  } = context;
  const { destroyModeWorker } = createLocalVoiceWorkerShutdown({
    modeWorkerPool,
    createWorkerUnavailableError,
    getModeLabel,
    writeRuntimeLog,
  });
  return { destroyModeWorker };
}

function assembleCreator(context) {
  const {
    buildModeWorkerKey, getModeWorkerPoolSize, buildModeWorkerSlotKey, modeWorkerPool,
    getSharedOptions, parseJsonFromCommandOutput, writeRuntimeLog, getModeLabel,
    buildWorkerReadyLogDetails, getWorkerResponseRequestId, summarizeWorkerResponse, destroyModeWorker,
    createWorkerUnavailableError, buildWorkerExitReason, describeRuntimeCandidate,
  } = context;
  const { createModeWorker } = createLocalVoiceWorkerCreator({
    buildModeWorkerKey, getModeWorkerPoolSize, buildModeWorkerSlotKey,
    modeWorkerPool, getSharedOptions,
    parseJsonFromCommandOutput, writeRuntimeLog, getModeLabel,
    buildWorkerReadyLogDetails, getWorkerResponseRequestId, summarizeWorkerResponse,
    destroyModeWorker, createWorkerUnavailableError, buildWorkerExitReason,
    describeRuntimeCandidate,
  });
  return { createModeWorker };
}

function assembleRequest(context) {
  const {
    createWorkerUnavailableError, getModeLabel, destroyModeWorker, buildWorkerRequestResult,
    writeRuntimeLog, describeRuntimeCandidate, getModeWorkerPoolSize, summarizeWorkerPayload,
    buildWorkerRequestInput, buildJsonError,
  } = context;
  const { requestModeWorker } = createLocalVoiceWorkerRequest({
    createWorkerUnavailableError, getModeLabel, destroyModeWorker,
    buildWorkerRequestResult, writeRuntimeLog, describeRuntimeCandidate,
    getModeWorkerPoolSize, summarizeWorkerPayload, buildWorkerRequestInput, buildJsonError,
  });
  return { requestModeWorker };
}

function assembleAcquisition(context) {
  const {
    createWorkerUnavailableError, getModeLabel, destroyModeWorker, buildModeWorkerKey,
    getModeWorkerPoolSize, buildModeWorkerSlotKey, modeWorkerPool, createModeWorker,
    ensureRunnerScriptPath, getModeWorkers, getNextModeWorkerSlotIndex, selectLeastBusyModeWorker,
    releaseModeWorkerReservation,
  } = context;
  const { ensureModeWorker, acquireModeWorker } = createLocalVoiceWorkerAcquisition({
    createWorkerUnavailableError, getModeLabel, destroyModeWorker,
    buildModeWorkerKey, getModeWorkerPoolSize, buildModeWorkerSlotKey,
    modeWorkerPool, createModeWorker, ensureRunnerScriptPath,
    getModeWorkers, getNextModeWorkerSlotIndex, selectLeastBusyModeWorker,
    releaseModeWorkerReservation,
  });
  return { ensureModeWorker, acquireModeWorker };
}

function createLocalVoiceWorkerAssembly(context) {
  const utils = assembleWorkerUtils(context);
  const shared = { ...context, ...utils };
  const shutdown = assembleShutdown(shared);
  const lifecycle = { ...shared, ...shutdown };
  const creator = assembleCreator(lifecycle);
  const request = assembleRequest(lifecycle);
  const acquisition = assembleAcquisition({ ...lifecycle, ...creator });
  return { ...utils, ...shutdown, ...creator, ...request, ...acquisition };
}

module.exports = { createLocalVoiceWorkerAssembly };
