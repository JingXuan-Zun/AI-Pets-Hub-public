const fs = require('fs');
const path = require('path');

const PRIMARY_FILE_NAME = 'desktop-pet-chat-history.v1.json';
const BACKUP_FILE_NAME = 'desktop-pet-chat-history.v1.backup.json';
const ARCHIVE_DIRECTORY_NAME = 'chat-archive';

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
  const archiveDirectory = path.join(userDataPath, ARCHIVE_DIRECTORY_NAME);

  // Serialized payload last known to be on disk as the primary file. Callers
  // such as the shared-state sync push the same messages many times a second;
  // skipping identical writes keeps the backup pointing at the previous
  // distinct history instead of being overwritten with an identical copy.
  let lastPersistedSerialized = null;

  function isPrimaryUnchanged(serialized) {
    if (lastPersistedSerialized !== serialized) return false;
    try {
      return fs.statSync(primaryPath).size === Buffer.byteLength(serialized, 'utf8');
    } catch {
      return false;
    }
  }

  function load() {
    const primary = readHistoryFile(primaryPath);
    if (primary.ok) {
      lastPersistedSerialized = JSON.stringify({ messages: primary.messages, version: 1 });
      return { ...primary, backupPath, primaryPath, source: 'primary' };
    }
    lastPersistedSerialized = null;

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
    const serialized = JSON.stringify({ messages: safeMessages, version: 1 });
    if (isPrimaryUnchanged(serialized)) {
      return {
        backupPath,
        bytes: Buffer.byteLength(serialized, 'utf8'),
        messageCount: safeMessages.length,
        ok: true,
        primaryPath,
        unchanged: true,
      };
    }
    try {
      if (readHistoryFile(primaryPath).ok) {
        writeTextFileSafely(backupPath, fs.readFileSync(primaryPath, 'utf8'));
      }
      lastPersistedSerialized = null;
      writeTextFileSafely(primaryPath, serialized);
      lastPersistedSerialized = serialized;
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

  // Old messages move here by month instead of being deleted. Each file is
  // rewritten whole; a month of text chat stays small enough for that.
  function archive(messages) {
    const safeMessages = Array.isArray(messages)
      ? messages.filter((message) => (
        message && typeof message === 'object' && typeof message.text === 'string'
      ))
      : [];
    if (!safeMessages.length) return { archivedCount: 0, ok: true };
    const byMonth = new Map();
    safeMessages.forEach((message) => {
      const createdAt = Number.isFinite(message.createdAt) ? message.createdAt : Date.now();
      const date = new Date(createdAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(month, [...(byMonth.get(month) ?? []), message]);
    });
    try {
      let archivedCount = 0;
      byMonth.forEach((monthMessages, month) => {
        const filePath = path.join(archiveDirectory, `${month}.json`);
        const existing = readHistoryFile(filePath);
        if (!existing.ok && existing.error !== 'missing-file') {
          throw new Error(`chat archive ${month} unreadable: ${existing.error}`);
        }
        const existingMessages = existing.ok ? existing.messages : [];
        const knownIds = new Set(existingMessages.map((message) => message.id).filter(Boolean));
        const additions = monthMessages.filter((message) => !message.id || !knownIds.has(message.id));
        const merged = [...existingMessages, ...additions]
          .sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0));
        writeTextFileSafely(filePath, JSON.stringify({ messages: merged, version: 1 }));
        archivedCount += additions.length;
      });
      const result = { archivedCount, ok: true };
      log?.('chat history archived', { ...result, months: [...byMonth.keys()] });
      return result;
    } catch (error) {
      const result = { error: normalizeError(error), ok: false };
      log?.('chat history archive failed', result);
      return result;
    }
  }

  return {
    archive,
    getPaths: () => ({ archiveDirectory, backupPath, primaryPath }),
    load,
    save,
  };
}

module.exports = { createPersistedChatHistoryStore };
