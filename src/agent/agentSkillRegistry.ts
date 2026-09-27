import {
  AGENT_SKILL_REGISTRY,
  type AgentSkillDefinition,
  type AgentSkillId,
  type AgentSkillPreferredToolName,
} from './agentSkillDefinitions';

export type {
  AgentSkillDefinition,
  AgentSkillId,
  AgentSkillPreferredCapabilityId,
  AgentSkillPreferredToolName,
} from './agentSkillDefinitions';

export interface AgentSkillListOptions {
  limit?: number | null;
  query?: string | null;
}

export interface AgentSkillExecutionInput {
  dryRun?: boolean | null;
  inputJson?: string | null;
  intent?: string | null;
  skillId: string;
  target?: string | null;
}

export interface AgentSkillExecutionResult {
  input: Record<string, unknown>;
  marker?: string | null;
  observations: string[];
  ok: boolean;
  preferredToolNames: AgentSkillPreferredToolName[];
  skill: AgentSkillDefinition | null;
  summary: string;
}

const AGENT_SKILL_BY_ID = new Map(
  AGENT_SKILL_REGISTRY.map((skill) => [skill.id, skill]),
);

function normalizeSkillLookupValue(value: string) {
  return value.trim().toLowerCase();
}

function parseSkillInputJson(value?: string | null): Record<string, unknown> {
  if (!value?.trim()) {
    return {};
  }

  const parsedValue = JSON.parse(value) as unknown;
  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new Error('Skill inputJson must decode to a JSON object.');
  }

  return parsedValue as Record<string, unknown>;
}

function getArrayInputLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function hasTimelineInput(input: Record<string, unknown>) {
  const timelineCount = Math.max(
    getArrayInputLength(input.timeline),
    getArrayInputLength(input.steps),
    getArrayInputLength(input.sequence),
  );
  const timelineJson = typeof input.timelineJson === 'string' && input.timelineJson.trim()
    ? 1
    : 0;

  return timelineCount > 0
    ? { count: timelineCount, marker: `[animation-timeline:${timelineCount}]` }
    : timelineJson > 0
      ? { count: timelineJson, marker: '[animation-timeline:json]' }
      : null;
}

function createCharacterAnimationMarker(input: Record<string, unknown>, intent?: string | null) {
  const animationId = typeof input.animationId === 'string' && input.animationId.trim()
    ? input.animationId.trim()
    : '';
  const animationIdsCount = getArrayInputLength(input.animationIds);
  const timelineInput = hasTimelineInput(input);

  if (timelineInput) {
    return timelineInput.marker;
  }

  if (animationIdsCount > 0) {
    return `[animation-sequence:${animationIdsCount}]`;
  }

  return animationId ? `[animation:${animationId}]` : intent?.trim() ? null : null;
}

function createSkillExecutionObservations(
  skill: AgentSkillDefinition,
  input: AgentSkillExecutionInput,
  marker: string | null,
) {
  return [
    `Skill: ${skill.id}`,
    `Capability: ${skill.preferredCapabilityId}`,
    `Risk: ${skill.risk}`,
    input.intent?.trim() ? `Intent: ${input.intent.trim()}` : '',
    input.target?.trim() ? `Target: ${input.target.trim()}` : '',
    marker ? `Marker: ${marker}` : '',
    input.dryRun === false ? 'Mode: execute-requested' : 'Mode: dry-run',
  ].filter(Boolean);
}

export function listAgentSkills(options: AgentSkillListOptions = {}) {
  const query = normalizeSkillLookupValue(options.query ?? '');
  const defaultLimit = AGENT_SKILL_REGISTRY.length;
  const limit = Math.max(1, Math.min(100, Math.round(options.limit ?? defaultLimit)));
  const filteredSkills = query
    ? AGENT_SKILL_REGISTRY.filter((skill) => (
        normalizeSkillLookupValue([
          skill.id,
          skill.title,
          skill.description,
          ...skill.tags,
        ].join(' ')).includes(query)
      ))
    : AGENT_SKILL_REGISTRY;

  return filteredSkills.slice(0, limit);
}

export function getAgentSkillDefinition(skillId: string) {
  return AGENT_SKILL_BY_ID.get(skillId as AgentSkillId) ?? null;
}

export function resolveAgentSkillExecution(input: AgentSkillExecutionInput): AgentSkillExecutionResult {
  const skill = getAgentSkillDefinition(input.skillId);
  if (!skill) {
    return {
      input: {},
      observations: [`Unknown skill: ${input.skillId}`],
      ok: false,
      preferredToolNames: [],
      skill: null,
      summary: `Unknown Agent skill "${input.skillId}".`,
    };
  }

  try {
    const parsedInput = parseSkillInputJson(input.inputJson);
    const marker = skill.id === 'character.animation'
      ? createCharacterAnimationMarker(parsedInput, input.intent)
      : null;

    return {
      input: parsedInput,
      marker,
      observations: createSkillExecutionObservations(skill, input, marker),
      ok: true,
      preferredToolNames: skill.preferredToolNames,
      skill,
      summary: `Resolved skill ${skill.id} via ${skill.preferredToolNames.length || 0} preferred tool route(s).`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid skill inputJson.';
    return {
      input: {},
      observations: [`Skill input error: ${message}`],
      ok: false,
      preferredToolNames: skill.preferredToolNames,
      skill,
      summary: message,
    };
  }
}
