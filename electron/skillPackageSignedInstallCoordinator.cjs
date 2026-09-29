const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_REGISTRY_KIND = 'agent-skill-trusted-signature-key-registry.v1';
const KEY_MIGRATION_PAYLOAD_KIND = 'agent-skill-package-key-migration-payload.v1';
const PACKAGE_KIND = 'agent-skill-package.v1';
const SIGNATURE_PAYLOAD_KIND = 'agent-skill-package-signature-payload.v1';
const MAX_PACKAGE_BYTES = 1024 * 1024;
const MAX_TRUSTED_KEYS = 24;
const KEY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const PUBLISHER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!isRecord(value)) return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a.localeCompare(b))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function cloneWithoutSignature(packageValue) {
  const security = isRecord(packageValue.security) ? { ...packageValue.security } : null;
  if (security) delete security.signature;
  const nextPackage = { ...packageValue, signature: undefined };
  if (security && Object.keys(security).length) nextPackage.security = security;
  else delete nextPackage.security;
  return JSON.parse(JSON.stringify(nextPackage));
}

function createCanonicalPayload(packageValue) {
  return JSON.stringify(normalizeJsonValue({
    kind: SIGNATURE_PAYLOAD_KIND,
    package: cloneWithoutSignature(packageValue),
  }));
}

function getSignature(packageValue) {
  const securitySignature = isRecord(packageValue.security) && isRecord(packageValue.security.signature)
    ? packageValue.security.signature : null;
  return isRecord(packageValue.signature) ? packageValue.signature : securitySignature;
}

function getKeyMigration(packageValue) {
  return isRecord(packageValue?.security) && isRecord(packageValue.security.keyMigration)
    ? packageValue.security.keyMigration
    : null;
}

function createCanonicalKeyMigrationPayload(packageValue) {
  const nextPackage = cloneWithoutSignature(packageValue);
  if (isRecord(nextPackage.security) && isRecord(nextPackage.security.keyMigration)) {
    const keyMigration = { ...nextPackage.security.keyMigration };
    delete keyMigration.newSignature;
    delete keyMigration.oldSignature;
    nextPackage.security = { ...nextPackage.security, keyMigration };
  }
  return JSON.stringify(normalizeJsonValue({
    kind: KEY_MIGRATION_PAYLOAD_KIND,
    package: nextPackage,
  }));
}

function getPublisherIdentity(packageValue) {
  if (!isRecord(packageValue)) return { error: 'package_json_invalid' };
  if (packageValue.publisher === undefined) return { publisherId: null };
  if (!isRecord(packageValue.publisher)) return { error: 'package_publisher_identity_invalid' };
  const publisherId = getString(packageValue.publisher.id);
  return PUBLISHER_ID_PATTERN.test(publisherId)
    ? { publisherId }
    : { error: 'package_publisher_identity_invalid' };
}

function normalizeTrustedKey(value) {
  if (!isRecord(value) || value.algorithm !== 'ed25519') return null;
  const keyId = getString(value.keyId);
  const publicKey = getString(value.publicKey);
  if (!KEY_ID_PATTERN.test(keyId) || !publicKey) return null;
  try {
    const keyObject = crypto.createPublicKey(publicKey);
    if (keyObject.asymmetricKeyType !== 'ed25519') return null;
    const keyFingerprint = crypto.createHash('sha256')
      .update(keyObject.export({ format: 'der', type: 'spki' }))
      .digest('hex');
    return { algorithm: 'ed25519', keyFingerprint, keyId, publicKey };
  } catch {
    return null;
  }
}

function normalizeTrustedKeyRegistry(value) {
  if (!isRecord(value) || value.kind !== KEY_REGISTRY_KIND || !Array.isArray(value.keys)) {
    throw new Error('trusted_key_registry_invalid');
  }
  const keys = value.keys.map(normalizeTrustedKey).filter(Boolean);
  if (keys.length !== value.keys.length || keys.length > MAX_TRUSTED_KEYS) {
    throw new Error('trusted_key_registry_invalid');
  }
  if (new Set(keys.map((key) => key.keyId)).size !== keys.length) throw new Error('trusted_key_registry_duplicate_key_id');
  return { keys, kind: KEY_REGISTRY_KIND };
}

function readTrustedKeyRegistry(registryPath) {
  try {
    return normalizeTrustedKeyRegistry(JSON.parse(fs.readFileSync(registryPath, 'utf8')));
  } catch {
    return { keys: [], kind: KEY_REGISTRY_KIND };
  }
}

function resolvePreviousKeyFingerprint(previousVerification, registryPath) {
  return previousVerification.keyFingerprint
    || readTrustedKeyRegistry(registryPath).keys
      .find((key) => key.keyId === previousVerification.keyId)?.keyFingerprint
    || null;
}

