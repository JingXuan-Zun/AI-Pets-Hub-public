function buildManifestEntry(context, input, cacheAudioFilePath, now) {
  const { generatedAudioCacheTtlMs, buildGeneratedAudioTextPreview, path } = context;
  const { cacheKey, mimeType, text, languageCode, seed, ttsModelPath, referencePath,
    referenceAudioPath, referenceSttModelPath, referenceText } = input;
  return {
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
}

function writeGeneratedAudioResult(context, input, cacheAudioFilePath, now) {
  const { fs, pathExists, updateGeneratedAudioManifestEntry, writeRuntimeLog, getGeneratedAudioFileUrl } = context;
  if (input.audioBase64) {
    fs.writeFileSync(cacheAudioFilePath, Buffer.from(input.audioBase64, 'base64'));
  } else if (!pathExists(cacheAudioFilePath)) {
    throw new Error('generated_audio_file_missing');
  }
  const manifestEntry = buildManifestEntry(context, input, cacheAudioFilePath, now);
  updateGeneratedAudioManifestEntry(input.cacheKey, () => manifestEntry);
  writeRuntimeLog('generated_audio_cache_written', {
    requestId: input.requestId,
    cacheKey: input.cacheKey,
    audioFilePath: cacheAudioFilePath,
  });
  return {
    audioFilePath: cacheAudioFilePath,
    audioFileUrl: getGeneratedAudioFileUrl(cacheAudioFilePath),
  };
}

function persistGeneratedAudioCache(context, {
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
  const { getGeneratedAudioCacheFilePath, writeRuntimeLog, buildJsonError } = context;
  const emptyResult = { audioFilePath: null, audioFileUrl: null };
  if (!cacheKey) return emptyResult;
  const cacheAudioFilePath = audioFilePath || getGeneratedAudioCacheFilePath(cacheKey);
  if (!cacheAudioFilePath) return emptyResult;
  const now = Date.now();
  try {
    return writeGeneratedAudioResult(context, {
      audioBase64, cacheKey, languageCode, mimeType, seed, referenceAudioPath,
      referencePath, referenceSttModelPath, referenceText, requestId, text, ttsModelPath,
    }, cacheAudioFilePath, now);
  } catch (error) {
    writeRuntimeLog('generated_audio_cache_write_failed', {
      requestId,
      cacheKey,
      error: buildJsonError(error),
    });
    return emptyResult;
  }
}

function createLocalVoiceGeneratedAudioPersistence(context) {
  return { persistGeneratedAudioCache: persistGeneratedAudioCache.bind(null, context) };
}

module.exports = { createLocalVoiceGeneratedAudioPersistence };
