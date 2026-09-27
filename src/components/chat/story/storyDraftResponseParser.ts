import JSON5 from 'json5';

type JsonRecord = Record<string, unknown>;

const STORY_TEXT_FIELDS = [
  ['title', 7],
  ['premise', 6],
  ['setting', 5],
  ['customScript', 5],
  ['openingScene', 4],
  ['userRole', 3],
  ['initialTime', 2],
  ['successCondition', 2],
  ['failureCondition', 2],
] as const;

const STORY_ARRAY_FIELDS = new Set([
  'goals',
  'tasks',
  'rules',
  'participantIds',
  'participantRoutes',
]);

const STORY_PRIMARY_FIELDS = new Set([
  'title',
  'premise',
  'setting',
  'customScript',
  'openingScene',
  'userRole',
  'initialTime',
  'successCondition',
  'failureCondition',
  'goals',
  'tasks',
  'rules',
]);

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stripJsonFence(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function normalizeCommonJsonMistakes(value: string) {
  return value
    .replace(/,\s*([}\]])/gu, '$1')
    .replace(/\u0000/gu, '')
    .trim();
}

function findBalancedObjectEnd(text: string, start: number) {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{' || character === '[') {
      stack.push(character);
      continue;
    }
    if (character !== '}' && character !== ']') continue;
    const expected = character === '}' ? '{' : '[';
    if (stack.pop() !== expected) return null;
    if (stack.length === 0) return index;
  }
  return null;
}

function parseBalancedObjects(text: string) {
  const candidates: Array<{ value: unknown; end: number }> = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    const end = findBalancedObjectEnd(text, start);
    if (end === null) continue;
    try {
      candidates.push({ value: JSON.parse(text.slice(start, end + 1)) as unknown, end });
    } catch {
      // An inner object may still be valid when an outer example is malformed.
    }
  }
  return candidates;
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function scoreStoryCandidate(value: unknown) {
  const record = asRecord(value);
  if (!record) return 0;
  let score = 0;
  let populatedFields = 0;
  for (const [field, weight] of STORY_TEXT_FIELDS) {
    if (hasText(record[field])) {
      score += weight;
      populatedFields += 1;
    }
  }
  for (const field of STORY_ARRAY_FIELDS) {
    if (Array.isArray(record[field]) && record[field].length > 0) {
      score += 3;
      populatedFields += 1;
    }
  }
  return score + Math.min(populatedFields, 8);
}

function isStoryCandidate(value: unknown) {
  const record = asRecord(value);
  if (!record) return false;
  const hasPrimaryField = Object.keys(record).some((key) => STORY_PRIMARY_FIELDS.has(key));
  return hasPrimaryField && scoreStoryCandidate(record) >= 2;
}

function chooseStoryCandidate(candidates: Array<{ value: unknown; end: number }>) {
  let best: { value: unknown; end: number; score: number } | null = null;
  for (const candidate of candidates) {
    if (!isStoryCandidate(candidate.value)) continue;
    const score = scoreStoryCandidate(candidate.value);
    if (!best || score > best.score || (score === best.score && candidate.end > best.end)) {
      best = { ...candidate, score };
    }
  }
  return best?.value ?? null;
}

export function parseStoryDraftResponse(value: string): unknown {
  const response = typeof value === 'string' ? value.trim() : '';
  if (!response) throw new Error('模型没有返回有效的故事 JSON。');
  const stripped = normalizeCommonJsonMistakes(stripJsonFence(response));
  try {
    const direct = JSON.parse(stripped) as unknown;
    if (isStoryCandidate(direct)) return direct;
  } catch {
    // The response may contain reasoning text around one or more JSON objects.
  }
  try {
    const relaxed = JSON5.parse(stripped) as unknown;
    if (isStoryCandidate(relaxed)) return relaxed;
  } catch {
    // JSON5 fallback handles single quotes, comments, and trailing commas.
  }
  const fencedBlocks = Array.from(response.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu))
    .map((match) => normalizeCommonJsonMistakes(match[1] ?? ''));
  for (const block of fencedBlocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      if (isStoryCandidate(parsed)) return parsed;
    } catch {
      try {
        const relaxed = JSON5.parse(block) as unknown;
        if (isStoryCandidate(relaxed)) return relaxed;
      } catch {
        // Continue with balanced-object extraction below.
      }
      const selectedBlock = chooseStoryCandidate(parseBalancedObjects(block));
      if (selectedBlock) return selectedBlock;
    }
  }
  const selected = chooseStoryCandidate(parseBalancedObjects(normalizeCommonJsonMistakes(response)));
  if (selected) return selected;
  throw new Error('模型没有返回有效的故事 JSON。');
}
