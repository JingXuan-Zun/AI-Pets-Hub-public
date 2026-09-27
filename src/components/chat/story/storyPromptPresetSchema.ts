import type {
  StoryPromptOrderEntry,
  StoryPromptOrderList,
  StoryPromptPreset,
  StoryPromptPresetItem,
  StoryPromptRole,
} from './storyPromptPresetTypes';

const GLOBAL_PROMPT_ORDER_ID = 100001;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRole(value: unknown): StoryPromptRole {
  return value === 'assistant' || value === 'user' ? value : 'system';
}

function normalizeOptionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeTriggers(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const triggers = value.map(normalizeText).filter(Boolean);
  return triggers.length > 0 ? [...new Set(triggers)] : undefined;
}

function normalizePrompt(value: unknown, index: number): StoryPromptPresetItem | null {
  if (!isRecord(value)) return null;
  const identifier = normalizeText(value.identifier) || `story-prompt-${index + 1}`;
  const content = normalizeText(value.content);
  const marker = value.marker === true;
  if (!content && !marker) return null;
  return {
    content,
    forbid_overrides: value.forbid_overrides === true,
    identifier,
    injection_depth: normalizeOptionalNumber(value.injection_depth),
    injection_order: normalizeOptionalNumber(value.injection_order),
    injection_position: normalizeOptionalNumber(value.injection_position),
    injection_trigger: normalizeTriggers(value.injection_trigger),
    marker,
    name: normalizeText(value.name) || identifier,
    role: normalizeRole(value.role),
    system_prompt: value.system_prompt === true,
  };
}

function normalizeOrderEntry(value: unknown): StoryPromptOrderEntry | null {
  if (!isRecord(value)) return null;
  const identifier = normalizeText(value.identifier);
  return identifier ? { enabled: value.enabled !== false, identifier } : null;
}

function normalizeOrder(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeOrderEntry)
    .filter((entry): entry is StoryPromptOrderEntry => entry !== null);
}

function normalizeOrderList(value: unknown): StoryPromptOrderList | null {
  if (!isRecord(value)) return null;
  const order = normalizeOrder(value.order);
  if (order.length === 0) return null;
  const characterId = typeof value.character_id === 'string' || Number.isFinite(value.character_id)
    ? value.character_id as string | number : GLOBAL_PROMPT_ORDER_ID;
  return { character_id: characterId, order };
}

function extractPresetPayload(value: unknown) {
  if (!isRecord(value)) throw new Error('JSON 顶层必须是对象。');
  const data = isRecord(value.data) ? value.data : value;
  if (!Array.isArray(data.prompts)) throw new Error('缺少 SillyTavern prompts 数组。');
  return { promptOrder: data.prompt_order, prompts: data.prompts };
}

function normalizeOrderLists(value: unknown, prompts: StoryPromptPresetItem[]) {
  if (!Array.isArray(value)) return createDefaultOrder(prompts);
  const isFlatOrder = value.every((entry) => isRecord(entry) && 'identifier' in entry);
  if (isFlatOrder) {
    const order = normalizeOrder(value);
    return order.length > 0 ? [{ character_id: GLOBAL_PROMPT_ORDER_ID, order }] : createDefaultOrder(prompts);
  }
  const lists = value.map(normalizeOrderList)
    .filter((list): list is StoryPromptOrderList => list !== null);
  return lists.length > 0 ? lists : createDefaultOrder(prompts);
}

function createDefaultOrder(prompts: StoryPromptPresetItem[]): StoryPromptOrderList[] {
  return [{
    character_id: GLOBAL_PROMPT_ORDER_ID,
    order: prompts.map((prompt) => ({ enabled: true, identifier: prompt.identifier })),
  }];
}

function deduplicatePrompts(prompts: StoryPromptPresetItem[]) {
  const byIdentifier = new Map<string, StoryPromptPresetItem>();
  prompts.forEach((prompt) => byIdentifier.set(prompt.identifier, prompt));
  return [...byIdentifier.values()];
}

export function parseStoryPromptPreset(value: unknown): StoryPromptPreset {
  const payload = extractPresetPayload(value);
  const prompts = deduplicatePrompts(payload.prompts.map(normalizePrompt)
    .filter((prompt): prompt is StoryPromptPresetItem => prompt !== null));
  if (prompts.length === 0) throw new Error('预设中没有可用的提示词模块。');
  return {
    prompt_order: normalizeOrderLists(payload.promptOrder, prompts),
    prompts,
    version: 1,
  };
}

export function normalizeStoredStoryPromptPreset(value: unknown) {
  try {
    return value ? parseStoryPromptPreset(value) : null;
  } catch {
    return null;
  }
}

export function createStoryPromptPresetTemplate(): StoryPromptPreset {
  const prompts: StoryPromptPresetItem[] = [{
    content: '在这里填写题材、文风、节奏、表达方式或其他故事要求。',
    identifier: 'user-custom-prompt',
    injection_trigger: ['draft', 'director', 'narrator'],
    name: '自定义提示词（破甲词）',
    role: 'system',
  }];
  return { prompt_order: createDefaultOrder(prompts), prompts, version: 1 };
}

export function getStoryPromptOrderList(preset: StoryPromptPreset) {
  return preset.prompt_order.find((list) => String(list.character_id) === String(GLOBAL_PROMPT_ORDER_ID))
    ?? preset.prompt_order[0];
}
