import {
  AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
  parseAgentSkillInstalledPackageRegistryJson,
  type AgentSkillInstalledPackage,
  type AgentSkillInstalledPackageRegistry,
} from './agentSkillPackageInstalledRegistry';

export const AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_EXPORT_KIND = 'agent-skill-installed-package-registry-export.v1';

export interface AgentSkillInstalledPackageRegistryExport {
  exportedAt: string;
  kind: typeof AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_EXPORT_KIND;
  registry: AgentSkillInstalledPackageRegistry;
}

export interface AgentSkillInstalledPackageRegistryImportPreview {
  errors: string[];
  importedCount: number;
  inputCount: number;
  kind: string;
  registry: AgentSkillInstalledPackageRegistry | null;
  ok: boolean;
  skippedDuplicateCount: number;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractRegistryFromImport(value: unknown) {
  if (!isRecord(value)) {
    return { error: 'Input must be a JSON object.', kind: '', registry: null };
  }

  if (value.kind === AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_EXPORT_KIND) {
    return { error: null, kind: getString(value.kind), registry: value.registry };
  }

  if (value.kind === AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND) {
    return { error: null, kind: getString(value.kind), registry: value };
  }

  return {
    error: 'Input is not an agent-skill-installed-package-registry export.',
    kind: getString(value.kind),
    registry: null,
  };
}

function mergeInstalledRegistries(
  currentRegistry: AgentSkillInstalledPackageRegistry,
  importedPackages: AgentSkillInstalledPackage[],
): {
  importedCount: number;
  registry: AgentSkillInstalledPackageRegistry;
  skippedDuplicateCount: number;
} {
  const currentIds = new Set(currentRegistry.packages.map((item) => item.id));
  const nextPackages = importedPackages.filter((item) => !currentIds.has(item.id));
  return {
    importedCount: nextPackages.length,
    registry: {
      kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_KIND,
      packages: [...nextPackages, ...currentRegistry.packages],
    },
    skippedDuplicateCount: importedPackages.length - nextPackages.length,
  };
}

export function createAgentSkillInstalledPackageRegistryExport(
  registry: AgentSkillInstalledPackageRegistry,
  exportedAt = new Date().toISOString(),
): AgentSkillInstalledPackageRegistryExport {
  return {
    exportedAt,
    kind: AGENT_SKILL_INSTALLED_PACKAGE_REGISTRY_EXPORT_KIND,
    registry,
  };
}

export function parseAgentSkillInstalledPackageRegistryImportJson(
  inputJson: string,
  currentRegistry: AgentSkillInstalledPackageRegistry,
): AgentSkillInstalledPackageRegistryImportPreview {
  try {
    const parsed = JSON.parse(inputJson) as unknown;
    const extracted = extractRegistryFromImport(parsed);
    if (extracted.error || !extracted.registry) {
      return {
        errors: [extracted.error ?? 'Installed registry export is missing registry data.'],
        importedCount: 0,
        inputCount: 0,
        kind: extracted.kind,
        ok: false,
        registry: null,
        skippedDuplicateCount: 0,
        warnings: [],
      };
    }

    const importedRegistry = parseAgentSkillInstalledPackageRegistryJson(JSON.stringify(extracted.registry));
    const mergeResult = mergeInstalledRegistries(currentRegistry, importedRegistry.packages);
    return {
      errors: [],
      importedCount: mergeResult.importedCount,
      inputCount: importedRegistry.packages.length,
      kind: extracted.kind,
      ok: true,
      registry: mergeResult.registry,
      skippedDuplicateCount: mergeResult.skippedDuplicateCount,
      warnings: mergeResult.importedCount === 0 ? ['No new installed package records would be imported.'] : [],
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'Invalid JSON.'],
      importedCount: 0,
      inputCount: 0,
      kind: '',
      ok: false,
      registry: null,
      skippedDuplicateCount: 0,
      warnings: [],
    };
  }
}
