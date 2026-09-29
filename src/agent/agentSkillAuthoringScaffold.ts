import { createAgentSkillManifest, type AgentSkillManifestEntry } from './agentSkillManifest';

export interface AgentSkillAuthoringScaffold {
  createdFrom: 'agent-skill-manifest';
  inputTemplate: Record<string, unknown>;
  manifestVersion: number;
  package: AgentSkillManifestEntry['package'];
  route: {
    preferredCapabilityId: string;
    preferredToolNames: string[];
  };
  skill: {
    description: string;
    id: string;
    risk: AgentSkillManifestEntry['risk'];
    stage: AgentSkillManifestEntry['stage'];
    tags: string[];
    title: string;
  };
  todo: string[];
}

function createInputTemplate(entry: AgentSkillManifestEntry) {
  return Object.fromEntries(entry.inputKeys.map((key) => [
    key,
    entry.requiredInputKeys.includes(key) ? '<required>' : '<optional>',
  ]));
}

function createAuthoringTodo(entry: AgentSkillManifestEntry) {
  return [
    'Confirm package metadata before install/runtime loading is added.',
    entry.preferredToolRoutes.length
      ? 'Verify preferred tool route permissions and receipts.'
      : 'Bind local runtime execution and dry-run behavior.',
    entry.package.assetRequirements.length
      ? 'Validate required assets before execution.'
      : 'Confirm no asset preflight is required.',
  ];
}

export function createAgentSkillAuthoringScaffold(skillId: string): AgentSkillAuthoringScaffold | null {
  const manifest = createAgentSkillManifest();
  const entry = manifest.entries.find((item) => item.id === skillId);
  if (!entry) {
    return null;
  }

  return {
    createdFrom: 'agent-skill-manifest',
    inputTemplate: createInputTemplate(entry),
    manifestVersion: 1,
    package: entry.package,
    route: {
      preferredCapabilityId: entry.preferredCapabilityId,
      preferredToolNames: entry.preferredToolRoutes.map((route) => route.name),
    },
    skill: {
      description: entry.description,
      id: entry.id,
      risk: entry.risk,
      stage: entry.stage,
      tags: entry.tags,
      title: entry.title,
    },
    todo: createAuthoringTodo(entry),
  };
}
