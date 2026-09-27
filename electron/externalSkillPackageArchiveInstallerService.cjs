const crypto = require('crypto');
const { extractSkillPackageArchiveEntries } = require('./skillPackageArchiveZip.cjs');

const ARCHIVE_MANIFEST_KIND = 'agent-skill-package-archive-manifest.v1';
const DISTRIBUTION_KIND = 'agent-skill-package-distribution.v1';
const PACKAGE_KIND = 'agent-skill-package.v1';
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const MAX_ARCHIVE_BASE64_LENGTH = 5_592_408;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseJson(buffer, errorCode) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error(errorCode);
  }
}

function parseVersion(value) {
  const version = getString(value);
  const matched = VERSION_PATTERN.exec(version);
  if (!matched || version.length > 64) return null;
  return {
    core: matched.slice(1, 4).map(Number),
    prerelease: matched[4] ? matched[4].split('.') : [],
    version,
  };
}

function comparePrerelease(left, right) {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] === undefined) return -1;
    if (right[index] === undefined) return 1;
    if (left[index] === right[index]) continue;
    const leftNumeric = /^\d+$/u.test(left[index]);
    const rightNumeric = /^\d+$/u.test(right[index]);
    if (leftNumeric && rightNumeric) return Number(left[index]) < Number(right[index]) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return left[index].localeCompare(right[index]);
  }
  return 0;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] < right.core[index] ? -1 : 1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function normalizeIdentity(value) {
  if (!isRecord(value) || value.kind !== DISTRIBUTION_KIND) return null;
  const identity = {
    kind: DISTRIBUTION_KIND,
    packageId: getString(value.packageId),
    publisherId: getString(value.publisherId),
    skillId: getString(value.skillId),
    version: getString(value.version),
  };
  return PACKAGE_ID_PATTERN.test(identity.packageId)
    && ID_PATTERN.test(identity.publisherId)
    && ID_PATTERN.test(identity.skillId)
    && parseVersion(identity.version)
    ? identity
    : null;
}

function inspectArchive(archiveBytes) {
  const entries = extractSkillPackageArchiveEntries(archiveBytes);
  if (entries.size !== 2 || !entries.has('manifest.json') || !entries.has('package.json')) {
    throw new Error('package_archive_entry_set_invalid');
  }
  const manifestBuffer = entries.get('manifest.json');
  const packageBuffer = entries.get('package.json');
  if (manifestBuffer.length > 16 * 1024) throw new Error('package_archive_manifest_too_large');
  const manifest = parseJson(manifestBuffer, 'package_archive_manifest_invalid');
  const packageValue = parseJson(packageBuffer, 'package_archive_package_json_invalid');
  const identity = normalizeIdentity(packageValue?.distribution);
  if (
    !isRecord(manifest)
    || manifest.kind !== ARCHIVE_MANIFEST_KIND
    || manifest.formatVersion !== 1
    || manifest.packageEntry !== 'package.json'
    || !/^[a-f0-9]{64}$/u.test(getString(manifest.packageSha256))
    || !identity
    || !isRecord(packageValue)
    || packageValue.kind !== PACKAGE_KIND
    || !isRecord(packageValue.publisher)
    || getString(packageValue.publisher.id) !== identity.publisherId
    || !isRecord(packageValue.scaffold)
    || !isRecord(packageValue.scaffold.skill)
    || getString(packageValue.scaffold.skill.id) !== identity.skillId
    || !isRecord(packageValue.scaffold.package)
    || getString(packageValue.scaffold.package.version) !== identity.version
    || getString(manifest.packageId) !== identity.packageId
    || getString(manifest.publisherId) !== identity.publisherId
    || getString(manifest.skillId) !== identity.skillId
    || getString(manifest.version) !== identity.version
    || getString(manifest.packageSha256) !== hash(packageBuffer)
  ) throw new Error('package_archive_identity_invalid');
  return {
    archiveDigest: hash(Buffer.isBuffer(archiveBytes) ? archiveBytes : Buffer.from(archiveBytes)),
    archivePackageSha256: hash(packageBuffer),
    artifactDigest: hash(`${JSON.stringify(packageValue)}\n`),
    identity,
    manifest,
    packageValue,
    rawPackageJson: packageBuffer.toString('utf8'),
  };
}

