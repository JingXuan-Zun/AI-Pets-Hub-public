function createLocalVoiceGeneratedAudioPaths({ ensureDir, generatedAudioCacheRoot, path }) {
  function ensureGeneratedAudioCacheRoot() {
    ensureDir(generatedAudioCacheRoot);
    return generatedAudioCacheRoot;
  }

  function getGeneratedAudioCacheFilePath(cacheKey) {
    if (!cacheKey) {
      return null;
    }

    ensureGeneratedAudioCacheRoot();
    return path.join(generatedAudioCacheRoot, `${cacheKey}.wav`);
  }

  return { ensureGeneratedAudioCacheRoot, getGeneratedAudioCacheFilePath };
}

module.exports = { createLocalVoiceGeneratedAudioPaths };
