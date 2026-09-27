import {
  type AgentSkillInstalledPackage,
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';
import { createAgentSkillManifest } from './agentSkillManifest';

export interface AgentSkillInstalledPackageAudit {
  duplicateSkillCount: number;
  runtimeEnabledCount: number;
  total: number;
  unknownSkillCount: number;
  uniqueSkillCount: number;
}

function countDuplicateSkills(packages: AgentSkillInstalledPackage[]) {
  const counts = new Map<string, number>();
  packages.forEach((item) => {
    counts.set(item.skillId, (counts.get(item.skillId) ?? 0) + 1);
  });
  return [...counts.values()].filter((count) => count > 1).length;
}

export function createAgentSkillInstalledPackageAudit(
  registry: AgentSkillInstalledPackageRegistry,
): AgentSkillInstalledPackageAudit {
  const registeredSkillIds = new Set<string>(createAgentSkillManifest().entries.map((entry) => entry.id));
  const uniqueSkillIds = new Set(registry.packages.map((item) => item.skillId));
  return {
    duplicateSkillCount: countDuplicateSkills(registry.packages),
    runtimeEnabledCount: registry.packages.filter((item) => item.runtimeEnabled).length,
    total: registry.packages.length,
    unknownSkillCount: registry.packages.filter((item) => !registeredSkillIds.has(item.skillId)).length,
    uniqueSkillCount: uniqueSkillIds.size,
  };
}
