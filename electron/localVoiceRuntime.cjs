const {
  ensureDir,
  pathExists,
} = require('./localVoiceRuntimePathUtils.cjs');

const GENERATED_AUDIO_CACHE_TTL_MS = 60 * 60 * 1000;
const GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS = 60 * 1000;
const GENERATED_AUDIO_CACHE_MANIFEST_FILE = 'manifest.jsonl';
const GENERATED_AUDIO_CACHE_PREVIEW_LIMIT = 120;
const LOCAL_TTS_WORKER_POOL_SIZE = 1;
const LOCAL_DEFAULT_WORKER_POOL_SIZE = 1;

const { createLocalVoiceSessionAssembly } = require('./localVoiceRuntimeSessionAssembly.cjs');
const { createLocalVoiceRuntimePaths } = require('./localVoiceRuntimePaths.cjs');
const { createLocalVoiceBackendAssembly } = require('./localVoiceRuntimeBackendAssembly.cjs');
const { createLocalVoiceServiceAssembly } = require('./localVoiceRuntimeServiceAssembly.cjs');
const { createLocalVoiceResourceAssembly } = require('./localVoiceRuntimeResourceAssembly.cjs');
const { createLocalVoiceCommandRunner } = require('./localVoiceRuntimeCommandRunner.cjs');
const { spawnCommand, runInlinePythonScript } = createLocalVoiceCommandRunner();

function createLocalVoiceRuntime({ app, localVoiceLibrary, log, projectRoot }) {
  const { runtimeRoot, embeddedRunnerPath, generatedAudioCacheRoot,
    generatedAudioManifestPath, referenceTextCachePath } = createLocalVoiceRuntimePaths({
    app, projectRoot, generatedAudioManifestFile: GENERATED_AUDIO_CACHE_MANIFEST_FILE,
  });
  const {
    referenceTextCache, modeWorkerPool, brokenModeRuntimeCandidates, activeSynthesisRequests,
    createSynthesisRequest, nextTranscriptionRequestId, writeRuntimeLog,
    bundledPythonPath, portableExecutableDir,
    cleanupGeneratedAudioCacheBeforeSynthesize, cancelSynthesis, dispose,
    getModeWorkerPoolSize, buildModeWorkerSlotKey, getModeWorkers,
    getNextModeWorkerSlotIndex, selectLeastBusyModeWorker, releaseModeWorkerReservation,
  } = createLocalVoiceSessionAssembly({
    log,
    getCleanupGeneratedAudioCache: () => cleanupGeneratedAudioCache,
    getDestroyModeWorker: () => destroyModeWorker,
    GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS, GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS,
    LOCAL_TTS_WORKER_POOL_SIZE, LOCAL_DEFAULT_WORKER_POOL_SIZE,
  });

  const {
    getSharedOptions, buildReferenceTextCacheKey, clearBrokenModeRuntimeCandidate,
    getBrokenModeRuntimeCandidate, getGeneratedAudioCacheFilePath, markBrokenModeRuntimeCandidate,
    persistReferenceText, readPersistedReferenceText, buildGeneratedAudioCacheKey,
    cleanupGeneratedAudioCache, persistGeneratedAudioCache, resolveGeneratedAudioCacheHit,
    getConfiguredReferenceText, resolveAssetSelection, ensureRunnerScriptPath,
  } = createLocalVoiceResourceAssembly({
    runtimeRoot, brokenModeRuntimeCandidates, generatedAudioCacheRoot,
    referenceTextCachePath, writeRuntimeLog, GENERATED_AUDIO_CACHE_MANIFEST_FILE,
    GENERATED_AUDIO_CACHE_PREVIEW_LIMIT, GENERATED_AUDIO_CACHE_TTL_MS,
    generatedAudioManifestPath, localVoiceLibrary, embeddedRunnerPath,
  });
  const {
    destroyModeWorker, requestModeWorker, resolveBasePythonRuntime, getHealth,
    ensureReferenceTextPrepared, warmupModeWorker, runRunnerCommand,
  } = createLocalVoiceBackendAssembly({
    bundledPythonPath, portableExecutableDir, projectRoot, runtimeRoot,
    modeWorkerPool, writeRuntimeLog, getModeWorkerPoolSize, buildModeWorkerSlotKey,
    getSharedOptions, ensureRunnerScriptPath, getModeWorkers, getNextModeWorkerSlotIndex,
    selectLeastBusyModeWorker, releaseModeWorkerReservation, getBrokenModeRuntimeCandidate, buildReferenceTextCacheKey,
    readPersistedReferenceText, spawnCommand, runInlinePythonScript, markBrokenModeRuntimeCandidate,
    resolveAssetSelection, getConfiguredReferenceText, persistReferenceText, referenceTextCache,
    clearBrokenModeRuntimeCandidate,
  });

  const { warmup, installDependencies, synthesize, transcribe } = createLocalVoiceServiceAssembly({
    resolveAssetSelection, getConfiguredReferenceText, writeRuntimeLog,
    warmupModeWorker, ensureReferenceTextPrepared, runRunnerCommand, requestModeWorker,
    runtimeRoot, pathExists, ensureDir, spawnCommand, getSharedOptions,
    brokenModeRuntimeCandidates, resolveBasePythonRuntime, runInlinePythonScript, getHealth,
    createSynthesisRequest, activeSynthesisRequests, cleanupGeneratedAudioCacheBeforeSynthesize,
    buildGeneratedAudioCacheKey, resolveGeneratedAudioCacheHit, getGeneratedAudioCacheFilePath,
    generatedAudioCacheRoot, persistGeneratedAudioCache,
    nextTranscriptionRequestId,
  });

  cleanupGeneratedAudioCache('startup');

  return {
    cancelSynthesis,
    dispose,
    getHealth,
    installDependencies,
    warmup,
    synthesize,
    transcribe,
  };
}

module.exports = {
  createLocalVoiceRuntime,
};
