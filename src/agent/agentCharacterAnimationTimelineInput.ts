import {
  resolveAgentCharacterAnimationTimelineStepSync,
  type AgentCharacterAnimationTimelineStepSync,
} from './agentCharacterAnimationTimelineSync';

export interface AgentCharacterAnimationTimelineStep {
  atMs?: number;
  durationMs?: number;
  expressionCandidates: string[];
  label?: string;
  motionCandidates: string[];
  sync?: AgentCharacterAnimationTimelineStepSync | null;
  textCandidates: string[];
}

export interface AgentCharacterAnimationTimelineSource {
  hasTimeline: boolean;
  items: unknown[];
  timelineJsonInvalid: boolean;
}

const TIMELINE_INPUT_KEYS = ['timeline', 'steps', 'sequence'] as const;
const MOTION_STEP_TEXT_KEYS = ['animationId', 'motionId'] as const;
const EXPRESSION_STEP_TEXT_KEYS = ['expressionId', 'expression', 'expressionName'] as const;
const GENERAL_STEP_TEXT_KEYS = ['name', 'query', 'intent', 'text', 'description'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteMsInput(value: unknown) {
  const numberValue = typeof value === 'number'
    ? value
    : trimString(value) ? Number(value) : NaN;

  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : undefined;
}

function parseTimelineJson(value: unknown) {
  const jsonText = trimString(value);
  if (!jsonText) {
    return { ok: true, value: null };
  }

  try {
    return { ok: true, value: JSON.parse(jsonText) as unknown };
  } catch {
    return { ok: false, value: null };
  }
}

function extractNestedTimelineValue(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  for (const key of TIMELINE_INPUT_KEYS) {
    if (value[key] !== undefined && value[key] !== null) {
      return value[key];
    }
  }

  return value;
}

function extractTimelineItems(value: unknown): unknown[] {
  const timelineValue = extractNestedTimelineValue(value);
  if (Array.isArray(timelineValue)) {
    return timelineValue;
  }

  if (trimString(timelineValue) || isRecord(timelineValue)) {
    return [timelineValue];
  }

  return [];
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(trimString).filter(Boolean)
    : [];
}

function dedupeTextCandidates(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const text = value.trim();
    const lookupKey = text.toLowerCase();
    if (!text || seen.has(lookupKey)) {
      return false;
    }

    seen.add(lookupKey);
    return true;
  });
}

export function createAgentCharacterAnimationTimelineSource(
  input: Record<string, unknown>,
): AgentCharacterAnimationTimelineSource {
  const directValues = TIMELINE_INPUT_KEYS
    .map((key) => input[key])
    .filter((value) => value !== undefined && value !== null);
  const parsedJson = parseTimelineJson(input.timelineJson);
  const jsonValues = parsedJson.value === null ? [] : [parsedJson.value];

  return {
    hasTimeline: directValues.length > 0 || Boolean(trimString(input.timelineJson)),
    items: [...directValues, ...jsonValues].flatMap(extractTimelineItems),
    timelineJsonInvalid: !parsedJson.ok,
  };
}

function normalizeRecordTimelineStep(
  record: Record<string, unknown>,
): AgentCharacterAnimationTimelineStep | null {
  const motionCandidates = dedupeTextCandidates([
    ...MOTION_STEP_TEXT_KEYS.map((key) => trimString(record[key])),
    ...getStringArray(record.animationIds),
    ...getStringArray(record.motionIds),
    ...getStringArray(record.animations),
    ...getStringArray(record.motions),
  ]);
  const expressionCandidates = dedupeTextCandidates([
    ...EXPRESSION_STEP_TEXT_KEYS.map((key) => trimString(record[key])),
    ...getStringArray(record.expressionIds),
    ...getStringArray(record.expressions),
  ]);
  const textCandidates = dedupeTextCandidates(
    GENERAL_STEP_TEXT_KEYS.map((key) => trimString(record[key])),
  );

  if (motionCandidates.length === 0 && expressionCandidates.length === 0 && textCandidates.length === 0) {
    return null;
  }

  return {
    atMs: finiteMsInput(record.atMs ?? record.startMs),
    durationMs: finiteMsInput(record.durationMs),
    expressionCandidates,
    label: trimString(record.label) || trimString(record.title) || undefined,
    motionCandidates,
    sync: resolveAgentCharacterAnimationTimelineStepSync(record),
    textCandidates,
  };
}

export function normalizeAgentCharacterAnimationTimelineStep(
  value: unknown,
): AgentCharacterAnimationTimelineStep | null {
  const text = trimString(value);
  if (text) {
    return {
      expressionCandidates: [],
      motionCandidates: [],
      sync: null,
      textCandidates: [text],
    };
  }

  return isRecord(value) ? normalizeRecordTimelineStep(value) : null;
}
