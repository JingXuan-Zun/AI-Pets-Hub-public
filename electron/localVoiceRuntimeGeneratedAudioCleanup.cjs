function pruneTrackedEntries(context, now) {
  const { readGeneratedAudioManifestEntries, pathExists, isPathInside,
    generatedAudioCacheRoot, fs, normalizeComparablePath } = context;
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
  return { keptEntries, trackedFilePaths, removedCount, dirty };
}

function removeStrayFiles(context, now, trackedFilePaths) {
  const { pathExists, generatedAudioCacheRoot, fs, generatedAudioCacheManifestFile,
    path, normalizeComparablePath, generatedAudioCacheTtlMs } = context;
  let removedCount = 0;
  if (pathExists(generatedAudioCacheRoot)) {
    const entries = fs.readdirSync(generatedAudioCacheRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === generatedAudioCacheManifestFile) continue;
      const filePath = path.join(generatedAudioCacheRoot, entry.name);
      const normalizedFilePath = normalizeComparablePath(filePath);
      if (trackedFilePaths.has(normalizedFilePath)) continue;
      try {
        const stats = fs.statSync(filePath);
        if (now - Math.floor(stats.mtimeMs) < generatedAudioCacheTtlMs) continue;
      } catch {
        // Ignore stat failures and try removing the file.
      }
      try {
        fs.unlinkSync(filePath);
        removedCount += 1;
      } catch {
        // Ignore stray cache cleanup failures.
      }
    }
  }
  return removedCount;
}

function createLocalVoiceGeneratedAudioCleanup(context) {
  const { pathExists, generatedAudioCacheRoot, generatedAudioManifestPath,
    ensureGeneratedAudioCacheRoot, writeGeneratedAudioManifestEntries, writeRuntimeLog } = context;
  function cleanupGeneratedAudioCache(reason = 'manual') {
    if (!pathExists(generatedAudioCacheRoot) && !pathExists(generatedAudioManifestPath)) return [];
    ensureGeneratedAudioCacheRoot();
    const now = Date.now();
    const { keptEntries, trackedFilePaths, removedCount: trackedRemoved, dirty } = pruneTrackedEntries(context, now);
    const strayRemoved = removeStrayFiles(context, now, trackedFilePaths);
    const removedCount = trackedRemoved + strayRemoved;
    if (dirty || strayRemoved > 0) writeGeneratedAudioManifestEntries(keptEntries);
    if (removedCount > 0 || reason === 'startup') {
      writeRuntimeLog('generated_audio_cache_cleanup_complete', {
        reason, keptCount: keptEntries.length, removedCount, cacheRoot: generatedAudioCacheRoot,
      });
    }
    return keptEntries;
  }
  return { cleanupGeneratedAudioCache };
}

module.exports = { createLocalVoiceGeneratedAudioCleanup };
