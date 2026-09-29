import { useState } from 'react';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillTrustEvidence,
  createEmptyAgentSkillTrustEvidenceRegistry,
  parseAgentSkillTrustEvidenceRegistryJson,
  removeAgentSkillTrustEvidence,
  serializeAgentSkillTrustEvidenceRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillTrustEvidenceRegistry,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-trust-evidence-registry.v1';

function loadTrustEvidenceRegistry() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillTrustEvidenceRegistry();
    }
    return parseAgentSkillTrustEvidenceRegistryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillTrustEvidenceRegistry();
  }
}

function persistTrustEvidenceRegistry(registry: AgentSkillTrustEvidenceRegistry) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Trust evidence registry can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillTrustEvidenceRegistry(registry));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Trust evidence registry storage failed.';
  }
}

export function useSettingsAgentSkillTrustEvidenceRegistry() {
  const [registry, setRegistry] = useState(loadTrustEvidenceRegistry);

  const createEvidence = (installedRegistry: AgentSkillInstalledPackageRegistry, packageId: string) => {
    const result = createAgentSkillTrustEvidence(registry, installedRegistry, packageId);
    const error = result.error || persistTrustEvidenceRegistry(result.registry);
    if (!error) {
      setRegistry(result.registry);
    }
    return error;
  };

  const removeEvidence = (packageId: string) => {
    const nextRegistry = removeAgentSkillTrustEvidence(registry, packageId);
    const error = persistTrustEvidenceRegistry(nextRegistry);
    if (!error) {
      setRegistry(nextRegistry);
    }
    return error;
  };

  const getEffectiveTrustedPackageIds = (
    policy: AgentSkillInstalledPackageRuntimePolicy,
    installedRegistry: AgentSkillInstalledPackageRegistry,
  ) => createAgentSkillEffectiveTrustedPackageIds(policy, installedRegistry, registry);

  return {
    createEvidence,
    getEffectiveTrustedPackageIds,
    registry,
    removeEvidence,
  };
}
