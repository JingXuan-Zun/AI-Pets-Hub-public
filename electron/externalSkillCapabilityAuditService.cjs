const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RECEIPT_HISTORY_FILE_NAME = 'external-skill-capability-receipts.v1.json';
const RATE_LIMIT_FILE_NAME = 'external-skill-capability-rate-limits.v1.json';
const RECEIPT_HISTORY_KIND = 'external-skill-capability-receipt-history.v1';
const RATE_LIMIT_STATE_KIND = 'external-skill-capability-rate-limits.v1';
const RATE_LIMIT_RESULT_KIND = 'external-skill-capability-rate-limit.v1';
const RECEIPT_KIND = 'external-skill-capability-receipt.v1';
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const DEFAULT_RECEIPT_LIMIT = 80;
const MAX_RECEIPT_LIMIT = 200;
const MAX_TRACKED_PACKAGES = 64;
const STORAGE_READ_RATE_LIMIT = 20;
const STORAGE_READ_RATE_WINDOW_MS = 60 * 1000;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLimit(value, fallback = DEFAULT_RECEIPT_LIMIT) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(1, Math.min(MAX_RECEIPT_LIMIT, Math.round(numeric)))
    : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function normalizeRateLimit(value) {
  if (!isRecord(value) || value.kind !== RATE_LIMIT_RESULT_KIND) {
    return null;
  }
  return {
    allowed: Boolean(value.allowed),
    kind: RATE_LIMIT_RESULT_KIND,
    limit: Number(value.limit) || STORAGE_READ_RATE_LIMIT,
    packageId: typeof value.packageId === 'string' ? value.packageId : '',
    remaining: Math.max(0, Number(value.remaining) || 0),
    retryAfterMs: Math.max(0, Number(value.retryAfterMs) || 0),
    scope: 'storage.read',
    windowMs: Number(value.windowMs) || STORAGE_READ_RATE_WINDOW_MS,
  };
}

function normalizeReceipt(value) {
  if (!isRecord(value) || value.kind !== RECEIPT_KIND) {
    return null;
  }
  const packageId = typeof value.packageId === 'string' ? value.packageId.trim() : '';
  if (!PACKAGE_ID_PATTERN.test(packageId)) {
    return null;
  }
  const writtenAt = typeof value.writtenAt === 'string' && Number.isFinite(Date.parse(value.writtenAt))
    ? value.writtenAt
    : new Date(0).toISOString();
  return {
    artifactDigest: typeof value.artifactDigest === 'string' ? value.artifactDigest : null,
    decision: typeof value.decision === 'string' ? value.decision : '',
    grantedScopes: normalizeStringArray(value.grantedScopes),
    kind: RECEIPT_KIND,
    packageId,
    rateLimit: normalizeRateLimit(value.rateLimit),
    reason: typeof value.reason === 'string' ? value.reason : '',
    receiptId: typeof value.receiptId === 'string' && value.receiptId.trim()
      ? value.receiptId.trim()
      : `capability-receipt-${crypto.randomUUID()}`,
    requestId: typeof value.requestId === 'string' ? value.requestId : '',
    requestedScopes: normalizeStringArray(value.requestedScopes),
    status: typeof value.status === 'string' ? value.status : '',
    usedScopes: normalizeStringArray(value.usedScopes),
    writtenAt,
  };
}

