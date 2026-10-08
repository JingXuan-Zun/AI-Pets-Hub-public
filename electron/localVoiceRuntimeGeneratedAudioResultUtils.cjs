const { createLocalVoiceGeneratedAudioHit } = require('./localVoiceRuntimeGeneratedAudioHit.cjs');
const { createLocalVoiceGeneratedAudioPersistence } = require('./localVoiceRuntimeGeneratedAudioPersistence.cjs');

function createLocalVoiceRuntimeGeneratedAudioResultUtils({
  buildGeneratedAudioTextPreview,
  buildJsonError,
  fs,
  generatedAudioCacheTtlMs,
  getGeneratedAudioCacheFilePath,
  getGeneratedAudioFileUrl,
  path,
  pathExists,
  updateGeneratedAudioManifestEntry,
  writeRuntimeLog,
}) {
  const { persistGeneratedAudioCache } = createLocalVoiceGeneratedAudioPersistence({
    buildGeneratedAudioTextPreview, buildJsonError, fs, generatedAudioCacheTtlMs,
    getGeneratedAudioCacheFilePath, getGeneratedAudioFileUrl, path, pathExists,
    updateGeneratedAudioManifestEntry, writeRuntimeLog,
  });

  const { resolveGeneratedAudioCacheHit } = createLocalVoiceGeneratedAudioHit({
    pathExists, generatedAudioCacheTtlMs, updateGeneratedAudioManifestEntry,
    getGeneratedAudioFileUrl, writeRuntimeLog,
  });

  return {
    persistGeneratedAudioCache,
    resolveGeneratedAudioCacheHit,
  };
}

module.exports = {
  createLocalVoiceRuntimeGeneratedAudioResultUtils,
};
