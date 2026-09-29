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

function cloneWithoutPackageSignature(packageValue) {
  const cloned = JSON.parse(JSON.stringify(packageValue));
  delete cloned.signature;
  if (cloned.security && typeof cloned.security === 'object') delete cloned.security.signature;
  return cloned;
}

function createPackageSignaturePayload(packageValue) {
  return JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-signature-payload.v1',
    package: cloneWithoutPackageSignature(packageValue),
  }));
}

function createMigrationSignaturePayload(packageValue) {
  const cloned = cloneWithoutPackageSignature(packageValue);
  delete cloned.security.keyMigration.oldSignature;
  delete cloned.security.keyMigration.newSignature;
  return JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-key-migration-payload.v1',
    package: cloned,
  }));
}

function fingerprint(publicKey) {
  return crypto.createHash('sha256')
    .update(publicKey.export({ format: 'der', type: 'spki' }))
    .digest('hex');
}

function keyRecord(keyId, publicKey) {
  return {
    algorithm: 'ed25519',
    keyId,
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  };
}

function registry(keys) {
  return { keys, kind: 'agent-skill-trusted-signature-key-registry.v1' };
}

function signPackage(packageValue, keyId, privateKey) {
  packageValue.signature = {
    algorithm: 'ed25519',
    digest: 'sha256:canonical-v1',
    keyId,
    signature: crypto.sign(
      null,
      Buffer.from(createPackageSignaturePayload(packageValue)),
      privateKey,
    ).toString('base64'),
  };
  return packageValue;
}

function createPackage(version) {
  return {
    kind: 'agent-skill-package.v1',
    publisher: { id: 'studio.migration' },
    scaffold: { skill: { id: 'character.animation' }, version },
  };
}

