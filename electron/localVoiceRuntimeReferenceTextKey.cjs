function buildReferenceTextCacheKey(fs, referenceAudioPath, sttModelPath, languageCode) {
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

function createLocalVoiceReferenceTextKey({ fs }) {
  return { buildReferenceTextCacheKey: buildReferenceTextCacheKey.bind(null, fs) };
}

module.exports = { createLocalVoiceReferenceTextKey };
