const fs = require('fs');
const path = require('path');
const { normalizeAbsolutePath, clampInteger, getPathKind } = require('./localFileSystemInputUtils.cjs');
const { getSafeStat } = require('./localFileSystemDestinationUtils.cjs');

const DEFAULT_READ_MAX_BYTES = 96 * 1024;

const MAX_READ_BYTES = 512 * 1024;

function looksBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 4096);
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) {
      return true;
    }
  }

  return false;
}

const IMAGE_MIME_TYPES = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function readFileDataUrl(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.filePath || request.query);
  if (!resolved.ok) return resolved;

  const stat = getSafeStat(resolved.path);
  if (!stat?.isFile()) {
    return { error: 'Path is not a file.', ok: false, path: resolved.path };
  }

  const mimeType = IMAGE_MIME_TYPES[path.extname(resolved.path).toLowerCase()];
  if (!mimeType) {
    return { error: 'Only supported image files can be read as data URLs.', ok: false, path: resolved.path };
  }

  const maxBytes = clampInteger(request.maxBytes, 16 * 1024 * 1024, 1, 32 * 1024 * 1024);
  if (stat.size > maxBytes) {
    return { error: 'Image file is too large.', ok: false, path: resolved.path, sizeBytes: stat.size };
  }

  try {
    return {
      dataUrl: `data:${mimeType};base64,${fs.readFileSync(resolved.path).toString('base64')}`,
      ok: true,
      path: resolved.path,
      sizeBytes: stat.size,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ok: false, path: resolved.path };
  }
}

function readOpenedTextFile(resolved, stat, maxBytes) {
  const fd = fs.openSync(resolved.path, 'r');
  try {
    const byteLength = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(byteLength);
    fs.readSync(fd, buffer, 0, byteLength, 0);
    if (looksBinary(buffer)) {
      return {
        error: 'File appears to be binary; text content was not returned.',
        kind: 'file',
        ok: false,
        path: resolved.path,
        sizeBytes: stat.size,
      };
    }
    return {
      encoding: 'utf8',
      extension: path.extname(resolved.path).toLowerCase(),
      modifiedAt: stat.mtimeMs || 0,
      ok: true,
      path: resolved.path,
      sizeBytes: stat.size,
      text: buffer.toString('utf8'),
      truncated: stat.size > maxBytes,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function readTextFile(request = {}) {
  const resolved = normalizeAbsolutePath(request.path || request.filePath || request.query);
  if (!resolved.ok) {
    return resolved;
  }
  const stat = getSafeStat(resolved.path);
  if (!stat) {
    return {
      error: 'Path does not exist.',
      ok: false,
      path: resolved.path,
    };
  }
  if (!stat.isFile()) {
    return {
      error: 'Path is not a file.',
      kind: getPathKind(stat),
      ok: false,
      path: resolved.path,
    };
  }
  const maxBytes = clampInteger(request.maxBytes, DEFAULT_READ_MAX_BYTES, 1, MAX_READ_BYTES);
  try {
    return readOpenedTextFile(resolved, stat, maxBytes);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      path: resolved.path,
    };
  }
}

module.exports = { looksBinary, readTextFile, readFileDataUrl };