function createMigratedPackage({
  fromKey,
  fromKeyFingerprint,
  fromKeyId,
  oldSigner = fromKey.privateKey,
  toKey,
  toKeyFingerprint,
  toKeyId,
  version,
}) {
  const packageValue = {
    ...createPackage(version),
    security: {
      keyMigration: {
        algorithm: 'ed25519',
        digest: 'sha256:canonical-key-migration-v1',
        fromKeyFingerprint,
        fromKeyId,
        publisherId: 'studio.migration',
        toKeyFingerprint,
        toKeyId,
      },
    },
  };
  const payload = Buffer.from(createMigrationSignaturePayload(packageValue));
  packageValue.security.keyMigration.oldSignature = crypto.sign(null, payload, oldSigner).toString('base64');
  packageValue.security.keyMigration.newSignature = crypto.sign(null, payload, toKey.privateKey).toString('base64');
  return signPackage(packageValue, toKeyId, toKey.privateKey);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-key-migration-'));
const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
const oldKey = crypto.generateKeyPairSync('ed25519');
const newKey = crypto.generateKeyPairSync('ed25519');
const attackerKey = crypto.generateKeyPairSync('ed25519');
const oldKeyId = 'publisher-key-old';
const newKeyId = 'publisher-key-new';
const oldKeyFingerprint = fingerprint(oldKey.publicKey);
const newKeyFingerprint = fingerprint(newKey.publicKey);
const oldRegistry = registry([keyRecord(oldKeyId, oldKey.publicKey)]);
const dualRegistry = registry([
  keyRecord(oldKeyId, oldKey.publicKey),
  keyRecord(newKeyId, newKey.publicKey),
]);
const packageId = 'character.animation@key-migration';

try {
  const initialPackage = signPackage(createPackage(1), oldKeyId, oldKey.privateKey);
  assert.equal(coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(initialPackage),
    trustedKeyRegistry: oldRegistry,
  }).ok, true);
  const initialDigest = artifactStore.getPackage(packageId).package.artifactDigest;
  const initialRegistryText = fs.readFileSync(coordinator.getPaths().registryPath, 'utf8');

  const noProofPackage = signPackage(createPackage(2), newKeyId, newKey.privateKey);
  const noProofRejected = coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(noProofPackage),
    trustedKeyRegistry: dualRegistry,
  });
  assert.equal(noProofRejected.ok, false);
  assert.equal(noProofRejected.error, 'package_signing_key_continuity_mismatch');
  assert.equal(noProofRejected.migrationError, 'package_signing_key_migration_missing');

  const validMigration = createMigratedPackage({
    fromKey: oldKey,
    fromKeyFingerprint: oldKeyFingerprint,
    fromKeyId: oldKeyId,
    toKey: newKey,
    toKeyFingerprint: newKeyFingerprint,
    toKeyId: newKeyId,
    version: 2,
  });
  const oldKeyMissing = coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(validMigration),
    trustedKeyRegistry: registry([keyRecord(newKeyId, newKey.publicKey)]),
  });
  assert.equal(oldKeyMissing.ok, false);
  assert.equal(oldKeyMissing.error, 'package_signing_key_migration_trusted_key_missing');

  const forgedMigration = createMigratedPackage({
    fromKey: oldKey,
    fromKeyFingerprint: oldKeyFingerprint,
    fromKeyId: oldKeyId,
    oldSigner: attackerKey.privateKey,
    toKey: newKey,
    toKeyFingerprint: newKeyFingerprint,
    toKeyId: newKeyId,
    version: 2,
  });
  const forgedRejected = coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(forgedMigration),
    trustedKeyRegistry: dualRegistry,
  });
  assert.equal(forgedRejected.ok, false);
  assert.equal(forgedRejected.error, 'package_signing_key_migration_verification_failed');

  const mismatchedMigration = createMigratedPackage({
    fromKey: oldKey,
    fromKeyFingerprint: 'f'.repeat(64),
    fromKeyId: oldKeyId,
    toKey: newKey,
    toKeyFingerprint: newKeyFingerprint,
    toKeyId: newKeyId,
    version: 2,
  });
  const mismatchRejected = coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(mismatchedMigration),
    trustedKeyRegistry: dualRegistry,
  });
  assert.equal(mismatchRejected.ok, false);
  assert.equal(mismatchRejected.error, 'package_signing_key_migration_continuity_mismatch');

  assert.equal(artifactStore.getPackage(packageId).package.artifactDigest, initialDigest);
  assert.equal(fs.readFileSync(coordinator.getPaths().registryPath, 'utf8'), initialRegistryText);

  const migrated = coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(validMigration),
    trustedKeyRegistry: dualRegistry,
  });
  assert.equal(migrated.ok, true, JSON.stringify(migrated));
  assert.equal(migrated.verification.keyId, newKeyId);
  assert.equal(migrated.verification.keyMigration.status, 'verified');
  const migratedArtifact = artifactStore.getPackage(packageId).package;
  assert.equal(migratedArtifact.signatureVerification.keyId, newKeyId);
  assert.equal(migratedArtifact.signatureVerification.keyFingerprint, newKeyFingerprint);
  assert.equal(migratedArtifact.signatureVerification.keyMigration.fromKeyId, oldKeyId);
  assert.equal(migratedArtifact.signatureVerification.keyMigration.toKeyId, newKeyId);
  assert.equal(
    migratedArtifact.signatureVerification.keyMigration.verifier,
    'main-process-ed25519-dual-signature',
  );

  const catalogRoot = crypto.generateKeyPairSync('ed25519');
  const catalogRootRegistryPath = path.join(tempRoot, 'migration-catalog-root-keys.json');
  fs.writeFileSync(catalogRootRegistryPath, JSON.stringify({
    keys: [{
      algorithm: 'ed25519',
      keyId: 'migration-catalog-root-v1',
      publicKey: catalogRoot.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      status: 'active',
    }],
    kind: 'external-skill-marketplace-catalog-root-key-registry.v1',
    minimumSequence: 1,
  }), 'utf8');
  const catalogService = createExternalSkillMarketplacePublisherCatalogService({
    now: () => Date.parse('2026-07-27T00:00:00.000Z'),
    rootKeyRegistryPath: catalogRootRegistryPath,
    userDataPath: tempRoot,
  });
  const publisherCatalog = {
    expiresAt: '2026-08-27T00:00:00.000Z',
    issuedAt: '2026-07-27T00:00:00.000Z',
    kind: 'external-skill-marketplace-publisher-catalog.v1',
    publishers: [{
      keyFingerprint: newKeyFingerprint,
      keyId: newKeyId,
      publisherId: 'studio.migration',
      status: 'active',
      verifiedAt: '2026-07-26T15:30:00.000Z',
    }],
    sequence: 1,
  };
  assert.equal(catalogService.provisionCatalog({
    catalog: publisherCatalog,
    kind: 'external-skill-marketplace-publisher-catalog-envelope.v1',
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-marketplace-publisher-catalog-v1',
      keyId: 'migration-catalog-root-v1',
      signature: crypto.sign(
        null,
        Buffer.from(createCanonicalPublisherCatalogPayload(publisherCatalog)),
        catalogRoot.privateKey,
      ).toString('base64'),
    },
  }).ok, true);
  const publisherIdentityService = createExternalSkillMarketplacePublisherIdentityService({
    catalogService,
    userDataPath: tempRoot,
  });
  const releaseAdmission = createExternalSkillReleaseAdmissionService({
    artifactStore,
    healthService: createExternalSkillPackageHealthService({
      artifactStore,
      rootPath: path.join(tempRoot, 'migration-health'),
    }),
    hostContext: { arch: 'x64', packaged: true, platform: 'win32' },
    publisherIdentityService,
  }).createAdmissionReport({ packageIds: [packageId] });
  assert.equal(releaseAdmission.rows[0].controlledRuntimeStatus, 'blocked');
  assert.equal(
    releaseAdmission.rows[0].checks.find((item) => item.id === 'signing-key-migration').status,
    'pass',
  );
  assert.equal(releaseAdmission.rows[0].marketplacePublisherIdentity.status, 'verified');

  const nextPackage = signPackage(createPackage(3), newKeyId, newKey.privateKey);
  const nextUpdate = coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(nextPackage),
    trustedKeyRegistry: registry([keyRecord(newKeyId, newKey.publicKey)]),
  });
  assert.equal(nextUpdate.ok, true);
  assert.equal(
    artifactStore.getPackage(packageId).package.signatureVerification.keyMigration.fromKeyId,
    oldKeyId,
  );

  console.log('agent skill signing key migration smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
