function refreshCacheEntry({ pathExists, generatedAudioCacheTtlMs }, currentEntry) {
  if (!currentEntry || !pathExists(currentEntry.audioFilePath) || currentEntry.expiresAt <= Date.now()) {
    return null;
  }
  const now = Date.now();
  return {
    ...currentEntry,
    expiresAt: now + generatedAudioCacheTtlMs,
    lastAccessedAt: now,
    hitCount: currentEntry.hitCount + 1,
  };
}

function projectCacheHit({ getGeneratedAudioFileUrl, writeRuntimeLog }, entry, cacheKey, requestId) {
  const output = {
    audioBase64: '',
    mimeType: entry.mimeType || 'audio/wav',
    audioFilePath: entry.audioFilePath,
    audioFileUrl: getGeneratedAudioFileUrl(entry.audioFilePath),
    cacheHit: true,
    cacheKey,
  };
  writeRuntimeLog('generated_audio_cache_hit', {
    requestId,
    cacheKey,
    hitCount: entry.hitCount,
    audioFilePath: entry.audioFilePath,
  });
  return output;
}

function resolveGeneratedAudioCacheHit(context, cacheKey, requestId) {
  if (!cacheKey) return null;
  const { updateGeneratedAudioManifestEntry } = context;
  const { entry } = updateGeneratedAudioManifestEntry(cacheKey,
    currentEntry => refreshCacheEntry(context, currentEntry));
  if (!entry) return null;
  return projectCacheHit(context, entry, cacheKey, requestId);
}

function createLocalVoiceGeneratedAudioHit(context) {
  return { resolveGeneratedAudioCacheHit: resolveGeneratedAudioCacheHit.bind(null, context) };
}

module.exports = { createLocalVoiceGeneratedAudioHit };