function readInstalledIdentity(artifactStore, packageId) {
  const current = artifactStore.getPackage(packageId);
  if (!current.ok) return current;
  if (!current.package) return { identity: null, ok: true, package: null };
  const artifact = artifactStore.readPackageArtifact(packageId);
  if (!artifact.ok) return artifact;
  try {
    const packageValue = JSON.parse(artifact.rawPackageJson);
    const distribution = normalizeIdentity(packageValue.distribution);
    const skillId = distribution?.skillId ?? getString(packageValue?.scaffold?.skill?.id);
    const version = distribution?.version ?? getString(packageValue?.scaffold?.package?.version);
    if (!ID_PATTERN.test(skillId) || !parseVersion(version)) {
      return { error: 'package_archive_existing_identity_unavailable', ok: false };
    }
    return { identity: { packageId, skillId, version }, ok: true, package: current.package };
  } catch {
    return { error: 'package_archive_existing_identity_unavailable', ok: false };
  }
}

function createExternalSkillPackageArchiveInstallerService({ artifactStore, signedInstallCoordinator, log } = {}) {
  if (!artifactStore || typeof artifactStore.readPackageArtifact !== 'function') throw new Error('artifact_store_missing');
  if (!signedInstallCoordinator || typeof signedInstallCoordinator.stageSignedPackageFromArchive !== 'function') {
    throw new Error('signed_install_coordinator_missing');
  }

  function stageSignedArchive(request = {}) {
    try {
      const archive = inspectArchive(request.archiveBytes);
      const installed = readInstalledIdentity(artifactStore, archive.identity.packageId);
      if (!installed.ok) return installed;
      let migration = { fromVersion: null, kind: 'install', toVersion: archive.identity.version };
      if (installed.identity) {
        if (installed.identity.skillId !== archive.identity.skillId) {
          return { error: 'package_archive_skill_identity_mismatch', ok: false };
        }
        const fromVersion = parseVersion(installed.identity.version);
        const toVersion = parseVersion(archive.identity.version);
        const comparison = compareVersions(toVersion, fromVersion);
        if (comparison < 0) return { error: 'package_archive_version_downgrade_rejected', ok: false };
        if (comparison === 0) return { error: 'package_archive_version_conflict', ok: false };
        migration = {
          fromVersion: installed.identity.version,
          kind: 'update',
          toVersion: archive.identity.version,
        };
      }
      const staged = signedInstallCoordinator.stageSignedPackageFromArchive({
        archiveVerification: {
          archiveDigest: archive.archiveDigest,
          archivePackageSha256: archive.archivePackageSha256,
          artifactDigest: archive.artifactDigest,
          formatVersion: 1,
          kind: 'agent-skill-package-archive-verification.v1',
          packageId: archive.identity.packageId,
          publisherId: archive.identity.publisherId,
          skillId: archive.identity.skillId,
          status: 'verified',
          verifiedAt: new Date().toISOString(),
          verifier: 'main-process-package-archive-v1',
          version: archive.identity.version,
        },
        packageId: archive.identity.packageId,
        rawPackageJson: archive.rawPackageJson,
        trustedKeyRegistry: request.trustedKeyRegistry,
      });
      if (!staged.ok) return staged;
      const result = {
        archiveDigest: archive.archiveDigest,
        identity: archive.identity,
        migration,
        ok: true,
        package: staged.package,
        packageJson: JSON.stringify(archive.packageValue),
        status: migration.kind === 'install' ? 'installed' : 'updated',
        verification: staged.verification,
      };
      log?.('Signed Skill package archive staged', {
        fromVersion: migration.fromVersion,
        packageId: archive.identity.packageId,
        status: result.status,
        toVersion: migration.toVersion,
      });
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function stageSignedArchiveBase64(request = {}) {
    const encoded = typeof request.archiveBase64 === 'string' ? request.archiveBase64.trim() : '';
    if (
      !encoded
      || encoded.length > MAX_ARCHIVE_BASE64_LENGTH
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
    ) return { error: 'package_archive_base64_invalid', ok: false };
    const archiveBytes = Buffer.from(encoded, 'base64');
    if (archiveBytes.toString('base64') !== encoded) {
      return { error: 'package_archive_base64_invalid', ok: false };
    }
    return stageSignedArchive({
      archiveBytes,
      trustedKeyRegistry: request.trustedKeyRegistry,
    });
  }

  return { inspectArchive, stageSignedArchive, stageSignedArchiveBase64 };
}

module.exports = {
  createExternalSkillPackageArchiveInstallerService,
  inspectArchive,
};
