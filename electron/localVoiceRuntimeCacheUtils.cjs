function createLocalVoiceRuntimeCacheUtils({
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
}) {
  function buildReferenceTextCacheKey(referenceAudioPath, sttModelPath, languageCode) {
    if (!referenceAudioPath || !sttModelPath) {
      return null;
    }

    let audioSize = 0;
    let audioMtimeMs = 0;
    try {
      const audioStats = fs.statSync(referenceAudioPath);
      audioSize = audioStats.size;
      audioMtimeMs = Math.floor(audioStats.mtimeMs);
    } catch {
      // Ignore cache metadata lookup failures.
    }

    return [
      referenceAudioPath,
      sttModelPath,
      languageCode || 'zh-CN',
      audioSize,
      audioMtimeMs,
    ].join('::');
  }

  function readPersistedReferenceTextCache() {
    if (!pathExists(referenceTextCachePath)) {
      return {};
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(referenceTextCachePath, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      writeRuntimeLog('reference_text_cache_read_failed', {
        error: buildJsonError(error),
      });
      return {};
    }
  }

  function writePersistedReferenceTextCache(entries) {
    ensureRuntimeRoot();

    try {
      fs.writeFileSync(referenceTextCachePath, JSON.stringify(entries ?? {}, null, 2), 'utf8');
      return true;
    } catch (error) {
      writeRuntimeLog('reference_text_cache_write_failed', {
        error: buildJsonError(error),
      });
      return false;
    }
  }

  function readPersistedReferenceText(referenceCacheKey) {
    if (!referenceCacheKey) {
      return '';
    }

    const entries = readPersistedReferenceTextCache();
    const entry = entries?.[referenceCacheKey];
    if (!entry || typeof entry !== 'object') {
      return '';
    }

    return typeof entry.text === 'string' ? entry.text.trim() : '';
  }

  function persistReferenceText(referenceCacheKey, referenceText, metadata = {}) {
    const normalizedText = typeof referenceText === 'string' ? referenceText.trim() : '';
    if (!referenceCacheKey || !normalizedText) {
      return false;
    }

    const entries = readPersistedReferenceTextCache();
    entries[referenceCacheKey] = {
      text: normalizedText,
      updatedAt: Date.now(),
      ...metadata,
    };
    return writePersistedReferenceTextCache(entries);
  }

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

  function buildModeRuntimeCandidateKey(mode, candidate) {
    return `${mode}::${describeRuntimeCandidate(candidate)}`;
  }

  function clearBrokenModeRuntimeCandidate(mode, candidate) {
    brokenModeRuntimeCandidates.delete(buildModeRuntimeCandidateKey(mode, candidate));
  }

  function markBrokenModeRuntimeCandidate(mode, candidate, error) {
    if (!candidate?.label || !String(candidate.label).startsWith('venv-')) {
      return;
    }

    brokenModeRuntimeCandidates.set(buildModeRuntimeCandidateKey(mode, candidate), {
      message: buildJsonError(error),
      recordedAt: Date.now(),
    });
  }

  function getBrokenModeRuntimeCandidate(mode, candidate) {
    return brokenModeRuntimeCandidates.get(buildModeRuntimeCandidateKey(mode, candidate)) ?? null;
  }

  return {
    buildModeRuntimeCandidateKey,
    buildReferenceTextCacheKey,
    clearBrokenModeRuntimeCandidate,
    ensureGeneratedAudioCacheRoot,
    getBrokenModeRuntimeCandidate,
    getGeneratedAudioCacheFilePath,
    markBrokenModeRuntimeCandidate,
    persistReferenceText,
    readPersistedReferenceText,
    readPersistedReferenceTextCache,
    writePersistedReferenceTextCache,
  };
}

module.exports = {
  createLocalVoiceRuntimeCacheUtils,
};
