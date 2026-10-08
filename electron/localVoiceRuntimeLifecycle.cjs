const { cancelActiveSynthesisRequests } = require('./localVoiceRuntimeCoreUtils.cjs');
const { buildJsonError } = require('./localVoiceRuntimeProcessUtils.cjs');

function startCleanupTimer(context) {
  const timer = context.setInterval(() => {
    try {
      context.getCleanupGeneratedAudioCache()('interval');
    } catch (error) {
      context.writeRuntimeLog('generated_audio_cache_cleanup_failed', {
        error: buildJsonError(error),
      });
    }
  }, context.cleanupIntervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

function cleanupBeforeSynthesize(context, state) {
  const now = context.now();
  if (now - state.lastSynthesisCacheCleanupAt < context.cleanupMinIntervalMs) return;
  state.lastSynthesisCacheCleanupAt = now;
  context.getCleanupGeneratedAudioCache()('before_synthesize');
}

function cancelSynthesis(context, reason = 'manual_cancel') {
  return cancelActiveSynthesisRequests({
    activeSynthesisRequests: context.activeSynthesisRequests,
    reason,
    writeRuntimeLog: context.writeRuntimeLog,
  });
}

function dispose(context, timer) {
  cancelSynthesis(context, 'runtime_dispose');
  context.clearInterval(timer);
  for (const worker of [...context.modeWorkerPool.values()]) {
    context.getDestroyModeWorker()(worker, 'runtime_dispose');
  }
  context.referenceTextCache.clear();
  context.writeRuntimeLog('Local voice runtime disposed');
}

function createLocalVoiceLifecycle(context) {
  const capabilities = { setInterval, clearInterval, now: () => Date.now(), ...context };
  const state = { lastSynthesisCacheCleanupAt: 0 };
  const timer = startCleanupTimer(capabilities);
  return {
    cleanupGeneratedAudioCacheBeforeSynthesize: () => cleanupBeforeSynthesize(capabilities, state),
    cancelSynthesis: cancelSynthesis.bind(null, capabilities),
    dispose: dispose.bind(null, capabilities, timer),
  };
}

module.exports = { createLocalVoiceLifecycle };
