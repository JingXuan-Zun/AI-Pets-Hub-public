const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_PACKAGE_BYTES = 1024 * 1024;
const STORE_KIND = 'agent-skill-package-artifact-store.v1';
const PACKAGE_KIND = 'agent-skill-package.v1';
const ARCHIVE_VERIFICATION_KIND = 'agent-skill-package-archive-verification.v1';
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const SNAPSHOT_ID_PATTERN = /^uninstall-[a-zA-Z0-9-]{1,120}$/u;
const MAX_LISTED_PACKAGES = 64;
const MAX_LISTED_UNINSTALL_SNAPSHOTS = 256;
const MAX_UNINSTALL_SNAPSHOTS_PER_PACKAGE = 5;
const UNINSTALL_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const UNINSTALL_SNAPSHOT_KIND = 'agent-skill-package-uninstall-snapshot.v1';
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePackageId(value) {
  const packageId = typeof value === 'string' ? value.trim() : '';
  if (!PACKAGE_ID_PATTERN.test(packageId)) {
    throw new Error('invalid_package_id');
  }
  return packageId;
}

function parsePackage(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('package_json_missing');
  }
  if (Buffer.byteLength(rawText, 'utf8') > MAX_PACKAGE_BYTES) {
    throw new Error('package_json_too_large');
  }
  const parsed = JSON.parse(rawText);
  if (!isRecord(parsed) || parsed.kind !== PACKAGE_KIND || !isRecord(parsed.scaffold)) {
    throw new Error('package_json_invalid');
  }
  return `${JSON.stringify(parsed)}\n`;
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJsonAtomically(targetPath, value) {
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  ensureDirectory(path.dirname(targetPath));
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempPath, targetPath);
}

function readIndex(indexPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return isRecord(parsed) && parsed.kind === STORE_KIND && isRecord(parsed.packages)
      ? parsed
      : { kind: STORE_KIND, packages: {} };
  } catch {
    return { kind: STORE_KIND, packages: {} };
  }
}

function normalizeSignatureVerification(value) {
  if (
    !isRecord(value)
    || value.status !== 'verified'
    || value.algorithm !== 'ed25519'
    || value.verifier !== 'main-process-ed25519'
    || typeof value.keyId !== 'string'
    || !value.keyId.trim()
    || typeof value.verifiedAt !== 'string'
    || !Number.isFinite(Date.parse(value.verifiedAt))
  ) {
    return null;
  }
  return {
    algorithm: 'ed25519',
    keyFingerprint: typeof value.keyFingerprint === 'string' && /^[a-f0-9]{64}$/u.test(value.keyFingerprint)
      ? value.keyFingerprint
      : null,
    keyId: value.keyId.trim(),
    keyMigration: normalizeKeyMigrationVerification(value.keyMigration),
    publisherId: typeof value.publisherId === 'string' && value.publisherId.trim()
      ? value.publisherId.trim()
      : null,
    status: 'verified',
    verifiedAt: value.verifiedAt,
    verifier: 'main-process-ed25519',
  };
}

function normalizeArchiveVerification(value, artifactDigest, packageId) {
  if (
    !isRecord(value)
    || value.kind !== ARCHIVE_VERIFICATION_KIND
    || value.status !== 'verified'
    || value.verifier !== 'main-process-package-archive-v1'
    || value.formatVersion !== 1
    || value.artifactDigest !== artifactDigest
    || value.packageId !== packageId
    || typeof value.archiveDigest !== 'string'
    || !/^[a-f0-9]{64}$/u.test(value.archiveDigest)
    || typeof value.archivePackageSha256 !== 'string'
    || !/^[a-f0-9]{64}$/u.test(value.archivePackageSha256)
    || typeof value.publisherId !== 'string'
    || !PACKAGE_ID_PATTERN.test(value.publisherId)
    || typeof value.skillId !== 'string'
    || !PACKAGE_ID_PATTERN.test(value.skillId)
    || typeof value.version !== 'string'
    || !VERSION_PATTERN.test(value.version)
    || typeof value.verifiedAt !== 'string'
    || !Number.isFinite(Date.parse(value.verifiedAt))
  ) return null;
  return {
    archiveDigest: value.archiveDigest,
    archivePackageSha256: value.archivePackageSha256,
    artifactDigest,
    formatVersion: 1,
    kind: ARCHIVE_VERIFICATION_KIND,
    packageId,
    publisherId: value.publisherId,
    skillId: value.skillId,
    status: 'verified',
    verifiedAt: value.verifiedAt,
    verifier: 'main-process-package-archive-v1',
    version: value.version,
  };
}

