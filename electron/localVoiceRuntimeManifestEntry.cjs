function normalizeGeneratedAudioManifestEntry(context, value) {
  const { path, isPathInside, generatedAudioCacheRoot } = context;
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value;
  const cacheKey = typeof entry.cacheKey === 'string' ? entry.cacheKey.trim() : '';
  const audioFilePath = typeof entry.audioFilePath === 'string' ? entry.audioFilePath.trim() : '';
  const createdAt = Number(entry.createdAt);
  const expiresAt = Number(entry.expiresAt);
  const lastAccessedAt = Number(entry.lastAccessedAt);

  if (!cacheKey || !audioFilePath || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) {
    return null;
  }

  const resolvedAudioFilePath = path.resolve(audioFilePath);
  if (!isPathInside(resolvedAudioFilePath, generatedAudioCacheRoot)) {
    return null;
  }

  return {
    version: 1,
    cacheKey,
    createdAt,
    expiresAt,
    lastAccessedAt: Number.isFinite(lastAccessedAt) ? lastAccessedAt : createdAt,
    hitCount: Math.max(0, Number(entry.hitCount) || 0),
    mimeType: typeof entry.mimeType === 'string' && entry.mimeType.trim() ? entry.mimeType.trim() : 'audio/wav',
    textLength: Math.max(0, Number(entry.textLength) || 0),
    textPreview: typeof entry.textPreview === 'string' ? entry.textPreview : '',
    languageCode: typeof entry.languageCode === 'string' && entry.languageCode.trim() ? entry.languageCode.trim() : 'zh-CN',
    seed: Number.isFinite(Number(entry.seed)) ? Math.trunc(Number(entry.seed)) : null,
    ttsModelPath: typeof entry.ttsModelPath === 'string' ? entry.ttsModelPath : '',
    referencePath: typeof entry.referencePath === 'string' ? entry.referencePath : '',
    referenceAudioPath: typeof entry.referenceAudioPath === 'string' ? entry.referenceAudioPath : '',
    referenceSttModelPath: typeof entry.referenceSttModelPath === 'string' ? entry.referenceSttModelPath : '',
    referenceTextLength: Math.max(0, Number(entry.referenceTextLength) || 0),
    audioFilePath: resolvedAudioFilePath,
    audioFileName: typeof entry.audioFileName === 'string' && entry.audioFileName.trim()
      ? entry.audioFileName.trim()
      : path.basename(resolvedAudioFilePath),
  };
}

module.exports = { normalizeGeneratedAudioManifestEntry };
