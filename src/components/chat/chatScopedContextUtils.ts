import type { ChatMessage, DesktopPetChatMode, PetPersonality } from '../../types';
import { isChatMessageInMode, resolveChatMessagePetId } from './chatMessageScopeUtils';

export function buildScopedChatHistory(
  messages: ChatMessage[],
  chatMode: DesktopPetChatMode,
  targetPetId: string,
) {
  const latestStoryId = chatMode === 'story'
    ? [...messages].reverse().find((message) => message.chatMode === 'story' && message.storyId)?.storyId
    : null;
  return messages.flatMap<ChatMessage>((message) => {
    if (!isChatMessageInMode(message, chatMode)) {
      return [];
    }

    if (chatMode === 'single' && resolveChatMessagePetId(message) !== targetPetId) {
      return [];
    }

    if (chatMode === 'story' && latestStoryId && message.storyId !== latestStoryId) {
      return [];
    }

    if (message.role === 'user') {
      return [message];
    }

    if (chatMode === 'group' || chatMode === 'story') {
      const speakerName = message.petName?.trim() || '其他桌宠';
      return [{
        ...message,
        text: `${speakerName}：${message.text}`,
      }];
    }

    return [message];
  });
}

export function buildChatScopedPersonality(
  personality: PetPersonality,
  chatMode: DesktopPetChatMode,
  participantNames: string[],
) {
  if (chatMode === 'single') {
    return personality;
  }

  if (chatMode === 'story') {
    const storyInstruction = [
      `当前是互动故事，参与角色有：${participantNames.join('、')}。`,
      `你只代表“${personality.name}”说话，不得代替用户或其他角色作出行动、选择或发言。`,
      '保持原有人格、关系定位、语气和口头习惯；故事设定只提供场景约束，不能覆盖人格。',
      '角色通道只输出该角色自然对白；场景、动作、氛围和转场由独立旁白通道负责。每轮都要给用户留下回应或选择空间。',
    ].join('\n');
    return {
      ...personality,
      systemInstruction: [personality.systemInstruction.trim(), storyInstruction]
        .filter(Boolean).join('\n\n'),
    };
  }

  const groupInstruction = [
    `当前是桌宠群聊场景，参与角色有：${participantNames.join('、')}。`,
    `你现在只代表“${personality.name}”自己说话。`,
    '请把聊天历史当成真实群聊现场：如果前面已经有其他桌宠发言，可以自然接对方的话，也可以顺着用户的话题继续聊。',
    '允许点名回应其他桌宠，语气要像群里实时互相接话，不要写成统一答复或客服总结。',
    '不要代替其他桌宠发言，不要一次性总结所有角色，也不要把多个角色的对话合并成一段。',
    '每次回复保持自然、简短、像正在群里互相聊天一样。',
    '\u5373\u4f7f\u5728\u7fa4\u804a\u91cc\uff0c\u4e5f\u8981\u4fdd\u6301\u4f60\u81ea\u5df1\u7684\u4eba\u683c\u63d0\u793a\u8bcd\u91cc\u7684\u8bed\u6c14\u3001\u6001\u5ea6\u3001\u5173\u7cfb\u5b9a\u4f4d\u548c\u53e3\u5934\u4e60\u60ef\uff0c\u4e0d\u8981\u53d8\u6210\u7edf\u4e00\u53e3\u543b\u3002',
  ].join('\n');

  return {
    ...personality,
    systemInstruction: [personality.systemInstruction.trim(), groupInstruction]
      .filter(Boolean)
      .join('\n\n'),
  };
}
