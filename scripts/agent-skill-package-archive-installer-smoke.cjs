const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { createExternalSkillPackageArchiveInstallerService } = require('../electron/externalSkillPackageArchiveInstallerService.cjs');
const { createExternalSkillReleaseAdmissionService } = require('../electron/externalSkillReleaseAdmissionService.cjs');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');

const addOneWasm = Buffer.from(
  '0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041016a0b',
  'hex',
).toString('base64');

const crcTable = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((left, right) => left.localeCompare(right))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function createSignaturePayload(packageValue) {
  const unsigned = JSON.parse(JSON.stringify(packageValue));
  delete unsigned.signature;
  return JSON.stringify(normalizeJsonValue({ kind: 'agent-skill-package-signature-payload.v1', package: unsigned }));
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

function createPackageFixture(keys, version, overrides = {}) {
  const identity = {
    kind: 'agent-skill-package-distribution.v1',
    packageId: 'studio.example:character.animation',
    publisherId: 'studio.example',
    skillId: 'character.animation',
    version,
    ...overrides.distribution,
  };
  const packageValue = {
    distribution: identity,
    kind: 'agent-skill-package.v1',
    publisher: { id: overrides.publisherId ?? 'studio.example' },
    runtime: { entrypoint: 'run', kind: 'wasm-pure-i32-v1', moduleBase64: addOneWasm },
    scaffold: {
      package: { runtime: 'external-sandbox', version: overrides.scaffoldVersion ?? version },
      skill: { id: overrides.skillId ?? 'character.animation' },
    },
  };
  packageValue.signature = {
    algorithm: 'ed25519',
    digest: 'sha256:canonical-v1',
    keyId: 'studio-key-v1',
    signature: crypto.sign(
      null,
      Buffer.from(createSignaturePayload(packageValue)),
      keys.privateKey,
    ).toString('base64'),
  };
  return packageValue;
}

function createArchive(packageValue, options = {}) {
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
    ...options.manifest,
  };
  const entries = [
    { content: JSON.stringify(manifest), name: 'manifest.json' },
    { content: packageBuffer, deflate: true, name: 'package.json' },
    ...(options.extraEntries ?? []),
  ];
  return buildZip(entries);
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-skill-archive-'));
  try {
    const keys = crypto.generateKeyPairSync('ed25519');
    const trustedKeyRegistry = {
      keys: [{
        algorithm: 'ed25519',
        keyId: 'studio-key-v1',
        publicKey: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      }],
      kind: 'agent-skill-trusted-signature-key-registry.v1',
    };
    const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
    const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
    const installer = createExternalSkillPackageArchiveInstallerService({ artifactStore, signedInstallCoordinator: coordinator });

    const versionOne = createPackageFixture(keys, '1.0.0');
    const installed = installer.stageSignedArchive({
      archiveBytes: createArchive(versionOne),
      trustedKeyRegistry,
    });
    assert.equal(installed.ok, true, JSON.stringify(installed));
    assert.equal(installed.status, 'installed');
    assert.equal(installed.identity.packageId, 'studio.example:character.animation');
    assert.equal(JSON.parse(installed.packageJson).distribution.version, '1.0.0');
    assert.deepEqual(installed.migration, { fromVersion: null, kind: 'install', toVersion: '1.0.0' });
    assert.equal(installer.stageSignedArchiveBase64({ archiveBase64: '***', trustedKeyRegistry }).error, 'package_archive_base64_invalid');
    const firstArtifact = artifactStore.getPackage(installed.identity.packageId).package;
    const firstDigest = firstArtifact.artifactDigest;
    assert.equal(firstArtifact.archiveVerification.status, 'verified');
    assert.equal(firstArtifact.archiveVerification.verifier, 'main-process-package-archive-v1');
    assert.equal(firstArtifact.archiveVerification.artifactDigest, firstArtifact.artifactDigest);
    assert.match(firstArtifact.archiveVerification.archiveDigest, /^[a-f0-9]{64}$/u);

    const versionTwo = createPackageFixture(keys, '1.1.0-beta.1');
    const updated = installer.stageSignedArchiveBase64({
      archiveBase64: createArchive(versionTwo).toString('base64'),
      trustedKeyRegistry,
    });
    assert.equal(updated.ok, true, JSON.stringify(updated));
    assert.equal(updated.status, 'updated');
    assert.equal(JSON.parse(updated.packageJson).distribution.version, '1.1.0-beta.1');
    assert.deepEqual(updated.migration, {
      fromVersion: '1.0.0',
      kind: 'update',
      toVersion: '1.1.0-beta.1',
    });
    const updatedDigest = artifactStore.getPackage(installed.identity.packageId).package.artifactDigest;
    assert.notEqual(updatedDigest, firstDigest);

    const admissionService = createExternalSkillReleaseAdmissionService({
      artifactStore,
      healthService: { preflight: () => ({ allowed: true, consecutiveFailures: 0 }) },
      hostContext: { arch: 'x64', packaged: true, platform: 'win32' },
      publisherIdentityService: {
        assessArtifact: () => ({
          issueCodes: [],
          keyFingerprint: 'a'.repeat(64),
          keyId: 'studio-key-v1',
          kind: 'external-skill-marketplace-publisher-assessment.v1',
          publisherId: 'studio.example',
          registryStatus: 'ready',
          status: 'verified',
        }),
      },
    });
    const admissionRow = admissionService.createAdmissionReport({
      packageIds: [installed.identity.packageId],
    }).rows[0];
    assert.equal(
      admissionRow.marketplaceChecks.find((check) => check.id === 'package-archive-provenance').status,
      'pass',
    );
    assert.equal(admissionRow.controlledRuntimeStatus, 'controlled-runtime-eligible');
    assert.equal(admissionRow.marketReleaseIssueCodes.includes('package-archive-provenance'), false);

    const sameVersion = createPackageFixture(keys, '1.1.0-beta.1');
    assert.equal(installer.stageSignedArchive({
      archiveBytes: createArchive(sameVersion),
      trustedKeyRegistry,
    }).error, 'package_archive_version_conflict');
    assert.equal(artifactStore.getPackage(installed.identity.packageId).package.artifactDigest, updatedDigest);

    const downgrade = createPackageFixture(keys, '1.0.9');
    assert.equal(installer.stageSignedArchive({
      archiveBytes: createArchive(downgrade),
      trustedKeyRegistry,
    }).error, 'package_archive_version_downgrade_rejected');
    assert.equal(artifactStore.getPackage(installed.identity.packageId).package.artifactDigest, updatedDigest);

    const identityMismatch = createPackageFixture(keys, '1.2.0', { skillId: 'other.skill' });
    assert.equal(installer.stageSignedArchive({
      archiveBytes: createArchive(identityMismatch),
      trustedKeyRegistry,
    }).error, 'package_archive_identity_invalid');

    const extraFile = createArchive(createPackageFixture(keys, '1.2.0'), {
      extraEntries: [{ content: 'not allowed', name: 'runtime/module.wasm' }],
    });
    assert.equal(installer.stageSignedArchive({ archiveBytes: extraFile, trustedKeyRegistry }).error, 'package_archive_entry_set_invalid');

    const traversal = createArchive(createPackageFixture(keys, '1.2.0'), {
      extraEntries: [{ content: 'bad', name: '../outside.js' }],
    });
    assert.equal(installer.stageSignedArchive({ archiveBytes: traversal, trustedKeyRegistry }).error, 'package_archive_entry_name_invalid');

    const badDigest = createArchive(createPackageFixture(keys, '1.2.0'), {
      manifest: { packageSha256: '0'.repeat(64) },
    });
    assert.equal(installer.stageSignedArchive({ archiveBytes: badDigest, trustedKeyRegistry }).error, 'package_archive_identity_invalid');

    const tampered = createPackageFixture(keys, '1.2.0');
    tampered.scaffold.package.runtime = 'tampered-runtime';
    assert.equal(installer.stageSignedArchive({
      archiveBytes: createArchive(tampered),
      trustedKeyRegistry,
    }).error, 'package_signature_verification_failed');
    assert.equal(artifactStore.getPackage(installed.identity.packageId).package.artifactDigest, updatedDigest);

    const corrupted = Buffer.from(createArchive(createPackageFixture(keys, '1.2.0')));
    corrupted[50] ^= 0xff;
    assert.equal(installer.stageSignedArchive({ archiveBytes: corrupted, trustedKeyRegistry }).ok, false);
    assert.equal(artifactStore.getPackage(installed.identity.packageId).package.artifactDigest, updatedDigest);

    const archiveProvenance = artifactStore.getPackage(installed.identity.packageId).package.archiveVerification;
    const uninstalled = artifactStore.uninstallPackage(installed.identity.packageId);
    assert.equal(uninstalled.ok, true, JSON.stringify(uninstalled));
    const restored = artifactStore.restoreUninstalledPackage({
      packageId: installed.identity.packageId,
      snapshotId: uninstalled.snapshot.snapshotId,
    });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    assert.deepEqual(restored.package.archiveVerification, archiveProvenance);
    const restoredAdmissionRow = admissionService.createAdmissionReport({
      packageIds: [installed.identity.packageId],
    }).rows[0];
    assert.equal(
      restoredAdmissionRow.marketplaceChecks.find((check) => check.id === 'package-archive-provenance').status,
      'pass',
    );

    const directJsonUpdate = createPackageFixture(keys, '1.2.0');
    const directStaged = coordinator.stageSignedPackage({
      archiveVerification: archiveProvenance,
      packageId: installed.identity.packageId,
      rawPackageJson: JSON.stringify(directJsonUpdate),
      trustedKeyRegistry,
    });
    assert.equal(directStaged.ok, true, JSON.stringify(directStaged));
    assert.equal(directStaged.package.archiveVerification, null);
    const directAdmissionRow = admissionService.createAdmissionReport({
      packageIds: [installed.identity.packageId],
    }).rows[0];
    assert.equal(directAdmissionRow.controlledRuntimeStatus, 'controlled-runtime-eligible');
    assert.equal(
      directAdmissionRow.marketplaceChecks.find((check) => check.id === 'package-archive-provenance').status,
      'fail',
    );
    assert.equal(directAdmissionRow.marketReleaseIssueCodes.includes('package-archive-provenance'), true);

    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
    const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ipcHandlers.cjs'), 'utf8');
    const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
    assert.match(mainSource, /createExternalSkillPackageArchiveInstallerService/u);
    assert.match(ipcSource, /stageSignedArchiveBase64/u);
    assert.match(preloadSource, /stageSignedSkillPackageArchive/u);
    assert.equal(ipcSource.includes('marketReleaseEnabled: true'), false);
    console.log('agent skill package archive installer smoke passed');
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
