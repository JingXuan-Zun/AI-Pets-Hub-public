const crypto = require('crypto');

const MAX_PACKAGE_IDS = 24;
const MAX_WASM_BYTES = 64 * 1024;
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const ENTRYPOINT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/u;
const REPORT_KIND = 'external-skill-release-admission-report.v1';
const HEALTH_DIAGNOSTICS_KIND = 'external-skill-package-health-diagnostics.v1';
const SUPPORTED_RUNTIME_KINDS = new Set(['wasm-pure-i32-v1', 'wasm-pure-json-v1']);
const ARCHIVE_VERIFICATION_KIND = 'agent-skill-package-archive-verification.v1';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizePackageIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => PACKAGE_ID_PATTERN.test(item)))]
    .slice(0, MAX_PACKAGE_IDS);
}

function createCheck(id, status, detail) {
  return { detail, id, status };
}

function createHostContext(value = {}) {
  return {
    arch: typeof value.arch === 'string' ? value.arch : process.arch,
    electronVersion: typeof value.electronVersion === 'string' ? value.electronVersion : process.versions.electron ?? null,
    nodeVersion: typeof value.nodeVersion === 'string' ? value.nodeVersion : process.versions.node,
    packaged: Boolean(value.packaged),
    platform: typeof value.platform === 'string' ? value.platform : process.platform,
  };
}

function inspectWasmRuntime(rawPackageJson) {
  const checks = [];
  let packageValue;
  try {
    packageValue = JSON.parse(rawPackageJson);
  } catch {
    return {
      checks: [createCheck('package-json', 'fail', 'Package JSON could not be parsed.')],
      runtimeKind: 'unknown',
    };
  }
  const runtime = isRecord(packageValue?.runtime) ? packageValue.runtime : null;
  const runtimeKind = typeof runtime?.kind === 'string' ? runtime.kind : 'unknown';
  checks.push(createCheck(
    'runtime-kind',
    SUPPORTED_RUNTIME_KINDS.has(runtimeKind) ? 'pass' : 'fail',
    SUPPORTED_RUNTIME_KINDS.has(runtimeKind) ? runtimeKind : 'Runtime kind is not in the controlled WASM allowlist.',
  ));
  const moduleBase64 = typeof runtime?.moduleBase64 === 'string' ? runtime.moduleBase64.trim() : '';
  const moduleBytes = moduleBase64 ? Buffer.from(moduleBase64, 'base64') : Buffer.alloc(0);
  const moduleSizeValid = moduleBytes.length > 0 && moduleBytes.length <= MAX_WASM_BYTES;
  checks.push(createCheck(
    'wasm-module-size',
    moduleSizeValid ? 'pass' : 'fail',
    moduleSizeValid ? `${moduleBytes.length} bytes` : 'WASM module is missing, empty, or above 64 KiB.',
  ));
  if (!moduleSizeValid) {
    return { checks, runtimeKind };
  }
  let module;
  try {
    module = new WebAssembly.Module(moduleBytes);
    checks.push(createCheck('wasm-compile', 'pass', 'WASM module compiled without instantiation.'));
  } catch {
    checks.push(createCheck('wasm-compile', 'fail', 'WASM module compilation failed.'));
    return { checks, runtimeKind };
  }
  const imports = WebAssembly.Module.imports(module);
  checks.push(createCheck(
    'wasm-imports',
    imports.length ? 'fail' : 'pass',
    imports.length ? `WASM declares ${imports.length} import(s).` : 'WASM declares no imports.',
  ));
  const exports = WebAssembly.Module.exports(module);
  const entrypoint = typeof runtime?.entrypoint === 'string' ? runtime.entrypoint.trim() : '';
  const primaryExported = ENTRYPOINT_PATTERN.test(entrypoint)
    && exports.some((item) => item.name === entrypoint && item.kind === 'function');
  checks.push(createCheck(
    'primary-entrypoint',
    primaryExported ? 'pass' : 'fail',
    primaryExported ? entrypoint : 'Primary entrypoint is missing or is not an exported function.',
  ));
  if (runtimeKind === 'wasm-pure-json-v1') {
    const memoryExported = exports.some((item) => item.name === 'memory' && item.kind === 'memory');
    checks.push(createCheck(
      'json-memory-export',
      memoryExported ? 'pass' : 'fail',
      memoryExported ? 'JSON ABI memory export is present.' : 'JSON ABI requires an exported memory named memory.',
    ));
  } else {
    checks.push(createCheck('json-memory-export', 'not-applicable', 'Runtime does not use the JSON ABI.'));
  }
  const capabilityEntrypoint = typeof runtime?.capabilityEntrypoint === 'string'
    ? runtime.capabilityEntrypoint.trim()
    : '';
  if (!capabilityEntrypoint) {
    checks.push(createCheck('capability-entrypoint', 'not-applicable', 'Package does not declare a capability response entrypoint.'));
  } else {
    const capabilityExported = runtimeKind === 'wasm-pure-json-v1'
      && ENTRYPOINT_PATTERN.test(capabilityEntrypoint)
      && exports.some((item) => item.name === capabilityEntrypoint && item.kind === 'function');
    checks.push(createCheck(
      'capability-entrypoint',
      capabilityExported ? 'pass' : 'fail',
      capabilityExported
        ? capabilityEntrypoint
        : 'Capability entrypoint requires the JSON ABI and an exported function.',
    ));
  }
  return { checks, runtimeKind };
}

