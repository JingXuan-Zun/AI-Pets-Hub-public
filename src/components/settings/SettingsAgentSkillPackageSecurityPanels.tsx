import { useMemo } from 'react';
import {
  type AgentSkillExecutableHandlerRegistry,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillTrustEvidenceRegistry,
  type AgentSkillTrustedSignatureKeyRegistry,
} from '../../agent';
import { createSettingsAgentSkillRendererSignatureVerifier } from './settingsAgentSkillRendererSignatureVerifier';
import { SettingsAgentSkillExternalLoaderBoundaryPanel } from './SettingsAgentSkillExternalLoaderBoundaryPanel';
import { SettingsAgentSkillExternalLoaderIpcContractPanel } from './SettingsAgentSkillExternalLoaderIpcContractPanel';
import { SettingsAgentSkillExternalPackageGuardPanel } from './SettingsAgentSkillExternalPackageGuardPanel';
import { SettingsAgentSkillExternalSandboxBootstrapDryRunPanel } from './SettingsAgentSkillExternalSandboxBootstrapDryRunPanel';
import { SettingsAgentSkillExternalSandboxBootstrapGatePanel } from './SettingsAgentSkillExternalSandboxBootstrapGatePanel';
import { SettingsAgentSkillExternalSandboxBootstrapStartPanel } from './SettingsAgentSkillExternalSandboxBootstrapStartPanel';
import { SettingsAgentSkillExternalSandboxIsolationPanel } from './SettingsAgentSkillExternalSandboxIsolationPanel';
import { SettingsAgentSkillExternalSandboxSupervisorPreflightPanel } from './SettingsAgentSkillExternalSandboxSupervisorPreflightPanel';
import { SettingsAgentSkillPackageSignatureVerificationPanel } from './SettingsAgentSkillPackageSignatureVerificationPanel';
import { SettingsAgentSkillRuntimeModeDecisionPanel } from './SettingsAgentSkillRuntimeModeDecisionPanel';
import { SettingsAgentSkillTrustedSignatureKeyPanel } from './SettingsAgentSkillTrustedSignatureKeyPanel';

export function SettingsAgentSkillPackageSecurityPanels({
  executableHandlerRegistry,
  externalSandboxEvidenceCodes,
  externalLoaderIpcContractCodes,
  onSetExternalSandboxEvidence,
  onSetExternalLoaderIpcContract,
  evidenceRegistry,
  installedRegistry,
  onImportTrustedKeyRegistryJson,
  onRemoveTrustedKey,
  policy,
  previewRegistry,
  trustedPackageIds,
  trustedSignatureKeyRegistry,
}: {
  executableHandlerRegistry: AgentSkillExecutableHandlerRegistry;
  externalSandboxEvidenceCodes?: readonly string[];
  externalLoaderIpcContractCodes?: readonly string[];
  evidenceRegistry: AgentSkillTrustEvidenceRegistry;
  onSetExternalSandboxEvidence?: (code: string, enabled: boolean) => void;
  onSetExternalLoaderIpcContract?: (code: string, enabled: boolean) => void;
  installedRegistry: AgentSkillInstalledPackageRegistry;
  onImportTrustedKeyRegistryJson: (rawText: string) => void;
  onRemoveTrustedKey: (keyId: string) => void;
  policy: AgentSkillInstalledPackageRuntimePolicy;
  previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry;
  trustedPackageIds?: readonly string[];
  trustedSignatureKeyRegistry: AgentSkillTrustedSignatureKeyRegistry;
}) {
  const signatureVerifier = useMemo(
    () => createSettingsAgentSkillRendererSignatureVerifier(trustedSignatureKeyRegistry),
    [trustedSignatureKeyRegistry],
  );

  return (
    <>
      <SettingsAgentSkillTrustedSignatureKeyPanel
        registry={trustedSignatureKeyRegistry}
        onImportRegistryJson={onImportTrustedKeyRegistryJson}
        onRemoveKey={onRemoveTrustedKey}
      />
      <SettingsAgentSkillPackageSignatureVerificationPanel
        registry={installedRegistry}
        verifier={signatureVerifier.verifier}
        verifierIssueCodes={signatureVerifier.issueCodes}
      />
      <SettingsAgentSkillExternalPackageGuardPanel
        installedRegistry={installedRegistry}
        policy={policy}
        previewRegistry={previewRegistry}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillExternalLoaderBoundaryPanel
        evidenceRegistry={evidenceRegistry}
        installedRegistry={installedRegistry}
        policy={policy}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillExternalSandboxIsolationPanel
        evidenceRegistry={evidenceRegistry}
        externalSandboxEvidenceCodes={externalSandboxEvidenceCodes}
        installedRegistry={installedRegistry}
        onSetExternalSandboxEvidence={onSetExternalSandboxEvidence}
        policy={policy}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillExternalLoaderIpcContractPanel
        contractCodes={externalLoaderIpcContractCodes}
        evidenceCodes={externalSandboxEvidenceCodes}
        evidenceRegistry={evidenceRegistry}
        installedRegistry={installedRegistry}
        onSetContractCode={onSetExternalLoaderIpcContract}
        policy={policy}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillExternalSandboxBootstrapDryRunPanel
        contractCodes={externalLoaderIpcContractCodes}
        evidenceCodes={externalSandboxEvidenceCodes}
        evidenceRegistry={evidenceRegistry}
        installedRegistry={installedRegistry}
        policy={policy}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillExternalSandboxBootstrapGatePanel
        contractCodes={externalLoaderIpcContractCodes}
        evidenceCodes={externalSandboxEvidenceCodes}
        evidenceRegistry={evidenceRegistry}
        installedRegistry={installedRegistry}
        policy={policy}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillExternalSandboxBootstrapStartPanel
        contractCodes={externalLoaderIpcContractCodes}
        evidenceCodes={externalSandboxEvidenceCodes}
        evidenceRegistry={evidenceRegistry}
        installedRegistry={installedRegistry}
        policy={policy}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillExternalSandboxSupervisorPreflightPanel
        contractCodes={externalLoaderIpcContractCodes}
        evidenceCodes={externalSandboxEvidenceCodes}
        evidenceRegistry={evidenceRegistry}
        installedRegistry={installedRegistry}
        policy={policy}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
      <SettingsAgentSkillRuntimeModeDecisionPanel
        evidenceRegistry={evidenceRegistry}
        executableHandlerRegistry={executableHandlerRegistry}
        installedRegistry={installedRegistry}
        policy={policy}
        previewRegistry={previewRegistry}
        signatureVerifier={signatureVerifier.verifier}
        trustedPackageIds={trustedPackageIds}
      />
    </>
  );
}
