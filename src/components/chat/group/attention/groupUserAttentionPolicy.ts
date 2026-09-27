import type { GroupUserAttention } from '../../../../chatState';
import type { ChatMessage } from '../../../../types';
import type { GroupConversationProgress } from '../topic/groupConversationProgressPolicy';

export function createProgressUserAttention(
  message: ChatMessage | undefined,
  progress: GroupConversationProgress,
): GroupUserAttention | null {
  if (!message?.petId || !message.text.trim() || progress.action !== 'ask-user') return null;
  return {
    createdAt: Date.now(),
    promptText: '这个话题已经连续几轮没有明显推进了。你想让角色继续、换个方向，还是直接插话？',
    roleId: message.petId,
    roleName: message.petName?.trim() || '当前角色',
    sourceMessageKey: `progress:${message.id ?? message.createdAt ?? Date.now()}`,
  };
}

export function createDirectorUserAttention(
  message: ChatMessage | undefined,
  reason: string,
): GroupUserAttention | null {
  if (!message?.petId || !message.text.trim()) return null;
  return {
    createdAt: Date.now(),
    promptText: reason === 'waiting-information'
      ? '群聊需要你的补充信息后才能继续。'
      : '当前话题需要你决定下一步，是否继续让角色讨论或直接插话？',
    roleId: message.petId,
    roleName: message.petName?.trim() || '当前角色',
    sourceMessageKey: `director:${message.id ?? message.createdAt ?? Date.now()}`,
  };
}

export function createBatchFailureUserAttention(message: ChatMessage | undefined) {
  if (!message) return null;
  return {
    createdAt: Date.now(),
    promptText: '这一轮有较多角色没有成功回应。你可以稍后继续，或直接发送新消息重新开始。',
    roleId: message.petId ?? 'group',
    roleName: '群聊',
    sourceMessageKey: `batch-failure:${message.id ?? message.createdAt ?? Date.now()}`,
  } satisfies GroupUserAttention;
}
