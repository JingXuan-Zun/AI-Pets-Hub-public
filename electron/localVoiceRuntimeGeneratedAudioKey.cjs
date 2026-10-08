const crypto = require('crypto');

function getPathCacheSignature({ fs, pathExists }, targetPath) {
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

function buildGeneratedAudioCacheKey(context, {
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
    ttsModelSignature: getPathCacheSignature(context, ttsModelPath),
    referencePath: referencePath || '',
    referencePathSignature: getPathCacheSignature(context, referencePath),
    referenceAudioPath: referenceAudioPath || '',
    referenceAudioSignature: getPathCacheSignature(context, referenceAudioPath),
    referenceText: referenceText || '',
    referenceSttModelPath: referenceSttModelPath || '',
    referenceSttModelSignature: getPathCacheSignature(context, referenceSttModelPath),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function buildGeneratedAudioTextPreview({ generatedAudioCachePreviewLimit }, text) {
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

function createLocalVoiceGeneratedAudioKey(context) {
  return {
    buildGeneratedAudioCacheKey: buildGeneratedAudioCacheKey.bind(null, context),
    buildGeneratedAudioTextPreview: buildGeneratedAudioTextPreview.bind(null, context),
  };
}

module.exports = { createLocalVoiceGeneratedAudioKey };
