import { useEffect, useState } from 'react';
import {
  applyAgentSkillSignedArchiveInstall,
  applyAgentSkillPackageMetadataUpdate,
  createAgentSkillPackageLifecycleState,
  createEmptyAgentSkillInstalledPackageRegistry,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageLifecycleState,
  parseAgentSkillInstalledPackageRegistryJson,
  replaceAgentSkillPackageLifecycleInstalledRegistry,
  rollbackAgentSkillPackageMetadataUpdate,
  rollbackAgentSkillPackageUninstall,
  quarantineAgentSkillPackage,
  removeAgentSkillInstalledPackage,
  restoreAgentSkillPackageFromQuarantine,
  serializeAgentSkillPackageLifecycleState,
  serializeAgentSkillInstalledPackageRegistry,
  uninstallAgentSkillPackage,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillTrustedSignatureKeyRegistry,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-installed-packages.v1';
const LIFECYCLE_STORAGE_KEY = 'desktop-pet.agent-skill-package-lifecycle.v1';

type AgentSkillArtifactAuditSummary = {
  error: string | null;
  missing: number;
  mismatched: number;
  quarantined: number;
  ready: number;
};

function createArtifactAuditSummary(): AgentSkillArtifactAuditSummary {
  return { error: null, missing: 0, mismatched: 0, quarantined: 0, ready: 0 };
}

function hasPackageSignature(packageValue: unknown) {
  if (!packageValue || typeof packageValue !== 'object') {
    return false;
  }
  const packageRecord = packageValue as { security?: { signature?: unknown }; signature?: unknown };
  return Boolean(packageRecord.signature || packageRecord.security?.signature);
}

function summarizeArtifactAudit(result: Awaited<ReturnType<NonNullable<Window['desktopPetShell']>['auditSkillPackageArtifacts']>>) {
  const summary = createArtifactAuditSummary();
  if (!result?.ok) {
    return { ...summary, error: result?.error || 'Skill package artifact audit failed.' };
  }
  result.rows.forEach((row) => { summary[row.status] += 1; });
  return summary;
}

function loadLifecycleState() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createAgentSkillPackageLifecycleState();
    }
    const lifecycleText = window.localStorage.getItem(LIFECYCLE_STORAGE_KEY);
    if (lifecycleText?.trim()) {
      return parseAgentSkillPackageLifecycleState(lifecycleText);
    }
    return createAgentSkillPackageLifecycleState(
      parseAgentSkillInstalledPackageRegistryJson(window.localStorage.getItem(STORAGE_KEY)),
    );
  } catch {
    return createAgentSkillPackageLifecycleState(createEmptyAgentSkillInstalledPackageRegistry());
  }
}

function persistLifecycleState(state: ReturnType<typeof createAgentSkillPackageLifecycleState>) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Installed package registry can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(LIFECYCLE_STORAGE_KEY, serializeAgentSkillPackageLifecycleState(state));
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillInstalledPackageRegistry(state.installedRegistry));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Installed package registry storage failed.';
  }
}

function removeUninstallSnapshotIds(
  state: ReturnType<typeof createAgentSkillPackageLifecycleState>,
  snapshotIds: readonly string[],
) {
  if (!snapshotIds.length) return state;
  const removed = new Set(snapshotIds);
  return {
    ...state,
    uninstallSnapshots: state.uninstallSnapshots.filter((snapshot) => !removed.has(snapshot.id)),
  };
}

