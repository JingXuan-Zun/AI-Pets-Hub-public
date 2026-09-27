const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillPackageHealthService } = require('../electron/externalSkillPackageHealthService.cjs');
const {
  createExternalSkillMarketplacePublisherIdentityService,
} = require('../electron/externalSkillMarketplacePublisherIdentityService.cjs');
const {
  createCanonicalPublisherCatalogPayload,
  createExternalSkillMarketplacePublisherCatalogService,
} = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');
const { createExternalSkillReleaseAdmissionService } = require('../electron/externalSkillReleaseAdmissionService.cjs');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a.localeCompare(b))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function signPackage(packageValue, privateKey) {
  const unsigned = JSON.parse(JSON.stringify(packageValue));
  delete unsigned.signature;
  const payload = JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-signature-payload.v1',
    package: unsigned,
  }));
  return {
    ...packageValue,
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-v1',
      keyId: 'release-admission-test-key',
      signature: crypto.sign(null, Buffer.from(payload), privateKey).toString('base64'),
    },
  };
}

function check(row, id) {
  return row.checks.find((item) => item.id === id);
}

function marketplaceCheck(row, id) {
  return row.marketplaceChecks.find((item) => item.id === id);
}

const addOneWasm = Buffer.from(
  '0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041016a0b',
  'hex',
).toString('base64');
const echoJsonWasm = Buffer.from(
  '0061736d0100000001070160027f7f017e03020100050401010101071002066d656d6f727902000372756e00000a0e010c002000ad4220862001ad840b',
  'hex',
).toString('base64');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-release-admission-'));
const nowMs = Date.parse('2026-07-26T14:00:00.000Z');
const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
const healthService = createExternalSkillPackageHealthService({
  artifactStore,
  now: () => nowMs,
  rootPath: path.join(tempRoot, 'health'),
});
const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const trustedKeyRegistry = {
  keys: [{
    algorithm: 'ed25519',
    keyId: 'release-admission-test-key',
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  }],
  kind: 'agent-skill-trusted-signature-key-registry.v1',
};
const { privateKey: catalogPrivateKey, publicKey: catalogPublicKey } = crypto.generateKeyPairSync('ed25519');
const catalogRootRegistryPath = path.join(tempRoot, 'catalog-root-keys.json');
fs.writeFileSync(catalogRootRegistryPath, JSON.stringify({
  keys: [{
    algorithm: 'ed25519',
    keyId: 'release-catalog-root-v1',
    publicKey: catalogPublicKey.export({ format: 'pem', type: 'spki' }).toString(),
    status: 'active',
  }],
  kind: 'external-skill-marketplace-catalog-root-key-registry.v1',
  minimumSequence: 1,
}), 'utf8');
const publisherCatalogService = createExternalSkillMarketplacePublisherCatalogService({
  now: () => nowMs,
  rootKeyRegistryPath: catalogRootRegistryPath,
  userDataPath: tempRoot,
});
const publisherCatalog = {
  expiresAt: '2026-08-26T14:00:00.000Z',
  issuedAt: '2026-07-26T13:00:00.000Z',
  kind: 'external-skill-marketplace-publisher-catalog.v1',
  publishers: [{
    keyFingerprint: crypto.createHash('sha256')
      .update(publicKey.export({ format: 'der', type: 'spki' }))
      .digest('hex'),
    keyId: 'release-admission-test-key',
    publisherId: 'studio.release',
    status: 'active',
    verifiedAt: '2026-07-26T14:00:00.000Z',
  }],
  sequence: 1,
};
assert.equal(publisherCatalogService.provisionCatalog({
  catalog: publisherCatalog,
  kind: 'external-skill-marketplace-publisher-catalog-envelope.v1',
  signature: {
    algorithm: 'ed25519',
    digest: 'sha256:canonical-marketplace-publisher-catalog-v1',
    keyId: 'release-catalog-root-v1',
    signature: crypto.sign(
      null,
      Buffer.from(createCanonicalPublisherCatalogPayload(publisherCatalog)),
      catalogPrivateKey,
    ).toString('base64'),
  },
}).ok, true);
const publisherIdentityService = createExternalSkillMarketplacePublisherIdentityService({
  catalogService: publisherCatalogService,
  userDataPath: tempRoot,
});

