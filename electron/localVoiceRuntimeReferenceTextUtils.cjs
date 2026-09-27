function createLocalVoiceRuntimeReferenceTextUtils({
  buildReferenceTextCacheKey,
  getConfiguredReferenceText,
  persistReferenceText,
  readPersistedReferenceText,
  referenceTextCache,
  writeRuntimeLog,
}) {
  async function ensureReferenceTextPrepared({
    assetSelection,
    purpose = 'synthesize',
    requestId,
    runRunnerCommand,
    settings,
    signal,
  }) {
    const configuredReferenceText = getConfiguredReferenceText(settings, assetSelection);
    if (configuredReferenceText.referenceText) {
      return configuredReferenceText;
    }

    if (!assetSelection?.referenceAudioPath || !assetSelection?.sttModel?.path) {
      return configuredReferenceText;
    }

    const languageCode = settings?.speechRecognitionLang || 'zh-CN';
    const referenceCacheKey = buildReferenceTextCacheKey(
      assetSelection.referenceAudioPath,
      assetSelection.sttModel.path,
      languageCode,
    );
    const cachedReferenceText = referenceCacheKey
      ? String(referenceTextCache.get(referenceCacheKey) || '').trim()
      : '';

    if (cachedReferenceText) {
      writeRuntimeLog('Reference text cache hit', {
        requestId,
        purpose,
        textLength: cachedReferenceText.length,
      });
      return {
        referenceText: cachedReferenceText,
        source: 'cache',
      };
    }

    const persistedReferenceText = readPersistedReferenceText(referenceCacheKey);
    if (persistedReferenceText) {
      if (referenceCacheKey) {
        referenceTextCache.set(referenceCacheKey, persistedReferenceText);
      }

      writeRuntimeLog('Reference text persistent cache hit', {
        requestId,
        purpose,
        textLength: persistedReferenceText.length,
      });
      return {
        referenceText: persistedReferenceText,
        source: 'persistent-cache',
      };
    }

    writeRuntimeLog('Reference text missing; using speaker embedding only mode', {
      requestId,
      purpose,
      referenceAudioPath: assetSelection.referenceAudioPath,
      sttModelPath: assetSelection.sttModel.path,
    });
    return configuredReferenceText;
  }

  return {
    ensureReferenceTextPrepared,
  };
}

module.exports = {
  createLocalVoiceRuntimeReferenceTextUtils,
};