function inspectSigningKeyMigration(artifact, rawPackageJson) {
  let packageValue;
  try {
    packageValue = JSON.parse(rawPackageJson);
  } catch {
    return createCheck('signing-key-migration', 'fail', 'Package migration declaration could not be parsed.');
  }
  const declaration = isRecord(packageValue?.security) && isRecord(packageValue.security.keyMigration)
    ? packageValue.security.keyMigration
    : null;
  if (!declaration) {
    return createCheck('signing-key-migration', 'not-applicable', 'Package does not declare a signing-key migration.');
  }
  const verification = artifact.signatureVerification ?? {};
  const evidence = isRecord(verification.keyMigration) ? verification.keyMigration : null;
  const valid = evidence?.status === 'verified'
    && evidence.verifier === 'main-process-ed25519-dual-signature'
    && evidence.fromKeyId === declaration.fromKeyId
    && evidence.fromKeyFingerprint === declaration.fromKeyFingerprint
    && evidence.toKeyId === declaration.toKeyId
    && evidence.toKeyFingerprint === declaration.toKeyFingerprint
    && evidence.publisherId === declaration.publisherId
    && evidence.toKeyId === verification.keyId
    && evidence.toKeyFingerprint === verification.keyFingerprint
    && evidence.publisherId === verification.publisherId
    && evidence.fromKeyId !== evidence.toKeyId;
  return createCheck(
    'signing-key-migration',
    valid ? 'pass' : 'fail',
    valid
      ? `Dual-signature migration from ${evidence.fromKeyId} to ${evidence.toKeyId} is verified.`
      : 'Signing-key migration declaration does not match persisted dual-signature evidence.',
  );
}

function inspectArchiveProvenance(artifact, rawPackageJson) {
  const evidence = isRecord(artifact.archiveVerification) ? artifact.archiveVerification : null;
  let packageValue;
  try {
    packageValue = JSON.parse(rawPackageJson);
  } catch {
    packageValue = null;
  }
  const distribution = isRecord(packageValue?.distribution) ? packageValue.distribution : null;
  const artifactDigest = packageValue
    ? crypto.createHash('sha256').update(`${JSON.stringify(packageValue)}\n`).digest('hex')
    : null;
  const valid = evidence?.kind === ARCHIVE_VERIFICATION_KIND
    && evidence.status === 'verified'
    && evidence.verifier === 'main-process-package-archive-v1'
    && evidence.formatVersion === 1
    && evidence.artifactDigest === artifact.artifactDigest
    && evidence.artifactDigest === artifactDigest
    && evidence.packageId === artifact.packageId
    && /^[a-f0-9]{64}$/u.test(evidence.archiveDigest ?? '')
    && /^[a-f0-9]{64}$/u.test(evidence.archivePackageSha256 ?? '')
    && distribution?.kind === 'agent-skill-package-distribution.v1'
    && evidence.packageId === distribution.packageId
    && evidence.publisherId === distribution.publisherId
    && evidence.skillId === distribution.skillId
    && evidence.version === distribution.version
    && Number.isFinite(Date.parse(evidence.verifiedAt));
  return createCheck(
    'package-archive-provenance',
    valid ? 'pass' : 'fail',
    valid
      ? `Archive ${evidence.archiveDigest.slice(0, 12)} is bound to ${evidence.packageId}@${evidence.version}.`
      : 'Artifact does not carry matching host-verified package archive provenance.',
  );
}