function stageSigned(packageId, runtime, { publisherId = 'studio.release' } = {}) {
  const packageValue = signPackage({
    kind: 'agent-skill-package.v1',
    ...(publisherId ? { publisher: { id: publisherId } } : {}),
    runtime,
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  const result = coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(packageValue),
    trustedKeyRegistry,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
}

try {
  const eligiblePackageId = 'character.animation@release-eligible';
  stageSigned(eligiblePackageId, {
    entrypoint: 'run',
    kind: 'wasm-pure-i32-v1',
    moduleBase64: addOneWasm,
  });

  const createService = (packaged) => createExternalSkillReleaseAdmissionService({
    artifactStore,
    healthService,
    hostContext: {
      arch: 'x64',
      electronVersion: '37.2.0',
      nodeVersion: '22.17.0',
      packaged,
      platform: 'win32',
    },
    publisherIdentityService,
    now: () => nowMs,
  });
  const devService = createService(false);
  const packagedService = createService(true);

  const devReport = devService.createAdmissionReport({ packageIds: [eligiblePackageId] });
  assert.equal(devReport.ok, true);
  assert.equal(devReport.marketReleaseEnabled, false);
  assert.equal(devReport.rows[0].controlledRuntimeStatus, 'review-required');
  assert.equal(check(devReport.rows[0], 'packaged-runtime-evidence').status, 'warning');
  assert.equal(devReport.rows[0].marketReleaseAllowed, false);
  assert.equal(devReport.rows[0].marketReleaseStatus, 'disabled');
  assert.equal(devReport.rows[0].marketReleaseIssueCodes.includes('marketplace-release-disabled'), true);
  assert.equal(devReport.rows[0].marketplacePublisherIdentity.status, 'verified');
  assert.equal(marketplaceCheck(devReport.rows[0], 'marketplace-publisher-identity').status, 'pass');
  assert.equal(marketplaceCheck(devReport.rows[0], 'package-archive-provenance').status, 'fail');
  assert.equal(devReport.rows[0].marketReleaseIssueCodes.includes('package-archive-provenance'), true);
  assert.equal(check(devReport.rows[0], 'signing-key-migration').status, 'not-applicable');
  assert.equal(devReport.summary.marketplacePublisherVerified, 1);

  const packagedReport = packagedService.createAdmissionReport({ packageIds: [eligiblePackageId] });
  assert.equal(packagedReport.rows[0].controlledRuntimeStatus, 'controlled-runtime-eligible');
  assert.equal(packagedReport.summary.eligible, 1);
  assert.equal(packagedReport.rows[0].marketReleaseAllowed, false);

  const missingPublisherPackageId = 'character.animation@release-publisher-missing';
  stageSigned(missingPublisherPackageId, {
    entrypoint: 'run',
    kind: 'wasm-pure-i32-v1',
    moduleBase64: addOneWasm,
  }, { publisherId: '' });
  const missingPublisherRow = packagedService.createAdmissionReport({
    packageIds: [missingPublisherPackageId],
  }).rows[0];
  assert.equal(missingPublisherRow.controlledRuntimeStatus, 'controlled-runtime-eligible');
  assert.equal(missingPublisherRow.marketplacePublisherIdentity.status, 'blocked');
  assert.equal(
    missingPublisherRow.marketReleaseIssueCodes.includes('marketplace-publisher-id-missing'),
    true,
  );
  assert.equal(marketplaceCheck(missingPublisherRow, 'marketplace-publisher-identity').status, 'fail');

  const unsignedPackageId = 'character.animation@release-unsigned';
  const unsigned = artifactStore.stagePackage({
    packageId: unsignedPackageId,
    rawPackageJson: JSON.stringify({
      kind: 'agent-skill-package.v1',
      runtime: { entrypoint: 'run', kind: 'wasm-pure-i32-v1', moduleBase64: addOneWasm },
      scaffold: { skill: { id: 'character.animation' } },
    }),
  });
  assert.equal(unsigned.ok, true);
  const unsignedRow = packagedService.createAdmissionReport({ packageIds: [unsignedPackageId] }).rows[0];
  assert.equal(unsignedRow.controlledRuntimeStatus, 'blocked');
  assert.equal(check(unsignedRow, 'signature-verification').status, 'fail');

  const invalidWasmPackageId = 'character.animation@release-invalid-wasm';
  stageSigned(invalidWasmPackageId, {
    entrypoint: 'run',
    kind: 'wasm-pure-i32-v1',
    moduleBase64: Buffer.from('not-wasm').toString('base64'),
  });
  const invalidWasmRow = packagedService.createAdmissionReport({ packageIds: [invalidWasmPackageId] }).rows[0];
  assert.equal(invalidWasmRow.controlledRuntimeStatus, 'blocked');
  assert.equal(check(invalidWasmRow, 'wasm-compile').status, 'fail');

  const noMemoryPackageId = 'character.animation@release-json-no-memory';
  stageSigned(noMemoryPackageId, {
    entrypoint: 'run',
    kind: 'wasm-pure-json-v1',
    moduleBase64: addOneWasm,
  });
  const noMemoryRow = packagedService.createAdmissionReport({ packageIds: [noMemoryPackageId] }).rows[0];
  assert.equal(noMemoryRow.controlledRuntimeStatus, 'blocked');
  assert.equal(check(noMemoryRow, 'json-memory-export').status, 'fail');

  const jsonPackageId = 'character.animation@release-json';
  stageSigned(jsonPackageId, {
    entrypoint: 'run',
    kind: 'wasm-pure-json-v1',
    moduleBase64: echoJsonWasm,
  });
  const jsonRow = packagedService.createAdmissionReport({ packageIds: [jsonPackageId] }).rows[0];
  assert.equal(jsonRow.controlledRuntimeStatus, 'controlled-runtime-eligible');
  assert.equal(check(jsonRow, 'json-memory-export').status, 'pass');

  const quarantinedPackageId = 'character.animation@release-quarantined';
  stageSigned(quarantinedPackageId, {
    entrypoint: 'run',
    kind: 'wasm-pure-i32-v1',
    moduleBase64: addOneWasm,
  });
  assert.equal(artifactStore.quarantinePackage(quarantinedPackageId, 'test-quarantine').ok, true);
  const quarantinedRow = packagedService.createAdmissionReport({ packageIds: [quarantinedPackageId] }).rows[0];
  assert.equal(quarantinedRow.controlledRuntimeStatus, 'blocked');
  assert.equal(check(quarantinedRow, 'artifact-status').status, 'fail');
  assert.equal(check(quarantinedRow, 'package-health').status, 'fail');

  const missingPackageId = 'character.animation@release-missing';
  const missingReport = packagedService.createAdmissionReport({ packageIds: [missingPackageId] });
  assert.equal(missingReport.rows.length, 1);
  assert.equal(missingReport.rows[0].packageId, missingPackageId);
  assert.equal(missingReport.rows[0].controlledRuntimeStatus, 'blocked');
  assert.equal(check(missingReport.rows[0], 'artifact-status').status, 'fail');
  assert.equal(check(missingReport.rows[0], 'artifact-integrity').status, 'fail');

  const healthPackageId = 'character.animation@release-health-export';
  stageSigned(healthPackageId, {
    entrypoint: 'run',
    kind: 'wasm-pure-i32-v1',
    moduleBase64: addOneWasm,
  });
  healthService.recordExecutionResult(healthPackageId, {
    error: `wasm failed at ${path.join(tempRoot, 'private', 'module.wasm')}`,
    status: 'failed',
    workerReceipt: { kind: 'external-skill-sandbox-execution-receipt.v1' },
  });
  const healthExport = packagedService.exportHealthDiagnostics({ packageId: healthPackageId });
  assert.equal(healthExport.ok, true);
  const healthJson = JSON.parse(healthExport.text);
  assert.equal(healthJson.kind, 'external-skill-package-health-diagnostics.v1');
  assert.equal(healthJson.entries.length, 1);
  assert.equal(healthExport.text.includes(tempRoot), false);
  assert.equal(healthExport.text.includes('healthStatePath'), false);
  assert.equal(healthExport.text.includes('<redacted-path>'), true);

  const admissionExport = packagedService.exportAdmissionReport({ packageIds: [eligiblePackageId] });
  assert.equal(admissionExport.ok, true);
  assert.equal(admissionExport.mimeType, 'application/json');
  assert.equal(JSON.parse(admissionExport.text).rows[0].packageId, eligiblePackageId);

  const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ipcHandlers.cjs'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  const typeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'vite-env.d.ts'), 'utf8');
  assert.match(ipcSource, /desktop-pet:create-external-skill-release-admission-report/u);
  assert.match(ipcSource, /desktop-pet:export-external-skill-release-admission-report/u);
  assert.match(ipcSource, /desktop-pet:export-external-skill-package-health-diagnostics/u);
  assert.match(preloadSource, /createExternalSkillReleaseAdmissionReport/u);
  assert.match(preloadSource, /exportExternalSkillReleaseAdmissionReport/u);
  assert.match(preloadSource, /exportExternalSkillPackageHealthDiagnostics/u);
  assert.match(typeSource, /DesktopPetExternalSkillReleaseAdmissionReportLike/u);
  assert.match(typeSource, /marketReleaseStatus: 'disabled'/u);
  assert.match(typeSource, /marketplacePublisherIdentity/u);

  console.log('agent skill release admission smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
