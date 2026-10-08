const { createLocalVoiceWorkerAssembly } = require('./localVoiceRuntimeWorkerAssembly.cjs');
const { createLocalVoiceSupportAssembly } = require('./localVoiceRuntimeSupportAssembly.cjs');
const { createLocalVoiceCandidateExecution } = require('./localVoiceRuntimeCandidateExecution.cjs');
const { getModeCandidate, getModeEnvDirectory, getModeLabel } = require('./localVoiceRuntimeModeUtils.cjs');
const { buildJsonError, extractMissingModuleName } = require('./localVoiceRuntimeProcessUtils.cjs');
const { parseJsonFromCommandOutput, splitOutputLines, takeTail } = require('./localVoiceRuntimeCommandUtils.cjs');
const { describeRuntimeCandidate, getPythonCandidates, isPathInside,
  normalizeComparablePath, uniqueStrings } = require('./localVoiceRuntimePathUtils.cjs');

function assembleBackendWorkers(context) {
  const {
    bundledPythonPath, portableExecutableDir, projectRoot, runtimeRoot,
    modeWorkerPool, writeRuntimeLog, getModeWorkerPoolSize, buildModeWorkerSlotKey,
    getSharedOptions, ensureRunnerScriptPath, getModeWorkers, getNextModeWorkerSlotIndex,
    selectLeastBusyModeWorker, releaseModeWorkerReservation,
  } = context;
  const {
    describeRuntimeEnvironment, getWorkerModeModelPath, parseRunnerPayload,
    destroyModeWorker, requestModeWorker, ensureModeWorker, acquireModeWorker,
  } = createLocalVoiceWorkerAssembly({
    bundledPythonPath, describeRuntimeCandidate, getModeEnvDirectory, isPathInside,
    normalizeComparablePath, portableExecutableDir, projectRoot, runtimeRoot,
    splitOutputLines, takeTail, modeWorkerPool, getModeLabel, writeRuntimeLog,
    getModeWorkerPoolSize, buildModeWorkerSlotKey, getSharedOptions, parseJsonFromCommandOutput,
    buildJsonError, ensureRunnerScriptPath, getModeWorkers, getNextModeWorkerSlotIndex,
    selectLeastBusyModeWorker, releaseModeWorkerReservation,
  });
  return {
    describeRuntimeEnvironment, getWorkerModeModelPath, parseRunnerPayload,
    destroyModeWorker, requestModeWorker, ensureModeWorker, acquireModeWorker,
  };
}

function assembleBackendSupport(context) {
  const {
    getBrokenModeRuntimeCandidate, projectRoot, runtimeRoot, writeRuntimeLog,
    buildReferenceTextCacheKey, readPersistedReferenceText, spawnCommand, runInlinePythonScript,
    getSharedOptions, describeRuntimeEnvironment, markBrokenModeRuntimeCandidate, resolveAssetSelection,
    getConfiguredReferenceText, persistReferenceText, referenceTextCache,
  } = context;
  const {
    getModeRuntimeCandidates, resolveBasePythonRuntime, getHealth, ensureReferenceTextPrepared,
  } = createLocalVoiceSupportAssembly({
    describeRuntimeCandidate, getBrokenModeRuntimeCandidate, getModeCandidate, getModeLabel,
    getPythonCandidates, projectRoot, runtimeRoot, writeRuntimeLog, buildJsonError,
    buildReferenceTextCacheKey, extractMissingModuleName, readPersistedReferenceText, uniqueStrings,
    spawnCommand, runInlinePythonScript, getSharedOptions, describeRuntimeEnvironment,
    markBrokenModeRuntimeCandidate, resolveAssetSelection, getConfiguredReferenceText,
    persistReferenceText, referenceTextCache,
  });
  return { getModeRuntimeCandidates, resolveBasePythonRuntime, getHealth, ensureReferenceTextPrepared };
}

function assembleBackendExecution(context) {
  const {
    getModeRuntimeCandidates, ensureModeWorker, clearBrokenModeRuntimeCandidate, markBrokenModeRuntimeCandidate,
    parseRunnerPayload, getWorkerModeModelPath, acquireModeWorker, requestModeWorker,
  } = context;
  const { warmupModeWorker, runRunnerCommand } = createLocalVoiceCandidateExecution({
    getModeRuntimeCandidates, getModeLabel, ensureModeWorker,
    clearBrokenModeRuntimeCandidate, markBrokenModeRuntimeCandidate,
    parseRunnerPayload, getWorkerModeModelPath, acquireModeWorker, requestModeWorker,
  });
  return { warmupModeWorker, runRunnerCommand };
}

function createLocalVoiceBackendAssembly(context) {
  const workers = assembleBackendWorkers(context);
  const support = assembleBackendSupport({ ...context, ...workers });
  const execution = assembleBackendExecution({ ...context, ...workers, ...support });
  return {
    destroyModeWorker: workers.destroyModeWorker,
    requestModeWorker: workers.requestModeWorker,
    resolveBasePythonRuntime: support.resolveBasePythonRuntime,
    getHealth: support.getHealth,
    ensureReferenceTextPrepared: support.ensureReferenceTextPrepared,
    ...execution,
  };
}

module.exports = { createLocalVoiceBackendAssembly };
