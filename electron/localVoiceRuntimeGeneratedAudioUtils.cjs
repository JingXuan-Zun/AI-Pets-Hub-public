const { createLocalVoiceGeneratedAudioKey } = require('./localVoiceRuntimeGeneratedAudioKey.cjs');
const { createLocalVoiceManifestStore } = require('./localVoiceRuntimeManifestStore.cjs');
const { createLocalVoiceGeneratedAudioCleanup } = require('./localVoiceRuntimeGeneratedAudioCleanup.cjs');
const { pathToFileURL } = require('url');

function getGeneratedAudioFileUrl(audioFilePath) {
  if (!audioFilePath) {
    return null;
  }

  try {
    return pathToFileURL(audioFilePath).href;
  } catch {
    return null;
  }
}

function createLocalVoiceRuntimeGeneratedAudioUtils({
  buildJsonError,
  ensureGeneratedAudioCacheRoot,
  fs,
  generatedAudioCacheManifestFile,
  generatedAudioCachePreviewLimit,
  generatedAudioCacheRoot,
  generatedAudioCacheTtlMs,
  generatedAudioManifestPath,
  isPathInside,
  normalizeComparablePath,
  path,
  pathExists,
  writeRuntimeLog,
}) {
  const { buildGeneratedAudioCacheKey, buildGeneratedAudioTextPreview } = createLocalVoiceGeneratedAudioKey({
    fs, pathExists, generatedAudioCachePreviewLimit,
  });

  const { readGeneratedAudioManifestEntries, writeGeneratedAudioManifestEntries,
    updateGeneratedAudioManifestEntry } = createLocalVoiceManifestStore({
    pathExists, generatedAudioManifestPath, fs, writeRuntimeLog, buildJsonError,
    ensureGeneratedAudioCacheRoot, path, isPathInside, generatedAudioCacheRoot,
  });

  const { cleanupGeneratedAudioCache } = createLocalVoiceGeneratedAudioCleanup({
    pathExists, generatedAudioCacheRoot, generatedAudioManifestPath,
    ensureGeneratedAudioCacheRoot, readGeneratedAudioManifestEntries,
    isPathInside, fs, normalizeComparablePath, generatedAudioCacheManifestFile,
    path, generatedAudioCacheTtlMs, writeGeneratedAudioManifestEntries, writeRuntimeLog,
  });

  return {
    buildGeneratedAudioCacheKey,
    buildGeneratedAudioTextPreview,
    cleanupGeneratedAudioCache,
    getGeneratedAudioFileUrl: getGeneratedAudioFileUrl.bind(null),
    updateGeneratedAudioManifestEntry,
  };
}

module.exports = {
  createLocalVoiceRuntimeGeneratedAudioUtils,
};
