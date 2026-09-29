import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { createExternalSkillPackageArchiveInstallerService } = require('../electron/externalSkillPackageArchiveInstallerService.cjs');
const { createExternalSkillPackageLifecycleService } = require('../electron/externalSkillPackageLifecycleService.cjs');
const { createExternalSkillMarketplacePublisherCatalogService, createCanonicalPublisherCatalogPayload } = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');
const { createExternalSkillMarketplacePublisherIdentityService } = require('../electron/externalSkillMarketplacePublisherIdentityService.cjs');
const { createExternalSkillReleaseAdmissionService } = require('../electron/externalSkillReleaseAdmissionService.cjs');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');

const DEFAULT_PUBLISHER_ID = 'ai-desktop-pet.official';
const DEFAULT_SKILL_ID = 'official.lifecycle-probe';
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const ADD_ONE_WASM = Buffer.from(
  '0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041016a0b',
  'hex',
).toString('base64');

const crcTable = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  }
  return (value ^ 0xffffffff) >>> 0;
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort((left, right) => left.localeCompare(right))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function createPackageSignaturePayload(packageValue) {
  const unsigned = JSON.parse(JSON.stringify(packageValue));
  delete unsigned.signature;
  if (unsigned.security?.signature) delete unsigned.security.signature;
  return JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-signature-payload.v1',
    package: unsigned,
  }));
}

function createKeyMigrationSignaturePayload(packageValue) {
  const unsigned = JSON.parse(createPackageSignaturePayload(packageValue));
  delete unsigned.package.security.keyMigration.oldSignature;
  delete unsigned.package.security.keyMigration.newSignature;
  return JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-key-migration-payload.v1',
    package: unsigned.package,
  }));
}

function fingerprint(publicKey) {
  return crypto.createHash('sha256')
    .update(publicKey.export({ format: 'der', type: 'spki' }))
    .digest('hex');
}

function exportPrivateKey(privateKey) {
  return privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
}

function exportPublicKey(publicKey) {
  return publicKey.export({ format: 'pem', type: 'spki' }).toString()
    .replace(/\r\n/gu, '\n')
    .trim();
}

function createKeyRecord(keyId, publicKey) {
  return {
    algorithm: 'ed25519',
    keyId,
    publicKey: exportPublicKey(publicKey),
  };
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

function createPackage({ keyId, packageId, privateKey, publisherId, skillId, version }) {
  return signPackage({
    distribution: {
      kind: 'agent-skill-package-distribution.v1',
      packageId,
      publisherId,
      skillId,
      version,
    },
    kind: 'agent-skill-package.v1',
    publisher: { id: publisherId },
    runtime: {
      entrypoint: 'run',
      kind: 'wasm-pure-i32-v1',
      moduleBase64: ADD_ONE_WASM,
    },
    scaffold: {
      package: { runtime: 'external-sandbox', version },
      skill: { id: skillId },
    },
  }, keyId, privateKey);
}

function createMigratedPackage(options) {
  const packageValue = {
    distribution: {
      kind: 'agent-skill-package-distribution.v1',
      packageId: options.packageId,
      publisherId: options.publisherId,
      skillId: options.skillId,
      version: options.version,
    },
    kind: 'agent-skill-package.v1',
    publisher: { id: options.publisherId },
    runtime: {
      entrypoint: 'run',
      kind: 'wasm-pure-i32-v1',
      moduleBase64: ADD_ONE_WASM,
    },
    scaffold: {
      package: { runtime: 'external-sandbox', version: options.version },
      skill: { id: options.skillId },
    },
    security: {
      keyMigration: {
        algorithm: 'ed25519',
        digest: 'sha256:canonical-key-migration-v1',
        fromKeyFingerprint: options.fromKeyFingerprint,
        fromKeyId: options.fromKeyId,
        publisherId: options.publisherId,
        toKeyFingerprint: options.toKeyFingerprint,
        toKeyId: options.toKeyId,
      },
    },
  };
  const payload = Buffer.from(createKeyMigrationSignaturePayload(packageValue));
  packageValue.security.keyMigration.oldSignature = crypto.sign(null, payload, options.fromPrivateKey).toString('base64');
  packageValue.security.keyMigration.newSignature = crypto.sign(null, payload, options.toPrivateKey).toString('base64');
  return signPackage(packageValue, options.toKeyId, options.toPrivateKey);
}

function buildZip(entries) {
  const localParts = [];
  const directoryParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content);
    const method = entry.deflate ? 8 : 0;
    const compressed = entry.deflate ? zlib.deflateRawSync(content) : content;
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(content.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(localOffset, 42);
    localParts.push(local, name, compressed);
    directoryParts.push(directory, name);
    localOffset += local.length + name.length + compressed.length;
  }
  const directoryBuffer = Buffer.concat(directoryParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBuffer.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, directoryBuffer, end]);
}

