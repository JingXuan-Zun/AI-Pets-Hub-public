const fs = require('fs');
const path = require('path');

const PRIMARY_FILE_NAME = 'desktop-pet-chat-history.v1.json';
const BACKUP_FILE_NAME = 'desktop-pet-chat-history.v1.backup.json';

function normalizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function readHistoryFile(filePath) {
  try {
    const rawText = fs.readFileSync(filePath, 'utf8').trim();
    if (!rawText) return { error: 'empty-file', ok: false };
    const payload = JSON.parse(rawText);
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages)) {
      return { error: 'invalid-history-payload', ok: false };
    }
    const messages = payload.messages.filter((message) => (
      message
      && typeof message === 'object'
      && typeof message.role === 'string'
      && typeof message.text === 'string'
    ));
    return { bytes: Buffer.byteLength(rawText, 'utf8'), messages, ok: true };
  } catch (error) {
    return {
      error: error && typeof error === 'object' && error.code === 'ENOENT'
        ? 'missing-file'
        : normalizeError(error),
      ok: false,
    };
  }
}

function writeTextFileSafely(targetPath, text) {
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.writeFileSync(tempPath, text, 'utf8');
    fs.renameSync(tempPath, targetPath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function createPersistedChatHistoryStore({ log, userDataPath }) {
  const primaryPath = path.join(userDataPath, PRIMARY_FILE_NAME);
  const backupPath = path.join(userDataPath, BACKUP_FILE_NAME);

  function load() {
    const primary = readHistoryFile(primaryPath);
    if (primary.ok) {
      return { ...primary, backupPath, primaryPath, source: 'primary' };
    }

    const backup = readHistoryFile(backupPath);
    if (backup.ok) {
      let repairedPrimary = false;
      let repairError = null;
      try {
        writeTextFileSafely(primaryPath, JSON.stringify({ messages: backup.messages, version: 1 }));
        repairedPrimary = true;
      } catch (error) {
        repairError = normalizeError(error);
      }
      log?.('persisted chat history restored from backup', {
        primaryError: primary.error,
        repairedPrimary,
        repairError,
      });
      return {
        ...backup,
        backupPath,
        primaryError: primary.error,
        primaryPath,
        repairedPrimary,
        repairError,
        source: 'backup',
      };
    }

    return {
      backupError: backup.error,
      backupPath,
      error: primary.error === 'missing-file' && backup.error === 'missing-file'
        ? 'missing-file' : primary.error,
      messages: [],
      ok: false,
      primaryError: primary.error,
      primaryPath,
      source: 'missing',
    };
  }

  function save(messages) {
    const safeMessages = Array.isArray(messages)
      ? messages.filter((message) => message && typeof message === 'object')
      : [];
    try {
      if (readHistoryFile(primaryPath).ok) {
        writeTextFileSafely(backupPath, fs.readFileSync(primaryPath, 'utf8'));
      }
      const serialized = JSON.stringify({ messages: safeMessages, version: 1 });
      writeTextFileSafely(primaryPath, serialized);
      const result = {
        backupPath,
        bytes: Buffer.byteLength(serialized, 'utf8'),
        messageCount: safeMessages.length,
        ok: true,
        primaryPath,
      };
      log?.('persisted chat history saved', result);
      return result;
    } catch (error) {
      const result = {
        backupPath,
        error: normalizeError(error),
        messageCount: safeMessages.length,
        ok: false,
        primaryPath,
      };
      log?.('persisted chat history save failed', result);
      return result;
    }
  }

  return {
    getPaths: () => ({ backupPath, primaryPath }),
    load,
    save,
  };
}

module.exports = { createPersistedChatHistoryStore };
