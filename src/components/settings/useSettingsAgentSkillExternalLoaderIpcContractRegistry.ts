import { useState } from 'react';
import {
  createEmptyAgentSkillExternalLoaderIpcContractRegistry,
  getAgentSkillExternalLoaderIpcContractCodes,
  parseAgentSkillExternalLoaderIpcContractRegistryJson,
  serializeAgentSkillExternalLoaderIpcContractRegistry,
  setAgentSkillExternalLoaderIpcContractCode,
  type AgentSkillExternalLoaderIpcContractRegistry,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-external-loader-ipc-contract-registry.v1';

function loadRegistry() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillExternalLoaderIpcContractRegistry();
    }
    return parseAgentSkillExternalLoaderIpcContractRegistryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillExternalLoaderIpcContractRegistry();
  }
}

function persistRegistry(registry: AgentSkillExternalLoaderIpcContractRegistry) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'External loader IPC contract review can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillExternalLoaderIpcContractRegistry(registry));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'External loader IPC contract storage failed.';
  }
}

export function useSettingsAgentSkillExternalLoaderIpcContractRegistry() {
  const [registry, setRegistry] = useState(loadRegistry);

  const setContractCode = (code: string, enabled: boolean) => {
    const nextRegistry = setAgentSkillExternalLoaderIpcContractCode(registry, code, enabled);
    const error = persistRegistry(nextRegistry);
    if (!error) {
      setRegistry(nextRegistry);
    }
    return error;
  };

  return {
    contractCodes: getAgentSkillExternalLoaderIpcContractCodes(registry),
    registry,
    setContractCode,
  };
}