function createSummary(rows) {
  const summary = {
    blocked: 0,
    eligible: 0,
    marketplacePublisherBlocked: 0,
    marketplacePublisherVerified: 0,
    'review-required': 0,
    total: rows.length,
  };
  rows.forEach((row) => {
    summary[row.controlledRuntimeStatus === 'controlled-runtime-eligible'
      ? 'eligible'
      : row.controlledRuntimeStatus] += 1;
    summary[row.marketplacePublisherIdentity?.status === 'verified'
      ? 'marketplacePublisherVerified'
      : 'marketplacePublisherBlocked'] += 1;
  });
  return summary;
}

function createExternalSkillReleaseAdmissionService({
  artifactStore,
  healthService,
  hostContext,
  publisherIdentityService,
  now = Date.now,
} = {}) {
  const host = createHostContext(hostContext);
  const getNow = typeof now === 'function' ? now : Date.now;
  const publisherIdentity = publisherIdentityService?.assessArtifact
    ? publisherIdentityService
    : {
      assessArtifact: () => ({
        issueCodes: ['marketplace-publisher-assessment-unavailable'],
        keyFingerprint: null,
        keyId: null,
        kind: 'external-skill-marketplace-publisher-assessment.v1',
        publisherId: null,
        registryStatus: 'unavailable',
        status: 'blocked',
      }),
    };

  function createCompatibilityRow(artifact) {
    const checks = [];
    let runtimeKind = 'unknown';
    checks.push(createCheck(
      'artifact-status',
      artifact.status === 'staged' ? 'pass' : 'fail',
      artifact.status === 'staged' ? 'Artifact is staged.' : `Artifact status is ${artifact.status || 'unknown'}.`,
    ));
    const signatureVerified = artifact.signatureVerification?.status === 'verified'
      && artifact.signatureVerification?.verifier === 'main-process-ed25519';
    checks.push(createCheck(
      'signature-verification',
      signatureVerified ? 'pass' : 'fail',
      signatureVerified
        ? `Verified by ${artifact.signatureVerification.keyId || 'trusted-key'}.`
        : 'Artifact does not carry main-process Ed25519 staging evidence.',
    ));
    const readResult = artifactStore.readPackageArtifact(artifact.packageId);
    if (!readResult.ok) {
      checks.push(createCheck('artifact-integrity', 'fail', readResult.error || 'Artifact could not be read.'));
    } else {
      checks.push(createCheck('artifact-integrity', 'pass', 'Artifact digest verification passed.'));
      checks.push(inspectSigningKeyMigration(artifact, readResult.rawPackageJson));
      const runtimeInspection = inspectWasmRuntime(readResult.rawPackageJson);
      runtimeKind = runtimeInspection.runtimeKind;
      checks.push(...runtimeInspection.checks);
    }
    const health = healthService.preflight(artifact.packageId);
    const healthStatus = !health.allowed
      ? 'fail'
      : health.consecutiveFailures > 0
        ? 'warning'
        : 'pass';
    checks.push(createCheck(
      'package-health',
      healthStatus,
      !health.allowed
        ? health.error || health.reason
        : health.consecutiveFailures > 0
          ? `Package has ${health.consecutiveFailures} prior consecutive failure(s).`
          : 'Package health permits execution.',
    ));
    checks.push(createCheck(
      'host-platform',
      host.platform === 'win32' ? 'pass' : 'fail',
      host.platform === 'win32' ? `Windows ${host.arch}` : `Unsupported host platform ${host.platform}.`,
    ));
    checks.push(createCheck(
      'packaged-runtime-evidence',
      host.packaged ? 'pass' : 'warning',
      host.packaged ? 'Report was generated by a packaged runtime.' : 'Packaged runtime validation is still required.',
    ));
    const failedChecks = checks.filter((check) => check.status === 'fail');
    const warningChecks = checks.filter((check) => check.status === 'warning');
    const controlledRuntimeStatus = failedChecks.length
      ? 'blocked'
      : warningChecks.length
        ? 'review-required'
        : 'controlled-runtime-eligible';
    const compatibilityIssueCodes = [...failedChecks, ...warningChecks].map((check) => check.id);
    const marketplacePublisherIdentity = publisherIdentity.assessArtifact(artifact);
    const marketplaceChecks = [
      inspectArchiveProvenance(artifact, readResult.ok ? readResult.rawPackageJson : ''),
      createCheck(
      'marketplace-publisher-identity',
      marketplacePublisherIdentity.status === 'verified' ? 'pass' : 'fail',
      marketplacePublisherIdentity.status === 'verified'
        ? `Publisher ${marketplacePublisherIdentity.publisherId} is bound to ${marketplacePublisherIdentity.keyId}.`
        : `Marketplace publisher identity is blocked: ${marketplacePublisherIdentity.issueCodes.join(', ')}.`,
      ),
    ];
    return {
      artifactDigest: artifact.artifactDigest ?? null,
      checks,
      compatibilityIssueCodes,
      controlledRuntimeStatus,
      marketReleaseAllowed: false,
      marketReleaseIssueCodes: [...new Set([
        'marketplace-release-disabled',
        ...compatibilityIssueCodes,
        ...marketplaceChecks.filter((check) => check.status !== 'pass').map((check) => check.id),
        ...marketplacePublisherIdentity.issueCodes,
      ])],
      marketReleaseStatus: 'disabled',
      marketplaceChecks,
      marketplacePublisherIdentity,
      packageId: artifact.packageId,
      runtimeKind,
    };
  }

  function createAdmissionReport(request = {}) {
    const packageIds = normalizePackageIds(request.packageIds);
    const listed = artifactStore?.listPackages?.({ packageIds }) ?? {
      error: 'artifact_store_listing_unavailable',
      ok: false,
      packages: [],
    };
    if (!listed.ok) {
      return { error: listed.error || 'artifact_store_listing_failed', ok: false, rows: [] };
    }
    const artifactsByPackageId = new Map(listed.packages.map((artifact) => [artifact.packageId, artifact]));
    const artifacts = packageIds.length
      ? packageIds.map((packageId) => artifactsByPackageId.get(packageId) ?? {
        artifactDigest: null,
        packageId,
        status: 'missing',
      })
      : listed.packages;
    const rows = artifacts.map(createCompatibilityRow);
    return {
      generatedAt: new Date(getNow()).toISOString(),
      host,
      kind: REPORT_KIND,
      marketReleaseEnabled: false,
      ok: true,
      rows,
      summary: createSummary(rows),
      version: 1,
    };
  }

  function createExport(result, prefix) {
    if (!result.ok) {
      return result;
    }
    const timestamp = result.generatedAt.replace(/[:.]/gu, '-');
    return {
      fileName: `${prefix}-${timestamp}.json`,
      mimeType: 'application/json',
      ok: true,
      text: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  function exportAdmissionReport(request = {}) {
    return createExport(createAdmissionReport(request), 'external-skill-release-admission');
  }

  function exportHealthDiagnostics(request = {}) {
    const packageId = typeof request.packageId === 'string' ? request.packageId.trim() : '';
    const health = healthService.listHealth({ packageId });
    const entries = health.entries ?? [];
    const generatedAt = new Date(getNow()).toISOString();
    const result = {
      entries,
      generatedAt,
      host,
      kind: HEALTH_DIAGNOSTICS_KIND,
      ok: true,
      policy: {
        backoffMs: [1000, 2000],
        quarantineFailureThreshold: 3,
      },
      summary: {
        backoff: entries.filter((entry) => entry.status === 'backoff').length,
        healthy: entries.filter((entry) => entry.status === 'healthy').length,
        quarantined: entries.filter((entry) => entry.status === 'quarantined').length,
        total: entries.length,
      },
      version: 1,
    };
    return createExport(result, 'external-skill-package-health');
  }

  return {
    createAdmissionReport,
    exportAdmissionReport,
    exportHealthDiagnostics,
  };
}

module.exports = { createExternalSkillReleaseAdmissionService };
