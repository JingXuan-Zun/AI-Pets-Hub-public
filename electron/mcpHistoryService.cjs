const fs = require('fs');
const path = require('path');
const {
  createMcpCancellationHistoryEntry,
  createMcpDiagnosticHistoryEntry,
  createMcpSessionHistoryEntry,
  createMcpToolCallResultHistoryEntry,
  createMcpToolCallStartHistoryEntry,
} = require('./mcpHistoryEntryFactory.cjs');

const DEFAULT_HISTORY_LIMIT = 80;
const MAX_HISTORY_LIMIT = 200;
const MCP_HISTORY_FILE_NAME = 'mcp-history.v1.json';

function normalizeLimit(value, fallback = DEFAULT_HISTORY_LIMIT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.round(parsed)));
}

function normalizeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  return {
    ...entry,
    createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : Date.now(),
    id: String(entry.id || `mcp-history-${Date.now()}`),
    serverId: String(entry.serverId ?? ''),
    status: String(entry.status ?? ''),
    type: String(entry.type ?? ''),
  };
}

function readHistoryState(storagePath, fallbackLimit, log) {
  if (!storagePath) {
    return { entries: [], retentionLimit: fallbackLimit };
  }

  try {
    const rawText = fs.readFileSync(storagePath, 'utf8');
    const parsed = JSON.parse(rawText);
    const retentionLimit = normalizeLimit(parsed?.retentionLimit, fallbackLimit);
    const rawEntries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const entries = rawEntries
      .map(normalizeHistoryEntry)
      .filter(Boolean)
      .slice(0, retentionLimit);
    return { entries, retentionLimit };
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      log?.('MCP history load failed', { error: normalizeErrorMessage(error), path: storagePath });
    }
    return { entries: [], retentionLimit: fallbackLimit };
  }
}

function writeHistoryEntries(storagePath, entries, retentionLimit, log) {
  if (!storagePath) {
    return;
  }

  try {
    ensureDirectory(path.dirname(storagePath));
    fs.writeFileSync(storagePath, `${JSON.stringify({
      entries,
      retentionLimit,
      savedAt: new Date().toISOString(),
      version: 1,
    }, null, 2)}\n`, 'utf8');
  } catch (error) {
    log?.('MCP history save failed', { error: normalizeErrorMessage(error), path: storagePath });
  }
}

function createMcpHistoryService(options = {}) {
  const fallbackLimit = normalizeLimit(options.maxEntries);
  const log = typeof options.log === 'function' ? options.log : null;
  const storagePath = typeof options.storagePath === 'string' && options.storagePath.trim()
    ? options.storagePath
    : '';
  const historyState = readHistoryState(storagePath, fallbackLimit, log);
  const entries = historyState.entries;
  let retentionLimit = historyState.retentionLimit;
  let nextId = entries.length + 1;

  function saveEntries() {
    writeHistoryEntries(storagePath, entries, retentionLimit, log);
  }

  function pushEntry(entry) {
    const createdAt = Date.now();
    entries.unshift({
      ...entry,
      createdAt,
      id: `mcp-history-${createdAt}-${nextId}`,
    });
    nextId += 1;
    if (entries.length > retentionLimit) {
      entries.length = retentionLimit;
    }
    saveEntries();
  }

  function recordDiagnostic(result) {
    pushEntry(createMcpDiagnosticHistoryEntry(result));
  }

  function recordToolCallStart(call) {
    pushEntry(createMcpToolCallStartHistoryEntry(call));
  }

  function recordToolCallResult(call) {
    pushEntry(createMcpToolCallResultHistoryEntry(call));
  }

  function recordCancellation(result) {
    pushEntry(createMcpCancellationHistoryEntry(result));
  }

  function recordSessionEvent(event) {
    pushEntry(createMcpSessionHistoryEntry(event));
  }

  function listHistory(request = {}) {
    const limit = normalizeLimit(request.limit, retentionLimit);
    const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
    const filteredEntries = serverId
      ? entries.filter((entry) => entry.serverId === serverId)
      : entries;
    return {
      entries: filteredEntries.slice(0, limit),
      limit,
      ok: true,
      retentionLimit,
      totalCount: filteredEntries.length,
    };
  }

  function clearHistory(request = {}) {
    const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
    const previousCount = entries.length;
    if (serverId) {
      const remainingEntries = entries.filter((entry) => entry.serverId !== serverId);
      entries.length = 0;
      entries.push(...remainingEntries);
    } else {
      entries.length = 0;
    }
    saveEntries();
    return {
      ok: true,
      removedCount: previousCount - entries.length,
      retentionLimit,
      totalCount: entries.length,
    };
  }

  function exportHistory(request = {}) {
    const result = listHistory(request);
    const exportedAt = new Date().toISOString();
    const text = `${JSON.stringify({
      entries: result.entries,
      exportedAt,
      retentionLimit,
      totalCount: result.totalCount,
      version: 1,
    }, null, 2)}\n`;
    return {
      entryCount: result.entries.length,
      fileName: `mcp-history-${exportedAt.replace(/[:.]/g, '-')}.json`,
      mimeType: 'application/json',
      ok: true,
      text,
    };
  }

  function setRetentionLimit(request = {}) {
    const previousCount = entries.length;
    retentionLimit = normalizeLimit(request.limit, retentionLimit);
    if (entries.length > retentionLimit) {
      entries.length = retentionLimit;
    }
    saveEntries();
    return {
      ok: true,
      removedCount: previousCount - entries.length,
      retentionLimit,
      totalCount: entries.length,
    };
  }

  return {
    clearHistory,
    exportHistory,
    listHistory,
    recordCancellation,
    recordDiagnostic,
    recordSessionEvent,
    recordToolCallResult,
    recordToolCallStart,
    setRetentionLimit,
  };
}

module.exports = {
  MCP_HISTORY_FILE_NAME,
  createMcpHistoryService,
};
