const fs = require('fs');
const path = require('path');

const HEALTH_FILE_NAME = 'external-skill-package-health.v1.json';
const HEALTH_STATE_KIND = 'external-skill-package-health-state.v1';
const HEALTH_RESULT_KIND = 'external-skill-package-health-result.v1';
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const MAX_TRACKED_PACKAGES = 64;
const QUARANTINE_FAILURE_THRESHOLD = 3;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function redactFailureReason(value) {
  return String(value || 'external_skill_execution_failed')
    .replace(/[A-Za-z]:\\[^\s]+/gu, '<redacted-path>')
    .slice(0, 160);
}

function normalizeEntry(value) {
  if (!isRecord(value) || !PACKAGE_ID_PATTERN.test(String(value.packageId || '').trim())) {
    return null;
  }
  return {
    artifactDigest: typeof value.artifactDigest === 'string' ? value.artifactDigest : '',
    backoffUntil: Math.max(0, Number(value.backoffUntil) || 0),
    consecutiveFailures: Math.max(0, Math.round(Number(value.consecutiveFailures) || 0)),
    lastError: typeof value.lastError === 'string' ? redactFailureReason(value.lastError) : '',
    lastFailureAt: typeof value.lastFailureAt === 'string' ? value.lastFailureAt : null,
    lastSuccessAt: typeof value.lastSuccessAt === 'string' ? value.lastSuccessAt : null,
    packageId: String(value.packageId).trim(),
    quarantinedAt: typeof value.quarantinedAt === 'string' ? value.quarantinedAt : null,
    status: ['backoff', 'healthy', 'quarantined'].includes(value.status) ? value.status : 'healthy',
    totalFailures: Math.max(0, Math.round(Number(value.totalFailures) || 0)),
  };
}

function classifyExecutionResult(result) {
  if (result?.status === 'succeeded') {
    return { kind: 'success', reason: 'execution_succeeded' };
  }
  if (result?.status === 'timed-out') {
    return { kind: 'failure', reason: result.error || 'worker_timed_out' };
  }
  const workerReported = result?.workerReceipt?.kind === 'external-skill-sandbox-execution-receipt.v1';
  const workerExited = typeof result?.error === 'string' && /^worker_exit_/u.test(result.error);
  if (result?.status === 'failed' && (workerReported || workerExited)) {
    return { kind: 'failure', reason: result.error || 'worker_execution_failed' };
  }
  return { kind: 'ignored', reason: result?.error || result?.status || 'execution_not_attributable' };
}

