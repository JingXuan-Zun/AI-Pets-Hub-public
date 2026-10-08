function readPersistedReferenceTextCache(context) {
  const { pathExists, referenceTextCachePath, fs, writeRuntimeLog, buildJsonError } = context;
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

function writePersistedReferenceTextCache(context, entries) {
  const { ensureRuntimeRoot, fs, referenceTextCachePath, writeRuntimeLog, buildJsonError } = context;
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

function readPersistedReferenceText(context, referenceCacheKey) {
  if (!referenceCacheKey) {
    return '';
  }

  const entries = readPersistedReferenceTextCache(context);
  const entry = entries?.[referenceCacheKey];
  if (!entry || typeof entry !== 'object') {
    return '';
  }

  return typeof entry.text === 'string' ? entry.text.trim() : '';
}

function persistReferenceText(context, referenceCacheKey, referenceText, metadata = {}) {
  const normalizedText = typeof referenceText === 'string' ? referenceText.trim() : '';
  if (!referenceCacheKey || !normalizedText) {
    return false;
  }

  const entries = readPersistedReferenceTextCache(context);
  entries[referenceCacheKey] = {
    text: normalizedText,
    updatedAt: Date.now(),
    ...metadata,
  };
  return writePersistedReferenceTextCache(context, entries);
}

function createLocalVoiceReferenceTextStore(context) {
  return {
    readPersistedReferenceTextCache: readPersistedReferenceTextCache.bind(null, context),
    writePersistedReferenceTextCache: writePersistedReferenceTextCache.bind(null, context),
    readPersistedReferenceText: readPersistedReferenceText.bind(null, context),
    persistReferenceText: persistReferenceText.bind(null, context),
  };
}

module.exports = { createLocalVoiceReferenceTextStore };