function createArchive(packageValue) {
  const packageBuffer = Buffer.from(JSON.stringify(packageValue));
  const identity = packageValue.distribution;
  const manifest = {
    formatVersion: 1,
    kind: 'agent-skill-package-archive-manifest.v1',
    packageEntry: 'package.json',
    packageId: identity.packageId,
    packageSha256: crypto.createHash('sha256').update(packageBuffer).digest('hex'),
    publisherId: identity.publisherId,
    skillId: identity.skillId,
    version: identity.version,
  };
  return buildZip([
    { content: JSON.stringify(manifest), name: 'manifest.json' },
    { content: packageBuffer, deflate: true, name: 'package.json' },
  ]);
}

function requireFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file.`);
}

function readJson(filePath, label) {
  requireFile(filePath, label);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
}

function writeFile(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, { flag: 'wx', mode });
}

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    const match = /^--([^=]+)=(.*)$/u.exec(String(argument));
    if (match) values.set(match[1], match[2].trim());
  }
  return {
    catalogDays: Number(values.get('catalog-days') || 60),
    marketplaceDirectory: values.get('marketplace-dir') || '',
    publisherId: values.get('publisher-id') || DEFAULT_PUBLISHER_ID,
    skillId: values.get('skill-id') || DEFAULT_SKILL_ID,
  };
}

function validateOptions(options) {
  if (!options.marketplaceDirectory) throw new Error('--marketplace-dir is required.');
  if (!ID_PATTERN.test(options.publisherId)) throw new Error('--publisher-id is invalid.');
  if (!ID_PATTERN.test(options.skillId)) throw new Error('--skill-id is invalid.');
  if (!Number.isSafeInteger(options.catalogDays) || options.catalogDays < 1 || options.catalogDays > 89) {
    throw new Error('--catalog-days must be an integer between 1 and 89.');
  }
}

function createCapabilityGatewayStub() {
  return {
    resetPackageHealth: () => ({ ok: true, reset: false }),
    revokeGrant: () => ({ ok: true, revoked: false }),
  };
}

function assertResult(result, label) {
  if (!result?.ok) throw new Error(`${label} failed: ${result?.error || 'unknown_error'}`);
  return result;
}

export function bootstrapFirstMarketplacePublisher({
  catalogDays = 60,
  marketplaceDirectory,
  now = Date.now,
  publisherId = DEFAULT_PUBLISHER_ID,
  skillId = DEFAULT_SKILL_ID,
} = {}) {
  validateOptions({ catalogDays, marketplaceDirectory, publisherId, skillId });
  const marketplaceRoot = path.resolve(marketplaceDirectory);
  const rootPrivateKeyPath = path.join(marketplaceRoot, 'private', 'catalog-root-private-key.pem');
  const rootRegistryPath = path.join(marketplaceRoot, 'production', 'marketplaceCatalogRootKeys.json');
  const currentCatalogPath = path.join(marketplaceRoot, 'publish', 'v1', 'publishers.json');
  requireFile(rootPrivateKeyPath, 'Catalog root private key');
  requireFile(rootRegistryPath, 'Catalog root registry');
  const currentEnvelope = readJson(currentCatalogPath, 'Current publisher Catalog');
  const targetPublisherDirectory = path.join(marketplaceRoot, 'publishers', publisherId);
  const targetCandidateDirectory = path.join(marketplaceRoot, 'publish-candidate');
  if (fs.existsSync(targetPublisherDirectory)) throw new Error(`Refusing to overwrite Publisher directory: ${publisherId}`);
  if (fs.existsSync(targetCandidateDirectory)) throw new Error('Refusing to overwrite existing publish-candidate directory.');

  const tempRuntime = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-first-publisher-'));
  const stagingRoot = path.join(marketplaceRoot, `.publisher-bootstrap-${process.pid}-${Date.now()}`);
  try {
    const verifier = createExternalSkillMarketplacePublisherCatalogService({
      now,
      rootKeyRegistryPath: rootRegistryPath,
      userDataPath: tempRuntime,
    });
    const currentVerification = verifier.verifyEnvelope(currentEnvelope, { allowExpired: true });
    if (!currentVerification.ok) {
      throw new Error(`Current publisher Catalog verification failed: ${currentVerification.error}`);
    }

    const rootPrivateKey = crypto.createPrivateKey(fs.readFileSync(rootPrivateKeyPath, 'utf8'));
    if (rootPrivateKey.asymmetricKeyType !== 'ed25519') throw new Error('Catalog root private key is not Ed25519.');
    const keyV1 = crypto.generateKeyPairSync('ed25519');
    const keyV2 = crypto.generateKeyPairSync('ed25519');
    const keyIdV1 = `${publisherId}-signing-2026-v1`;
    const keyIdV2 = `${publisherId}-signing-2026-v2`;
    const fingerprintV1 = fingerprint(keyV1.publicKey);
    const fingerprintV2 = fingerprint(keyV2.publicKey);
    const packageId = `${publisherId}:${skillId}`;
    const packages = {
      install: createPackage({
        keyId: keyIdV1,
        packageId,
        privateKey: keyV1.privateKey,
        publisherId,
        skillId,
        version: '1.0.0',
      }),
      update: createPackage({
        keyId: keyIdV1,
        packageId,
        privateKey: keyV1.privateKey,
        publisherId,
        skillId,
        version: '1.1.0',
      }),
      downgrade: createPackage({
        keyId: keyIdV1,
        packageId,
        privateKey: keyV1.privateKey,
        publisherId,
        skillId,
        version: '1.0.5',
      }),
      migration: createMigratedPackage({
        fromKeyFingerprint: fingerprintV1,
        fromKeyId: keyIdV1,
        fromPrivateKey: keyV1.privateKey,
        packageId,
        publisherId,
        skillId,
        toKeyFingerprint: fingerprintV2,
        toKeyId: keyIdV2,
        toPrivateKey: keyV2.privateKey,
        version: '2.0.0',
      }),
    };
    const archives = Object.fromEntries(
      Object.entries(packages).map(([kind, packageValue]) => [kind, createArchive(packageValue)]),
    );
    const trustedKeyRegistry = {
      keys: [
        createKeyRecord(keyIdV1, keyV1.publicKey),
        createKeyRecord(keyIdV2, keyV2.publicKey),
      ],
      kind: 'agent-skill-trusted-signature-key-registry.v1',
    };

    const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRuntime });
    const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRuntime });
    const installer = createExternalSkillPackageArchiveInstallerService({ artifactStore, signedInstallCoordinator: coordinator });
    const lifecycle = createExternalSkillPackageLifecycleService({
      artifactStore,
      capabilityGateway: createCapabilityGatewayStub(),
      signedInstallCoordinator: coordinator,
      userDataPath: tempRuntime,
    });
    const installed = assertResult(installer.stageSignedArchive({
      archiveBytes: archives.install,
      trustedKeyRegistry,
    }), 'Install');
    const updated = assertResult(installer.stageSignedArchive({
      archiveBytes: archives.update,
      trustedKeyRegistry,
    }), 'Update');
    const downgrade = installer.stageSignedArchive({
      archiveBytes: archives.downgrade,
      trustedKeyRegistry,
    });
    if (downgrade.ok || downgrade.error !== 'package_archive_version_downgrade_rejected') {
      throw new Error(`Downgrade rejection failed: ${downgrade.error || 'unexpected_success'}`);
    }
    const migrated = assertResult(installer.stageSignedArchive({
      archiveBytes: archives.migration,
      trustedKeyRegistry,
    }), 'Key migration');
    if (migrated.verification?.keyMigration?.status !== 'verified') {
      throw new Error('Key migration did not retain dual-signature verification evidence.');
    }
    const uninstalled = assertResult(lifecycle.uninstallPackage({ packageId }), 'Uninstall');
    const restored = assertResult(lifecycle.rollbackUninstall({
      packageId,
      snapshotId: uninstalled.snapshot.snapshotId,
    }), 'Uninstall rollback');

    const nowMs = Number(now());
    if (!Number.isFinite(nowMs)) throw new Error('Publisher bootstrap clock is invalid.');
    const minimumIssuedAtMs = Date.parse(currentEnvelope.catalog.issuedAt) + 1;
    const issuedAtMs = Math.max(nowMs, minimumIssuedAtMs);
    const issuedAt = new Date(issuedAtMs).toISOString();
    const expiresAt = new Date(issuedAtMs + catalogDays * 24 * 60 * 60 * 1000).toISOString();
    const candidateCatalog = {
      expiresAt,
      issuedAt,
      kind: 'external-skill-marketplace-publisher-catalog.v1',
      publishers: [{
        keyFingerprint: fingerprintV2,
        keyId: keyIdV2,
        publisherId,
        status: 'active',
        verifiedAt: issuedAt,
      }],
      sequence: currentEnvelope.catalog.sequence + 1,
    };
    const candidateEnvelope = {
      catalog: candidateCatalog,
      kind: 'external-skill-marketplace-publisher-catalog-envelope.v1',
      signature: {
        algorithm: 'ed25519',
        digest: 'sha256:canonical-marketplace-publisher-catalog-v1',
        keyId: currentEnvelope.signature.keyId,
        signature: crypto.sign(
          null,
          Buffer.from(createCanonicalPublisherCatalogPayload(candidateCatalog)),
          rootPrivateKey,
        ).toString('base64'),
      },
    };
    const candidateVerification = verifier.verifyEnvelope(candidateEnvelope);
    if (!candidateVerification.ok) {
      throw new Error(`Candidate Catalog verification failed: ${candidateVerification.error}`);
    }
    const provisioned = assertResult(verifier.provisionCatalog(candidateEnvelope), 'Candidate Catalog provisioning');
    const publisherIdentityService = createExternalSkillMarketplacePublisherIdentityService({
      catalogService: verifier,
      userDataPath: tempRuntime,
    });
    const admission = createExternalSkillReleaseAdmissionService({
      artifactStore,
      healthService: { preflight: () => ({ allowed: true, consecutiveFailures: 0 }) },
      hostContext: { arch: 'x64', packaged: true, platform: 'win32' },
      publisherIdentityService,
    }).createAdmissionReport({ packageIds: [packageId] });
    const admissionRow = admission.rows[0];
    if (admissionRow.marketplacePublisherIdentity.status !== 'verified') {
      throw new Error(`Publisher identity admission failed: ${admissionRow.marketplacePublisherIdentity.issueCodes.join(',')}`);
    }
    if (admissionRow.marketReleaseAllowed !== false || admission.marketReleaseEnabled !== false) {
      throw new Error('Market release hard-disable invariant was violated.');
    }

    const report = {
      catalog: {
        digest: candidateVerification.catalogDigest,
        expiresAt,
        publisherCount: 1,
        sequence: candidateCatalog.sequence,
        status: provisioned.status,
      },
      generatedAt: new Date(nowMs).toISOString(),
      kind: 'first-marketplace-publisher-lifecycle-report.v1',
      lifecycle: {
        downgrade: { error: downgrade.error, rejected: true, version: '1.0.5' },
        install: { status: installed.status, version: installed.identity.version },
        keyMigration: {
          fromKeyId: migrated.verification.keyMigration.fromKeyId,
          status: migrated.verification.keyMigration.status,
          toKeyId: migrated.verification.keyMigration.toKeyId,
          version: migrated.identity.version,
        },
        uninstall: { status: uninstalled.receipt.status },
        uninstallRollback: { status: restored.receipt.status },
        update: { status: updated.status, version: updated.identity.version },
      },
      marketReleaseAllowed: false,
      package: {
        packageId,
        runtimeKind: 'wasm-pure-i32-v1',
        skillId,
      },
      publisher: {
        activeKeyFingerprint: fingerprintV2,
        activeKeyId: keyIdV2,
        previousKeyFingerprint: fingerprintV1,
        previousKeyId: keyIdV1,
        publisherId,
        status: admissionRow.marketplacePublisherIdentity.status,
      },
      releaseAdmission: {
        controlledRuntimeStatus: admissionRow.controlledRuntimeStatus,
        marketReleaseIssueCodes: admissionRow.marketReleaseIssueCodes,
        marketReleaseStatus: admissionRow.marketReleaseStatus,
      },
    };

    const publisherStage = path.join(stagingRoot, 'publisher');
    const candidateStage = path.join(stagingRoot, 'publish-candidate', 'v1');
    writeFile(path.join(publisherStage, 'private', 'publisher-signing-key-v1.pem'), exportPrivateKey(keyV1.privateKey));
    writeFile(path.join(publisherStage, 'private', 'publisher-signing-key-v2.pem'), exportPrivateKey(keyV2.privateKey));
    writeJson(path.join(publisherStage, 'public', 'trustedPublisherKeys.json'), trustedKeyRegistry);
    writeJson(path.join(publisherStage, 'public', 'publisher.json'), {
      activeKeyFingerprint: fingerprintV2,
      activeKeyId: keyIdV2,
      kind: 'marketplace-publisher-profile.v1',
      previousKeyFingerprint: fingerprintV1,
      previousKeyId: keyIdV1,
      publisherId,
      status: 'active',
    });
    for (const [kind, archive] of Object.entries(archives)) {
      writeFile(path.join(publisherStage, 'packages', `${kind}-${packages[kind].distribution.version}.skillpkg.zip`), archive);
    }
    writeJson(path.join(publisherStage, 'reports', 'first-publisher-lifecycle-report.json'), report);
    writeJson(path.join(candidateStage, 'publishers.json'), candidateEnvelope);

    fs.mkdirSync(path.dirname(targetPublisherDirectory), { recursive: true });
    fs.renameSync(publisherStage, targetPublisherDirectory);
    fs.renameSync(path.join(stagingRoot, 'publish-candidate'), targetCandidateDirectory);

    return {
      activeKeyFingerprint: fingerprintV2,
      activeKeyId: keyIdV2,
      catalogExpiresAt: expiresAt,
      catalogSequence: candidateCatalog.sequence,
      lifecycleStatus: 'passed',
      marketReleaseAllowed: false,
      packageId,
      publisherId,
    };
  } finally {
    fs.rmSync(tempRuntime, { force: true, recursive: true });
    fs.rmSync(stagingRoot, { force: true, recursive: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = bootstrapFirstMarketplacePublisher(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
