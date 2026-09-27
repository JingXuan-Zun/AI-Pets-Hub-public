const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STORE_DIRECTORY_NAME = 'neural-persona';
const RECORD_FILE_SUFFIX = '.record.json';

function normalizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function roleStorageKey(roleId) {
  return crypto.createHash('sha256').update(roleId, 'utf8').digest('hex');
}

function validateRoleId(roleId) {
  return typeof roleId === 'string' && roleId.trim().length > 0 && roleId.length <= 256;
}

function validateSerializedValue(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 4 * 1024 * 1024;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function writeAtomically(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, value, 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function createNeuralPersonaFileStore({ userDataPath, log }) {
  const storeDirectory = path.join(userDataPath, STORE_DIRECTORY_NAME);
  const logMessage = (message, details) => log?.(message, details);
  const filePathForRole = (roleId) => path.join(
    storeDirectory,
    `${roleStorageKey(roleId)}${RECORD_FILE_SUFFIX}`,
  );

  function read(roleId) {
    if (!validateRoleId(roleId)) return { error: 'invalid-role-id', ok: false };
    try {
      const value = readText(filePathForRole(roleId));
      return { ok: true, value };
    } catch (error) {
      const message = normalizeError(error);
      logMessage('neural persona read failed', { error: message, roleId });
      return { error: message, ok: false };
    }
  }

  function compareAndSwap(roleId, expectedValue, nextValue) {
    if (!validateRoleId(roleId)) return { error: 'invalid-role-id', ok: false };
    if (expectedValue !== null && typeof expectedValue !== 'string') {
      return { error: 'invalid-expected-value', ok: false };
    }
    if (!validateSerializedValue(nextValue)) return { error: 'invalid-next-value', ok: false };
    try {
      const filePath = filePathForRole(roleId);
      const currentValue = readText(filePath);
      if (currentValue !== expectedValue) return { matched: false, ok: true };
      writeAtomically(filePath, nextValue);
      return { matched: true, ok: true };
    } catch (error) {
      const message = normalizeError(error);
      logMessage('neural persona compare-and-swap failed', { error: message, roleId });
      return { error: message, ok: false };
    }
  }

  return {
    compareAndSwap,
    getPaths: () => ({ storeDirectory }),
    read,
  };
}

module.exports = {
  RECORD_FILE_SUFFIX,
  STORE_DIRECTORY_NAME,
  createNeuralPersonaFileStore,
  roleStorageKey,
};