function normalizeKeyMigrationVerification(value) {
  if (
    !isRecord(value)
    || value.status !== 'verified'
    || value.verifier !== 'main-process-ed25519-dual-signature'
    || typeof value.fromKeyId !== 'string'
    || !value.fromKeyId.trim()
    || typeof value.toKeyId !== 'string'
    || !value.toKeyId.trim()
    || typeof value.fromKeyFingerprint !== 'string'
    || !/^[a-f0-9]{64}$/u.test(value.fromKeyFingerprint)
    || typeof value.toKeyFingerprint !== 'string'
    || !/^[a-f0-9]{64}$/u.test(value.toKeyFingerprint)
    || typeof value.publisherId !== 'string'
    || !value.publisherId.trim()
    || typeof value.verifiedAt !== 'string'
    || !Number.isFinite(Date.parse(value.verifiedAt))
  ) {
    return null;
  }
  return {
    fromKeyFingerprint: value.fromKeyFingerprint,
    fromKeyId: value.fromKeyId.trim(),
    publisherId: value.publisherId.trim(),
    status: 'verified',
    toKeyFingerprint: value.toKeyFingerprint,
    toKeyId: value.toKeyId.trim(),
    verifiedAt: value.verifiedAt,
    verifier: 'main-process-ed25519-dual-signature',
  };
}

function createArtifactRecord(
  packageId,
  artifactDigest,
  byteLength,
  stagedAt,
  signatureVerification,
  archiveVerification,
) {
  return {
    archiveVerification,
    artifactDigest,
    byteLength,
    packageId,
    signatureVerification,
    stagedAt,
    status: 'staged',
  };
}

