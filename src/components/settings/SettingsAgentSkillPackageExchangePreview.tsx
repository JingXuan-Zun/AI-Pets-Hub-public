import { useMemo, useState } from 'react';
import { PackageCheck, Save } from 'lucide-react';
import { parseAgentSkillPackageImportJson } from '../../agent/agentSkillPackageExchange';
import { Button } from '../../../components/ui/button';
import { SettingsAgentSkillExecutableHandlerGuardPanel } from './SettingsAgentSkillExecutableHandlerGuardPanel';
import { SettingsAgentSkillExecutableHandlerRegistryPanel } from './SettingsAgentSkillExecutableHandlerRegistryPanel';
import { SettingsAgentSkillExecutableHandlerRunPreviewPanel } from './SettingsAgentSkillExecutableHandlerRunPreviewPanel';
import { SettingsAgentSkillExecutionPlanPreviewPanel } from './SettingsAgentSkillExecutionPlanPreviewPanel';
import { SettingsAgentSkillExecutionScopePanel } from './SettingsAgentSkillExecutionScopePanel';
import { SettingsAgentSkillPackageDraftLibraryPanel } from './SettingsAgentSkillPackageDraftLibraryPanel';
import { SettingsAgentSkillPackageDraftLibraryExchangePanel } from './SettingsAgentSkillPackageDraftLibraryExchangePanel';
import { SettingsAgentSkillPackageRecoveryPanel } from './SettingsAgentSkillPackageRecoveryPanel';
import { SettingsAgentSkillInstalledPackageRegistryPanel } from './SettingsAgentSkillInstalledPackageRegistryPanel';
import { SettingsAgentSkillInstalledPackageRegistryExchangePanel } from './SettingsAgentSkillInstalledPackageRegistryExchangePanel';
import { SettingsAgentSkillInstalledPackageHandlerContractPanel } from './SettingsAgentSkillInstalledPackageHandlerContractPanel';
import { SettingsAgentSkillInstalledPackageHandlerPreviewPanel } from './SettingsAgentSkillInstalledPackageHandlerPreviewPanel';
import { SettingsAgentSkillInstalledPackageRuntimeMetadataPanel } from './SettingsAgentSkillInstalledPackageRuntimeMetadataPanel';
import { SettingsAgentSkillInstalledPackageRuntimePolicyPanel } from './SettingsAgentSkillInstalledPackageRuntimePolicyPanel';
import { SettingsAgentSkillInstalledPackageRuntimeReadinessPanel } from './SettingsAgentSkillInstalledPackageRuntimeReadinessPanel';
import { SettingsAgentSkillPackageSecurityPanels } from './SettingsAgentSkillPackageSecurityPanels';
import { SettingsAgentSkillPackageSourceViewPanel } from './SettingsAgentSkillPackageSourceViewPanel';
import { SettingsAgentSkillSignedPackageUpdatePanels } from './SettingsAgentSkillSignedPackageUpdatePanels';
import { SettingsAgentSkillSignedArchiveInstallerPanel } from './SettingsAgentSkillSignedArchiveInstallerPanel';
import { SettingsAgentSkillTrustEvidencePanel } from './SettingsAgentSkillTrustEvidencePanel';
import { formatSettingsAgentSkillPackageExportJson } from './settingsAgentSkillPackageExportJson';
import { downloadJsonTextFile } from './settingsDownloadUtils';
import { createSettingsAgentSkillRendererSignatureVerifier } from './settingsAgentSkillRendererSignatureVerifier';
import { useSettingsAgentSkillInstalledPackageRegistry } from './useSettingsAgentSkillInstalledPackageRegistry';
import { useSettingsAgentSkillPackageDraftLibrary } from './useSettingsAgentSkillPackageDraftLibrary';
import { useSettingsAgentSkillInstalledPackageHandlerPreviewRegistry } from './useSettingsAgentSkillInstalledPackageHandlerPreviewRegistry';
import { useSettingsAgentSkillInstalledPackageRuntimePolicy } from './useSettingsAgentSkillInstalledPackageRuntimePolicy';
import { useSettingsAgentSkillExecutableHandlerRegistry } from './useSettingsAgentSkillExecutableHandlerRegistry';
import { useSettingsAgentSkillExternalSandboxEvidenceRegistry } from './useSettingsAgentSkillExternalSandboxEvidenceRegistry';
import { useSettingsAgentSkillExternalLoaderIpcContractRegistry } from './useSettingsAgentSkillExternalLoaderIpcContractRegistry';
import { useSettingsAgentSkillTrustEvidenceRegistry } from './useSettingsAgentSkillTrustEvidenceRegistry';
import { useSettingsAgentSkillTrustedSignatureKeyRegistry } from './useSettingsAgentSkillTrustedSignatureKeyRegistry';

