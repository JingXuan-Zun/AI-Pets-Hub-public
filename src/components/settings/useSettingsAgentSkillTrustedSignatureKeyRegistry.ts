import { useState } from 'react';
import {
  createEmptyAgentSkillTrustedSignatureKeyRegistry,
  parseAgentSkillTrustedSignatureKeyRegistryJson,
  removeAgentSkillTrustedSignatureKey,
  serializeAgentSkillTrustedSignatureKeyRegistry,
  type AgentSkillTrustedSignatureKeyRegistry,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-trusted-signature-key-registry.v1';

function loadRegistry() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillTrustedSignatureKeyRegistry();
    }
    return parseAgentSkillTrustedSignatureKeyRegistryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillTrustedSignatureKeyRegistry();
  }
}

function persistRegistry(registry: AgentSkillTrustedSignatureKeyRegistry) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Trusted signature keys can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillTrustedSignatureKeyRegistry(registry));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Trusted signature key storage failed.';
  }
}

export function useSettingsAgentSkillTrustedSignatureKeyRegistry() {
  const [registry, setRegistry] = useState(loadRegistry);

  const replaceRegistry = (nextRegistry: AgentSkillTrustedSignatureKeyRegistry) => {
    const error = persistRegistry(nextRegistry);
    if (!error) {
      setRegistry(nextRegistry);
    }
    return error;
  };

  const importRegistryJson = (rawText: string) => {
    try {
      const nextRegistry = parseAgentSkillTrustedSignatureKeyRegistryJson(rawText);
      if (!nextRegistry.keys.length) {
        return 'trusted_key_registry_invalid';
      }
      return replaceRegistry(nextRegistry);
    } catch {
      return 'trusted_key_registry_invalid';
    }
  };

  const removeKey = (keyId: string) => {
    return replaceRegistry(removeAgentSkillTrustedSignatureKey(registry, keyId));
  };

  return {
    importRegistryJson,
    registry,
    removeKey,
    replaceRegistry,
  };
}
