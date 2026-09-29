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
  function persistGeneratedAudioCache({
    audioBase64,
    audioFilePath,
    cacheKey,
    languageCode,
    mimeType,
    seed,
    referenceAudioPath,
    referencePath,
    referenceSttModelPath,
    referenceText,
    requestId,
    text,
    ttsModelPath,
  }) {
    if (!cacheKey) {
      return {
        audioFilePath: null,
        audioFileUrl: null,
      };
    }

    const cacheAudioFilePath = audioFilePath || getGeneratedAudioCacheFilePath(cacheKey);
    if (!cacheAudioFilePath) {
      return {
        audioFilePath: null,
        audioFileUrl: null,
      };
    }

    const now = Date.now();

    try {
      if (audioBase64) {
        fs.writeFileSync(cacheAudioFilePath, Buffer.from(audioBase64, 'base64'));
      } else if (!pathExists(cacheAudioFilePath)) {
        throw new Error('generated_audio_file_missing');
      }

      const manifestEntry = {
        version: 1,
        cacheKey,
        createdAt: now,
        expiresAt: now + generatedAudioCacheTtlMs,
        lastAccessedAt: now,
        hitCount: 0,
        mimeType: mimeType || 'audio/wav',
        textLength: typeof text === 'string' ? text.length : 0,
        textPreview: buildGeneratedAudioTextPreview(text),
        languageCode: languageCode || 'zh-CN',
        seed: Number.isFinite(seed) ? Math.trunc(seed) : null,
        ttsModelPath: ttsModelPath || '',
        referencePath: referencePath || '',
        referenceAudioPath: referenceAudioPath || '',
        referenceSttModelPath: referenceSttModelPath || '',
        referenceTextLength: typeof referenceText === 'string' ? referenceText.length : 0,
        audioFilePath: cacheAudioFilePath,
        audioFileName: path.basename(cacheAudioFilePath),
      };

      updateGeneratedAudioManifestEntry(cacheKey, () => manifestEntry);
      writeRuntimeLog('generated_audio_cache_written', {
        requestId,
        cacheKey,
        audioFilePath: cacheAudioFilePath,
      });

      return {
        audioFilePath: cacheAudioFilePath,
        audioFileUrl: getGeneratedAudioFileUrl(cacheAudioFilePath),
      };
    } catch (error) {
      writeRuntimeLog('generated_audio_cache_write_failed', {
        requestId,
        cacheKey,
        error: buildJsonError(error),
      });
      return {
        audioFilePath: null,
        audioFileUrl: null,
      };
    }
  }

  function resolveGeneratedAudioCacheHit(cacheKey, requestId) {
    if (!cacheKey) {
      return null;
    }

    const { entry } = updateGeneratedAudioManifestEntry(cacheKey, (currentEntry) => {
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
    });

    if (!entry) {
      return null;
    }

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

  return {
    persistGeneratedAudioCache,
    resolveGeneratedAudioCacheHit,
  };
}

module.exports = {
  createLocalVoiceRuntimeGeneratedAudioResultUtils,
};
