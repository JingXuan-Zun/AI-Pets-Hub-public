import {
  AGENT_SKILL_REGISTRY,
  type AgentSkillDefinition,
  type AgentSkillId,
  type AgentSkillPreferredToolName,
} from './agentSkillDefinitions';
import { getAgentToolDefinition } from './agentToolRegistry';

export interface AgentSkillManifestToolRoute {
  available: boolean;
  capabilityId: string | null;
  description: string | null;
  name: AgentSkillPreferredToolName;
}

export interface AgentSkillManifestEntry {
  defaultEnabled: boolean;
  description: string;
  id: AgentSkillId;
  inputKeys: string[];
  package: AgentSkillDefinition['package'];
  preferredCapabilityId: string;
  preferredToolRoutes: AgentSkillManifestToolRoute[];
  requiredInputKeys: string[];
  risk: AgentSkillDefinition['risk'];
  routeSummary: string;
  stage: AgentSkillDefinition['stage'];
  tags: string[];
  title: string;
}

export interface AgentSkillManifestSummary {
  assetRequirementCounts: Record<string, number>;
  capabilityCounts: Record<string, number>;
  defaultEnabledCount: number;
  installStatusCounts: Record<AgentSkillDefinition['package']['installStatus'], number>;
  riskCounts: Record<AgentSkillDefinition['risk'], number>;
  runtimeCounts: Record<AgentSkillDefinition['package']['runtime'], number>;
  runtimeRequirementCounts: Record<string, number>;
  stageCounts: Record<AgentSkillDefinition['stage'], number>;
  total: number;
  toolRoutedCount: number;
}

export interface AgentSkillManifest {
  entries: AgentSkillManifestEntry[];
  summary: AgentSkillManifestSummary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createCountRecord<T extends string>(keys: readonly T[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function incrementCount<T extends string>(counts: Record<T, number>, key: T) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function getSkillInputKeys(skill: AgentSkillDefinition) {
  const properties = isRecord(skill.inputSchema.properties)
    ? skill.inputSchema.properties
    : {};
  return Object.keys(properties).sort((a, b) => a.localeCompare(b));
}

function getRequiredInputKeys(skill: AgentSkillDefinition) {
  const required = skill.inputSchema.required;
  return Array.isArray(required)
    ? required.filter((key): key is string => typeof key === 'string').sort()
    : [];
}

function createToolRoute(toolName: AgentSkillPreferredToolName): AgentSkillManifestToolRoute {
  const definition = getAgentToolDefinition(toolName);
  return {
    available: Boolean(definition),
    capabilityId: definition?.capabilityId ?? null,
    description: definition?.description ?? null,
    name: toolName,
  };
}

function createRouteSummary(skill: AgentSkillDefinition, routes: AgentSkillManifestToolRoute[]) {
  if (routes.length === 0) {
    return `${skill.preferredCapabilityId} / local runtime`;
  }

  const unavailableCount = routes.filter((route) => !route.available).length;
  const suffix = unavailableCount > 0 ? `, ${unavailableCount} missing` : '';
  return `${skill.preferredCapabilityId} / ${routes.length} preferred tool(s)${suffix}`;
}

function createManifestEntry(skill: AgentSkillDefinition): AgentSkillManifestEntry {
  const preferredToolRoutes = skill.preferredToolNames.map(createToolRoute);
  return {
    defaultEnabled: skill.defaultEnabled,
    description: skill.description,
    id: skill.id,
    inputKeys: getSkillInputKeys(skill),
    package: {
      ...skill.package,
      assetRequirements: [...skill.package.assetRequirements],
      runtimeRequirements: [...skill.package.runtimeRequirements],
    },
    preferredCapabilityId: skill.preferredCapabilityId,
    preferredToolRoutes,
    requiredInputKeys: getRequiredInputKeys(skill),
    risk: skill.risk,
    routeSummary: createRouteSummary(skill, preferredToolRoutes),
    stage: skill.stage,
    tags: [...skill.tags],
    title: skill.title,
  };
}

function createManifestSummary(entries: AgentSkillManifestEntry[]): AgentSkillManifestSummary {
  const riskCounts = createCountRecord(['action', 'read', 'visual'] as const);
  const stageCounts = createCountRecord(['foundation', 'future', 'mvp'] as const);
  const installStatusCounts = createCountRecord(['bundled', 'external-required', 'planned'] as const);
  const runtimeCounts = createCountRecord(['external-mcp', 'hybrid', 'local', 'platform-tool'] as const);
  const assetRequirementCounts: Record<string, number> = {};
  const capabilityCounts: Record<string, number> = {};
  const runtimeRequirementCounts: Record<string, number> = {};

  entries.forEach((entry) => {
    incrementCount(riskCounts, entry.risk);
    incrementCount(stageCounts, entry.stage);
    incrementCount(installStatusCounts, entry.package.installStatus);
    incrementCount(runtimeCounts, entry.package.runtime);
    capabilityCounts[entry.preferredCapabilityId] = (capabilityCounts[entry.preferredCapabilityId] ?? 0) + 1;
    entry.package.assetRequirements.forEach((key) => {
      assetRequirementCounts[key] = (assetRequirementCounts[key] ?? 0) + 1;
    });
    entry.package.runtimeRequirements.forEach((key) => {
      runtimeRequirementCounts[key] = (runtimeRequirementCounts[key] ?? 0) + 1;
    });
  });

  return {
    assetRequirementCounts,
    capabilityCounts,
    defaultEnabledCount: entries.filter((entry) => entry.defaultEnabled).length,
    installStatusCounts,
    riskCounts,
    runtimeCounts,
    runtimeRequirementCounts,
    stageCounts,
    total: entries.length,
    toolRoutedCount: entries.filter((entry) => entry.preferredToolRoutes.length > 0).length,
  };
}

export function createAgentSkillManifest(
  skills: AgentSkillDefinition[] = AGENT_SKILL_REGISTRY,
): AgentSkillManifest {
  const entries = skills.map(createManifestEntry);
  return {
    entries,
    summary: createManifestSummary(entries),
  };
}
