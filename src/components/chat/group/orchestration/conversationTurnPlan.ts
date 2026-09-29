import type { GroupTopicStatus } from '../topic/topicLifecycle';

export type ConversationTurnIntent =
  | 'answer-user'
  | 'respond-to-character'
  | 'react-to-user-exchange'
  | 'bridge-participants'
  | 'advance-topic'
  | 'resolve-disagreement'
  | 'request-information'
  | 'summarize-topic'
  | 'close-topic';

export type ConversationInterruptionPolicy = 'user-priority';

export interface ConversationTurnPlan {
  addressedCharacterIds: string[];
  attentionReasons: string[];
  attentionScore: number | null;
  intent: ConversationTurnIntent;
  interruptionPolicy: ConversationInterruptionPolicy;
  speakerId: string;
  turnBudget: number;
  usedAttentionFallback: boolean;
}

type TurnInteraction = {
  followsUserAddressedExchange?: boolean;
  groupInteractionKind: 'direct' | 'bridge' | 'group';
  pullInPetId: string | null;
  replyToPetIds: string[];
  userAddressedPetId?: string | null;
  userAddressedPetIds?: string[];
  userTopicPriority?: boolean;
};

function resolveTurnIntent(
  speakerId: string,
  interaction: TurnInteraction,
  topicStatus?: GroupTopicStatus | null,
): ConversationTurnIntent {
  const userAddressedIds = interaction.userAddressedPetIds
    ?? (interaction.userAddressedPetId ? [interaction.userAddressedPetId] : []);
  if (userAddressedIds.includes(speakerId)) return 'answer-user';
  if (interaction.userTopicPriority) return 'answer-user';
  if (interaction.followsUserAddressedExchange) return 'react-to-user-exchange';
  if (topicStatus === 'disputed') return 'resolve-disagreement';
  if (topicStatus === 'waiting-information') return 'request-information';
  if (topicStatus === 'resolving' || topicStatus === 'concluded') return 'summarize-topic';
  if (topicStatus === 'decaying' || topicStatus === 'closed' || topicStatus === 'archived') {
    return 'close-topic';
  }
  if (interaction.groupInteractionKind === 'bridge' || interaction.pullInPetId) {
    return 'bridge-participants';
  }
  return interaction.replyToPetIds.length > 0
    ? 'respond-to-character'
    : 'advance-topic';
}

export function createConversationTurnPlan(options: {
  attentionReasons?: string[];
  attentionScore?: number | null;
  interaction: TurnInteraction;
  intent?: ConversationTurnIntent;
  speakerId: string;
  topicStatus?: GroupTopicStatus | null;
  usedAttentionFallback?: boolean;
}): ConversationTurnPlan {
  const addressedIds = [
    ...options.interaction.replyToPetIds,
    ...(options.interaction.pullInPetId ? [options.interaction.pullInPetId] : []),
  ];
  return {
    addressedCharacterIds: [...new Set(addressedIds)],
    attentionReasons: options.attentionReasons ?? [],
    attentionScore: options.attentionScore ?? null,
    intent: options.intent ?? resolveTurnIntent(
      options.speakerId,
      options.interaction,
      options.topicStatus,
    ),
    interruptionPolicy: 'user-priority',
    speakerId: options.speakerId,
    turnBudget: 1,
    usedAttentionFallback: options.usedAttentionFallback ?? false,
  };
}

const INTENT_PROMPTS: Record<ConversationTurnIntent, string> = {
  'answer-user': '直接回答用户刚刚交给你的问题或对话意图。',
  'respond-to-character': '回应当前被指定的角色，不要改成面向用户的总结。',
  'react-to-user-exchange': '围绕用户与被点名角色刚发生的新对话给出简短反应。',
  'bridge-participants': '回应主要对象，并自然给另一位角色留下接话口。',
  'advance-topic': '面向当前群体推进话题，提供一个新的有效反应点。',
  'resolve-disagreement': '明确当前分歧点，回应关键差异并推动形成可检验的下一步。',
  'request-information': '指出目前缺少的关键信息，不要在证据不足时强行下结论。',
  'summarize-topic': '给出简短的阶段结论，区分已确认内容与仍未解决的问题。',
  'close-topic': '用一句自然收束当前话题，不要再次展开新的讨论分支。',
};

export function buildConversationTurnPromptLines(plan?: ConversationTurnPlan) {
  if (!plan) return [];
  return [
    `本轮目标：${INTENT_PROMPTS[plan.intent]}`,
    `本轮最多输出 ${plan.turnBudget} 次角色发言，不要代替其他角色继续说话。`,
    '如果出现新的用户输入，立即以用户输入为最高优先级，停止扩展当前轮次。',
  ];
}
