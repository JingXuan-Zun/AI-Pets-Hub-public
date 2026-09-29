import { useState } from 'react';
import {
  createEmptyAgentSkillExecutableHandlerRegistry,
  getAgentSkillExecutableHandlerPackageIds,
  parseAgentSkillExecutableHandlerRegistryJson,
  registerAgentSkillExecutableHandlersFromPreviews,
  removeAgentSkillExecutableHandler,
  serializeAgentSkillExecutableHandlerRegistry,
  type AgentSkillExecutableHandlerRegistry,
  type AgentSkillInstalledPackageHandlerPreviewRegistry,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-executable-handler-registry.v1';

function loadExecutableHandlerRegistry() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillExecutableHandlerRegistry();
    }
    return parseAgentSkillExecutableHandlerRegistryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillExecutableHandlerRegistry();
  }
}

function persistExecutableHandlerRegistry(registry: AgentSkillExecutableHandlerRegistry) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Executable handler registry can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillExecutableHandlerRegistry(registry));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Executable handler registry storage failed.';
  }
}

export function useSettingsAgentSkillExecutableHandlerRegistry() {
  const [registry, setRegistry] = useState(loadExecutableHandlerRegistry);

  const registerFromPreviews = (
    installedRegistry: AgentSkillInstalledPackageRegistry,
    policy: AgentSkillInstalledPackageRuntimePolicy,
    previewRegistry: AgentSkillInstalledPackageHandlerPreviewRegistry,
    trustedPackageIds?: readonly string[],
  ) => {
    const result = registerAgentSkillExecutableHandlersFromPreviews(
      registry,
      installedRegistry,
      policy,
      previewRegistry,
      new Date().toISOString(),
      { trustedPackageIds },
    );
    const error = persistExecutableHandlerRegistry(result.registry);
    if (!error) {
      setRegistry(result.registry);
    }
    return { ...result, error };
  };

  const removeHandler = (packageId: string) => {
    const nextRegistry = removeAgentSkillExecutableHandler(registry, packageId);
    const error = persistExecutableHandlerRegistry(nextRegistry);
    if (!error) {
      setRegistry(nextRegistry);
    }
    return error;
  };

  return {
    executableHandlerPackageIds: getAgentSkillExecutableHandlerPackageIds(registry),
    registerFromPreviews,
    registry,
    removeHandler,
  };
}