function createSkillPackageArtifactStore({ userDataPath, log, now = Date.now } = {}) {
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) {
    throw new Error('user_data_path_missing');
  }
  const rootPath = path.join(path.resolve(userDataPath), 'skill-package-artifacts-v1');
  const indexPath = path.join(rootPath, 'index.json');
  const getNow = typeof now === 'function' ? now : Date.now;

  function packageDirectory(packageId) {
    return path.join(rootPath, 'packages', hash(packageId));
  }

  function artifactPath(packageId, artifactDigest) {
    return path.join(packageDirectory(packageId), `${artifactDigest}.json`);
  }

  function uninstallSnapshotPath(packageId, snapshotId) {
    return path.join(rootPath, 'uninstall-snapshots', hash(packageId), `${snapshotId}.json`);
  }

  function uninstallSnapshotPolicy() {
    return {
      maxAgeDays: UNINSTALL_SNAPSHOT_MAX_AGE_MS / (24 * 60 * 60 * 1000),
      maxSnapshotsPerPackage: MAX_UNINSTALL_SNAPSHOTS_PER_PACKAGE,
    };
  }

  function readUninstallSnapshot(filePath, expectedPackageId = '') {
    try {
      const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const packageId = normalizePackageId(snapshot?.packageId);
      const snapshotId = typeof snapshot?.snapshotId === 'string' ? snapshot.snapshotId.trim() : '';
      if (
        !isRecord(snapshot)
        || snapshot.kind !== UNINSTALL_SNAPSHOT_KIND
        || (expectedPackageId && packageId !== expectedPackageId)
        || !SNAPSHOT_ID_PATTERN.test(snapshotId)
        || path.basename(filePath) !== `${snapshotId}.json`
        || hash(packageId) !== path.basename(path.dirname(filePath))
        || !isRecord(snapshot.package)
        || snapshot.package.packageId !== packageId
        || typeof snapshot.package.artifactDigest !== 'string'
        || !/^[a-f0-9]{64}$/u.test(snapshot.package.artifactDigest)
        || typeof snapshot.uninstalledAt !== 'string'
        || !Number.isFinite(Date.parse(snapshot.uninstalledAt))
      ) {
        return { error: 'uninstall_snapshot_invalid', ok: false, snapshotId: SNAPSHOT_ID_PATTERN.test(snapshotId) ? snapshotId : null };
      }
      return { ok: true, snapshot };
    } catch {
      const snapshotId = path.basename(filePath, '.json');
      return {
        error: 'uninstall_snapshot_invalid',
        ok: false,
        snapshotId: SNAPSHOT_ID_PATTERN.test(snapshotId) ? snapshotId : null,
      };
    }
  }

  function collectUninstallSnapshots(request = {}) {
    const requestedPackageId = request.packageId ? normalizePackageId(request.packageId) : '';
    const snapshotRoot = path.join(rootPath, 'uninstall-snapshots');
    const snapshots = [];
    const invalidSnapshotIds = [];
    if (!fs.existsSync(snapshotRoot)) {
      return { invalidSnapshotIds, snapshots };
    }
    const packageDirectories = requestedPackageId
      ? [path.join(snapshotRoot, hash(requestedPackageId))]
      : fs.readdirSync(snapshotRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(snapshotRoot, entry.name));
    for (const directory of packageDirectories) {
      if (!fs.existsSync(directory)) continue;
      const files = fs.readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => path.join(directory, entry.name));
      for (const filePath of files) {
        const result = readUninstallSnapshot(filePath, requestedPackageId);
        if (!result.ok) {
          invalidSnapshotIds.push(result.snapshotId);
          continue;
        }
        snapshots.push({ filePath, snapshot: result.snapshot });
      }
    }
    return { invalidSnapshotIds, snapshots };
  }

  function listUninstallSnapshots(request = {}) {
    try {
      const collected = collectUninstallSnapshots(request);
      const snapshots = collected.snapshots
        .sort((left, right) => Date.parse(right.snapshot.uninstalledAt) - Date.parse(left.snapshot.uninstalledAt))
        .slice(0, MAX_LISTED_UNINSTALL_SNAPSHOTS)
        .map(({ snapshot }) => ({
          packageId: snapshot.packageId,
          snapshotId: snapshot.snapshotId,
          uninstalledAt: snapshot.uninstalledAt,
        }));
      return {
        invalidSnapshotCount: collected.invalidSnapshotIds.length,
        invalidSnapshotIds: collected.invalidSnapshotIds.filter(Boolean).slice(0, 20),
        ok: true,
        policy: uninstallSnapshotPolicy(),
        snapshots,
        totalCount: collected.snapshots.length,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        invalidSnapshotCount: 0,
        invalidSnapshotIds: [],
        ok: false,
        policy: uninstallSnapshotPolicy(),
        snapshots: [],
        totalCount: 0,
      };
    }
  }

  function collectArtifactReferences(packageId) {
    const references = new Set();
    try {
      if (fs.existsSync(indexPath)) {
        const parsedIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        if (!isRecord(parsedIndex) || parsedIndex.kind !== STORE_KIND || !isRecord(parsedIndex.packages)) {
          return { ok: false, reason: 'artifact_index_invalid', references };
        }
        const current = parsedIndex.packages[packageId];
        if (current) {
          if (
            !isRecord(current)
            || current.packageId !== packageId
            || typeof current.artifactDigest !== 'string'
            || !/^[a-f0-9]{64}$/u.test(current.artifactDigest)
          ) {
            return { ok: false, reason: 'artifact_index_record_invalid', references };
          }
          references.add(current.artifactDigest);
        }
      }
      for (const directoryName of ['snapshots', 'uninstall-snapshots']) {
        const directory = path.join(rootPath, directoryName, hash(packageId));
        if (!fs.existsSync(directory)) continue;
        const files = fs.readdirSync(directory, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
        for (const entry of files) {
          const filePath = path.join(directory, entry.name);
          if (directoryName === 'uninstall-snapshots') {
            const result = readUninstallSnapshot(filePath, packageId);
            if (!result.ok) return { ok: false, reason: 'uninstall_snapshot_invalid', references };
            references.add(result.snapshot.package.artifactDigest);
            continue;
          }
          const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (
            !isRecord(snapshot)
            || snapshot.packageId !== packageId
            || typeof snapshot.artifactDigest !== 'string'
            || !/^[a-f0-9]{64}$/u.test(snapshot.artifactDigest)
          ) {
            return { ok: false, reason: 'update_snapshot_invalid', references };
          }
          references.add(snapshot.artifactDigest);
        }
      }
      return { ok: true, references };
    } catch {
      return { ok: false, reason: 'artifact_reference_scan_failed', references };
    }
  }

  function cleanupUnreferencedArtifacts(packageId) {
    const collected = collectArtifactReferences(packageId);
    if (!collected.ok) {
      return { deletedArtifactCount: 0, skipped: true, skipReason: collected.reason };
    }
    const directory = packageDirectory(packageId);
    if (!fs.existsSync(directory)) {
      return { deletedArtifactCount: 0, skipped: false, skipReason: null };
    }
    let deletedArtifactCount = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/u.test(entry.name)) continue;
      const artifactDigest = path.basename(entry.name, '.json');
      if (collected.references.has(artifactDigest)) continue;
      fs.unlinkSync(path.join(directory, entry.name));
      deletedArtifactCount += 1;
    }
    return { deletedArtifactCount, skipped: false, skipReason: null };
  }

  function cleanupUninstallSnapshots(request = {}) {
    try {
      const protectedSnapshotIds = new Set(
        Array.isArray(request.protectedSnapshotIds)
          ? request.protectedSnapshotIds.filter((value) => typeof value === 'string' && SNAPSHOT_ID_PATTERN.test(value))
          : [],
      );
      const collected = collectUninstallSnapshots(request);
      const nowMs = Number(getNow());
      const grouped = new Map();
      for (const entry of collected.snapshots) {
        const rows = grouped.get(entry.snapshot.packageId) ?? [];
        rows.push(entry);
        grouped.set(entry.snapshot.packageId, rows);
      }
      const removedSnapshotIds = [];
      const skippedSnapshotIds = [];
      const affectedPackageIds = new Set();
      for (const [packageId, rows] of grouped) {
        rows.sort((left, right) => Date.parse(right.snapshot.uninstalledAt) - Date.parse(left.snapshot.uninstalledAt));
        const retainedByCount = new Set(rows.slice(0, MAX_UNINSTALL_SNAPSHOTS_PER_PACKAGE).map((entry) => entry.snapshot.snapshotId));
        for (const entry of rows) {
          const snapshotId = entry.snapshot.snapshotId;
          if (protectedSnapshotIds.has(snapshotId)) continue;
          const expired = nowMs - Date.parse(entry.snapshot.uninstalledAt) > UNINSTALL_SNAPSHOT_MAX_AGE_MS;
          if (!expired && retainedByCount.has(snapshotId)) continue;
          try {
            fs.unlinkSync(entry.filePath);
            affectedPackageIds.add(packageId);
            removedSnapshotIds.push(snapshotId);
          } catch {
            skippedSnapshotIds.push(snapshotId);
          }
        }
      }
      let deletedArtifactCount = 0;
      const artifactCleanupSkips = [];
      for (const packageId of affectedPackageIds) {
        const cleanup = cleanupUnreferencedArtifacts(packageId);
        deletedArtifactCount += cleanup.deletedArtifactCount;
        if (cleanup.skipped) artifactCleanupSkips.push({ packageId, reason: cleanup.skipReason });
      }
      const hasSkips = collected.invalidSnapshotIds.length > 0
        || skippedSnapshotIds.length > 0
        || artifactCleanupSkips.length > 0;
      log?.('Skill package uninstall snapshots cleaned', {
        deletedArtifactCount,
        invalidSnapshotCount: collected.invalidSnapshotIds.length,
        removedSnapshotCount: removedSnapshotIds.length,
        status: hasSkips ? 'completed-with-skips' : 'completed',
      });
      return {
        artifactCleanupSkips,
        deletedArtifactCount,
        invalidSnapshotCount: collected.invalidSnapshotIds.length,
        invalidSnapshotIds: collected.invalidSnapshotIds.filter(Boolean).slice(0, 20),
        ok: true,
        policy: uninstallSnapshotPolicy(),
        removedSnapshotCount: removedSnapshotIds.length,
        removedSnapshotIds,
        skippedSnapshotCount: skippedSnapshotIds.length,
        skippedSnapshotIds,
        status: hasSkips ? 'completed-with-skips' : 'completed',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        policy: uninstallSnapshotPolicy(),
        status: 'failed',
      };
    }
  }

  function stagePackage(request = {}) {
    try {
      const packageId = normalizePackageId(request.packageId);
      const packageText = parsePackage(request.rawPackageJson);
      const artifactDigest = hash(packageText);
      const stagedAt = new Date(getNow()).toISOString();
      const currentIndex = readIndex(indexPath);
      const previous = currentIndex.packages[packageId] ?? null;
      const nextRecord = createArtifactRecord(
        packageId,
        artifactDigest,
        Buffer.byteLength(packageText, 'utf8'),
        stagedAt,
        normalizeSignatureVerification(request.signatureVerification),
        normalizeArchiveVerification(request.archiveVerification, artifactDigest, packageId),
      );
      const targetArtifactPath = artifactPath(packageId, artifactDigest);
      ensureDirectory(path.dirname(targetArtifactPath));
      if (!fs.existsSync(targetArtifactPath)) {
        const tempArtifactPath = `${targetArtifactPath}.${process.pid}.tmp`;
        fs.writeFileSync(tempArtifactPath, packageText, 'utf8');
        fs.renameSync(tempArtifactPath, targetArtifactPath);
      }
      if (previous && previous.artifactDigest !== artifactDigest) {
        const snapshotPath = path.join(rootPath, 'snapshots', hash(packageId), `${stagedAt.replace(/[:.]/gu, '-')}.json`);
        writeJsonAtomically(snapshotPath, previous);
      }
      writeJsonAtomically(indexPath, {
        kind: STORE_KIND,
        packages: { ...currentIndex.packages, [packageId]: nextRecord },
      });
      log?.('Skill package artifact staged', { artifactDigest, packageId, replaced: Boolean(previous) });
      return { ok: true, package: nextRecord, replaced: Boolean(previous) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function quarantinePackage(packageId, reason = 'runtime_failure') {
    try {
      const normalizedPackageId = normalizePackageId(packageId);
      const currentIndex = readIndex(indexPath);
      const current = currentIndex.packages[normalizedPackageId];
      if (!current) {
        return { error: 'package_artifact_not_found', ok: false };
      }
      const quarantined = { ...current, quarantinedAt: new Date(getNow()).toISOString(), reason, status: 'quarantined' };
      writeJsonAtomically(indexPath, {
        kind: STORE_KIND,
        packages: { ...currentIndex.packages, [normalizedPackageId]: quarantined },
      });
      log?.('Skill package artifact quarantined', { packageId: normalizedPackageId, reason });
      return { ok: true, package: quarantined };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function uninstallPackage(packageId, reason = 'user_requested') {
    try {
      const normalizedPackageId = normalizePackageId(packageId);
      const currentIndex = readIndex(indexPath);
      const current = currentIndex.packages[normalizedPackageId];
      if (!current) return { error: 'package_artifact_not_found', ok: false };
      const uninstalledAt = new Date(getNow()).toISOString();
      const snapshotId = `uninstall-${getNow()}-${crypto.randomUUID()}`;
      const snapshot = {
        kind: UNINSTALL_SNAPSHOT_KIND,
        package: current,
        packageId: normalizedPackageId,
        reason: String(reason || 'user_requested').slice(0, 120),
        snapshotId,
        uninstalledAt,
      };
      writeJsonAtomically(uninstallSnapshotPath(normalizedPackageId, snapshotId), snapshot);
      const nextPackages = { ...currentIndex.packages };
      delete nextPackages[normalizedPackageId];
      writeJsonAtomically(indexPath, { kind: STORE_KIND, packages: nextPackages });
      const retentionCleanup = cleanupUninstallSnapshots({
        packageId: normalizedPackageId,
        protectedSnapshotIds: [snapshotId],
      });
      log?.('Skill package artifact uninstalled', { packageId: normalizedPackageId, snapshotId });
      return {
        ok: true,
        package: current,
        retentionCleanup,
        snapshot: { packageId: normalizedPackageId, snapshotId, uninstalledAt },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function restoreUninstalledPackage(request = {}) {
    try {
      const packageId = normalizePackageId(request.packageId);
      const snapshotId = typeof request.snapshotId === 'string' ? request.snapshotId.trim() : '';
      if (!SNAPSHOT_ID_PATTERN.test(snapshotId)) throw new Error('invalid_uninstall_snapshot_id');
      const currentIndex = readIndex(indexPath);
      if (currentIndex.packages[packageId]) {
        return { error: 'package_artifact_already_installed', ok: false };
      }
      const snapshot = JSON.parse(fs.readFileSync(uninstallSnapshotPath(packageId, snapshotId), 'utf8'));
      if (
        !isRecord(snapshot)
        || snapshot.kind !== UNINSTALL_SNAPSHOT_KIND
        || snapshot.packageId !== packageId
        || snapshot.snapshotId !== snapshotId
        || !isRecord(snapshot.package)
        || snapshot.package.packageId !== packageId
      ) {
        return { error: 'uninstall_snapshot_invalid', ok: false };
      }
      const rawPackageJson = fs.readFileSync(artifactPath(packageId, snapshot.package.artifactDigest), 'utf8');
      if (hash(rawPackageJson) !== snapshot.package.artifactDigest) {
        return { error: 'package_artifact_digest_mismatch', ok: false };
      }
      writeJsonAtomically(indexPath, {
        kind: STORE_KIND,
        packages: { ...currentIndex.packages, [packageId]: snapshot.package },
      });
      log?.('Skill package artifact uninstall rolled back', { packageId, snapshotId });
      return { ok: true, package: snapshot.package, snapshotId };
    } catch (error) {
      const message = error?.code === 'ENOENT'
        ? 'uninstall_snapshot_not_found'
        : error instanceof Error ? error.message : String(error);
      return { error: message, ok: false };
    }
  }

  function getPackage(packageId) {
    try {
      const normalizedPackageId = normalizePackageId(packageId);
      return { ok: true, package: readIndex(indexPath).packages[normalizedPackageId] ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false, package: null };
    }
  }

  function listPackages(request = {}) {
    try {
      const requestedIds = Array.isArray(request.packageIds)
        ? [...new Set(request.packageIds.map(normalizePackageId))].slice(0, MAX_LISTED_PACKAGES)
        : [];
      const index = readIndex(indexPath);
      const packages = requestedIds.length
        ? requestedIds.map((packageId) => index.packages[packageId]).filter(Boolean)
        : Object.values(index.packages).slice(0, MAX_LISTED_PACKAGES);
      return { ok: true, packages, totalCount: packages.length };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false, packages: [], totalCount: 0 };
    }
  }

  function readPackageArtifact(packageId) {
    try {
      const normalizedPackageId = normalizePackageId(packageId);
      const artifact = readIndex(indexPath).packages[normalizedPackageId] ?? null;
      if (!artifact) {
        return { error: 'package_artifact_not_found', ok: false };
      }
      if (artifact.status === 'quarantined') {
        return { error: 'package_artifact_quarantined', ok: false };
      }
      const rawPackageJson = fs.readFileSync(
        artifactPath(normalizedPackageId, artifact.artifactDigest),
        'utf8',
      );
      if (hash(rawPackageJson) !== artifact.artifactDigest) {
        return { error: 'package_artifact_digest_mismatch', ok: false };
      }
      return { artifact, ok: true, rawPackageJson };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function auditPackages(request = {}) {
    const items = Array.isArray(request.packages) ? request.packages.slice(0, 24) : [];
    try {
      const index = readIndex(indexPath);
      const rows = items.map((item) => {
        const packageId = normalizePackageId(item?.packageId);
        const expectedDigest = hash(parsePackage(item?.rawPackageJson));
        const artifact = index.packages[packageId] ?? null;
        const status = !artifact ? 'missing' : artifact.status === 'quarantined' ? 'quarantined'
          : artifact.artifactDigest === expectedDigest ? 'ready' : 'mismatched';
        return { artifactDigest: artifact?.artifactDigest ?? null, expectedDigest, packageId, status };
      });
      return { ok: true, rows };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false, rows: [] };
    }
  }

  return {
    auditPackages,
    cleanupUninstallSnapshots,
    getPackage,
    getPaths: () => ({ indexPath, rootPath }),
    listPackages,
    listUninstallSnapshots,
    quarantinePackage,
    readPackageArtifact,
    restoreUninstalledPackage,
    stagePackage,
    uninstallPackage,
  };
}

module.exports = { createSkillPackageArtifactStore };
