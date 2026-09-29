import type { GroupChatInteractionPlan } from '../../chatGroupInteractionPlanner';

function formatNames(names: string[]) {
  return names.filter(Boolean).join('、');
}

function buildUserInteractionLines(plan: GroupChatInteractionPlan) {
  if (plan.userTopicPriority) return [
    '本轮优先回应用户刚刚提出的话题，不要回到用户发言之前的旧话题。',
    '请从你自己的角度补充用户话题；如果没有新观点，可以简短回应后保持安静。',
  ];
  if (plan.userAddressedPetId) {
    const names = plan.userAddressedPetNames?.length
      ? formatNames(plan.userAddressedPetNames) : plan.userAddressedPetName || '当前角色';
    return [
      `用户这次明确点名了「${names}」，你是其中之一。`,
      '本轮只处理用户刚刚这句话：直接回答用户的问题或对话意图，不要继续旧的群聊话题队列。',
      '不要让其他角色代答，也不要为了接上一句群聊而偏离用户刚刚点名的问题。',
    ];
  }
  if (!plan.followsUserAddressedExchange) return null;
  const names = plan.userAddressedPetNames?.length
    ? formatNames(plan.userAddressedPetNames) : '被点名角色';
  return [
    `用户刚刚点名了「${names}」，他们已经先直接回应用户。`,
    '本轮不要拉回更早的旧群聊内容；请围绕“用户与被点名角色刚刚的新对话”自然展开。',
    '可以补充一个很短的新角度、追问、共鸣或把话题轻轻递给下一位角色，但不要抢答用户原问题。',
  ];
}

function buildDirectInteractionLines(plan: GroupChatInteractionPlan) {
  const targets = plan.replyToPetNames.length
    ? plan.replyToPetNames : [plan.replyToPetName || '上一位桌宠'];
  if (plan.groupInteractionKind === 'bridge' && targets.length > 1) return [
    `本轮主要回应「${targets[0]}」刚才说的话。`,
    `如果语气非常自然，可以顺手提到「${formatNames(targets.slice(1))}」，但不要改变当前主要接话对象。`,
    '不要写成逐条清单，也不要让动作、称呼或对话对象和上一句现场状态错位。',
  ];
  const target = targets[0] || '上一位桌宠';
  const lines = [
    `本轮不要默认回复用户，你主要回应「${target}」刚才说的话。`,
    `回复里可以自然点名「${target}」，像真实群聊里接对方的话，不要写成给用户的统一总结。`,
  ];
  if (plan.pullInPetId && plan.pullInPetId !== plan.replyToPetId) {
    lines.push(`如果语气合适，顺手把「${plan.pullInPetName}」拉进话题，问一个很短的问题或留一个接话口。`);
  }
  return lines;
}

export function buildGroupInteractionPromptLines(plan?: GroupChatInteractionPlan) {
  if (!plan) return [
    '本轮面向整个群聊说话，不要只回复用户或只盯着某一个角色。',
    '可以抛出一个很短的问题、对当前话题给出群体回应，或让两位以上桌宠都能继续接话。',
  ];
  const userLines = buildUserInteractionLines(plan);
  if (userLines) return userLines;
  if (plan.groupInteractionKind === 'group') return [
    '本轮面向整个群聊说话，不要只回复用户或只盯着某一个角色。',
    '可以抛出一个很短的问题、对当前话题给出群体回应，或让两位以上桌宠都能继续接话。',
  ];
  return buildDirectInteractionLines(plan);
}
