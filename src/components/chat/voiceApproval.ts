import { desktopPetChatStore } from '../../chatStore';
import { isPetAudible } from './voiceConversationBusy';
import { type ChatAgentApprovalDecision, type PetConfig } from '../../types';
import { latestPendingAgentLoopApprovalId, resolveAgentLoopApproval } from './runController/agentLoopApprovalRegistry';
import { AGENT_APPROVAL_APPROVE_TASK_TEXTS } from './runController/approvalDecisionText';

// Answering an approval card by voice ("同意" / "拒绝"), so hands-free use does not need a
// click for every step. Only clear, whole-utterance words count — never a bare "嗯", and
// never a longer sentence that merely contains one — because the microphone also hears TV,
// other people and the user talking to themselves. The Windows UAC prompt itself cannot be
// answered this way: Windows shows it on a secure desktop on purpose.

// Everyday answers count too ("好的", "行"), since the character now asks out loud and the
// microphone only listens for this while a question waits.
const APPROVE_WORDS = new Set(['同意', '我同意', '允许', '可以', '确认', '批准', '执行', '没问题', '同意了', '可以了', '好', '行', '准了', '准许', '去', '做', '开始']);
const DENY_WORDS = new Set(['拒绝', '不同意', '我不同意', '不允许', '不可以', '不行', '不要', '取消', '算了', '别', '不', '不用', '不用了', '先别', '别了', '不好']);
const APPROVE_TASK_WORDS = AGENT_APPROVAL_APPROVE_TASK_TEXTS;
const FILLER = /[\s，。,.!！?？~～、…吧啊呀呢哦嘛的]/gu;

export function classifyVoiceApproval(text: string): ChatAgentApprovalDecision | null {
  const words = text.replace(FILLER, '');
  if (APPROVE_TASK_WORDS.has(words)) return 'approve-task';
  if (!words || words.length > 5) return null;
  if (DENY_WORDS.has(words)) return 'deny';
  if (APPROVE_WORDS.has(words)) return 'approve';
  return null;
}

/** Answers the waiting approval card when the utterance is a clear yes/no; returns the decision. */
export function resolvePendingApprovalByVoice(text: string): ChatAgentApprovalDecision | null {
  const messageId = latestPendingAgentLoopApprovalId();
  if (!messageId) return null;
  const decision = classifyVoiceApproval(text);
  if (!decision) return null;
  return resolveAgentLoopApproval(messageId, decision) ? decision : null;
}

// Longer than this is someone talking about something else, not answering the question.
const MAX_UNDERSTOOD_ANSWER_CHARS = 40;

function findPendingQuestion(approvalId: string) {
  const messages = desktopPetChatStore.getState().messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const pending = messages[index]?.agentLoopRun?.pendingApproval;
    if (pending?.id === approvalId) return pending.title;
  }
  return '';
}

export type ApprovalAnswerJudge = (question: string, answer: string) => Promise<ChatAgentApprovalDecision | null>;

/** Asks the configured model whether a free-form reply ("去吧去吧没事", "嗯嗯你弄吧") agrees. */
export const judgeApprovalAnswerWithModel = (settings: PetConfig['settings']): ApprovalAnswerJudge => async (question, answer) => {
  const { getConfiguredCognitionResponse } = await import('../../services/geminiService');
  const output = await getConfiguredCognitionResponse(
    `角色刚问用户：${question || '能不能做这一步'}\n用户的回答（语音识别，可能有错字）：${answer}`,
    [
      '你在判断用户对一个确认问题的回答是什么意思。',
      '同意、允许、让对方去做 → approve；拒绝、不让做、叫停、等等再说 → deny；',
      '回答和这个问题无关、听不出是同意还是拒绝 → unrelated。拿不准时选 unrelated，不要猜同意。',
      '只输出一个词：approve、deny 或 unrelated。',
    ].join('\n'),
    settings,
    { maxTokensOverride: 16, task: 'understanding', timeoutMs: 8000 },
  );
  const word = String(output ?? '').toLowerCase();
  if (/\bdeny\b/u.test(word)) return 'deny';
  if (/\bapprove\b/u.test(word)) return 'approve';
  return null;
};

/**
 * Fixed words first (instant), then the model understands what the user meant. Returns the
 * decision when the waiting card was answered, or null when the speech was not an answer.
 */
export async function resolvePendingApprovalBySpeech(
  text: string,
  judge: ApprovalAnswerJudge,
  isAudible: () => boolean = isPetAudible,
): Promise<ChatAgentApprovalDecision | null> {
  // Whatever arrives while she is talking is most likely her own voice: never act on it, and
  // never stop her playback from here (answers and playback are kept apart).
  if (isAudible()) return null;
  const quick = resolvePendingApprovalByVoice(text);
  if (quick) return quick;
  const approvalId = latestPendingAgentLoopApprovalId();
  const answer = text.trim();
  if (!approvalId || !answer || answer.length > MAX_UNDERSTOOD_ANSWER_CHARS) return null;
  let decision: ChatAgentApprovalDecision | null = null;
  try {
    decision = await judge(findPendingQuestion(approvalId), answer);
  } catch {
    return null;
  }
  // The card may have been answered another way while the model was thinking.
  if (!decision || latestPendingAgentLoopApprovalId() !== approvalId) return null;
  return resolveAgentLoopApproval(approvalId, decision) ? decision : null;
}
