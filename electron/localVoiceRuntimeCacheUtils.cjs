const { createLocalVoiceReferenceTextKey } = require('./localVoiceRuntimeReferenceTextKey.cjs');
const { createLocalVoiceGeneratedAudioPaths } = require('./localVoiceRuntimeGeneratedAudioPaths.cjs');
const { createLocalVoiceReferenceTextStore } = require('./localVoiceRuntimeReferenceTextStore.cjs');
const { createLocalVoiceBrokenCandidates } = require('./localVoiceRuntimeBrokenCandidates.cjs');

function createLocalVoiceRuntimeCacheUtils({
  buildJsonError,
  brokenModeRuntimeCandidates,
  describeRuntimeCandidate,
  ensureDir,
  ensureRuntimeRoot,
  fs,
  generatedAudioCacheRoot,
  path,
  pathExists,
  referenceTextCachePath,
  writeRuntimeLog,
}) {
  const { buildReferenceTextCacheKey } = createLocalVoiceReferenceTextKey({ fs });

  const { readPersistedReferenceTextCache, writePersistedReferenceTextCache,
    readPersistedReferenceText, persistReferenceText } = createLocalVoiceReferenceTextStore({
    pathExists, referenceTextCachePath, fs, writeRuntimeLog, buildJsonError, ensureRuntimeRoot,
  });

  const { ensureGeneratedAudioCacheRoot, getGeneratedAudioCacheFilePath } = createLocalVoiceGeneratedAudioPaths({
    ensureDir, generatedAudioCacheRoot, path,
  });

  const { buildModeRuntimeCandidateKey, clearBrokenModeRuntimeCandidate,
    markBrokenModeRuntimeCandidate, getBrokenModeRuntimeCandidate } = createLocalVoiceBrokenCandidates({
    brokenModeRuntimeCandidates, describeRuntimeCandidate, buildJsonError,
  });

  return {
    buildModeRuntimeCandidateKey,
    buildReferenceTextCacheKey,
    clearBrokenModeRuntimeCandidate,
    ensureGeneratedAudioCacheRoot,
    getBrokenModeRuntimeCandidate,
    getGeneratedAudioCacheFilePath,
    markBrokenModeRuntimeCandidate,
    persistReferenceText,
    readPersistedReferenceText,
    readPersistedReferenceTextCache,
    writePersistedReferenceTextCache,
  };
}

module.exports = {
  createLocalVoiceRuntimeCacheUtils,
};
