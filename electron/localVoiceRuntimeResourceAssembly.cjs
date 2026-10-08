const fs = require('fs');
const path = require('path');
const { createRuntimeRootHelpers } = require('./localVoiceRuntimeCoreUtils.cjs');
const { createPythonEnv } = require('./localVoiceRuntimeHostUtils.cjs');
const { createRunnerScriptResolver } = require('./localVoiceRuntimeScriptUtils.cjs');
const { createLocalVoiceCacheAssembly } = require('./localVoiceRuntimeCacheAssembly.cjs');
const { createLocalVoiceRuntimeSelectionUtils } = require('./localVoiceRuntimeSelectionUtils.cjs');
const { resolveReferenceAudioPath } = require('./localVoiceRuntimeAudioUtils.cjs');
const { buildJsonError } = require('./localVoiceRuntimeProcessUtils.cjs');
const { describeRuntimeCandidate, ensureDir, isPathInside, normalizeComparablePath,
  pathExists, readFirstExistingTextFile, resolveReferenceTextFromAudioFileName,
} = require('./localVoiceRuntimePathUtils.cjs');

function assembleResourceCache(context) {
  const {
    brokenModeRuntimeCandidates, generatedAudioCacheRoot, referenceTextCachePath,
    writeRuntimeLog, GENERATED_AUDIO_CACHE_MANIFEST_FILE, GENERATED_AUDIO_CACHE_PREVIEW_LIMIT,
    GENERATED_AUDIO_CACHE_TTL_MS, generatedAudioManifestPath, ensureRuntimeRoot,
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
    buildGeneratedAudioCacheKey,
    buildGeneratedAudioTextPreview,
    cleanupGeneratedAudioCache,
    getGeneratedAudioFileUrl,
    updateGeneratedAudioManifestEntry,
    persistGeneratedAudioCache,
    resolveGeneratedAudioCacheHit,
  } = createLocalVoiceCacheAssembly({
    buildJsonError, brokenModeRuntimeCandidates, describeRuntimeCandidate,
    ensureDir, ensureRuntimeRoot, fs, generatedAudioCacheRoot, path, pathExists,
    referenceTextCachePath, writeRuntimeLog, GENERATED_AUDIO_CACHE_MANIFEST_FILE,
    GENERATED_AUDIO_CACHE_PREVIEW_LIMIT, GENERATED_AUDIO_CACHE_TTL_MS,
    generatedAudioManifestPath, isPathInside, normalizeComparablePath,
  });
  return {
    buildReferenceTextCacheKey, clearBrokenModeRuntimeCandidate, ensureGeneratedAudioCacheRoot,
    getBrokenModeRuntimeCandidate, getGeneratedAudioCacheFilePath, markBrokenModeRuntimeCandidate,
    persistReferenceText, readPersistedReferenceText, buildGeneratedAudioCacheKey,
    buildGeneratedAudioTextPreview, cleanupGeneratedAudioCache, getGeneratedAudioFileUrl,
    updateGeneratedAudioManifestEntry, persistGeneratedAudioCache, resolveGeneratedAudioCacheHit,
  };
}

function assembleResourceSelection(context) {
  const { localVoiceLibrary } = context;
  const { getConfiguredReferenceText, resolveAssetSelection } = createLocalVoiceRuntimeSelectionUtils({
    localVoiceLibrary,
    readFirstExistingTextFile,
    resolveReferenceTextFromAudioFileName,
    resolveReferenceAudioPath,
  });
  return { getConfiguredReferenceText, resolveAssetSelection };
}

function createLocalVoiceResourceAssembly(context) {
  const { ensureRuntimeRoot, getSharedOptions } = createRuntimeRootHelpers({
    createPythonEnv,
    ensureDir,
    runtimeRoot: context.runtimeRoot,
  });
  const cache = assembleResourceCache({ ...context, ensureRuntimeRoot });
  const selection = assembleResourceSelection(context);
  const ensureRunnerScriptPath = createRunnerScriptResolver({
    sourcePath: context.embeddedRunnerPath, runtimeRoot: context.runtimeRoot,
  });
  return { getSharedOptions, ...cache, ...selection, ensureRunnerScriptPath };
}

module.exports = { createLocalVoiceResourceAssembly };
