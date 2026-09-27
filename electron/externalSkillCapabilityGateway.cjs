const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  createCapabilityResponseInput,
  parseCapabilityRequest,
} = require('./externalSkillCapabilityProtocol.cjs');
const {
  createExternalSkillCapabilityAuditService,
} = require('./externalSkillCapabilityAuditService.cjs');
const {
  createExternalSkillPackageHealthService,
} = require('./externalSkillPackageHealthService.cjs');
const {
  createExternalSkillReleaseAdmissionService,
} = require('./externalSkillReleaseAdmissionService.cjs');
const {
  createExternalSkillMarketplacePublisherIdentityService,
} = require('./externalSkillMarketplacePublisherIdentityService.cjs');

const GRANT_FILE_NAME = 'external-skill-capability-grants.v1.json';
const STORAGE_FILE_NAME = 'external-skill-capability-storage.v1.json';
const GRANT_KIND = 'external-skill-capability-grants.v1';
const STORAGE_KIND = 'external-skill-capability-storage.v1';
const RECEIPT_KIND = 'external-skill-capability-receipt.v1';
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u;
const MAX_GRANTS = 24;
const STORAGE_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/u;
const MAX_STORAGE_VALUE_BYTES = 4 * 1024;
const MAX_CAPABILITY_CALLS_PER_EXECUTION = 1;
const DEFAULT_CAPABILITY_FLOW_TIMEOUT_MS = 10000;
const MAX_CAPABILITY_FLOW_TIMEOUT_MS = 15000;
const SUPPORTED_SCOPES = new Set([
  'filesystem.read',
  'filesystem.write',
  'network.connect',
  'screen.read',
  'desktop.control',
  'message.send',
  'commerce.execute',
  'process.execute',
  'storage.read',
  'storage.write',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeId(value, name, pattern) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!pattern.test(normalized)) {
    throw new Error(`invalid_${name}`);
  }
  return normalized;
}

function normalizeScopes(value) {
  return Array.isArray(value)
    ? [...new Set(value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean))]
    : [];
}

function normalizeFlowTimeoutMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_CAPABILITY_FLOW_TIMEOUT_MS;
  }
  return Math.max(1000, Math.min(MAX_CAPABILITY_FLOW_TIMEOUT_MS, Math.round(numeric)));
}

