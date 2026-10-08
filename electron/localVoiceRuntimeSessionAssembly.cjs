const { createLocalVoiceRuntimeState } = require('./localVoiceRuntimeState.cjs');
const { createRuntimeLogger } = require('./localVoiceRuntimeCoreUtils.cjs');
const { resolveBundledPythonPath, resolvePortableExecutableDir } = require('./localVoiceRuntimePathUtils.cjs');
const { createLocalVoiceLifecycle } = require('./localVoiceRuntimeLifecycle.cjs');
const { createLocalVoiceWorkerPool } = require('./localVoiceRuntimeWorkerPool.cjs');

function createSessionStateAndHost(log) {
  const state = createLocalVoiceRuntimeState();
  const writeRuntimeLog = createRuntimeLogger(log);
  const bundledPythonPath = resolveBundledPythonPath();
  const portableExecutableDir = resolvePortableExecutableDir();
  return { ...state, writeRuntimeLog, bundledPythonPath, portableExecutableDir };
}

function createLocalVoiceSessionAssembly({
  log, getCleanupGeneratedAudioCache, getDestroyModeWorker,
  GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS, GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS,
  LOCAL_TTS_WORKER_POOL_SIZE, LOCAL_DEFAULT_WORKER_POOL_SIZE,
}) {
  const session = createSessionStateAndHost(log);
  const { activeSynthesisRequests, modeWorkerPool, referenceTextCache, writeRuntimeLog } = session;
  const { cleanupGeneratedAudioCacheBeforeSynthesize, cancelSynthesis, dispose } = createLocalVoiceLifecycle({
    activeSynthesisRequests, modeWorkerPool, referenceTextCache, writeRuntimeLog,
    getCleanupGeneratedAudioCache,
    getDestroyModeWorker,
    cleanupIntervalMs: GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS,
    cleanupMinIntervalMs: GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS,
  });
  const {
    getModeWorkerPoolSize,
    buildModeWorkerSlotKey,
    getModeWorkers,
    getNextModeWorkerSlotIndex,
    selectLeastBusyModeWorker,
    releaseModeWorkerReservation,
  } = createLocalVoiceWorkerPool({
    modeWorkerPool,
    ttsPoolSize: LOCAL_TTS_WORKER_POOL_SIZE,
    defaultPoolSize: LOCAL_DEFAULT_WORKER_POOL_SIZE,
  });
  return {
    ...session, cleanupGeneratedAudioCacheBeforeSynthesize, cancelSynthesis, dispose,
    getModeWorkerPoolSize, buildModeWorkerSlotKey, getModeWorkers,
    getNextModeWorkerSlotIndex, selectLeastBusyModeWorker, releaseModeWorkerReservation,
  };
}

module.exports = { createLocalVoiceSessionAssembly };
