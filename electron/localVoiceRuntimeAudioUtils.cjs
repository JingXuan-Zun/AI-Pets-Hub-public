const fs = require('fs');
const path = require('path');
const { pathExists } = require('./localVoiceRuntimePathUtils.cjs');

function resolveReferenceAudioPath(referencePath) {
  if (!pathExists(referencePath)) {
    return null;
  }

  const stats = fs.statSync(referencePath);
  if (stats.isFile()) {
    return referencePath;
  }

  const entries = fs.readdirSync(referencePath, { withFileTypes: true });
  const audioEntries = entries
    .filter((entry) => entry.isFile() && /\.(wav|flac|mp3|m4a|ogg|aac)$/i.test(entry.name))
    .map((entry) => path.join(referencePath, entry.name));

  if (audioEntries.length === 0) {
    return null;
  }

  const preferredAudioPath = audioEntries
    .map((audioPath) => ({
      audioPath,
      score: scoreReferenceAudioCandidate(audioPath),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return path.basename(left.audioPath).localeCompare(path.basename(right.audioPath), 'zh-CN');
    })[0];

  return preferredAudioPath?.audioPath ?? null;
}

function getWavAudioDurationMs(audioPath) {
  if (!audioPath || path.extname(audioPath).toLowerCase() !== '.wav') {
    return null;
  }

  let fileHandle = null;
  try {
    fileHandle = fs.openSync(audioPath, 'r');
    const headerBuffer = Buffer.alloc(512 * 1024);
    const bytesRead = fs.readSync(fileHandle, headerBuffer, 0, headerBuffer.length, 0);
    const buffer = headerBuffer.subarray(0, bytesRead);

    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      return null;
    }

    let offset = 12;
    let channelCount = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let dataSize = 0;

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkDataOffset = offset + 8;

      if (chunkId === 'fmt ' && chunkDataOffset + 16 <= buffer.length) {
        channelCount = buffer.readUInt16LE(chunkDataOffset + 2);
        sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
        bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
      } else if (chunkId === 'data') {
        dataSize = chunkSize;
        break;
      }

      offset += 8 + chunkSize + (chunkSize % 2);
    }

    if (!channelCount || !sampleRate || !bitsPerSample || !dataSize) {
      return null;
    }

    const bytesPerSecond = sampleRate * channelCount * (bitsPerSample / 8);
    if (!bytesPerSecond) {
      return null;
    }

    return Math.round((dataSize / bytesPerSecond) * 1000);
  } catch {
    return null;
  } finally {
    if (fileHandle !== null) {
      try {
        fs.closeSync(fileHandle);
      } catch {
        // Ignore file close failures.
      }
    }
  }
}

function scoreReferenceAudioCandidate(audioPath) {
  let fileSize = Number.POSITIVE_INFINITY;
  try {
    fileSize = fs.statSync(audioPath).size;
  } catch {
    // Ignore stat failures and keep the default large score.
  }

  const durationMs = getWavAudioDurationMs(audioPath);
  if (durationMs == null) {
    return fileSize;
  }

  const targetDurationMs = 3000;
  const minimumIdealDurationMs = 1800;
  const maximumIdealDurationMs = 5000;
  let score = Math.abs(durationMs - targetDurationMs);

  if (durationMs < minimumIdealDurationMs) {
    score += 4000;
  }

  if (durationMs > maximumIdealDurationMs) {
    score += 2500 + (durationMs - maximumIdealDurationMs);
  }

  return score + Math.round(fileSize / 1024);
}

module.exports = {
  getWavAudioDurationMs,
  resolveReferenceAudioPath,
  scoreReferenceAudioCandidate,
};