function createChildRequestId(requestId, phase) {
  const digest = crypto.createHash('sha256').update(`${requestId}:${phase}`).digest('hex').slice(0, 12);
  return `${requestId.slice(0, 80)}:${phase}:${digest}`;
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function createEmptyRegistry() {
  return { grants: [], kind: GRANT_KIND };
}

function normalizeGrant(value) {
  if (!isRecord(value) || !PACKAGE_ID_PATTERN.test(String(value.packageId || '').trim())) {
    return null;
  }
  const scopes = normalizeScopes(value.scopes).filter((scope) => SUPPORTED_SCOPES.has(scope));
  return {
    artifactDigest: typeof value.artifactDigest === 'string' ? value.artifactDigest.trim() : '',
    packageId: String(value.packageId).trim(),
    reviewedAt: typeof value.reviewedAt === 'string' && value.reviewedAt.trim()
      ? value.reviewedAt.trim()
      : new Date(0).toISOString(),
    scopes,
    skillId: typeof value.skillId === 'string' ? value.skillId.trim() : '',
  };
}

function parseRegistry(rawText) {
  if (!rawText?.trim()) {
    return createEmptyRegistry();
  }
  try {
    const parsed = JSON.parse(rawText);
    if (!isRecord(parsed) || parsed.kind !== GRANT_KIND || !Array.isArray(parsed.grants)) {
      return createEmptyRegistry();
    }
    return {
      grants: parsed.grants.map(normalizeGrant).filter(Boolean).slice(0, MAX_GRANTS),
      kind: GRANT_KIND,
    };
  } catch {
    return createEmptyRegistry();
  }
}

function writeRegistry(filePath, registry) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(tempPath, JSON.stringify(registry, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function createCapabilityReceipt({
  artifactDigest = null,
  decision,
  packageId,
  requestId,
  requestedScopes,
  status,
  reason,
  grantedScopes = [],
  rateLimit = null,
  usedScopes = [],
}) {
  return {
    artifactDigest,
    grantedScopes,
    kind: RECEIPT_KIND,
    packageId,
    rateLimit,
    reason,
    receiptId: `capability-receipt-${crypto.randomUUID()}`,
    requestId,
    requestedScopes,
    status,
    decision,
    usedScopes,
    writtenAt: new Date().toISOString(),
  };
}

function createExternalSkillCapabilityGateway({
  artifactStore,
  auditService,
  healthService,
  hostContext,
  marketplacePublisherIdentityService,
  releaseAdmissionService,
  supervisor,
  userDataPath,
  log,
  now,
} = {}) {
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) {
    throw new Error('user_data_path_missing');
  }
  const rootPath = path.join(path.resolve(userDataPath), 'skill-capabilities-v1');
  const grantPath = path.join(rootPath, GRANT_FILE_NAME);
  const storagePath = path.join(rootPath, STORAGE_FILE_NAME);
  const activeFlows = new Map();
  const capabilityAudit = auditService ?? createExternalSkillCapabilityAuditService({ log, now, rootPath });
  const packageHealth = healthService ?? createExternalSkillPackageHealthService({
    artifactStore,
    log,
    now,
    rootPath: path.join(path.resolve(userDataPath), 'external-skill-runtime-health-v1'),
  });
  const marketplacePublisherIdentity = marketplacePublisherIdentityService
    ?? createExternalSkillMarketplacePublisherIdentityService({ userDataPath });
  const releaseAdmission = releaseAdmissionService ?? createExternalSkillReleaseAdmissionService({
    artifactStore,
    healthService: packageHealth,
    hostContext,
    publisherIdentityService: marketplacePublisherIdentity,
    now,
  });

  function recordResultReceipts(result) {
    const candidates = [result?.capabilityReceipt, ...(Array.isArray(result?.capabilityReceipts)
      ? result.capabilityReceipts
      : [])].filter(Boolean);
    const seen = new Set();
    candidates.forEach((receipt) => {
      const key = receipt.receiptId || `${receipt.requestId}:${receipt.status}:${receipt.reason}:${receipt.writtenAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        capabilityAudit.recordReceipt(receipt);
      }
    });
    return result;
  }

  function loadRegistry() {
    try {
      return parseRegistry(fs.readFileSync(grantPath, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return createEmptyRegistry();
      }
      log?.('Skill capability grant registry read failed', { error: String(error) });
      return createEmptyRegistry();
    }
  }

  function saveRegistry(registry) {
    writeRegistry(grantPath, registry);
    return { ok: true, path: grantPath };
  }

  function readStorageRegistry() {
    try {
      const parsed = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
      return isRecord(parsed) && parsed.kind === STORAGE_KIND && isRecord(parsed.packages)
        ? parsed
        : { kind: STORAGE_KIND, packages: {} };
    } catch {
      return { kind: STORAGE_KIND, packages: {} };
    }
  }

  function getGrant(packageId, registry = loadRegistry()) {
    return registry.grants.find((grant) => grant.packageId === packageId) ?? null;
  }

  function inspectPackage(packageId) {
    if (!artifactStore || typeof artifactStore.readPackageArtifact !== 'function') {
      return { error: 'artifact_store_unavailable', ok: false };
    }
    const artifactResult = artifactStore.readPackageArtifact(packageId);
    if (!artifactResult.ok) {
      return { error: artifactResult.error, ok: false };
    }
    try {
      const parsed = JSON.parse(artifactResult.rawPackageJson);
      return {
        artifactDigest: artifactResult.artifact?.artifactDigest ?? null,
        capabilityEntrypoint: typeof parsed?.runtime?.capabilityEntrypoint === 'string'
          ? parsed.runtime.capabilityEntrypoint.trim()
          : '',
        ok: true,
        runtimeKind: typeof parsed?.runtime?.kind === 'string' ? parsed.runtime.kind : '',
        skillId: typeof parsed?.scaffold?.skill?.id === 'string' ? parsed.scaffold.skill.id.trim() : '',
      };
    } catch {
      return { error: 'package_artifact_invalid', ok: false };
    }
  }

  function listGrants() {
    return { grants: loadRegistry().grants, kind: GRANT_KIND, path: grantPath };
  }

  function setGrant(request = {}) {
    try {
      const packageId = normalizeId(request.packageId, 'package_id', PACKAGE_ID_PATTERN);
      const requestedScopes = normalizeScopes(request.scopes);
      if (requestedScopes.some((scope) => !SUPPORTED_SCOPES.has(scope))) {
        return { error: 'permission_scope_unsupported', ok: false };
      }
      const packageInfo = inspectPackage(packageId);
      if (!packageInfo.ok || !packageInfo.skillId) {
        return { error: packageInfo.error || 'package_skill_id_missing', ok: false };
      }
      const registry = loadRegistry();
      const grant = {
        artifactDigest: packageInfo.artifactDigest,
        packageId,
        reviewedAt: new Date().toISOString(),
        scopes: requestedScopes,
        skillId: packageInfo.skillId,
      };
      const nextRegistry = {
        grants: [grant, ...registry.grants.filter((item) => item.packageId !== packageId)].slice(0, MAX_GRANTS),
        kind: GRANT_KIND,
      };
      saveRegistry(nextRegistry);
      log?.('Skill capability grant persisted', { packageId, scopeCount: requestedScopes.length });
      return { grant, ok: true, registry: nextRegistry };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function revokeGrant(request = {}) {
    try {
      const packageId = normalizeId(request.packageId, 'package_id', PACKAGE_ID_PATTERN);
      const registry = loadRegistry();
      const nextRegistry = {
        grants: registry.grants.filter((item) => item.packageId !== packageId),
        kind: GRANT_KIND,
      };
      saveRegistry(nextRegistry);
      return { ok: true, registry: nextRegistry, revoked: registry.grants.length !== nextRegistry.grants.length };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function decide(request = {}) {
    const packageId = normalizeId(request.packageId, 'package_id', PACKAGE_ID_PATTERN);
    const requestedScopes = normalizeScopes(request.permissionScopes);
    const packageInfo = inspectPackage(packageId);
    const grant = getGrant(packageId);
    const allowedScopes = grant?.scopes ?? [];
    const unknownScopes = requestedScopes.filter((scope) => !SUPPORTED_SCOPES.has(scope));
    const missingScopes = requestedScopes.filter((scope) => !allowedScopes.includes(scope));
    const issueCodes = [...new Set([
      !packageInfo.ok ? `package_${packageInfo.error}` : '',
      packageInfo.ok && grant && grant.skillId !== packageInfo.skillId ? 'permission_grant_stale' : '',
      packageInfo.ok && grant && grant.artifactDigest !== packageInfo.artifactDigest ? 'permission_grant_stale' : '',
      unknownScopes.length ? 'permission_scope_unsupported' : '',
      !requestedScopes.length || (grant && grant.skillId) ? '' : 'permission_grant_missing',
      missingScopes.length ? 'permission_scope_not_granted' : '',
    ].filter(Boolean))];
    return {
      allowedScopes,
      artifactDigest: packageInfo.artifactDigest,
      issueCodes,
      packageId,
      requestedScopes,
      status: issueCodes.length ? 'denied' : 'allowed',
    };
  }

  async function runPackageExecutionInternal(request = {}) {
    const packageId = normalizeId(request.packageId, 'package_id', PACKAGE_ID_PATTERN);
    const requestId = normalizeId(request.requestId, 'request_id', REQUEST_ID_PATTERN);
    const requestedScopes = normalizeScopes(request.permissionScopes);
    const decision = decide({ packageId, permissionScopes: requestedScopes });
    if (activeFlows.has(requestId)) {
      return { error: 'duplicate_request_id', packageCodeLoaded: false, packageId, requestId, status: 'rejected' };
    }
    if (requestedScopes.length) {
      const allowed = decision.status === 'allowed';
      return {
        capabilityDecision: decision,
        capabilityReceipt: createCapabilityReceipt({
          artifactDigest: decision.artifactDigest,
          decision: allowed ? 'allowed-but-disabled' : 'denied',
          grantedScopes: decision.allowedScopes,
          packageId,
          reason: allowed ? 'capability_execution_not_implemented' : decision.issueCodes.join(','),
          requestId,
          requestedScopes,
          status: allowed ? 'blocked' : 'denied',
        }),
        error: allowed ? 'capability_execution_not_implemented' : 'external_permission_not_granted',
        packageCodeLoaded: false,
        packageId,
        requestId,
        status: 'rejected',
      };
    }
    const healthPreflight = packageHealth.preflight(packageId);
    if (!healthPreflight.allowed) {
      return {
        error: healthPreflight.error,
        packageCodeLoaded: false,
        packageHealth: healthPreflight,
        packageId,
        requestId,
        status: 'rejected',
      };
    }
    const startedAt = Date.now();
    const deadline = startedAt + normalizeFlowTimeoutMs(request.timeoutMs);
    activeFlows.set(requestId, requestId);
    try {
      const result = await supervisor.runPackageExecution({
        ...request,
        executionPhase: 'primary',
        packageId,
        permissionScopes: [],
        requestId,
        timeoutMs: Math.max(500, deadline - Date.now()),
      });
      const zeroCapabilityResult = {
        ...result,
        capabilityDecision: decision,
        capabilityReceipt: createCapabilityReceipt({
          artifactDigest: decision.artifactDigest,
          decision: 'not-requested',
          packageId,
          reason: 'zero-capability-execution',
          requestId,
          requestedScopes: [],
          status: 'not-requested',
        }),
      };
      if (result.status !== 'succeeded') {
        return zeroCapabilityResult;
      }
      const parsedRequest = parseCapabilityRequest(result.output);
      if (parsedRequest.status === 'not-requested') {
        return zeroCapabilityResult;
      }
      if (parsedRequest.status === 'invalid') {
        return {
          ...zeroCapabilityResult,
          capabilityFlow: { calls: 0, maxCalls: MAX_CAPABILITY_CALLS_PER_EXECUTION, status: 'invalid-request' },
          error: parsedRequest.error,
          output: undefined,
          status: 'failed',
        };
      }
      const packageInfo = inspectPackage(packageId);
      if (
        packageInfo.runtimeKind !== 'wasm-pure-json-v1'
        || !packageInfo.capabilityEntrypoint
      ) {
        return {
          ...zeroCapabilityResult,
          capabilityFlow: { calls: 0, maxCalls: MAX_CAPABILITY_CALLS_PER_EXECUTION, status: 'resume-unavailable' },
          error: 'capability_resume_entrypoint_missing',
          output: undefined,
          status: 'failed',
        };
      }
      const capabilityRequest = parsedRequest.request;
      const capabilityResult = readStorageValueInternal({
        key: capabilityRequest.key,
        packageId,
        permissionScopes: [capabilityRequest.scope],
        requestId: createChildRequestId(requestId, 'capability-1'),
      });
      const remainingMs = deadline - Date.now();
      if (remainingMs < 500) {
        return {
          ...zeroCapabilityResult,
          capabilityDecision: capabilityResult.capabilityDecision,
          capabilityFlow: { calls: 1, maxCalls: MAX_CAPABILITY_CALLS_PER_EXECUTION, status: 'timed-out' },
          capabilityReceipt: capabilityResult.capabilityReceipt,
          capabilityReceipts: [capabilityResult.capabilityReceipt].filter(Boolean),
          error: 'capability_flow_timed_out',
          output: undefined,
          status: 'timed-out',
        };
      }
      const resumeRequestId = createChildRequestId(requestId, 'resume-1');
      activeFlows.set(requestId, resumeRequestId);
      const resumed = await supervisor.runPackageExecution({
        executionPhase: 'capability-response',
        input: createCapabilityResponseInput(capabilityRequest, capabilityResult),
        packageId,
        permissionScopes: [],
        requestId: resumeRequestId,
        timeoutMs: remainingMs,
      });
      const resumedRequest = resumed.status === 'succeeded'
        ? parseCapabilityRequest(resumed.output)
        : { status: 'not-requested' };
      if (resumedRequest.status !== 'not-requested') {
        return {
          ...resumed,
          capabilityDecision: capabilityResult.capabilityDecision,
          capabilityFlow: { calls: 1, maxCalls: MAX_CAPABILITY_CALLS_PER_EXECUTION, status: 'quota-exceeded' },
          capabilityReceipt: capabilityResult.capabilityReceipt,
          capabilityReceipts: [capabilityResult.capabilityReceipt].filter(Boolean),
          error: 'capability_call_quota_exceeded',
          output: undefined,
          requestId,
          status: 'rejected',
        };
      }
      return {
        ...resumed,
        capabilityDecision: capabilityResult.capabilityDecision,
        capabilityFlow: {
          calls: 1,
          maxCalls: MAX_CAPABILITY_CALLS_PER_EXECUTION,
          status: resumed.status !== 'succeeded'
            ? `resume-${resumed.status}`
            : capabilityResult.status === 'succeeded'
              ? 'completed'
              : 'recovered-with-capability-error',
        },
        capabilityReceipt: capabilityResult.capabilityReceipt,
        capabilityReceipts: [capabilityResult.capabilityReceipt].filter(Boolean),
        requestId,
        workerRequestIds: [result.requestId, resumed.requestId],
      };
    } finally {
      activeFlows.delete(requestId);
    }
  }

  async function runPackageExecution(request = {}) {
    const result = await runPackageExecutionInternal(request);
    const withHealth = result.packageHealth
      ? result
      : { ...result, packageHealth: packageHealth.recordExecutionResult(result.packageId, result) };
    return recordResultReceipts(withHealth);
  }

  function cancelExecution(requestId) {
    const normalizedRequestId = typeof requestId === 'string' ? requestId.trim() : '';
    const workerRequestId = activeFlows.get(normalizedRequestId) ?? normalizedRequestId;
    const result = supervisor.cancelProbe(workerRequestId);
    return { ...result, requestId: normalizedRequestId, workerRequestId };
  }

  function readStorageValueInternal(request = {}) {
    try {
      const packageId = normalizeId(request.packageId, 'package_id', PACKAGE_ID_PATTERN);
      const requestId = normalizeId(request.requestId, 'request_id', REQUEST_ID_PATTERN);
      const key = typeof request.key === 'string' ? request.key.trim() : '';
      const requestedScopes = normalizeScopes(request.permissionScopes);
      const decision = decide({ packageId, permissionScopes: requestedScopes });
      const receiptBase = {
        artifactDigest: decision.artifactDigest,
        decision: decision.status === 'allowed' ? 'allowed' : 'denied',
        grantedScopes: decision.allowedScopes,
        packageId,
        requestId,
        requestedScopes,
      };
      if (requestedScopes.length !== 1 || requestedScopes[0] !== 'storage.read') {
        return {
          capabilityDecision: decision,
          capabilityReceipt: createCapabilityReceipt({
            ...receiptBase,
            reason: 'capability_scope_mismatch',
            status: 'denied',
          }),
          error: 'capability_scope_mismatch',
          status: 'rejected',
        };
      }
      if (decision.status !== 'allowed') {
        return {
          capabilityDecision: decision,
          capabilityReceipt: createCapabilityReceipt({
            ...receiptBase,
            reason: decision.issueCodes.join(','),
            status: 'denied',
          }),
          error: 'external_permission_not_granted',
          status: 'rejected',
        };
      }
      const capabilityRateLimit = capabilityAudit.consumeStorageRead(packageId);
      if (!capabilityRateLimit.allowed) {
        return {
          capabilityDecision: decision,
          capabilityRateLimit,
          capabilityReceipt: createCapabilityReceipt({
            ...receiptBase,
            decision: 'allowed-but-rate-limited',
            rateLimit: capabilityRateLimit,
            reason: 'capability_storage_rate_limited',
            status: 'rate-limited',
          }),
          error: 'capability_storage_rate_limited',
          status: 'rejected',
        };
      }
      if (!STORAGE_KEY_PATTERN.test(key)) {
        return {
          capabilityDecision: decision,
          capabilityRateLimit,
          capabilityReceipt: createCapabilityReceipt({
            ...receiptBase,
            rateLimit: capabilityRateLimit,
            reason: 'capability_storage_key_invalid',
            status: 'failed',
          }),
          error: 'capability_storage_key_invalid',
          status: 'failed',
        };
      }
      const storage = readStorageRegistry();
      const packageValues = isRecord(storage.packages[packageId]) ? storage.packages[packageId] : null;
      if (!packageValues || !Object.prototype.hasOwnProperty.call(packageValues, key)) {
        return {
          capabilityDecision: decision,
          capabilityRateLimit,
          capabilityReceipt: createCapabilityReceipt({
            ...receiptBase,
            rateLimit: capabilityRateLimit,
            reason: 'capability_storage_key_not_found',
            status: 'failed',
          }),
          error: 'capability_storage_key_not_found',
          status: 'failed',
        };
      }
      const value = packageValues[key];
      if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_STORAGE_VALUE_BYTES) {
        return {
          capabilityDecision: decision,
          capabilityRateLimit,
          capabilityReceipt: createCapabilityReceipt({
            ...receiptBase,
            rateLimit: capabilityRateLimit,
            reason: 'capability_storage_value_too_large',
            status: 'failed',
          }),
          error: 'capability_storage_value_too_large',
          status: 'failed',
        };
      }
      return {
        capabilityDecision: decision,
        capabilityRateLimit,
        capabilityReceipt: createCapabilityReceipt({
          ...receiptBase,
          decision: 'allowed',
          rateLimit: capabilityRateLimit,
          reason: 'storage_read',
          status: 'executed',
          usedScopes: ['storage.read'],
        }),
        capabilityValue: value,
        status: 'succeeded',
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), status: 'failed' };
    }
  }

  function readStorageValue(request = {}) {
    return recordResultReceipts(readStorageValueInternal(request));
  }

  return {
    cancelExecution,
    clearReceiptHistory: capabilityAudit.clearReceipts,
    createReleaseAdmissionReport: releaseAdmission.createAdmissionReport,
    decide,
    getPaths: () => ({
      grantPath,
      rootPath,
      storagePath,
      ...capabilityAudit.getPaths(),
      ...packageHealth.getPaths(),
    }),
    exportPackageHealthDiagnostics: releaseAdmission.exportHealthDiagnostics,
    exportReleaseAdmissionReport: releaseAdmission.exportAdmissionReport,
    listGrants,
    listPackageHealth: packageHealth.listHealth,
    listReceiptHistory: capabilityAudit.listReceipts,
    readStorageValue,
    revokeGrant,
    runPackageExecution,
    resetPackageHealth: packageHealth.resetHealth,
    setGrant,
  };
}

module.exports = { createExternalSkillCapabilityGateway };