export function SettingsAgentSkillPackageExchangePreview({
  selectedSkillId,
}: {
  selectedSkillId: string;
}) {
  const exportJson = formatSettingsAgentSkillPackageExportJson(selectedSkillId);
  const [importJson, setImportJson] = useState('');
  const [draftFeedback, setDraftFeedback] = useState('');
  const draftLibrary = useSettingsAgentSkillPackageDraftLibrary();
  const installedRegistry = useSettingsAgentSkillInstalledPackageRegistry();
  const handlerPreviewRegistry = useSettingsAgentSkillInstalledPackageHandlerPreviewRegistry();
  const runtimePolicy = useSettingsAgentSkillInstalledPackageRuntimePolicy();
  const executableHandlers = useSettingsAgentSkillExecutableHandlerRegistry();
  const ipcContract = useSettingsAgentSkillExternalLoaderIpcContractRegistry();
  const sandboxEvidence = useSettingsAgentSkillExternalSandboxEvidenceRegistry();
  const trustEvidence = useSettingsAgentSkillTrustEvidenceRegistry();
  const trustedSignatureKeys = useSettingsAgentSkillTrustedSignatureKeyRegistry();
  const signatureVerifier = useMemo(
    () => createSettingsAgentSkillRendererSignatureVerifier(trustedSignatureKeys.registry),
    [trustedSignatureKeys.registry],
  );
  const effectiveTrustedPackageIds = trustEvidence.getEffectiveTrustedPackageIds(
    runtimePolicy.policy,
    installedRegistry.registry,
  );
  const runtimePolicyOptions = {
    ...runtimePolicy.policyOptions,
    trustedPackageIds: effectiveTrustedPackageIds,
  };
  const loaderOptions = {
    ...runtimePolicyOptions,
    executableHandlerPackageIds: executableHandlers.executableHandlerPackageIds,
    previewHandlerPackageIds: handlerPreviewRegistry.previewPackageIds,
  };
  const importPreview = importJson.trim()
    ? parseAgentSkillPackageImportJson(importJson)
    : null;
  const saveImportDraft = () => {
    const result = draftLibrary.saveImportPreview(importPreview);
    setDraftFeedback(result.error || `Saved package draft for ${result.draft?.skillId}.`);
  };
  const removeDraft = (draftId: string) => {
    const error = draftLibrary.removeDraft(draftId);
    setDraftFeedback(error || 'Removed package draft.');
  };
  const clearDrafts = () => {
    const error = draftLibrary.clearDrafts();
    setDraftFeedback(error || 'Cleared package drafts.');
  };
  const setDraftEnabled = (draftId: string, enabled: boolean) => {
    const error = draftLibrary.setDraftEnabled(draftId, enabled);
    setDraftFeedback(error || (enabled ? 'Enabled package draft for future install review.' : 'Disabled package draft.'));
  };
  const installEnabledDrafts = () => {
    const result = installedRegistry.installEnabledDrafts(draftLibrary.library);
    setDraftFeedback(result.error || `Installed registry staged ${result.installedCount} draft(s), skipped ${result.skippedCount}.`);
  };
  const removeInstalledPackage = async (packageId: string) => {
    const error = await installedRegistry.removeInstalledPackage(packageId);
    if (!error) {
      runtimePolicy.removeRecord(packageId);
      handlerPreviewRegistry.removePreview(packageId);
      executableHandlers.removeHandler(packageId);
      trustEvidence.removeEvidence(packageId);
    }
    setDraftFeedback(error || 'Removed installed package record.');
  };
  const restoreQuarantinedPackage = async (packageId: string) => {
    const error = await installedRegistry.restoreQuarantinedPackage(packageId, trustedSignatureKeys.registry);
    if (!error) {
      runtimePolicy.removeRecord(packageId);
      handlerPreviewRegistry.removePreview(packageId);
      executableHandlers.removeHandler(packageId);
      trustEvidence.removeEvidence(packageId);
    }
    setDraftFeedback(error || 'Reverified and restored quarantined package with prior runtime grants cleared.');
  };
  const rollbackUninstall = async (snapshotId: string) => {
    const error = await installedRegistry.rollbackUninstall(snapshotId);
    setDraftFeedback(error || 'Rolled back package uninstall; runtime permissions remain cleared.');
  };
  const cleanupUninstallSnapshots = async () => {
    const result = await installedRegistry.cleanupUninstallSnapshots();
    const cleanup = result.cleanup;
    setDraftFeedback(result.error || (
      `Cleaned ${cleanup?.removedSnapshotCount ?? 0} uninstall snapshot(s) and ${cleanup?.deletedArtifactCount ?? 0} unreferenced artifact(s).`
    ));
  };
  const exportLifecycleReceipts = async () => {
    const exportReceipts = window.desktopPetShell?.exportExternalSkillPackageLifecycleReceipts;
    if (!exportReceipts) {
      setDraftFeedback('External Skill lifecycle receipt export is unavailable.');
      return;
    }
    const result = await exportReceipts();
    if (!result.ok || !result.fileName || !result.text) {
      setDraftFeedback(result.error || 'External Skill lifecycle receipt export failed.');
      return;
    }
    downloadJsonTextFile(result.fileName, result.text);
    setDraftFeedback('Exported redacted External Skill lifecycle receipts.');
  };
  const setRuntimePolicyRecord = (
    packageId: string,
    patch: Parameters<typeof runtimePolicy.setRecord>[2],
  ) => {
    const error = runtimePolicy.setRecord(installedRegistry.registry, packageId, patch);
    setDraftFeedback(error || 'Updated installed package runtime policy.');
  };
  const clearRuntimePolicyRecord = (packageId: string) => {
    const error = runtimePolicy.removeRecord(packageId);
    setDraftFeedback(error || 'Cleared installed package runtime policy.');
  };
  const createTrustEvidence = (packageId: string) => {
    const error = trustEvidence.createEvidence(installedRegistry.registry, packageId);
    setDraftFeedback(error || 'Recorded local trust evidence.');
  };
  const removeTrustEvidence = (packageId: string) => {
    const error = trustEvidence.removeEvidence(packageId);
    setDraftFeedback(error || 'Removed local trust evidence.');
  };
  const createHandlerPreview = (packageId: string) => {
    const error = handlerPreviewRegistry.createPreview(installedRegistry.registry, packageId);
    setDraftFeedback(error || 'Registered handler preview without executable runtime.');
  };
  const removeHandlerPreview = (packageId: string) => {
    const error = handlerPreviewRegistry.removePreview(packageId);
    setDraftFeedback(error || 'Removed handler preview.');
  };
  const registerExecutableHandlers = () => {
    const result = executableHandlers.registerFromPreviews(
      installedRegistry.registry,
      runtimePolicy.policy,
      handlerPreviewRegistry.registry,
      effectiveTrustedPackageIds,
    );
    setDraftFeedback(result.error || `Registered ${result.registeredCount} executable handler(s), blocked ${result.blockedCount}.`);
  };
  const removeExecutableHandler = (packageId: string) => {
    const error = executableHandlers.removeHandler(packageId);
    setDraftFeedback(error || 'Removed executable handler.');
  };
  const applyMetadataUpdate = async (candidateDraftId: string) => {
    const result = await installedRegistry.applyMetadataUpdate(
      draftLibrary.library,
      candidateDraftId,
      signatureVerifier.verifier,
      trustedSignatureKeys.registry,
    );
    setDraftFeedback(result.error || `Metadata update ${result.action}.`);
  };
  const rollbackMetadataUpdate = (snapshotId: string) => {
    const result = installedRegistry.rollbackMetadataUpdate(snapshotId);
    setDraftFeedback(result.error || `Metadata update ${result.action}.`);
  };
  const quarantineArtifactIssues = async () => {
    const error = await installedRegistry.quarantineArtifactIssues();
    setDraftFeedback(error || '已隔离存在归档异常的签名包，并写入生命周期收据。');
  };

  return (
    <div className="mt-3 rounded-sm border border-border/80 bg-background/25 p-3">
      <div className="mb-2 flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <PackageCheck className="h-3.5 w-3.5 text-primary" />
        Package exchange preview
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <pre className="max-h-44 overflow-auto rounded-sm border border-border/70 bg-secondary/20 p-2 text-3xs text-muted-foreground">
          {exportJson || 'No package export available.'}
        </pre>
        <div className="space-y-2">
          <textarea
            className="h-32 w-full resize-y rounded-sm border border-border bg-background/50 p-2 font-mono text-3xs text-foreground outline-none"
            placeholder="Paste agent-skill-package.v1 JSON to preview import"
            spellCheck={false}
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
          />
          <div className="rounded-sm border border-border/70 bg-secondary/20 px-2 py-1 font-mono text-3xs text-muted-foreground">
            {importPreview
              ? `${importPreview.ok ? 'ok' : 'blocked'} / ${importPreview.skillId || importPreview.kind || 'unknown'} / errors ${importPreview.errors.length} / warnings ${importPreview.warnings.length}`
              : 'import preview idle'}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="xs" disabled={!importPreview?.ok} onClick={saveImportDraft}>
              <Save className="h-3 w-3" />
              Save draft
            </Button>
            {draftFeedback ? (
              <span className="truncate font-mono text-3xs text-muted-foreground">{draftFeedback}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-sm border border-border/70 bg-secondary/20 px-2 py-1 font-mono text-3xs text-muted-foreground">
        <span className="min-w-0 truncate">
          签名包归档审阅: 正常 {installedRegistry.artifactAudit.ready} / 缺失 {installedRegistry.artifactAudit.missing} / 不一致 {installedRegistry.artifactAudit.mismatched} / 已隔离 {installedRegistry.artifactAudit.quarantined}
          {installedRegistry.artifactAudit.error ? ` / ${installedRegistry.artifactAudit.error}` : ''}
        </span>
        {installedRegistry.artifactAudit.missing || installedRegistry.artifactAudit.mismatched || installedRegistry.artifactAudit.quarantined ? (
          <Button type="button" variant="outline" size="xs" onClick={() => void quarantineArtifactIssues()}>
            隔离异常项
          </Button>
        ) : null}
      </div>
      <SettingsAgentSkillPackageDraftLibraryPanel
        drafts={draftLibrary.library.drafts}
        library={draftLibrary.library}
        onClear={clearDrafts}
        onRemove={removeDraft}
        onSetEnabled={setDraftEnabled}
      />
      <SettingsAgentSkillPackageDraftLibraryExchangePanel
        library={draftLibrary.library}
        onImportLibrary={draftLibrary.replaceLibrary}
      />
      <SettingsAgentSkillSignedArchiveInstallerPanel
        trustedKeyRegistry={trustedSignatureKeys.registry}
        onImportTrustedKeyRegistryJson={trustedSignatureKeys.importRegistryJson}
        onInstallArchive={installedRegistry.installSignedArchive}
      />
      <SettingsAgentSkillInstalledPackageRegistryPanel
        draftLibrary={draftLibrary.library}
        registry={installedRegistry.registry}
        onInstallEnabledDrafts={installEnabledDrafts}
        onRemoveInstalledPackage={(packageId) => void removeInstalledPackage(packageId)}
      />
      <SettingsAgentSkillPackageRecoveryPanel
        lifecycle={installedRegistry.lifecycle}
        onCleanupUninstallSnapshots={() => void cleanupUninstallSnapshots()}
        onExportReceipts={() => void exportLifecycleReceipts()}
        onRestoreQuarantined={(packageId) => void restoreQuarantinedPackage(packageId)}
        onRollbackUninstall={(snapshotId) => void rollbackUninstall(snapshotId)}
      />
      <SettingsAgentSkillInstalledPackageRegistryExchangePanel
        registry={installedRegistry.registry}
        onImportRegistry={installedRegistry.replaceRegistry}
      />
      <SettingsAgentSkillSignedPackageUpdatePanels
        installedRegistry={installedRegistry.registry}
        library={draftLibrary.library}
        lifecycle={installedRegistry.lifecycle}
        onApplyMetadataUpdate={applyMetadataUpdate}
        onRollbackMetadataUpdate={rollbackMetadataUpdate}
        signatureVerifier={signatureVerifier.verifier}
      />
      <SettingsAgentSkillPackageSecurityPanels
        evidenceRegistry={trustEvidence.registry}
        executableHandlerRegistry={executableHandlers.registry}
        externalLoaderIpcContractCodes={ipcContract.contractCodes}
        externalSandboxEvidenceCodes={sandboxEvidence.evidenceCodes}
        installedRegistry={installedRegistry.registry}
        onImportTrustedKeyRegistryJson={trustedSignatureKeys.importRegistryJson}
        onRemoveTrustedKey={trustedSignatureKeys.removeKey}
        onSetExternalLoaderIpcContract={ipcContract.setContractCode}
        onSetExternalSandboxEvidence={sandboxEvidence.setEvidenceCode}
        policy={runtimePolicy.policy}
        previewRegistry={handlerPreviewRegistry.registry}
        trustedPackageIds={effectiveTrustedPackageIds}
        trustedSignatureKeyRegistry={trustedSignatureKeys.registry}
      />
      <SettingsAgentSkillInstalledPackageRuntimePolicyPanel
        policy={runtimePolicy.policy}
        registry={installedRegistry.registry}
        onClearRecord={clearRuntimePolicyRecord}
        onSetRecord={setRuntimePolicyRecord}
      />
      <SettingsAgentSkillTrustEvidencePanel
        evidenceRegistry={trustEvidence.registry}
        installedRegistry={installedRegistry.registry}
        onCreateEvidence={createTrustEvidence}
        onRemoveEvidence={removeTrustEvidence}
      />
      <SettingsAgentSkillInstalledPackageHandlerPreviewPanel
        installedRegistry={installedRegistry.registry}
        previewRegistry={handlerPreviewRegistry.registry}
        onCreatePreview={createHandlerPreview}
        onRemovePreview={removeHandlerPreview}
      />
      <SettingsAgentSkillInstalledPackageHandlerContractPanel
        installedRegistry={installedRegistry.registry}
        previewRegistry={handlerPreviewRegistry.registry}
      />
      <SettingsAgentSkillExecutableHandlerGuardPanel
        installedRegistry={installedRegistry.registry}
        policy={runtimePolicy.policy}
        previewRegistry={handlerPreviewRegistry.registry}
        trustedPackageIds={effectiveTrustedPackageIds}
      />
      <SettingsAgentSkillExecutableHandlerRegistryPanel
        installedRegistry={installedRegistry.registry}
        policy={runtimePolicy.policy}
        previewRegistry={handlerPreviewRegistry.registry}
        registry={executableHandlers.registry}
        trustedPackageIds={effectiveTrustedPackageIds}
        onRegisterFromPreviews={registerExecutableHandlers}
        onRemoveHandler={removeExecutableHandler}
      />
      <SettingsAgentSkillExecutableHandlerRunPreviewPanel
        handlerRegistry={executableHandlers.registry}
        installedRegistry={installedRegistry.registry}
        policy={runtimePolicy.policy}
        previewRegistry={handlerPreviewRegistry.registry}
        trustedPackageIds={effectiveTrustedPackageIds}
      />
      <SettingsAgentSkillExecutionPlanPreviewPanel
        executableHandlerPackageIds={executableHandlers.executableHandlerPackageIds}
        installedRegistry={installedRegistry.registry}
        policy={runtimePolicy.policy}
        previewRegistry={handlerPreviewRegistry.registry}
        trustedPackageIds={effectiveTrustedPackageIds}
      />
      <SettingsAgentSkillExecutionScopePanel
        installedRegistry={installedRegistry.registry}
        loaderOptions={loaderOptions}
        previewRegistry={handlerPreviewRegistry.registry}
      />
      <SettingsAgentSkillInstalledPackageRuntimeReadinessPanel
        executableHandlerPackageIds={executableHandlers.executableHandlerPackageIds}
        handlerPreviews={handlerPreviewRegistry.registry}
        policy={runtimePolicy.policy}
        registry={installedRegistry.registry}
        trustedPackageIds={effectiveTrustedPackageIds}
      />
      <SettingsAgentSkillInstalledPackageRuntimeMetadataPanel
        policyOptions={{
          ...runtimePolicyOptions,
          loaderPackageIds: loaderOptions.executableHandlerPackageIds,
          handlerPreviewPackageIds: loaderOptions.previewHandlerPackageIds,
        }}
        registry={installedRegistry.registry}
      />
      <SettingsAgentSkillPackageSourceViewPanel library={draftLibrary.library} />
    </div>
  );
}
