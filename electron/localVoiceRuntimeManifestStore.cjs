const { normalizeGeneratedAudioManifestEntry } = require('./localVoiceRuntimeManifestEntry.cjs');

function readGeneratedAudioManifestEntries(context) {
  const { pathExists, generatedAudioManifestPath, fs, normalizeGeneratedAudioManifestEntry,
    writeRuntimeLog, buildJsonError } = context;
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

function writeGeneratedAudioManifestEntries(context, entries) {
  const { ensureGeneratedAudioCacheRoot, normalizeGeneratedAudioManifestEntry,
    fs, generatedAudioManifestPath } = context;
  ensureGeneratedAudioCacheRoot();
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeGeneratedAudioManifestEntry(entry))
    .filter(Boolean)
    .sort((left, right) => left.createdAt - right.createdAt);
  const content = normalizedEntries.map((entry) => JSON.stringify(entry)).join('\n');
  fs.writeFileSync(generatedAudioManifestPath, content ? `${content}\n` : '', 'utf8');
  return normalizedEntries;
}

function updateGeneratedAudioManifestEntry(context, cacheKey, updater) {
  const { readGeneratedAudioManifestEntries, writeGeneratedAudioManifestEntries } = context;
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

function createLocalVoiceManifestStore(dependencies) {
  const context = { ...dependencies };
  context.normalizeGeneratedAudioManifestEntry = normalizeGeneratedAudioManifestEntry.bind(null, context);
  context.readGeneratedAudioManifestEntries = readGeneratedAudioManifestEntries.bind(null, context);
  context.writeGeneratedAudioManifestEntries = writeGeneratedAudioManifestEntries.bind(null, context);
  return {
    readGeneratedAudioManifestEntries: context.readGeneratedAudioManifestEntries,
    writeGeneratedAudioManifestEntries: context.writeGeneratedAudioManifestEntries,
    updateGeneratedAudioManifestEntry: updateGeneratedAudioManifestEntry.bind(null, context),
  };
}

module.exports = { createLocalVoiceManifestStore };
