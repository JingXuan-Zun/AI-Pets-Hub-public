import type { ChatMessage, DesktopPetChatMode } from '../../types';
import { DEFAULT_CHAT_ACTIVE_PET_ID } from '../../chatState';

export const GROUP_CHAT_STOPPED_MESSAGE = '群聊已停止。';
export const GROUP_CHAT_CONTINUE_DELAY_MS = 1200;

export type PrivateChatResetScope = 'current-private' | 'all-private' | 'group' | 'story';

const GROUP_CHAT_STOP_COMMANDS = new Set([
  '停',
  '停止',
  '停止群聊',
  '别聊了',
  '先别聊了',
  '暂停群聊',
  'stop',
]);

const CHAT_RESET_COMMANDS = new Set([
  '/reset', '/reset current', '/reset all', '/reset group', '/reset story',
]);

export function shouldStopGroupChat(text: string) {
  const normalizedText = text.trim().toLowerCase();
  return GROUP_CHAT_STOP_COMMANDS.has(normalizedText);
}

export function shouldResetChat(text: string) {
  const normalizedText = text.trim().toLowerCase();
  return CHAT_RESET_COMMANDS.has(normalizedText);
}

export function resolveChatResetScope(
  text: string,
  chatMode: DesktopPetChatMode,
): PrivateChatResetScope | null {
  const normalizedText = text.trim().toLowerCase();
  if (normalizedText !== '/reset') return null;
  if (chatMode === 'group') return 'group';
  if (chatMode === 'story') return null;
  return 'current-private';
}

export function resolvePrivateChatResetScopeChoice(value: string | null | undefined): PrivateChatResetScope | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) return null;
  if (['1', 'current', '当前'].includes(normalizedValue)) return 'current-private';
  if (['2', 'all', '全部'].includes(normalizedValue)) return 'all-private';
  if (['3', 'group', '群聊'].includes(normalizedValue)) return 'group';
  if (['4', 'story', '故事', '故事模式'].includes(normalizedValue)) return 'story';
  return null;
}

export function requestPrivateChatResetScope(): PrivateChatResetScope | null {
  if (typeof window === 'undefined') return null;
  return resolvePrivateChatResetScopeChoice(window.prompt([
    '请选择要清除的聊天记录（每个范围独立）：',
    '1：仅清除当前私聊角色',
    '2：清除全部私聊角色',
    '3：仅清除群聊记录',
    '4：仅清除故事模式记录',
    '取消：不清除',
  ].join('\n'), '1'));
}

function resolvePrivateMessagePetId(message: ChatMessage) {
  return message.petId?.trim() || DEFAULT_CHAT_ACTIVE_PET_ID;
}

export function clearPrivateChatMessages(
  messages: readonly ChatMessage[],
  activePetId: string,
  scope: PrivateChatResetScope,
) {
  return messages.filter((message) => {
    if (scope === 'group') return message.chatMode !== 'group';
    if (scope === 'story') return message.chatMode !== 'story';
    if (message.chatMode !== 'single') return true;
    if (scope === 'all-private') return false;
    return resolvePrivateMessagePetId(message) !== activePetId;
  });
}

export function getPrivateChatResetCompletedMessage(scope: PrivateChatResetScope) {
  if (scope === 'all-private') return '已清除全部私聊角色的聊天记录。';
  if (scope === 'group') return '已清除群聊记录。';
  if (scope === 'story') return '已清除故事模式记录。';
  return '已清除当前角色的私聊记录。';
}

export function shouldCancelActiveRequestForChatModeSwitch(
  currentChatState: { isGroupChatRunning: boolean },
  nextMode: DesktopPetChatMode,
) {
  return nextMode !== 'group' && currentChatState.isGroupChatRunning;
}

export function waitForNextGroupChatTurn(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}