function createExternalSkillCapabilityAuditService({ rootPath, log, now = Date.now } = {}) {
  if (typeof rootPath !== 'string' || !rootPath.trim()) {
    throw new Error('capability_audit_root_path_missing');
  }
  const receiptHistoryPath = path.join(path.resolve(rootPath), RECEIPT_HISTORY_FILE_NAME);
  const rateLimitPath = path.join(path.resolve(rootPath), RATE_LIMIT_FILE_NAME);
  const getNow = typeof now === 'function' ? now : Date.now;

  function readReceiptHistory() {
    try {
      const parsed = JSON.parse(fs.readFileSync(receiptHistoryPath, 'utf8'));
      if (!isRecord(parsed) || parsed.kind !== RECEIPT_HISTORY_KIND || !Array.isArray(parsed.receipts)) {
        return [];
      }
      return parsed.receipts.map(normalizeReceipt).filter(Boolean).slice(0, MAX_RECEIPT_LIMIT);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        log?.('Skill capability receipt history read failed', { error: String(error) });
      }
      return [];
    }
  }

  function saveReceiptHistory(receipts) {
    try {
      writeJsonAtomic(receiptHistoryPath, {
        kind: RECEIPT_HISTORY_KIND,
        receipts: receipts.slice(0, MAX_RECEIPT_LIMIT),
        savedAt: new Date(getNow()).toISOString(),
      });
      return true;
    } catch (error) {
      log?.('Skill capability receipt history write failed', { error: String(error) });
      return false;
    }
  }

  function recordReceipt(receipt) {
    const normalized = normalizeReceipt(receipt);
    if (!normalized) {
      return { error: 'capability_receipt_invalid', ok: false };
    }
    const receipts = readReceiptHistory();
    const nextReceipts = [normalized, ...receipts.filter((item) => item.receiptId !== normalized.receiptId)];
    return {
      ok: saveReceiptHistory(nextReceipts),
      receipt: normalized,
      totalCount: Math.min(nextReceipts.length, MAX_RECEIPT_LIMIT),
    };
  }

  function listReceipts(request = {}) {
    const packageId = typeof request.packageId === 'string' ? request.packageId.trim() : '';
    const status = typeof request.status === 'string' ? request.status.trim() : '';
    const limit = normalizeLimit(request.limit);
    const filtered = readReceiptHistory().filter((receipt) => (
      (!packageId || receipt.packageId === packageId)
      && (!status || receipt.status === status)
    ));
    return {
      kind: RECEIPT_HISTORY_KIND,
      limit,
      ok: true,
      path: receiptHistoryPath,
      receipts: filtered.slice(0, limit),
      retentionLimit: MAX_RECEIPT_LIMIT,
      totalCount: filtered.length,
    };
  }

  function clearReceipts(request = {}) {
    const packageId = typeof request.packageId === 'string' ? request.packageId.trim() : '';
    const receipts = readReceiptHistory();
    const remaining = packageId ? receipts.filter((receipt) => receipt.packageId !== packageId) : [];
    return {
      ok: saveReceiptHistory(remaining),
      removedCount: receipts.length - remaining.length,
      totalCount: remaining.length,
    };
  }

  function readRateLimitState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(rateLimitPath, 'utf8'));
      return isRecord(parsed) && parsed.kind === RATE_LIMIT_STATE_KIND && isRecord(parsed.packages)
        ? parsed
        : { kind: RATE_LIMIT_STATE_KIND, packages: {} };
    } catch {
      return { kind: RATE_LIMIT_STATE_KIND, packages: {} };
    }
  }

  function pruneRateLimitState(state, nowMs) {
    const cutoff = nowMs - STORAGE_READ_RATE_WINDOW_MS;
    const packages = {};
    Object.entries(state.packages).forEach(([packageId, value]) => {
      if (!PACKAGE_ID_PATTERN.test(packageId) || !isRecord(value) || !Array.isArray(value.storageRead)) {
        return;
      }
      const timestamps = value.storageRead
        .map(Number)
        .filter((timestamp) => Number.isFinite(timestamp) && timestamp > cutoff && timestamp <= nowMs)
        .sort((left, right) => left - right);
      if (timestamps.length) {
        packages[packageId] = { storageRead: timestamps };
      }
    });
    const trimmedPackages = Object.fromEntries(Object.entries(packages)
      .sort((left, right) => right[1].storageRead.at(-1) - left[1].storageRead.at(-1))
      .slice(0, MAX_TRACKED_PACKAGES));
    return { kind: RATE_LIMIT_STATE_KIND, packages: trimmedPackages };
  }

  function saveRateLimitState(state, nowMs) {
    try {
      writeJsonAtomic(rateLimitPath, { ...state, savedAt: new Date(nowMs).toISOString() });
      return true;
    } catch (error) {
      log?.('Skill capability rate-limit state write failed', { error: String(error) });
      return false;
    }
  }

  function consumeStorageRead(packageId) {
    const nowMs = Number(getNow());
    const state = pruneRateLimitState(readRateLimitState(), nowMs);
    const timestamps = state.packages[packageId]?.storageRead ?? [];
    if (timestamps.length >= STORAGE_READ_RATE_LIMIT) {
      saveRateLimitState(state, nowMs);
      return {
        allowed: false,
        kind: RATE_LIMIT_RESULT_KIND,
        limit: STORAGE_READ_RATE_LIMIT,
        packageId,
        remaining: 0,
        retryAfterMs: Math.max(1, timestamps[0] + STORAGE_READ_RATE_WINDOW_MS - nowMs),
        scope: 'storage.read',
        windowMs: STORAGE_READ_RATE_WINDOW_MS,
      };
    }
    state.packages[packageId] = { storageRead: [...timestamps, nowMs] };
    saveRateLimitState(pruneRateLimitState(state, nowMs), nowMs);
    return {
      allowed: true,
      kind: RATE_LIMIT_RESULT_KIND,
      limit: STORAGE_READ_RATE_LIMIT,
      packageId,
      remaining: STORAGE_READ_RATE_LIMIT - timestamps.length - 1,
      retryAfterMs: 0,
      scope: 'storage.read',
      windowMs: STORAGE_READ_RATE_WINDOW_MS,
    };
  }

  return {
    clearReceipts,
    consumeStorageRead,
    getPaths: () => ({ rateLimitPath, receiptHistoryPath }),
    listReceipts,
    recordReceipt,
  };
}

module.exports = {
  RATE_LIMIT_FILE_NAME,
  RECEIPT_HISTORY_FILE_NAME,
  createExternalSkillCapabilityAuditService,
};
