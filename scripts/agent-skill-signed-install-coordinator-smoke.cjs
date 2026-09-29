const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a.localeCompare(b))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function createSignaturePayload(packageValue) {
  const unsigned = JSON.parse(JSON.stringify(packageValue));
  delete unsigned.signature;
  return JSON.stringify(normalizeJsonValue({ kind: 'agent-skill-package-signature-payload.v1', package: unsigned }));
}

function createSignedPackage(privateKey, publicKey, options = {}) {
  const keyId = options.keyId || 'marketplace-test-key';
  const packageValue = {
    kind: 'agent-skill-package.v1',
    ...(options.publisherId ? { publisher: { id: options.publisherId } } : {}),
    scaffold: { skill: { id: 'character.animation' }, version: options.version || 1 },
  };
  packageValue.signature = {
    algorithm: 'ed25519',
    digest: 'sha256:canonical-v1',
    keyId,
    signature: crypto.sign(null, Buffer.from(createSignaturePayload(packageValue)), privateKey).toString('base64'),
  };
  return {
    packageValue,
    trustedKeyRegistry: {
      keys: [{ algorithm: 'ed25519', keyId, publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString() }],
      kind: 'agent-skill-trusted-signature-key-registry.v1',
    },
  };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-signed-install-'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
const fixture = createSignedPackage(privateKey, publicKey);

try {
  const staged = coordinator.stageSignedPackage({
    packageId: 'character.animation@signed-draft',
    rawPackageJson: JSON.stringify(fixture.packageValue),
    trustedKeyRegistry: fixture.trustedKeyRegistry,
  });
  assert.equal(staged.ok, true);
  assert.equal(staged.verification.verifier, 'main-process-ed25519');
  const stagedArtifact = artifactStore.getPackage('character.animation@signed-draft').package;
  assert.equal(stagedArtifact.status, 'staged');
  assert.equal(stagedArtifact.signatureVerification.algorithm, 'ed25519');
  assert.match(stagedArtifact.signatureVerification.keyFingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(stagedArtifact.signatureVerification.keyId, 'marketplace-test-key');
  assert.equal(stagedArtifact.signatureVerification.status, 'verified');
  assert.equal(stagedArtifact.signatureVerification.verifier, 'main-process-ed25519');
  assert.equal(Number.isFinite(Date.parse(stagedArtifact.signatureVerification.verifiedAt)), true);
  assert.equal(fs.existsSync(coordinator.getPaths().registryPath), true);

  const sameKeyUpdate = createSignedPackage(privateKey, publicKey, { version: 2 });
  const sameKeyStaged = coordinator.stageSignedPackage({
    packageId: 'character.animation@signed-draft',
    rawPackageJson: JSON.stringify(sameKeyUpdate.packageValue),
    trustedKeyRegistry: sameKeyUpdate.trustedKeyRegistry,
  });
  assert.equal(sameKeyStaged.ok, true);
  assert.equal(sameKeyStaged.replaced, true);

  const beforeMismatchedKey = artifactStore.getPackage('character.animation@signed-draft').package.artifactDigest;
  const alternateKeys = crypto.generateKeyPairSync('ed25519');
  const differentKeyUpdate = createSignedPackage(alternateKeys.privateKey, alternateKeys.publicKey, {
    keyId: 'marketplace-other-key',
    version: 3,
  });
  const continuityRejected = coordinator.stageSignedPackage({
    packageId: 'character.animation@signed-draft',
    rawPackageJson: JSON.stringify(differentKeyUpdate.packageValue),
    trustedKeyRegistry: differentKeyUpdate.trustedKeyRegistry,
  });
  assert.equal(continuityRejected.ok, false);
  assert.equal(continuityRejected.error, 'package_signing_key_continuity_mismatch');
  assert.equal(continuityRejected.expectedKeyId, 'marketplace-test-key');
  assert.equal(artifactStore.getPackage('character.animation@signed-draft').package.artifactDigest, beforeMismatchedKey);
  assert.equal(fs.readFileSync(coordinator.getPaths().registryPath, 'utf8').includes('marketplace-other-key'), false);

  const registryBeforeReusedKeyId = fs.readFileSync(coordinator.getPaths().registryPath, 'utf8');
  const reusedKeyIdUpdate = createSignedPackage(alternateKeys.privateKey, alternateKeys.publicKey, {
    keyId: 'marketplace-test-key',
    version: 3,
  });
  const reusedKeyIdRejected = coordinator.stageSignedPackage({
    packageId: 'character.animation@signed-draft',
    rawPackageJson: JSON.stringify(reusedKeyIdUpdate.packageValue),
    trustedKeyRegistry: reusedKeyIdUpdate.trustedKeyRegistry,
  });
  assert.equal(reusedKeyIdRejected.ok, false);
  assert.equal(reusedKeyIdRejected.error, 'package_signing_key_continuity_mismatch');
  assert.equal(reusedKeyIdRejected.expectedKeyId, 'marketplace-test-key');
  assert.match(reusedKeyIdRejected.expectedKeyFingerprint, /^[a-f0-9]{64}$/u);
  assert.match(reusedKeyIdRejected.receivedKeyFingerprint, /^[a-f0-9]{64}$/u);
  assert.notEqual(reusedKeyIdRejected.expectedKeyFingerprint, reusedKeyIdRejected.receivedKeyFingerprint);
  assert.equal(artifactStore.getPackage('character.animation@signed-draft').package.artifactDigest, beforeMismatchedKey);
  assert.equal(fs.readFileSync(coordinator.getPaths().registryPath, 'utf8'), registryBeforeReusedKeyId);

  const publisherOne = createSignedPackage(privateKey, publicKey, { publisherId: 'publisher.one' });
  assert.equal(coordinator.stageSignedPackage({
    packageId: 'character.animation@publisher-continuity',
    rawPackageJson: JSON.stringify(publisherOne.packageValue),
    trustedKeyRegistry: publisherOne.trustedKeyRegistry,
  }).ok, true);
  assert.equal(
    artifactStore.getPackage('character.animation@publisher-continuity').package.signatureVerification.publisherId,
    'publisher.one',
  );
  const publisherOneUpdate = createSignedPackage(privateKey, publicKey, { publisherId: 'publisher.one', version: 2 });
  assert.equal(coordinator.stageSignedPackage({
    packageId: 'character.animation@publisher-continuity',
    rawPackageJson: JSON.stringify(publisherOneUpdate.packageValue),
    trustedKeyRegistry: publisherOneUpdate.trustedKeyRegistry,
  }).ok, true);
  const publisherTwo = createSignedPackage(privateKey, publicKey, { publisherId: 'publisher.two', version: 2 });
  const publisherRejected = coordinator.stageSignedPackage({
    packageId: 'character.animation@publisher-continuity',
    rawPackageJson: JSON.stringify(publisherTwo.packageValue),
    trustedKeyRegistry: publisherTwo.trustedKeyRegistry,
  });
  assert.equal(publisherRejected.ok, false);
  assert.equal(publisherRejected.error, 'package_publisher_continuity_mismatch');
  const publisherRemoval = createSignedPackage(privateKey, publicKey, { version: 3 });
  const publisherRemovalRejected = coordinator.stageSignedPackage({
    packageId: 'character.animation@publisher-continuity',
    rawPackageJson: JSON.stringify(publisherRemoval.packageValue),
    trustedKeyRegistry: publisherRemoval.trustedKeyRegistry,
  });
  assert.equal(publisherRemovalRejected.ok, false);
  assert.equal(publisherRemovalRejected.error, 'package_publisher_continuity_mismatch');

  const legacyPackageId = 'character.animation@legacy-fingerprint';
  assert.equal(artifactStore.stagePackage({
    packageId: legacyPackageId,
    rawPackageJson: JSON.stringify(fixture.packageValue),
    signatureVerification: {
      algorithm: 'ed25519',
      keyId: 'marketplace-test-key',
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      verifier: 'main-process-ed25519',
    },
  }).ok, true);
  const legacyUpdate = createSignedPackage(privateKey, publicKey, { version: 2 });
  const legacyUpdated = coordinator.stageSignedPackage({
    packageId: legacyPackageId,
    rawPackageJson: JSON.stringify(legacyUpdate.packageValue),
    trustedKeyRegistry: legacyUpdate.trustedKeyRegistry,
  });
  assert.equal(legacyUpdated.ok, true);
  assert.match(
    artifactStore.getPackage(legacyPackageId).package.signatureVerification.keyFingerprint,
    /^[a-f0-9]{64}$/u,
  );

  const unrecoverableRoot = path.join(tempRoot, 'unrecoverable-fingerprint');
  const unrecoverableStore = createSkillPackageArtifactStore({ userDataPath: unrecoverableRoot });
  const unrecoverableCoordinator = createSkillPackageSignedInstallCoordinator({
    artifactStore: unrecoverableStore,
    userDataPath: unrecoverableRoot,
  });
  const unrecoverablePackageId = 'character.animation@unrecoverable-fingerprint';
  assert.equal(unrecoverableStore.stagePackage({
    packageId: unrecoverablePackageId,
    rawPackageJson: JSON.stringify(fixture.packageValue),
    signatureVerification: {
      algorithm: 'ed25519',
      keyId: 'marketplace-test-key',
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      verifier: 'main-process-ed25519',
    },
  }).ok, true);
  const unrecoverableDigest = unrecoverableStore.getPackage(unrecoverablePackageId).package.artifactDigest;
  const unrecoverableRejected = unrecoverableCoordinator.stageSignedPackage({
    packageId: unrecoverablePackageId,
    rawPackageJson: JSON.stringify(legacyUpdate.packageValue),
    trustedKeyRegistry: legacyUpdate.trustedKeyRegistry,
  });
  assert.equal(unrecoverableRejected.ok, false);
  assert.equal(unrecoverableRejected.error, 'package_signing_key_fingerprint_unavailable');
  assert.equal(unrecoverableStore.getPackage(unrecoverablePackageId).package.artifactDigest, unrecoverableDigest);
  assert.equal(fs.existsSync(unrecoverableCoordinator.getPaths().registryPath), false);

  const unsignedPackageId = 'character.animation@unsigned-existing';
  assert.equal(artifactStore.stagePackage({
    packageId: unsignedPackageId,
    rawPackageJson: JSON.stringify({ kind: 'agent-skill-package.v1', scaffold: { skill: { id: 'character.animation' } } }),
  }).ok, true);
  const signedAdoptionRejected = coordinator.stageSignedPackage({
    packageId: unsignedPackageId,
    rawPackageJson: JSON.stringify(fixture.packageValue),
    trustedKeyRegistry: fixture.trustedKeyRegistry,
  });
  assert.equal(signedAdoptionRejected.ok, false);
  assert.equal(signedAdoptionRejected.error, 'package_signing_continuity_unavailable');

  const tampered = { ...fixture.packageValue, scaffold: { skill: { id: 'changed' } } };
  const rejected = coordinator.stageSignedPackage({
    packageId: 'character.animation@tampered',
    rawPackageJson: JSON.stringify(tampered),
    trustedKeyRegistry: fixture.trustedKeyRegistry,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, 'package_signature_verification_failed');

  const unknownKey = coordinator.stageSignedPackage({
    packageId: 'character.animation@unknown-key',
    rawPackageJson: JSON.stringify(fixture.packageValue),
    trustedKeyRegistry: { ...fixture.trustedKeyRegistry, keys: [] },
  });
  assert.equal(unknownKey.ok, false);
  assert.equal(unknownKey.error, 'package_signature_trusted_key_missing');

  const invalidEnvelope = { kind: 'agent-skill-package.v1', publisher: { id: 'publisher.invalid' } };
  invalidEnvelope.signature = {
    algorithm: 'ed25519',
    digest: 'sha256:canonical-v1',
    keyId: 'marketplace-invalid-envelope-key',
    signature: crypto.sign(
      null,
      Buffer.from(createSignaturePayload(invalidEnvelope)),
      alternateKeys.privateKey,
    ).toString('base64'),
  };
  const registryBeforeInvalidEnvelope = fs.readFileSync(coordinator.getPaths().registryPath, 'utf8');
  const invalidEnvelopeRejected = coordinator.stageSignedPackage({
    packageId: 'character.animation@invalid-envelope',
    rawPackageJson: JSON.stringify(invalidEnvelope),
    trustedKeyRegistry: {
      keys: [{
        algorithm: 'ed25519',
        keyId: 'marketplace-invalid-envelope-key',
        publicKey: alternateKeys.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      }],
      kind: 'agent-skill-trusted-signature-key-registry.v1',
    },
  });
  assert.equal(invalidEnvelopeRejected.ok, false);
  assert.equal(invalidEnvelopeRejected.error, 'package_json_invalid');
  assert.equal(artifactStore.getPackage('character.animation@invalid-envelope').package, null);
  assert.equal(fs.readFileSync(coordinator.getPaths().registryPath, 'utf8'), registryBeforeInvalidEnvelope);
  console.log('agent skill signed install coordinator smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
