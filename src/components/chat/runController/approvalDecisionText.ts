import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode } from '../../../types';

export const AGENT_APPROVAL_DECISION_PUNCTUATION_PATTERN = /[\s,，.。!！?？、;；:："“”'‘’()[\]{}<>《》【】\-—_~～]+/gu;

export const AGENT_APPROVAL_APPROVE_TEXTS = new Set([
  'y',
  'yes',
  'ok',
  'okay',
  'approve',
  'approved',
  'confirm',
  'confirmed',
  'goahead',
  '可以',
  '可以了',
  '可以执行',
  '允许',
  '准了',
  '批准',
  '同意',
  '确认',
  '确认执行',
  '好',
  '好的',
  '好吧',
  '行',
  '行的',
  '没问题',
  '继续',
  '继续吧',
  '继续执行',
  '开始',
  '开始吧',
  '执行',
  '执行吧',
  '执行计划',
  '运行',
  '运行吧',
  '做吧',
  '去做吧',
  '处理吧',
  '整理吧',
  '打开吧',
  '关掉吧',
  '关闭吧',
  '移动吧',
  '保存吧',
]);

export const AGENT_APPROVAL_DENY_TEXTS = new Set([
  'n',
  'no',
  'deny',
  'cancel',
  'stop',
  '不',
  '不要',
  '不用',
  '不用了',
  '不行',
  '不可以',
  '别',
  '别动',
  '先别',
  '先别动',
  '先不要',
  '先不用',
  '取消',
  '拒绝',
  '停止',
  '停下',
  '停',
  '算了',
  '不要执行',
  '别执行',
  '先别执行',
]);

export const AGENT_APPROVAL_APPROVE_PATTERN = /^(?:(?:就)?(?:按|照)?(?:这个|这样|刚才|刚刚|计划)?(?:做|执行|运行|开始|继续|处理|整理|打开|关闭|关掉|移动|保存|改)(?:吧|呀|啦|了)?|(?:就)?(?:按|照)(?:这个|这样|刚才的计划|刚刚的计划|计划)(?:做|执行|来|处理)(?:吧|呀|啦)?|(?:goahead|approved?|confirm(?:ed)?|yes|ok|okay))$/iu;

export const AGENT_APPROVAL_DENY_PATTERN = /^(?:不(?:要|用|行|可以)?|别|先别|取消|拒绝|停止|停下|停|算了|别动|不要执行|别执行|先不要|先不用|先别执行|no|cancel|deny|stop)(?:了|吧|啦)?$/iu;

export function normalizeAgentApprovalDecisionText(text: string) {
  return text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/^\/\s*(?:agent|助手|智能体|代理)\s*/iu, '')
    .replace(AGENT_APPROVAL_DECISION_PUNCTUATION_PATTERN, '');
}

export function resolveAgentApprovalDecisionFromText(text: string): ChatAgentApprovalDecision | null {
  const normalizedText = normalizeAgentApprovalDecisionText(text);
  if (!normalizedText || normalizedText.length > 18) {
    return null;
  }

  if (AGENT_APPROVAL_DENY_TEXTS.has(normalizedText) || AGENT_APPROVAL_DENY_PATTERN.test(normalizedText)) {
    return 'deny';
  }

  if (AGENT_APPROVAL_APPROVE_TEXTS.has(normalizedText) || AGENT_APPROVAL_APPROVE_PATTERN.test(normalizedText)) {
    return 'approve';
  }

  return null;
}

export function findLatestPendingAgentApprovalMessage(
  messages: ChatMessage[],
  options: {
    activePetId?: string | null;
    chatMode?: DesktopPetChatMode | null;
  } = {},
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message?.id || message.agentApproval?.status !== 'pending') {
      continue;
    }

    if (options.chatMode && message.chatMode && message.chatMode !== options.chatMode) {
      continue;
    }

    if (options.chatMode === 'single' && message.petId === null) {
      continue;
    }

    if (options.activePetId && message.petId && message.petId !== options.activePetId) {
      continue;
    }

    return message;
  }

  return null;
}
