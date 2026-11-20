import { GROWTH_KIND_LABELS } from '../character-growth/growthRules';
import { classifyVoiceApproval } from '../components/chat/voiceApproval';
import { NEURAL_MEMORY_PROPOSAL_TYPE_LABELS, type NeuralMemoryProposal } from './neuralMemoryProposalTypes';

// In a hands-free voice conversation (2026-11-20, user): when she wants to remember something,
// she asks out loud — saying briefly what it is — and the user's spoken answer counts like the
// 记住 / 不用记 buttons. One question at a time; anything else the user says goes on as normal
// chat and the proposal simply stays in the sidebar. Typed chat is unchanged (sidebar only).

/** How long after her question an answer still counts. */
export const MEMORY_ASK_ANSWER_WINDOW_MS = 3 * 60_000;
const MEMORY_APPROVE = new Set(['记住', '记吧', '记下来', '记下吧', '记着', '记上', '你记', '帮我记', '要记', '记']);
const MEMORY_DENY = new Set(['别记', '不用记', '不记', '不要记', '别记了', '忘了吧', '不用记了']);
const FILLER = /[\s，。,.!！?？~～、…吧啊呀呢哦嘛的了]/gu;

export type MemoryAnswer = 'approve' | 'deny';

/** A clear yes / no to her question, or null (then it is ordinary chat). */
export function classifyMemoryAnswer(text: string): MemoryAnswer | null {
  const words = text.replace(FILLER, '');
  if (MEMORY_DENY.has(words)) return 'deny';
  if (MEMORY_APPROVE.has(words)) return 'approve';
  const general = classifyVoiceApproval(text);
  if (general === 'deny') return 'deny';
  return general ? 'approve' : null;
}

export function describeProposalKind(proposal: NeuralMemoryProposal) {
  if (proposal.scope === 'shared') return '关于你的事（所有角色都会知道）';
  return proposal.growth ? `自己的变化（${GROWTH_KIND_LABELS[proposal.growth.kind]}）` : NEURAL_MEMORY_PROPOSAL_TYPE_LABELS[proposal.type];
}

/** Her spoken question: briefly what it is, then whether she may keep it. */
export function buildMemoryAskInstruction(proposal: NeuralMemoryProposal) {
  const what = proposal.growth
    ? `你回顾最近的经历，觉得自己有了一个变化：「${proposal.content}」${proposal.reason ? `（因为：${proposal.reason}）` : ''}。`
    : `你想把这件事记下来：「${proposal.content}」（${describeProposalKind(proposal)}）。`;
  return [
    '（这不是用户发来的消息。现在是语音聊天，你要开口问用户一件事。）',
    what,
    '用你自己的口吻说一两句话：先简单说一下想记住的是什么（用你自己的话概括，不要照念原文），再问用户可不可以记下来。',
    '要短，像随口一问；不要长篇解释，不要提“记忆提议”“侧栏”“按钮”这类软件用语。',
  ].join('\n');
}

export interface PendingMemoryAsk {
  askedAt: number;
  proposalId: string;
  question: string;
  roleId: string;
}

let pending: PendingMemoryAsk | null = null;
let answerer: ((text: string) => Promise<boolean>) | null = null;

export const readPendingMemoryAsk = (now = Date.now()) => (pending && now - pending.askedAt < MEMORY_ASK_ANSWER_WINDOW_MS ? pending : null);
export const setPendingMemoryAsk = (next: PendingMemoryAsk | null) => { pending = next; };

/** The pet window registers how a heard answer is applied (it holds the config). */
export function registerMemoryAskAnswerer(next: ((text: string) => Promise<boolean>) | null) {
  answerer = next;
  return () => { if (answerer === next) answerer = null; };
}

/** Voice conversation: true when what was heard answered her memory question (not sent as chat). */
export async function answerMemoryAskBySpeech(text: string) {
  if (!readPendingMemoryAsk() || !answerer) return false;
  return answerer(text);
}