export function useSettingsAgentSkillInstalledPackageRegistry() {
  const [lifecycle, setLifecycle] = useState(loadLifecycleState);
  const [artifactAudit, setArtifactAudit] = useState(createArtifactAuditSummary);
  const registry = lifecycle.installedRegistry;

  const persist = (nextLifecycle: typeof lifecycle) => {
    const error = persistLifecycleState(nextLifecycle);
    if (!error) {
      setLifecycle(nextLifecycle);
    }
    return error;
  };

  const installEnabledDrafts = (draftLibrary: AgentSkillPackageDraftLibrary) => {
    const result = gateEnabledSkillPackageDraftsIntoInstalledRegistry(draftLibrary, registry);
    const error = persist(replaceAgentSkillPackageLifecycleInstalledRegistry(lifecycle, result.registry));
    return { ...result, error };
  };

  const installSignedArchive = async (
    archiveBase64: string,
    trustedKeyRegistry: AgentSkillTrustedSignatureKeyRegistry,
  ) => {
    const stageArchive = window.desktopPetShell?.stageSignedSkillPackageArchive;
    if (!stageArchive) {
      return { error: 'Signed Skill package archive installer is unavailable.', identity: null, status: null };
    }
    const result = await stageArchive({ archiveBase64, trustedKeyRegistry });
    if (!result.ok || !result.identity || !result.packageJson || !result.status) {
      return {
        error: result.error || 'Signed Skill package archive installation failed.',
        identity: result.identity ?? null,
        status: result.status ?? null,
      };
    }
    const applied = applyAgentSkillSignedArchiveInstall(lifecycle, {
      identity: result.identity,
      packageJson: result.packageJson,
      status: result.status,
    });
    const error = applied.error || persist(applied.state);
    return {
      error,
      identity: result.identity,
      status: error ? null : result.status,
    };
  };

  const removeInstalledPackage = async (packageId: string) => {
    const packageItem = registry.packages.find((item) => item.id === packageId);
    if (packageItem && hasPackageSignature(packageItem.package)) {
      const uninstallPackage = window.desktopPetShell?.uninstallExternalSkillPackage;
      if (!uninstallPackage) return 'External Skill package lifecycle service is unavailable.';
      const result = await uninstallPackage({ packageId });
      if (!result.ok || !result.snapshot?.snapshotId) {
        return result.error || 'External Skill package uninstall failed.';
      }
      const lifecycleResult = uninstallAgentSkillPackage(
        lifecycle,
        packageId,
        result.snapshot.snapshotId,
        result.snapshot.uninstalledAt,
      );
      return persist(removeUninstallSnapshotIds(
        lifecycleResult.state,
        result.retentionCleanup?.removedSnapshotIds ?? [],
      ));
    }
    const nextRegistry = removeAgentSkillInstalledPackage(registry, packageId);
    return persist(replaceAgentSkillPackageLifecycleInstalledRegistry(lifecycle, nextRegistry));
  };

  const restoreQuarantinedPackage = async (
    packageId: string,
    trustedKeyRegistry: AgentSkillTrustedSignatureKeyRegistry,
  ) => {
    const quarantined = lifecycle.quarantinedPackages.find((item) => item.package.id === packageId);
    const restorePackage = window.desktopPetShell?.restoreQuarantinedExternalSkillPackage;
    if (!quarantined || !restorePackage) return 'External Skill package restore is unavailable.';
    const result = await restorePackage({
      packageId,
      rawPackageJson: JSON.stringify(quarantined.package.package),
      trustedKeyRegistry,
    });
    if (!result.ok) return result.error || 'External Skill package restore failed.';
    return persist(restoreAgentSkillPackageFromQuarantine(lifecycle, packageId).state);
  };

  const rollbackUninstall = async (snapshotId: string) => {
    const snapshot = lifecycle.uninstallSnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return 'Uninstall snapshot was not found.';
    if (hasPackageSignature(snapshot.package.package)) {
      const rollbackPackage = window.desktopPetShell?.rollbackExternalSkillPackageUninstall;
      if (!rollbackPackage) return 'External Skill package rollback is unavailable.';
      const result = await rollbackPackage({ packageId: snapshot.package.id, snapshotId });
      if (!result.ok) return result.error || 'External Skill package rollback failed.';
    }
    return persist(rollbackAgentSkillPackageUninstall(lifecycle, snapshotId).state);
  };

  const cleanupUninstallSnapshots = async () => {
    const cleanupSnapshots = window.desktopPetShell?.cleanupExternalSkillPackageUninstallSnapshots;
    if (!cleanupSnapshots) {
      return { cleanup: null, error: 'External Skill uninstall snapshot cleanup is unavailable.' };
    }
    const cleanup = await cleanupSnapshots();
    if (!cleanup.ok) {
      return { cleanup, error: cleanup.error || 'External Skill uninstall snapshot cleanup failed.' };
    }
    const nextLifecycle = removeUninstallSnapshotIds(lifecycle, cleanup.removedSnapshotIds ?? []);
    const error = persist(nextLifecycle);
    return { cleanup, error };
  };

  const replaceRegistry = (nextRegistry: AgentSkillInstalledPackageRegistry) => {
    return persist(replaceAgentSkillPackageLifecycleInstalledRegistry(lifecycle, nextRegistry));
  };

  const applyMetadataUpdate = async (
    library: AgentSkillPackageDraftLibrary,
    candidateDraftId: string,
    signatureVerifier?: AgentSkillPackageSignatureVerifier | null,
    trustedKeyRegistry?: AgentSkillTrustedSignatureKeyRegistry,
  ) => {
    const result = applyAgentSkillPackageMetadataUpdate(lifecycle, library, candidateDraftId, { signatureVerifier });
    if (result.action !== 'installed' && result.action !== 'replaced') {
      return { ...result, error: result.issueCodes[0] ?? null };
    }
    const draft = library.drafts.find((item) => item.id === candidateDraftId);
    const installedPackage = result.state.installedRegistry.packages.find((item) => item.sourceDraftId === candidateDraftId);
    const stageArtifact = typeof window === 'undefined' ? null : window.desktopPetShell?.stageSkillPackageArtifact;
    if (!draft || !installedPackage || !stageArtifact) {
      return { ...result, error: 'Skill package artifact store is unavailable.' };
    }
    const staged = await stageArtifact({
      packageId: installedPackage.id,
      rawPackageJson: JSON.stringify(draft.package),
      trustedKeyRegistry,
    });
    if (!staged?.ok) {
      return { ...result, error: staged?.error || 'Skill package artifact staging failed.' };
    }
    return { ...result, error: persist(result.state) };
  };

  const rollbackMetadataUpdate = (snapshotId: string) => {
    const result = rollbackAgentSkillPackageMetadataUpdate(lifecycle, snapshotId);
    return { ...result, error: persist(result.state) };
  };

  const quarantineArtifactIssues = async () => {
    const auditArtifacts = window.desktopPetShell?.auditSkillPackageArtifacts;
    const quarantineArtifact = window.desktopPetShell?.quarantineSkillPackageArtifact;
    const packages = registry.packages.filter((item) => hasPackageSignature(item.package));
    if (!auditArtifacts || !quarantineArtifact) return 'Skill package artifact store is unavailable.';
    const report = await auditArtifacts({
      packages: packages.map((item) => ({ packageId: item.id, rawPackageJson: JSON.stringify(item.package) })),
    });
    if (!report.ok) return report.error || 'Skill package artifact audit failed.';
    const issues = report.rows.filter((row) => row.status !== 'ready');
    let nextLifecycle = lifecycle;
    for (const issue of issues) {
      if (issue.status !== 'missing' && issue.status !== 'quarantined') {
        const quarantined = await quarantineArtifact({ packageId: issue.packageId, reason: `reconciliation_${issue.status}` });
        if (!quarantined.ok) return quarantined.error || 'Skill package artifact quarantine failed.';
      }
      nextLifecycle = quarantineAgentSkillPackage(nextLifecycle, issue.packageId, [`artifact-${issue.status}`]).state;
    }
    return persist(nextLifecycle);
  };

  useEffect(() => {
    const auditArtifacts = window.desktopPetShell?.auditSkillPackageArtifacts;
    const packages = registry.packages
      .filter((item) => hasPackageSignature(item.package))
      .map((item) => ({ packageId: item.id, rawPackageJson: JSON.stringify(item.package) }));
    if (!auditArtifacts || !packages.length) {
      setArtifactAudit(createArtifactAuditSummary());
      return;
    }
    let cancelled = false;
    void auditArtifacts({ packages }).then((result) => {
      if (!cancelled) setArtifactAudit(summarizeArtifactAudit(result));
    }).catch(() => {
      if (!cancelled) setArtifactAudit({ ...createArtifactAuditSummary(), error: 'Skill package artifact audit failed.' });
    });
    return () => { cancelled = true; };
  }, [registry]);

  return {
    applyMetadataUpdate,
    artifactAudit,
    cleanupUninstallSnapshots,
    installSignedArchive,
    installEnabledDrafts,
    lifecycle,
    registry,
    quarantineArtifactIssues,
    removeInstalledPackage,
    replaceRegistry,
    restoreQuarantinedPackage,
    rollbackUninstall,
    rollbackMetadataUpdate,
  };
}
