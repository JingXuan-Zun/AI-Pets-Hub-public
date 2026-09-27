import { useState } from 'react';
import {
  createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  parseAgentSkillInstalledPackageRuntimePolicyJson,
  pruneAgentSkillInstalledPackageRuntimePolicy,
  removeAgentSkillInstalledPackageRuntimePolicyRecord,
  serializeAgentSkillInstalledPackageRuntimePolicy,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillInstalledPackageRuntimePolicy,
  type AgentSkillInstalledPackageRuntimePolicyPatch,
} from '../../agent';

const STORAGE_KEY = 'desktop-pet.agent-skill-installed-runtime-policy.v1';

function loadRuntimePolicy() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createEmptyAgentSkillInstalledPackageRuntimePolicy();
    }
    return parseAgentSkillInstalledPackageRuntimePolicyJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyAgentSkillInstalledPackageRuntimePolicy();
  }
}

function persistRuntimePolicy(policy: AgentSkillInstalledPackageRuntimePolicy) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'Runtime policy can only be saved in the browser or desktop shell.';
    }
    window.localStorage.setItem(STORAGE_KEY, serializeAgentSkillInstalledPackageRuntimePolicy(policy));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Runtime policy storage failed.';
  }
}

export function useSettingsAgentSkillInstalledPackageRuntimePolicy() {
  const [policy, setPolicy] = useState(loadRuntimePolicy);

  const setRecord = (
    registry: AgentSkillInstalledPackageRegistry,
    packageId: string,
    patch: AgentSkillInstalledPackageRuntimePolicyPatch,
  ) => {
    const result = setAgentSkillInstalledPackageRuntimePolicyRecord(policy, registry, packageId, patch);
    const error = result.error || persistRuntimePolicy(result.policy);
    if (!error) {
      setPolicy(result.policy);
    }
    return error;
  };

  const removeRecord = (packageId: string) => {
    const nextPolicy = removeAgentSkillInstalledPackageRuntimePolicyRecord(policy, packageId);
    const error = persistRuntimePolicy(nextPolicy);
    if (!error) {
      setPolicy(nextPolicy);
    }
    return error;
  };

  const prune = (registry: AgentSkillInstalledPackageRegistry) => {
    const nextPolicy = pruneAgentSkillInstalledPackageRuntimePolicy(policy, registry);
    const error = persistRuntimePolicy(nextPolicy);
    if (!error) {
      setPolicy(nextPolicy);
    }
    return error;
  };

  return {
    policy,
    policyOptions: createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(policy),
    prune,
    removeRecord,
    setRecord,
  };
}
