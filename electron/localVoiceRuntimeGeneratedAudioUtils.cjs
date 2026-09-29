const crypto = require('crypto');
const { pathToFileURL } = require('url');

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
  function getPathCacheSignature(targetPath) {
    if (!targetPath || !pathExists(targetPath)) {
      return null;
    }

    try {
      const stats = fs.statSync(targetPath);
      return `${stats.isDirectory() ? 'dir' : 'file'}:${stats.size}:${Math.floor(stats.mtimeMs)}`;
    } catch {
      return null;
    }
  }

  function buildGeneratedAudioCacheKey({
    text,
    languageCode,
    seed,
    ttsModelPath,
    referencePath,
    referenceAudioPath,
    referenceText,
    referenceSttModelPath,
  }) {
    const payload = {
      text: typeof text === 'string' ? text.trim() : '',
      languageCode: languageCode || 'zh-CN',
      seed: Number.isFinite(seed) ? Math.trunc(seed) : null,
      ttsModelPath: ttsModelPath || '',
      ttsModelSignature: getPathCacheSignature(ttsModelPath),
      referencePath: referencePath || '',
      referencePathSignature: getPathCacheSignature(referencePath),
      referenceAudioPath: referenceAudioPath || '',
      referenceAudioSignature: getPathCacheSignature(referenceAudioPath),
      referenceText: referenceText || '',
      referenceSttModelPath: referenceSttModelPath || '',
      referenceSttModelSignature: getPathCacheSignature(referenceSttModelPath),
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  function buildGeneratedAudioTextPreview(text) {
    const normalized = String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return '';
    }

    return normalized.length > generatedAudioCachePreviewLimit
      ? `${normalized.slice(0, generatedAudioCachePreviewLimit)}...`
      : normalized;
  }

  function normalizeGeneratedAudioManifestEntry(value) {
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

  function readGeneratedAudioManifestEntries() {
    if (!pathExists(generatedAudioManifestPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(generatedAudioManifestPath, 'utf8');
      return raw
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return normalizeGeneratedAudioManifestEntry(JSON.parse(line));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      writeRuntimeLog('generated_audio_manifest_read_failed', {
        error: buildJsonError(error),
      });
      return [];
    }
  }

  function writeGeneratedAudioManifestEntries(entries) {
    ensureGeneratedAudioCacheRoot();
    const normalizedEntries = (Array.isArray(entries) ? entries : [])
      .map((entry) => normalizeGeneratedAudioManifestEntry(entry))
      .filter(Boolean)
      .sort((left, right) => left.createdAt - right.createdAt);
    const content = normalizedEntries.map((entry) => JSON.stringify(entry)).join('\n');
    fs.writeFileSync(generatedAudioManifestPath, content ? `${content}\n` : '', 'utf8');
    return normalizedEntries;
  }

  function updateGeneratedAudioManifestEntry(cacheKey, updater) {
    const entries = readGeneratedAudioManifestEntries();
    const targetIndex = entries.findIndex((entry) => entry.cacheKey === cacheKey);
    const currentEntry = targetIndex >= 0 ? entries[targetIndex] : null;
    const nextEntry = typeof updater === 'function' ? updater(currentEntry) : null;

    if (targetIndex >= 0) {
      entries.splice(targetIndex, 1);
    }

    if (nextEntry) {
      entries.push(nextEntry);
    }

    const shouldWrite = targetIndex >= 0 || Boolean(nextEntry);
    const writtenEntries = shouldWrite ? writeGeneratedAudioManifestEntries(entries) : entries;

    return {
      entry: nextEntry ? writtenEntries.find((item) => item.cacheKey === nextEntry.cacheKey) ?? null : null,
      entries,
    };
  }

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

  function cleanupGeneratedAudioCache(reason = 'manual') {
    if (!pathExists(generatedAudioCacheRoot) && !pathExists(generatedAudioManifestPath)) {
      return [];
    }

    ensureGeneratedAudioCacheRoot();
    const now = Date.now();
    const keptEntries = [];
    const trackedFilePaths = new Set();
    let removedCount = 0;
    let dirty = false;

    for (const entry of readGeneratedAudioManifestEntries()) {
      const expired = entry.expiresAt <= now;
      const fileExists = pathExists(entry.audioFilePath);

      if (!fileExists || expired) {
        if (fileExists && isPathInside(entry.audioFilePath, generatedAudioCacheRoot)) {
          try {
            fs.unlinkSync(entry.audioFilePath);
          } catch {
            // Ignore cache file cleanup failures.
          }
        }

        removedCount += 1;
        dirty = true;
        continue;
      }

      trackedFilePaths.add(normalizeComparablePath(entry.audioFilePath));
      keptEntries.push(entry);
    }

    if (pathExists(generatedAudioCacheRoot)) {
      const entries = fs.readdirSync(generatedAudioCacheRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || entry.name === generatedAudioCacheManifestFile) {
          continue;
        }

        const filePath = path.join(generatedAudioCacheRoot, entry.name);
        const normalizedFilePath = normalizeComparablePath(filePath);
        if (trackedFilePaths.has(normalizedFilePath)) {
          continue;
        }

        try {
          const stats = fs.statSync(filePath);
          if (now - Math.floor(stats.mtimeMs) < generatedAudioCacheTtlMs) {
            continue;
          }
        } catch {
          // Ignore stat failures and try removing the file.
        }

        try {
          fs.unlinkSync(filePath);
          removedCount += 1;
          dirty = true;
        } catch {
          // Ignore stray cache cleanup failures.
        }
      }
    }

    if (dirty) {
      writeGeneratedAudioManifestEntries(keptEntries);
    }

    if (removedCount > 0 || reason === 'startup') {
      writeRuntimeLog('generated_audio_cache_cleanup_complete', {
        reason,
        keptCount: keptEntries.length,
        removedCount,
        cacheRoot: generatedAudioCacheRoot,
      });
    }

    return keptEntries;
  }

  return {
    buildGeneratedAudioCacheKey,
    buildGeneratedAudioTextPreview,
    cleanupGeneratedAudioCache,
    getGeneratedAudioFileUrl,
    updateGeneratedAudioManifestEntry,
  };
}

module.exports = {
  createLocalVoiceRuntimeGeneratedAudioUtils,
};
