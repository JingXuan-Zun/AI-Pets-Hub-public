import type { ChatMessage } from '../../../../types';
import { isChatMessageInMode } from '../../chatMessageScopeUtils';
import type { GroupContributionSignal } from '../role/groupContributionSignalProtocol';

export type GroupConversationProgressAction = 'continue' | 'ask-user' | 'close';

export type GroupConversationProgress = {
  action: GroupConversationProgressAction;
  latestNovelty: number;
  reason: string;
  stagnantTurnCount: number;
};

const PROGRESS_SIGNALS = new Set<GroupContributionSignal>([
  'new-fact', 'new-viewpoint', 'new-question', 'new-action', 'new-relationship', 'new-conclusion',
]);

const RECENT_MODEL_LIMIT = 6;
const ASK_USER_STAGNANT_TURNS = 3;
const CLOSE_STAGNANT_TURNS = 5;

function normalizeText(text: string) {
  return text
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .slice(0, 600);
}

function buildUnits(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (/^[a-z0-9]+$/i.test(normalized)) return normalized.split(/(?=\s)/u).filter(Boolean);
  return [...new Set(Array.from(normalized))];
}

function similarity(left: string, right: string) {
  const leftUnits = new Set(buildUnits(left));
  const rightUnits = new Set(buildUnits(right));
  if (!leftUnits.size || !rightUnits.size) return 0;
  const shared = [...leftUnits].filter((unit) => rightUnits.has(unit)).length;
  return shared / new Set([...leftUnits, ...rightUnits]).size;
}

function resolveStagnantTurnCount(replies: ChatMessage[]) {
  const latest = replies.at(-1)?.text ?? '';
  let count = 0;
  for (let index = replies.length - 2; index >= 0; index -= 1) {
    if (similarity(latest, replies[index].text) < 0.32) break;
    count += 1;
  }
  return count;
}

function hasStructuredProgress(message: ChatMessage) {
  return PROGRESS_SIGNALS.has(message.groupContributionSignal as GroupContributionSignal);
}

function resolveLatestNovelty(replies: ChatMessage[]) {
  const latest = replies.at(-1)?.text ?? '';
  const previous = replies.slice(0, -1).slice(-3);
  if (!latest || !previous.length) return 1;
  return Number((1 - Math.max(...previous.map((reply) => similarity(latest, reply.text)))).toFixed(2));
}

export function analyzeGroupConversationProgress(messages: ChatMessage[]): GroupConversationProgress {
  const replies = messages
    .filter((message) => isChatMessageInMode(message, 'group') && message.role === 'model')
    .slice(-RECENT_MODEL_LIMIT);
  const structuredProgress = replies.at(-1) ? hasStructuredProgress(replies.at(-1)!) : false;
  const stagnantTurnCount = structuredProgress ? 0 : replies.length < 2 ? 0 : resolveStagnantTurnCount(replies);
  const latestNovelty = resolveLatestNovelty(replies);
  const action = stagnantTurnCount >= CLOSE_STAGNANT_TURNS
    ? 'close'
    : stagnantTurnCount >= ASK_USER_STAGNANT_TURNS
      ? 'ask-user'
      : 'continue';
  const reason = action === 'continue'
    ? 'conversation-progressing'
    : action === 'ask-user'
      ? 'semantic-loop-needs-user-choice'
      : 'semantic-loop-reached-safety-limit';
  return { action, latestNovelty, reason, stagnantTurnCount };
}
