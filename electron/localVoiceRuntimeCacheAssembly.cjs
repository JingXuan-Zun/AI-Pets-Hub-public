const { createLocalVoiceRuntimeCacheUtils } = require('./localVoiceRuntimeCacheUtils.cjs');
const { createLocalVoiceRuntimeGeneratedAudioUtils } = require('./localVoiceRuntimeGeneratedAudioUtils.cjs');
const { createLocalVoiceRuntimeGeneratedAudioResultUtils } = require('./localVoiceRuntimeGeneratedAudioResultUtils.cjs');

function createReferenceCache(context) {
  const {
    buildJsonError, brokenModeRuntimeCandidates, describeRuntimeCandidate, ensureDir,
    ensureRuntimeRoot, fs, generatedAudioCacheRoot, path,
    pathExists, referenceTextCachePath, writeRuntimeLog,
  } = context;
  const {
    buildReferenceTextCacheKey,
    clearBrokenModeRuntimeCandidate,
    ensureGeneratedAudioCacheRoot,
    getBrokenModeRuntimeCandidate,
    getGeneratedAudioCacheFilePath,
    markBrokenModeRuntimeCandidate,
    persistReferenceText,
    readPersistedReferenceText,
  } = createLocalVoiceRuntimeCacheUtils({
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
  });

  return {
    buildReferenceTextCacheKey, clearBrokenModeRuntimeCandidate, ensureGeneratedAudioCacheRoot, getBrokenModeRuntimeCandidate,
    getGeneratedAudioCacheFilePath, markBrokenModeRuntimeCandidate, persistReferenceText, readPersistedReferenceText,
  };
}

function createGeneratedAudioCache(context) {
  const {
    buildJsonError, ensureGeneratedAudioCacheRoot, fs, GENERATED_AUDIO_CACHE_MANIFEST_FILE,
    GENERATED_AUDIO_CACHE_PREVIEW_LIMIT, generatedAudioCacheRoot, GENERATED_AUDIO_CACHE_TTL_MS, generatedAudioManifestPath,
    isPathInside, normalizeComparablePath, path, pathExists,
    writeRuntimeLog,
  } = context;
  const {
    buildGeneratedAudioCacheKey,
    buildGeneratedAudioTextPreview,
    cleanupGeneratedAudioCache,
    getGeneratedAudioFileUrl,
    updateGeneratedAudioManifestEntry,
  } = createLocalVoiceRuntimeGeneratedAudioUtils({
    buildJsonError,
    ensureGeneratedAudioCacheRoot,
    fs,
    generatedAudioCacheManifestFile: GENERATED_AUDIO_CACHE_MANIFEST_FILE,
    generatedAudioCachePreviewLimit: GENERATED_AUDIO_CACHE_PREVIEW_LIMIT,
    generatedAudioCacheRoot,
    generatedAudioCacheTtlMs: GENERATED_AUDIO_CACHE_TTL_MS,
    generatedAudioManifestPath,
    isPathInside,
    normalizeComparablePath,
    path,
    pathExists,
    writeRuntimeLog,
  });

  return {
    buildGeneratedAudioCacheKey, buildGeneratedAudioTextPreview, cleanupGeneratedAudioCache, getGeneratedAudioFileUrl,
    updateGeneratedAudioManifestEntry,
  };
}

function createGeneratedAudioResults(context) {
  const {
    buildGeneratedAudioTextPreview, buildJsonError, fs, GENERATED_AUDIO_CACHE_TTL_MS,
    getGeneratedAudioCacheFilePath, getGeneratedAudioFileUrl, path, pathExists,
    updateGeneratedAudioManifestEntry, writeRuntimeLog,
  } = context;
  const {
    persistGeneratedAudioCache,
    resolveGeneratedAudioCacheHit,
  } = createLocalVoiceRuntimeGeneratedAudioResultUtils({
    buildGeneratedAudioTextPreview,
    buildJsonError,
    fs,
    generatedAudioCacheTtlMs: GENERATED_AUDIO_CACHE_TTL_MS,
    getGeneratedAudioCacheFilePath,
    getGeneratedAudioFileUrl,
    path,
    pathExists,
    updateGeneratedAudioManifestEntry,
    writeRuntimeLog,
  });
  return { persistGeneratedAudioCache, resolveGeneratedAudioCacheHit };
}

function createLocalVoiceCacheAssembly(context) {
  const referenceCache = createReferenceCache(context);
  const generatedAudio = createGeneratedAudioCache({ ...context, ...referenceCache });
  const generatedResults = createGeneratedAudioResults({ ...context, ...referenceCache, ...generatedAudio });
  return { ...referenceCache, ...generatedAudio, ...generatedResults };
}

module.exports = { createLocalVoiceCacheAssembly };
