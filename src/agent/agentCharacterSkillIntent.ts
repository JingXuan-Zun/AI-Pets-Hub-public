import { type AgentChatCommand } from './agentChatCommand';

export interface AgentCharacterAnimationIntent {
  animationId: string;
  reason: string;
}

const CHARACTER_REFERENCE_PATTERN = /(?:\b(?:pet|avatar|character|role|companion)\b|\u89d2\u8272|\u5ba0\u7269|\u684c\u5ba0|\u865a\u62df\u5f62\u8c61|\u4f34\u4fa3|\u4ed6|\u5979|ta)/iu;
const ACTION_INTENT_PATTERN = /(?:\b(?:do|perform|play|show|trigger|act|pose|motion|animation|dance|wave|clap|jump|bow|nod|salute|spin|sit)\b|\u505a|\u8868\u6f14|\u6f14\u51fa|\u64ad\u653e|\u89e6\u53d1|\u52a8\u4f5c|\u52a8\u753b|\u59ff\u52bf|\u821e|\u8df3|\u6325\u624b|\u62db\u624b|\u9f13\u638c|\u62cd\u624b|\u8df3\u821e|\u97a0\u8eac|\u70b9\u5934|\u6447\u5934|\u656c\u793c|\u8f6c\u5708|\u5750\u4e0b|\u6bd4\u5fc3)/iu;
const COMMAND_TRIGGER_PATTERN = /(?:\b(?:do|perform|play|show|trigger|act|pose)\b|\u8ba9|\u5e2e\u6211|\u7ed9\u6211|\u6765\u4e2a|\u6765\u4e00\u4e2a|\u505a|\u8868\u6f14|\u6f14\u51fa|\u64ad\u653e|\u89e6\u53d1|\u52a8\u4f5c|\u52a8\u753b|\u59ff\u52bf)/iu;
const EXPLANATION_QUESTION_PATTERN = /(?:\b(?:what|why|how|explain|meaning|definition)\b|\u4ec0\u4e48|\u4e3a\u4ec0\u4e48|\u5982\u4f55|\u89e3\u91ca|\u610f\u601d)/iu;

const ANIMATION_ALIASES: Array<{ id: string; terms: string[] }> = [
  { id: 'wave', terms: ['wave', 'waving', 'hello', 'hi', '\u6325\u624b', '\u62db\u624b', '\u6253\u62db\u547c', '\u95ee\u597d'] },
  { id: 'dance', terms: ['dance', 'dancing', '\u8df3\u821e', '\u821e\u8e48', '\u5355\u66f2\u821e\u8e48'] },
  { id: 'clap', terms: ['clap', 'clapping', '\u62cd\u624b', '\u9f13\u638c'] },
  { id: 'jump', terms: ['jump', 'hop', 'bounce', '\u8df3', '\u8df3\u8dc3', '\u8e66'] },
  { id: 'bow', terms: ['bow', 'bowing', '\u97a0\u8eac', '\u5f2f\u8170'] },
  { id: 'nod', terms: ['nod', 'nodding', '\u70b9\u5934'] },
  { id: 'shake-head', terms: ['shake head', 'shake-head', 'shake_head', '\u6447\u5934'] },
  { id: 'salute', terms: ['salute', '\u656c\u793c'] },
  { id: 'spin', terms: ['spin', 'turn', 'twirl', '\u8f6c\u5708', '\u8f6c\u4e2a\u5708', '\u65cb\u8f6c'] },
  { id: 'sit', terms: ['sit', 'sitting', '\u5750\u4e0b', '\u5750'] },
  { id: 'heart', terms: ['heart', 'love', 'finger heart', 'finger-heart', '\u6bd4\u5fc3', '\u7231\u5fc3'] },
  { id: 'peace', terms: ['peace', 'v sign', 'v-sign', '\u6bd4\u8036', '\u526a\u5200\u624b'] },
  { id: 'scratch-head', terms: ['scratch head', 'scratch-head', '\u6320\u5934', '\u6293\u5934', '\u6478\u5934'] },
];

function normalizeIntentText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase();
}

function includesTerm(text: string, term: string) {
  const normalizedText = normalizeIntentText(text);
  const normalizedTerm = normalizeIntentText(term);
  if (/^[a-z0-9][a-z0-9 -]*$/iu.test(normalizedTerm)) {
    const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const boundaryPattern = new RegExp(`(?:^|[^a-z0-9])${escapedTerm}(?:$|[^a-z0-9])`, 'iu');
    return boundaryPattern.test(normalizedText);
  }

  return normalizedText.includes(normalizedTerm);
}

function resolveAnimationIdFromText(text: string) {
  return ANIMATION_ALIASES.find((group) => (
    group.terms.some((term) => includesTerm(text, term))
  ))?.id ?? null;
}

function isShortActionPhrase(text: string) {
  const compactText = text.replace(/\s+/gu, '');
  return compactText.length > 0 && compactText.length <= 16;
}

export function resolveAgentCharacterAnimationIntent(text: string): AgentCharacterAnimationIntent | null {
  const sourceText = text.trim();
  if (!sourceText || sourceText.startsWith('/')) {
    return null;
  }

  const animationId = resolveAnimationIdFromText(sourceText);
  if (!animationId) {
    return null;
  }

  const hasCharacterReference = CHARACTER_REFERENCE_PATTERN.test(sourceText);
  const hasCommandTrigger = COMMAND_TRIGGER_PATTERN.test(sourceText);
  const hasActionIntent = ACTION_INTENT_PATTERN.test(sourceText);
  if (!hasCharacterReference && EXPLANATION_QUESTION_PATTERN.test(sourceText)) {
    return null;
  }

  if (!hasCharacterReference && !hasCommandTrigger && !isShortActionPhrase(sourceText)) {
    return null;
  }

  if (!hasActionIntent && !hasCommandTrigger) {
    return null;
  }

  return {
    animationId,
    reason: `Matched character animation intent: ${animationId}.`,
  };
}

export function createAgentCharacterAnimationSkillCommand(
  sourceText: string,
  intent: AgentCharacterAnimationIntent,
): AgentChatCommand {
  return {
    capabilityId: 'skill-system',
    instruction: sourceText,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: sourceText,
      input: {
        dryRun: false,
        inputJson: JSON.stringify({ animationId: intent.animationId }),
        intent: sourceText,
        skillId: 'character.animation',
      },
      name: 'execute_agent_skill',
    },
  };
}

export function resolveAgentCharacterAnimationSkillCommand(text: string) {
  const intent = resolveAgentCharacterAnimationIntent(text);
  return intent
    ? createAgentCharacterAnimationSkillCommand(text.trim(), intent)
    : null;
}
