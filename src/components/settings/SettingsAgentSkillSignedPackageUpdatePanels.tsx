import {
  type AgentSkillPackageLifecycleState,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageDraftLibrary,
  type AgentSkillPackageSignatureVerifier,
} from '../../agent';
import { SettingsAgentSkillMarketplaceInstallReadinessPanel } from './SettingsAgentSkillMarketplaceInstallReadinessPanel';
import { SettingsAgentSkillMarketplaceProductionReadinessPanel } from './SettingsAgentSkillMarketplaceProductionReadinessPanel';
import { SettingsAgentSkillSignedPackageUpdateApplicationPreviewPanel } from './SettingsAgentSkillSignedPackageUpdateApplicationPreviewPanel';
import { SettingsAgentSkillSignedPackageUpdatePreviewPanel } from './SettingsAgentSkillSignedPackageUpdatePreviewPanel';
import { SettingsAgentSkillSignedPackageUpdateRollbackPreviewPanel } from './SettingsAgentSkillSignedPackageUpdateRollbackPreviewPanel';

export function SettingsAgentSkillSignedPackageUpdatePanels({
  installedRegistry,
  library,
  lifecycle,
  onApplyMetadataUpdate,
  onRollbackMetadataUpdate,
  signatureVerifier,
}: {
  installedRegistry: AgentSkillInstalledPackageRegistry;
  library: AgentSkillPackageDraftLibrary;
  lifecycle: AgentSkillPackageLifecycleState;
  onApplyMetadataUpdate: (candidateDraftId: string) => void;
  onRollbackMetadataUpdate: (snapshotId: string) => void;
  signatureVerifier?: AgentSkillPackageSignatureVerifier | null;
}) {
  return (
    <>
      <SettingsAgentSkillMarketplaceInstallReadinessPanel
        installedRegistry={installedRegistry}
        library={library}
        signatureVerifier={signatureVerifier}
      />
      <SettingsAgentSkillMarketplaceProductionReadinessPanel />
      <SettingsAgentSkillSignedPackageUpdatePreviewPanel
        installedRegistry={installedRegistry}
        library={library}
        signatureVerifier={signatureVerifier}
      />
      <SettingsAgentSkillSignedPackageUpdateApplicationPreviewPanel
        installedRegistry={installedRegistry}
        library={library}
        onApplyMetadataUpdate={onApplyMetadataUpdate}
        signatureVerifier={signatureVerifier}
      />
      <SettingsAgentSkillSignedPackageUpdateRollbackPreviewPanel
        installedRegistry={installedRegistry}
        library={library}
        lifecycle={lifecycle}
        onRollbackMetadataUpdate={onRollbackMetadataUpdate}
        signatureVerifier={signatureVerifier}
      />
    </>
  );
}
