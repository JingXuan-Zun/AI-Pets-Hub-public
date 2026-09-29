import { useState } from 'react';
import {
  createEmptyAgentSkillExternalSandboxEvidenceRegistry,
  getAgentSkillExternalSandboxEvidenceCodes,
  parseAgentSkillExternalSandboxEvidenceRegistryJson,
  serializeAgentSkillExternalSandboxEvidenceRegistry,
  setAgentSkillExternalSandboxEvidenceCode,
  type AgentSkillExternalSandboxEvidenceRegistry,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-external-sandbox-evidence-registry.v1';

function loadRegistry() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillExternalSandboxEvidenceRegistry();
    }
    return parseAgentSkillExternalSandboxEvidenceRegistryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillExternalSandboxEvidenceRegistry();
  }
}

function persistRegistry(registry: AgentSkillExternalSandboxEvidenceRegistry) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Sandbox evidence can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillExternalSandboxEvidenceRegistry(registry));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Sandbox evidence storage failed.';
  }
}

export function useSettingsAgentSkillExternalSandboxEvidenceRegistry() {
  const [registry, setRegistry] = useState(loadRegistry);

  const setEvidenceCode = (code: string, enabled: boolean) => {
    const nextRegistry = setAgentSkillExternalSandboxEvidenceCode(registry, code, enabled);
    const error = persistRegistry(nextRegistry);
    if (!error) {
      setRegistry(nextRegistry);
    }
    return error;
  };

  return {
    evidenceCodes: getAgentSkillExternalSandboxEvidenceCodes(registry),
    registry,
    setEvidenceCode,
  };
}
