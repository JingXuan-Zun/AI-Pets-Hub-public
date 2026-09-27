import { type PetAction } from '../../types';
import { stripGroupRoleSignalMarkers } from './group/role/groupRoleSignalProtocol';

export type CharacterToolAction = Extract<PetAction, 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING'>;

export type CharacterToolInvocation =
  | {
      kind: 'action';
      action: CharacterToolAction;
      raw: string;
    }
  | {
      kind: 'animation';
      animationId: string;
      raw: string;
    }
  | {
      kind: 'web-search';
      query: string;
      raw: string;
    };

const TOOL_MARKER_REGEX = /(?:【|\[)\s*(Live2D表情|live2d表情|动作动画|3D动画|3d动画|动画|动作|表情|情绪|状态|联网查询|查询|搜索|animation|expression|action|web-search|search)\s*(?:[:：]\s*)?([^】\]\r\n]{1,80})(?:】|\])/giu;
const ACTION_TOOL_NAMES = new Set(['动作', '情绪', '状态', 'action']);
const ANIMATION_TOOL_NAMES = new Set(['动画', '动作动画', '3D动画', '3d动画', '表情', 'Live2D表情', 'live2d表情', 'animation', 'expression']);
const ACTION_VALUE_SEPARATOR_REGEX = /(?:、|,|，|\/|\||;|；|\s+|然后|接着|之后|再|->|→)+/u;

const EXPRESSION_TOOL_MARKER_REGEX = /(?:【|\[)\s*(?:live2d\s*)?expression\s*(?:[:：]\s*)?([^】\]\r\n]{1,80})(?:】|\])/giu;

const ACTION_ALIAS_MAP: Record<string, CharacterToolAction> = {
  吃: 'EATING',
  吃东西: 'EATING',
  进食: 'EATING',
  干饭: 'EATING',
  咀嚼: 'EATING',
  啃: 'EATING',
  嚼: 'EATING',
  eating: 'EATING',
  eat: 'EATING',
  chew: 'EATING',
  chewing: 'EATING',

  开心: 'HAPPY',
  高兴: 'HAPPY',
  快乐: 'HAPPY',
  笑: 'HAPPY',
  微笑: 'HAPPY',
  大笑: 'HAPPY',
  兴奋: 'HAPPY',
  激动: 'HAPPY',
  惊喜: 'HAPPY',
  害羞: 'HAPPY',
  脸红: 'HAPPY',
  得意: 'HAPPY',
  期待: 'HAPPY',
  打招呼: 'HAPPY',
  挥手: 'HAPPY',
  happy: 'HAPPY',
  joy: 'HAPPY',
  smile: 'HAPPY',
  shy: 'HAPPY',
  blush: 'HAPPY',
  excited: 'HAPPY',
  surprise: 'HAPPY',
  greeting: 'HAPPY',
  wave: 'HAPPY',

  难过: 'SAD',
  伤心: 'SAD',
  失落: 'SAD',
  委屈: 'SAD',
  沮丧: 'SAD',
  哭: 'SAD',
  生气: 'SAD',
  害怕: 'SAD',
  紧张: 'SAD',
  不安: 'SAD',
  尴尬: 'SAD',
  sad: 'SAD',
  cry: 'SAD',
  angry: 'SAD',
  scared: 'SAD',
  nervous: 'SAD',

  睡: 'SLEEPING',
  睡觉: 'SLEEPING',
  困: 'SLEEPING',
  困倦: 'SLEEPING',
  犯困: 'SLEEPING',
  休息: 'SLEEPING',
  放松: 'SLEEPING',
  闭眼: 'SLEEPING',
  眨眼: 'SLEEPING',
  sleep: 'SLEEPING',
  sleeping: 'SLEEPING',
  sleepy: 'SLEEPING',
  blink: 'SLEEPING',
  relaxed: 'SLEEPING',
};

function normalizeToolName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeToolValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '')
    .replace(/[。！!？?，,、；;：:）)\]】]+$/gu, '');
}

export function resolveCharacterToolAction(value: string): CharacterToolAction | null {
  const normalizedValue = normalizeToolValue(value);
  return ACTION_ALIAS_MAP[normalizedValue] ?? null;
}

export function resolveCharacterToolActions(value: string): CharacterToolAction[] {
  const directAction = resolveCharacterToolAction(value);
  if (directAction) {
    return [directAction];
  }

  return Array.from(new Set(
    value
      .split(ACTION_VALUE_SEPARATOR_REGEX)
      .map(resolveCharacterToolAction)
      .filter((action): action is CharacterToolAction => Boolean(action)),
  ));
}

export function extractCharacterToolInvocations(text: string): CharacterToolInvocation[] {
  const invocations: CharacterToolInvocation[] = [];

  for (const match of text.matchAll(TOOL_MARKER_REGEX)) {
    const toolName = normalizeToolName(match[1] ?? '');
    const rawValue = match[2]?.trim() ?? '';
    const raw = match[0] ?? '';
    if (!rawValue) {
      continue;
    }

    if (ACTION_TOOL_NAMES.has(toolName)) {
      const actions = resolveCharacterToolActions(rawValue);
      actions.forEach((action) => {
        invocations.push({ kind: 'action', action, raw });
      });
      continue;
    }

    if (ANIMATION_TOOL_NAMES.has(toolName)) {
      invocations.push({
        kind: 'animation',
        animationId: rawValue,
        raw,
      });
      continue;
    }

    invocations.push({
      kind: 'web-search',
      query: rawValue,
      raw,
    });
  }

  for (const match of text.matchAll(EXPRESSION_TOOL_MARKER_REGEX)) {
    const rawValue = match[1]?.trim() ?? '';
    const raw = match[0] ?? '';
    if (!rawValue) {
      continue;
    }

    invocations.push({
      kind: 'animation',
      animationId: rawValue,
      raw,
    });
  }

  return invocations;
}

export function stripCharacterToolMarkers(text: string) {
  return text
    .replace(TOOL_MARKER_REGEX, '')
    .replace(EXPRESSION_TOOL_MARKER_REGEX, '')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

export function shouldEnforcePersonaExtraInfo(systemInstruction: string) {
  return /附加信息|额外信息|方括号|【[^】]*】/u.test(systemInstruction);
}

export function ensurePersonaExtraInfo(text: string, systemInstruction: string) {
  const trimmedText = text.trim();
  void systemInstruction;
  return trimmedText;
}

export function buildVisibleCharacterReplyText(text: string, systemInstruction: string) {
  const withoutRoleSignals = stripGroupRoleSignalMarkers(text);
  const visibleText = stripCharacterToolMarkers(withoutRoleSignals) || withoutRoleSignals;
  return ensurePersonaExtraInfo(visibleText, systemInstruction);
}