function verifyKeyMigration({
  packageValue,
  previousKeyFingerprint,
  previousVerification,
  publisherId,
  trustedKeys,
  verification,
}) {
  const migration = getKeyMigration(packageValue);
  if (!migration) return { error: 'package_signing_key_migration_missing', ok: false };
  if (!previousVerification.publisherId || !publisherId) {
    return { error: 'package_signing_key_migration_publisher_required', ok: false };
  }
  const normalized = {
    algorithm: getString(migration.algorithm),
    digest: getString(migration.digest),
    fromKeyFingerprint: getString(migration.fromKeyFingerprint).toLowerCase(),
    fromKeyId: getString(migration.fromKeyId),
    newSignature: getString(migration.newSignature),
    oldSignature: getString(migration.oldSignature),
    publisherId: getString(migration.publisherId),
    toKeyFingerprint: getString(migration.toKeyFingerprint).toLowerCase(),
    toKeyId: getString(migration.toKeyId),
  };
  if (
    normalized.algorithm !== 'ed25519'
    || normalized.digest !== 'sha256:canonical-key-migration-v1'
    || !KEY_ID_PATTERN.test(normalized.fromKeyId)
    || !KEY_ID_PATTERN.test(normalized.toKeyId)
    || !PUBLISHER_ID_PATTERN.test(normalized.publisherId)
    || !/^[a-f0-9]{64}$/u.test(normalized.fromKeyFingerprint)
    || !/^[a-f0-9]{64}$/u.test(normalized.toKeyFingerprint)
    || !normalized.oldSignature
    || !normalized.newSignature
  ) {
    return { error: 'package_signing_key_migration_invalid', ok: false };
  }
  if (
    normalized.fromKeyId !== previousVerification.keyId
    || normalized.fromKeyFingerprint !== previousKeyFingerprint
    || normalized.toKeyId !== verification.keyId
    || normalized.toKeyFingerprint !== verification.keyFingerprint
    || normalized.publisherId !== previousVerification.publisherId
    || normalized.publisherId !== publisherId
  ) {
    return { error: 'package_signing_key_migration_continuity_mismatch', ok: false };
  }
  const oldTrustedKey = trustedKeys.find((key) => (
    key.keyId === normalized.fromKeyId
    && key.keyFingerprint === normalized.fromKeyFingerprint
  ));
  const newTrustedKey = trustedKeys.find((key) => (
    key.keyId === normalized.toKeyId
    && key.keyFingerprint === normalized.toKeyFingerprint
  ));
  if (!oldTrustedKey || !newTrustedKey) {
    return { error: 'package_signing_key_migration_trusted_key_missing', ok: false };
  }
  try {
    const payload = Buffer.from(createCanonicalKeyMigrationPayload(packageValue));
    const oldVerified = crypto.verify(
      null,
      payload,
      oldTrustedKey.publicKey,
      Buffer.from(normalized.oldSignature, 'base64'),
    );
    const newVerified = crypto.verify(
      null,
      payload,
      newTrustedKey.publicKey,
      Buffer.from(normalized.newSignature, 'base64'),
    );
    return oldVerified && newVerified
      ? { migration: normalized, ok: true }
      : { error: 'package_signing_key_migration_verification_failed', ok: false };
  } catch {
    return { error: 'package_signing_key_migration_invalid', ok: false };
  }
}

function writeJsonAtomically(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempPath, targetPath);
}

function verifyPackageSignature(packageValue, trustedKeys) {
  if (!isRecord(packageValue) || packageValue.kind !== PACKAGE_KIND) return { error: 'package_json_invalid', ok: false };
  const signature = getSignature(packageValue);
  if (!signature) return { error: 'package_signature_missing', ok: false };
  const algorithm = getString(signature.algorithm);
  const digest = getString(signature.digest);
  const keyId = getString(signature.keyId);
  const encodedSignature = getString(signature.signature);
  if (algorithm !== 'ed25519' || digest !== 'sha256:canonical-v1' || !encodedSignature) {
    return { error: 'package_signature_invalid', ok: false };
  }
  const trustedKey = trustedKeys.find((key) => key.keyId === keyId && key.algorithm === algorithm);
  if (!trustedKey) return { error: 'package_signature_trusted_key_missing', ok: false };
  try {
    const verified = crypto.verify(null, Buffer.from(createCanonicalPayload(packageValue)), trustedKey.publicKey, Buffer.from(encodedSignature, 'base64'));
    return verified
      ? { keyFingerprint: trustedKey.keyFingerprint, keyId, ok: true, verifier: 'main-process-ed25519' }
      : { error: 'package_signature_verification_failed', ok: false };
  } catch {
    return { error: 'package_signature_invalid', ok: false };
  }
}

function parsePackage(rawPackageJson) {
  if (typeof rawPackageJson !== 'string' || !rawPackageJson.trim()) throw new Error('package_json_missing');
  if (Buffer.byteLength(rawPackageJson, 'utf8') > MAX_PACKAGE_BYTES) throw new Error('package_json_too_large');
  const packageValue = JSON.parse(rawPackageJson);
  if (!isRecord(packageValue) || packageValue.kind !== PACKAGE_KIND || !isRecord(packageValue.scaffold)) {
    throw new Error('package_json_invalid');
  }
  return packageValue;
}

function createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath, log } = {}) {
  if (!artifactStore || typeof artifactStore.stagePackage !== 'function') throw new Error('artifact_store_missing');
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) throw new Error('user_data_path_missing');
  const registryPath = path.join(path.resolve(userDataPath), 'skill-package-security-v1', 'trusted-keys.json');

  function stageSignedPackageInternal(request = {}, archiveVerification = null) {
    try {
      const trustedKeys = normalizeTrustedKeyRegistry(request.trustedKeyRegistry);
      const packageValue = parsePackage(request.rawPackageJson);
      const publisher = getPublisherIdentity(packageValue);
      if (publisher.error) return { error: publisher.error, ok: false };
      const verification = verifyPackageSignature(packageValue, trustedKeys.keys);
      if (!verification.ok) return verification;
      const current = artifactStore.getPackage?.(request.packageId);
      if (current && !current.ok) return current;
      let keyMigrationVerification = null;
      let previousVerification = null;
      if (current?.package) {
        previousVerification = current.package.signatureVerification;
        if (previousVerification?.status !== 'verified' || !previousVerification.keyId) {
          return { error: 'package_signing_continuity_unavailable', ok: false };
        }
        if (previousVerification.publisherId && previousVerification.publisherId !== publisher.publisherId) {
          return {
            error: 'package_publisher_continuity_mismatch',
            expectedPublisherId: previousVerification.publisherId,
            ok: false,
            receivedPublisherId: publisher.publisherId,
          };
        }
        const previousKeyFingerprint = resolvePreviousKeyFingerprint(previousVerification, registryPath);
        if (!previousKeyFingerprint) {
          return { error: 'package_signing_key_fingerprint_unavailable', ok: false };
        }
        if (previousVerification.keyId !== verification.keyId) {
          const migrationResult = verifyKeyMigration({
            packageValue,
            previousKeyFingerprint,
            previousVerification,
            publisherId: publisher.publisherId,
            trustedKeys: trustedKeys.keys,
            verification,
          });
          if (!migrationResult.ok) {
            return migrationResult.error === 'package_signing_key_migration_missing'
              ? {
                error: 'package_signing_key_continuity_mismatch',
                expectedKeyId: previousVerification.keyId,
                migrationError: migrationResult.error,
                ok: false,
                receivedKeyId: verification.keyId,
              }
              : migrationResult;
          }
          keyMigrationVerification = {
            fromKeyFingerprint: migrationResult.migration.fromKeyFingerprint,
            fromKeyId: migrationResult.migration.fromKeyId,
            publisherId: migrationResult.migration.publisherId,
            status: 'verified',
            toKeyFingerprint: migrationResult.migration.toKeyFingerprint,
            toKeyId: migrationResult.migration.toKeyId,
            verifiedAt: new Date().toISOString(),
            verifier: 'main-process-ed25519-dual-signature',
          };
        } else if (previousKeyFingerprint !== verification.keyFingerprint) {
          return {
            error: 'package_signing_key_continuity_mismatch',
            expectedKeyFingerprint: previousKeyFingerprint,
            expectedKeyId: previousVerification.keyId,
            ok: false,
            receivedKeyFingerprint: verification.keyFingerprint,
            receivedKeyId: verification.keyId,
          };
        }
      }
      writeJsonAtomically(registryPath, trustedKeys);
      const verifiedAt = new Date().toISOString();
      const staged = artifactStore.stagePackage({
        archiveVerification,
        packageId: request.packageId,
        rawPackageJson: request.rawPackageJson,
        signatureVerification: {
          algorithm: 'ed25519',
          keyFingerprint: verification.keyFingerprint,
          keyId: verification.keyId,
          keyMigration: keyMigrationVerification ?? previousVerification?.keyMigration ?? null,
          publisherId: publisher.publisherId,
          status: 'verified',
          verifiedAt,
          verifier: verification.verifier,
        },
      });
      if (!staged.ok) return staged;
      log?.('Signed skill package staged', {
        keyId: verification.keyId,
        keyMigration: keyMigrationVerification ? {
          fromKeyId: keyMigrationVerification.fromKeyId,
          toKeyId: keyMigrationVerification.toKeyId,
        } : null,
        packageId: staged.package.packageId,
        publisherId: publisher.publisherId,
      });
      return {
        ...staged,
        verification: {
          ...verification,
          keyMigration: keyMigrationVerification,
          publisherId: publisher.publisherId,
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function stageSignedPackage(request = {}) {
    return stageSignedPackageInternal(request, null);
  }

  function stageSignedPackageFromArchive(request = {}) {
    return stageSignedPackageInternal(request, request.archiveVerification ?? null);
  }

  return { getPaths: () => ({ registryPath }), stageSignedPackage, stageSignedPackageFromArchive };
}

module.exports = { createSkillPackageSignedInstallCoordinator };
