import { type AgentSkillInstalledPackageRegistry } from './agentSkillPackageInstalledRegistry';
import { createAgentSkillManifest, type AgentSkillManifestEntry } from './agentSkillManifest';

export type AgentSkillInstalledPackageRuntimeMetadataStatus = 'metadata-ready' | 'runtime-disabled' | 'unknown-skill';

export interface AgentSkillInstalledPackageRuntimeMetadataRow {
  installStatus: string;
  packageId: string;
  registryVersion: string | null;
  runtime: string;
  skillId: string;
  status: AgentSkillInstalledPackageRuntimeMetadataStatus;
}

export interface AgentSkillInstalledPackageRuntimeMetadataReport {
  rows: AgentSkillInstalledPackageRuntimeMetadataRow[];
  summary: Record<AgentSkillInstalledPackageRuntimeMetadataStatus, number> & { total: number };
}

function resolveRowStatus(
  installedRuntimeEnabled: boolean,
  registered: boolean,
): AgentSkillInstalledPackageRuntimeMetadataStatus {
  if (!registered) {
    return 'unknown-skill';
  }
  return installedRuntimeEnabled ? 'metadata-ready' : 'runtime-disabled';
}

export function createAgentSkillInstalledPackageRuntimeMetadataReport(
  registry: AgentSkillInstalledPackageRegistry,
): AgentSkillInstalledPackageRuntimeMetadataReport {
  const manifestById = new Map<string, AgentSkillManifestEntry>(
    createAgentSkillManifest().entries.map((entry) => [entry.id, entry]),
  );
  const rows = registry.packages.map((item) => {
    const manifestEntry = manifestById.get(item.skillId);
    return {
      installStatus: manifestEntry?.package.installStatus ?? 'unknown',
      packageId: item.id,
      registryVersion: manifestEntry?.package.version ?? null,
      runtime: item.package.scaffold.package.runtime,
      skillId: item.skillId,
      status: resolveRowStatus(item.runtimeEnabled, Boolean(manifestEntry)),
    };
  });
  const summary = { 'metadata-ready': 0, 'runtime-disabled': 0, total: rows.length, 'unknown-skill': 0 };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });

  return { rows, summary };
}
