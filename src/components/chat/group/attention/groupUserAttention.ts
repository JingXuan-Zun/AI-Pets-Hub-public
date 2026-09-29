import type { GroupUserAttention } from '../../../../chatState';
import type { ChatMessage } from '../../../../types';
import { isChatMessageInMode } from '../../chatMessageScopeUtils';

const COMMON_USER_ADDRESSES = [
  '主人', '主公', '阁下', '指挥官', '博士', '旅行者', '用户',
];

const RESPONSE_SIGNAL = /[?？]|要不要|愿不愿意|你觉得|你想|请选择|请告诉|告诉我|回答|回应|决定|来吗|可以吗|好吗|如何|是否|哪一个|哪个|怎么办/u;
const DIRECT_FOLLOW_UPS = ['，', ',', '：', ':', '？', '?', '！', '!', '要不要', '愿不愿意', '你觉得', '你想', '请选择', '请告诉', '是否'];

export interface GroupUserAttentionDetectionOptions {
  handledMessageKey?: string | null;
  participantNames: string[];
  userDisplayName?: string;
}

function normalizeAddress(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function sourceMessageKey(message: ChatMessage) {
  return message.id
    ?? `${message.createdAt ?? 0}:${message.petId ?? 'primary'}:${message.text}`;
}

function resolveUserAddresses(options: GroupUserAttentionDetectionOptions) {
  const participantNames = new Set(options.participantNames.map(normalizeAddress));
  return [options.userDisplayName ?? '', ...COMMON_USER_ADDRESSES]
    .map(normalizeAddress)
    .filter((address, index, addresses) => (
      address.length > 0
      && !participantNames.has(address)
      && addresses.indexOf(address) === index
    ));
}

function hasDirectUserAddress(text: string, addresses: string[]) {
  const normalizedText = normalizeAddress(text);
  return addresses.some((address) => (
    normalizedText.includes(`@${address}`)
    || normalizedText.startsWith(address)
    || DIRECT_FOLLOW_UPS.some((followUp) => normalizedText.includes(`${address}${followUp}`))
    || normalizedText.includes(`，${address}`)
    || normalizedText.includes(`。${address}`)
    || normalizedText.includes(`！${address}`)
    || normalizedText.includes(`!${address}`)
  ));
}

export function detectGroupUserAttention(
  message: ChatMessage | undefined,
  options: GroupUserAttentionDetectionOptions,
): GroupUserAttention | null {
  if (!message || message.role !== 'model' || !isChatMessageInMode(message, 'group')) {
    return null;
  }
  const messageKey = sourceMessageKey(message);
  if (messageKey === options.handledMessageKey || !RESPONSE_SIGNAL.test(message.text)) {
    return null;
  }
  if (!hasDirectUserAddress(message.text, resolveUserAddresses(options))) {
    return null;
  }
  return {
    createdAt: Date.now(),
    promptText: message.text,
    roleId: message.petId ?? 'primary',
    roleName: message.petName?.trim() || '角色',
    sourceMessageKey: messageKey,
  };
}

export function detectLatestGroupUserAttention(
  messages: ChatMessage[],
  options: GroupUserAttentionDetectionOptions,
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'model' && isChatMessageInMode(message, 'group')) {
      return detectGroupUserAttention(message, options);
    }
  }
  return null;
}
