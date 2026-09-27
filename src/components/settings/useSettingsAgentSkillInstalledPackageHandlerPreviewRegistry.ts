import { useState } from 'react';
import {
  createAgentSkillInstalledPackageHandlerPreview,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  getAgentSkillInstalledPackageHandlerPreviewPackageIds,
  parseAgentSkillInstalledPackageHandlerPreviewRegistryJson,
  removeAgentSkillInstalledPackageHandlerPreview,
  serializeAgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-handler-preview-registry.v1';

function loadHandlerPreviewRegistry() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry();
    }
    return parseAgentSkillInstalledPackageHandlerPreviewRegistryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry();
  }
}

function persistHandlerPreviewRegistry(registry: AgentSkillInstalledPackageHandlerPreviewRegistry) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Handler preview registry can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillInstalledPackageHandlerPreviewRegistry(registry));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Handler preview registry storage failed.';
  }
}

export function useSettingsAgentSkillInstalledPackageHandlerPreviewRegistry() {
  const [registry, setRegistry] = useState(loadHandlerPreviewRegistry);

  const createPreview = (installedRegistry: AgentSkillInstalledPackageRegistry, packageId: string) => {
    const result = createAgentSkillInstalledPackageHandlerPreview(registry, installedRegistry, packageId);
    const error = result.error || persistHandlerPreviewRegistry(result.registry);
    if (!error) {
      setRegistry(result.registry);
    }
    return error;
  };

  const removePreview = (packageId: string) => {
    const nextRegistry = removeAgentSkillInstalledPackageHandlerPreview(registry, packageId);
    const error = persistHandlerPreviewRegistry(nextRegistry);
    if (!error) {
      setRegistry(nextRegistry);
    }
    return error;
  };

  return {
    createPreview,
    previewPackageIds: getAgentSkillInstalledPackageHandlerPreviewPackageIds(registry),
    registry,
    removePreview,
  };
}