function createExternalSkillPackageHealthService({ artifactStore, log, now = Date.now, rootPath } = {}) {
  if (typeof rootPath !== 'string' || !rootPath.trim()) {
    throw new Error('package_health_root_path_missing');
  }
  const healthStatePath = path.join(path.resolve(rootPath), HEALTH_FILE_NAME);
  const getNow = typeof now === 'function' ? now : Date.now;

  function readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(healthStatePath, 'utf8'));
      if (!isRecord(parsed) || parsed.kind !== HEALTH_STATE_KIND || !isRecord(parsed.packages)) {
        return { kind: HEALTH_STATE_KIND, packages: {} };
      }
      const packages = Object.fromEntries(Object.entries(parsed.packages)
        .map(([packageId, value]) => [packageId, normalizeEntry(value)])
        .filter(([, value]) => Boolean(value))
        .slice(0, MAX_TRACKED_PACKAGES));
      return { kind: HEALTH_STATE_KIND, packages };
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        log?.('External Skill package health read failed', { error: String(error) });
      }
      return { kind: HEALTH_STATE_KIND, packages: {} };
    }
  }

  function saveState(state) {
    try {
      const packages = Object.fromEntries(Object.entries(state.packages)
        .sort((left, right) => {
          const leftTime = Date.parse(left[1].lastFailureAt || left[1].lastSuccessAt || '') || 0;
          const rightTime = Date.parse(right[1].lastFailureAt || right[1].lastSuccessAt || '') || 0;
          return rightTime - leftTime;
        })
        .slice(0, MAX_TRACKED_PACKAGES));
      writeJsonAtomic(healthStatePath, {
        kind: HEALTH_STATE_KIND,
        packages,
        savedAt: new Date(getNow()).toISOString(),
      });
      return true;
    } catch (error) {
      log?.('External Skill package health write failed', { error: String(error) });
      return false;
    }
  }

  function getArtifact(packageId) {
    if (!artifactStore || typeof artifactStore.getPackage !== 'function') {
      return { artifact: null, error: 'artifact_store_unavailable', ok: false };
    }
    const result = artifactStore.getPackage(packageId);
    return result?.ok
      ? { artifact: result.package ?? null, ok: true }
      : { artifact: null, error: result?.error || 'artifact_lookup_failed', ok: false };
  }

  function createResult(packageId, entry, extras = {}) {
    const nowMs = Number(getNow());
    return {
      artifactDigest: entry?.artifactDigest || null,
      backoffUntil: entry?.backoffUntil || 0,
      consecutiveFailures: entry?.consecutiveFailures || 0,
      kind: HEALTH_RESULT_KIND,
      packageId,
      retryAfterMs: entry?.backoffUntil > nowMs ? entry.backoffUntil - nowMs : 0,
      status: entry?.status || 'untracked',
      totalFailures: entry?.totalFailures || 0,
      ...extras,
    };
  }

  function preflight(packageId) {
    const artifactResult = getArtifact(packageId);
    if (!artifactResult.ok || !artifactResult.artifact) {
      return createResult(packageId, null, { allowed: true, reason: artifactResult.error || 'artifact_not_tracked' });
    }
    const artifact = artifactResult.artifact;
    if (artifact.status === 'quarantined') {
      return createResult(packageId, {
        artifactDigest: artifact.artifactDigest,
        status: 'quarantined',
      }, { allowed: false, blocked: true, error: 'package_artifact_quarantined', reason: artifact.reason || 'artifact_quarantined' });
    }
    const state = readState();
    let entry = normalizeEntry(state.packages[packageId]);
    if (entry && entry.artifactDigest !== artifact.artifactDigest) {
      delete state.packages[packageId];
      saveState(state);
      entry = null;
    }
    if (!entry) {
      return createResult(packageId, {
        artifactDigest: artifact.artifactDigest,
        status: 'healthy',
      }, { allowed: true, reason: 'package_health_ready' });
    }
    if (entry.status === 'quarantined') {
      return createResult(packageId, entry, {
        allowed: false,
        blocked: true,
        error: 'external_skill_package_health_quarantined',
        reason: 'automatic_runtime_failure_threshold',
      });
    }
    const nowMs = Number(getNow());
    if (entry.backoffUntil > nowMs) {
      return createResult(packageId, entry, {
        allowed: false,
        blocked: true,
        error: 'external_skill_retry_backoff_active',
        reason: 'runtime_failure_backoff',
      });
    }
    return createResult(packageId, entry, { allowed: true, reason: 'package_health_ready' });
  }

  function recordExecutionResult(packageId, result) {
    const artifactResult = getArtifact(packageId);
    if (!artifactResult.ok || !artifactResult.artifact) {
      return createResult(packageId, null, {
        allowed: true,
        classification: 'ignored',
        reason: artifactResult.error || 'artifact_not_tracked',
      });
    }
    const artifact = artifactResult.artifact;
    const state = readState();
    const existing = normalizeEntry(state.packages[packageId]);
    const entry = existing?.artifactDigest === artifact.artifactDigest
      ? existing
      : {
        artifactDigest: artifact.artifactDigest,
        backoffUntil: 0,
        consecutiveFailures: 0,
        lastError: '',
        lastFailureAt: null,
        lastSuccessAt: null,
        packageId,
        quarantinedAt: null,
        status: 'healthy',
        totalFailures: 0,
      };
    const classification = classifyExecutionResult(result);
    if (classification.kind === 'ignored') {
      return createResult(packageId, entry, { allowed: true, classification: 'ignored', reason: classification.reason });
    }
    const nowMs = Number(getNow());
    const nowIso = new Date(nowMs).toISOString();
    if (classification.kind === 'success') {
      const healthy = {
        ...entry,
        backoffUntil: 0,
        consecutiveFailures: 0,
        lastError: '',
        lastSuccessAt: nowIso,
        quarantinedAt: null,
        status: 'healthy',
      };
      state.packages[packageId] = healthy;
      const statePersisted = saveState(state);
      return createResult(packageId, healthy, {
        allowed: true,
        classification: 'success',
        reason: classification.reason,
        statePersisted,
      });
    }
    const consecutiveFailures = entry.consecutiveFailures + 1;
    const failed = {
      ...entry,
      backoffUntil: 0,
      consecutiveFailures,
      lastError: redactFailureReason(classification.reason),
      lastFailureAt: nowIso,
      status: 'backoff',
      totalFailures: entry.totalFailures + 1,
    };
    if (consecutiveFailures >= QUARANTINE_FAILURE_THRESHOLD) {
      const quarantineResult = typeof artifactStore.quarantinePackage === 'function'
        ? artifactStore.quarantinePackage(packageId, 'automatic_runtime_failure_threshold')
        : { error: 'artifact_quarantine_unavailable', ok: false };
      failed.backoffUntil = 0;
      failed.quarantinedAt = nowIso;
      failed.status = 'quarantined';
      state.packages[packageId] = failed;
      const statePersisted = saveState(state);
      return createResult(packageId, failed, {
        allowed: false,
        blocked: true,
        classification: 'failure',
        error: quarantineResult.ok ? 'package_artifact_quarantined' : 'external_skill_package_health_quarantined',
        quarantineApplied: Boolean(quarantineResult.ok),
        quarantineError: quarantineResult.error || null,
        reason: 'automatic_runtime_failure_threshold',
        statePersisted,
      });
    }
    const backoffMs = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * (2 ** (consecutiveFailures - 1)));
    failed.backoffUntil = nowMs + backoffMs;
    state.packages[packageId] = failed;
    const statePersisted = saveState(state);
    return createResult(packageId, failed, {
      allowed: false,
      classification: 'failure',
      reason: 'runtime_failure_backoff',
      statePersisted,
    });
  }

  function listHealth(request = {}) {
    const packageId = typeof request.packageId === 'string' ? request.packageId.trim() : '';
    const entries = Object.values(readState().packages)
      .map(normalizeEntry)
      .filter((entry) => entry && (!packageId || entry.packageId === packageId));
    return {
      entries,
      kind: HEALTH_STATE_KIND,
      ok: true,
      path: healthStatePath,
      totalCount: entries.length,
    };
  }

  function resetHealth(request = {}) {
    const packageId = typeof request.packageId === 'string' ? request.packageId.trim() : '';
    if (!PACKAGE_ID_PATTERN.test(packageId)) {
      return { error: 'invalid_package_id', ok: false };
    }
    const artifactResult = getArtifact(packageId);
    if (artifactResult.artifact?.status === 'quarantined') {
      return { error: 'package_artifact_quarantined', ok: false };
    }
    const state = readState();
    const reset = Boolean(state.packages[packageId]);
    delete state.packages[packageId];
    return { ok: saveState(state), packageId, reset };
  }

  return {
    getPaths: () => ({ healthStatePath }),
    listHealth,
    preflight,
    recordExecutionResult,
    resetHealth,
  };
}

module.exports = {
  HEALTH_FILE_NAME,
  createExternalSkillPackageHealthService,
};
