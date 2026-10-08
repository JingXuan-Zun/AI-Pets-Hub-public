const fs = require('fs');
const path = require('path');

function normalizeErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function writeBufferFileSafely(targetPath, buffer) {
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  ensureDirectory(path.dirname(targetPath));
  fs.writeFileSync(tempPath, buffer);
  fs.copyFileSync(tempPath, targetPath);
  fs.rmSync(tempPath, { force: true });
}

module.exports = { normalizeErrorMessage, ensureDirectory, isPlainObject, writeBufferFileSafely };
