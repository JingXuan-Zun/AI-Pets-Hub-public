const fs = require('fs');
const path = require('path');

const RECEIPT_HISTORY_KIND = 'external-skill-package-lifecycle-receipts.v1';
const RECEIPT_KIND = 'external-skill-package-lifecycle-receipt.v1';
const RECEIPT_EXPORT_KIND = 'external-skill-package-lifecycle-receipt-export.v1';
const MAX_RECEIPTS = 200;
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizePackageId(value) {
  const packageId = typeof value === 'string' ? value.trim() : '';
  if (!PACKAGE_ID_PATTERN.test(packageId)) throw new Error('invalid_package_id');
  return packageId;
}

function readReceiptHistory(receiptPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    return isRecord(parsed) && parsed.kind === RECEIPT_HISTORY_KIND && Array.isArray(parsed.receipts)
      ? parsed.receipts.slice(0, MAX_RECEIPTS)
      : [];
  } catch {
    return [];
  }
}

function writeJsonAtomically(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, targetPath);
}

function createExternalSkillPackageLifecycleService({
  artifactStore,
  capabilityGateway,
  signedInstallCoordinator,
  userDataPath,
  log,
  now = Date.now,
} = {}) {
  if (!artifactStore || typeof artifactStore.getPackage !== 'function') throw new Error('artifact_store_missing');
  if (!capabilityGateway || typeof capabilityGateway.revokeGrant !== 'function') throw new Error('capability_gateway_missing');
  if (!signedInstallCoordinator || typeof signedInstallCoordinator.stageSignedPackage !== 'function') {
    throw new Error('signed_install_coordinator_missing');
  }
  if (typeof userDataPath !== 'string' || !userDataPath.trim()) throw new Error('user_data_path_missing');
  const getNow = typeof now === 'function' ? now : Date.now;
  const receiptPath = path.join(path.resolve(userDataPath), 'external-skill-package-lifecycle-v1', 'receipts.json');

  function appendReceipt(action, packageId, status, details = {}) {
    const at = new Date(getNow()).toISOString();
    const receipt = {
      action,
      at,
      cleanup: details.cleanup ? {
        deletedArtifactCount: Number(details.cleanup.deletedArtifactCount || 0),
        invalidSnapshotCount: Number(details.cleanup.invalidSnapshotCount || 0),
        removedSnapshotCount: Number(details.cleanup.removedSnapshotCount || 0),
        skippedSnapshotCount: Number(details.cleanup.skippedSnapshotCount || 0),
        status: details.cleanup.status || 'unknown',
      } : null,
      grantRevoked: Boolean(details.grantRevoked),
      healthReset: Boolean(details.healthReset),
      kind: RECEIPT_KIND,
      packageId,
      receiptId: `${packageId}:${action}:${at}`,
      snapshotId: details.snapshotId || null,
      status,
    };
    const receipts = [receipt, ...readReceiptHistory(receiptPath)].slice(0, MAX_RECEIPTS);
    writeJsonAtomically(receiptPath, { kind: RECEIPT_HISTORY_KIND, receipts, savedAt: at });
    return receipt;
  }

  function cleanupRuntimeState(packageId, { resetHealth = true } = {}) {
    const grant = capabilityGateway.revokeGrant({ packageId });
    const health = resetHealth ? capabilityGateway.resetPackageHealth({ packageId }) : { ok: true, reset: false };
    return {
      grant,
      health,
      ok: grant?.ok === true && health?.ok === true,
    };
  }

  function restoreQuarantinedPackage(request = {}) {
    try {
      const packageId = normalizePackageId(request.packageId);
      const current = artifactStore.getPackage(packageId);
      if (!current.ok || current.package?.status !== 'quarantined') {
        return { error: 'package_artifact_not_quarantined', ok: false };
      }
      const staged = signedInstallCoordinator.stageSignedPackage({
        packageId,
        rawPackageJson: request.rawPackageJson,
        trustedKeyRegistry: request.trustedKeyRegistry,
      });
      if (!staged.ok) return staged;
      const cleanup = cleanupRuntimeState(packageId);
      if (!cleanup.ok) {
        artifactStore.quarantinePackage(packageId, 'restore_cleanup_failed');
        appendReceipt('restore-quarantine', packageId, 'failed');
        return { error: 'package_restore_cleanup_failed', ok: false };
      }
      const receipt = appendReceipt('restore-quarantine', packageId, 'succeeded', {
        grantRevoked: cleanup.grant.revoked,
        healthReset: cleanup.health.reset,
      });
      log?.('External Skill package restored from quarantine', { packageId });
      return { ok: true, package: staged.package, receipt };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function uninstallPackage(request = {}) {
    try {
      const packageId = normalizePackageId(request.packageId);
      const uninstalled = artifactStore.uninstallPackage(packageId, 'user_requested');
      if (!uninstalled.ok) return uninstalled;
      const cleanup = cleanupRuntimeState(packageId);
      if (!cleanup.ok) {
        artifactStore.restoreUninstalledPackage({ packageId, snapshotId: uninstalled.snapshot.snapshotId });
        appendReceipt('uninstall', packageId, 'failed', { snapshotId: uninstalled.snapshot.snapshotId });
        return { error: 'package_uninstall_cleanup_failed', ok: false };
      }
      const receipt = appendReceipt('uninstall', packageId, 'succeeded', {
        cleanup: uninstalled.retentionCleanup,
        grantRevoked: cleanup.grant.revoked,
        healthReset: cleanup.health.reset,
        snapshotId: uninstalled.snapshot.snapshotId,
      });
      log?.('External Skill package uninstalled', { packageId, snapshotId: uninstalled.snapshot.snapshotId });
      return { ok: true, receipt, snapshot: uninstalled.snapshot };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function rollbackUninstall(request = {}) {
    try {
      const packageId = normalizePackageId(request.packageId);
      const restored = artifactStore.restoreUninstalledPackage({ packageId, snapshotId: request.snapshotId });
      if (!restored.ok) return restored;
      const cleanup = cleanupRuntimeState(packageId, { resetHealth: restored.package.status !== 'quarantined' });
      if (!cleanup.ok) {
        artifactStore.quarantinePackage(packageId, 'rollback_cleanup_failed');
        appendReceipt('rollback-uninstall', packageId, 'failed', { snapshotId: request.snapshotId });
        return { error: 'package_rollback_cleanup_failed', ok: false };
      }
      const receipt = appendReceipt('rollback-uninstall', packageId, 'succeeded', {
        grantRevoked: cleanup.grant.revoked,
        healthReset: cleanup.health.reset,
        snapshotId: request.snapshotId,
      });
      log?.('External Skill package uninstall rolled back', { packageId, snapshotId: request.snapshotId });
      return { ok: true, package: restored.package, receipt };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function listUninstallSnapshots(request = {}) {
    try {
      const packageId = request.packageId ? normalizePackageId(request.packageId) : '';
      return artifactStore.listUninstallSnapshots(packageId ? { packageId } : {});
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false, snapshots: [], totalCount: 0 };
    }
  }

  function cleanupUninstallSnapshots(request = {}) {
    let packageId = 'all-packages';
    try {
      packageId = request.packageId ? normalizePackageId(request.packageId) : packageId;
      const cleanup = artifactStore.cleanupUninstallSnapshots(
        request.packageId ? { packageId } : {},
      );
      const receipt = appendReceipt(
        'cleanup-uninstall-snapshots',
        packageId,
        cleanup.ok ? 'succeeded' : 'failed',
        { cleanup },
      );
      return { ...cleanup, receipt };
    } catch (error) {
      const failed = {
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        status: 'failed',
      };
      const receipt = appendReceipt('cleanup-uninstall-snapshots', packageId, 'failed', { cleanup: failed });
      return { ...failed, receipt };
    }
  }

  function listReceipts(request = {}) {
    const packageId = typeof request.packageId === 'string' ? request.packageId.trim() : '';
    const receipts = readReceiptHistory(receiptPath).filter((receipt) => !packageId || receipt.packageId === packageId);
    return { kind: RECEIPT_HISTORY_KIND, ok: true, receipts, totalCount: receipts.length };
  }

  function exportReceipts(request = {}) {
    const listed = listReceipts(request);
    const generatedAt = new Date(getNow()).toISOString();
    const result = {
      generatedAt,
      kind: RECEIPT_EXPORT_KIND,
      ok: true,
      receipts: listed.receipts,
      summary: {
        failed: listed.receipts.filter((receipt) => receipt.status === 'failed').length,
        snapshotCleanups: listed.receipts.filter((receipt) => receipt.action === 'cleanup-uninstall-snapshots').length,
        restored: listed.receipts.filter((receipt) => receipt.action === 'restore-quarantine').length,
        rollback: listed.receipts.filter((receipt) => receipt.action === 'rollback-uninstall').length,
        succeeded: listed.receipts.filter((receipt) => receipt.status === 'succeeded').length,
        total: listed.totalCount,
        uninstalled: listed.receipts.filter((receipt) => receipt.action === 'uninstall').length,
      },
      version: 1,
    };
    return {
      fileName: `external-skill-package-lifecycle-${generatedAt.replace(/[:.]/gu, '-')}.json`,
      mimeType: 'application/json',
      ok: true,
      text: `${JSON.stringify(result, null, 2)}\n`,
    };
  }

  return {
    cleanupUninstallSnapshots,
    getPaths: () => ({ receiptPath }),
    exportReceipts,
    listReceipts,
    listUninstallSnapshots,
    restoreQuarantinedPackage,
    rollbackUninstall,
    uninstallPackage,
  };
}

module.exports = { createExternalSkillPackageLifecycleService };
