import { applyDesktopPetSlotChanges, getDesktopPetSlot, getDesktopPetSlots } from '../../multiPetRoster';
import { type ChatMessage, type PetConfig, type PetPersonality } from '../../types';
import {
  createManualGroupMemoryRecord,
  evaluateGroupMemoryWrite,
  toStoredGroupMemoryRecord,
} from './group/memory/groupMemoryRecord';
import { createManualGroupMemoryCandidate } from './group/memory/groupMemoryCandidate';
import {
  appendGroupMemoryEvidenceScopeSnapshot,
  enqueueGroupMemoryCandidate,
  upsertGroupMemoryRecord,
} from '../../group-memory';

export type ChatMemorySaveTarget =
  | 'roleMemory'
  | 'chatMemory'
  | 'groupMemory'
  | 'groupMemoryCandidate';
export type ChatMemorySaveHandler = (
  message: ChatMessage,
  target: ChatMemorySaveTarget,
  groupId?: string,
) => void;
type RoleMemorySaveTarget = Exclude<ChatMemorySaveTarget, 'groupMemory' | 'groupMemoryCandidate'>;

const CHAT_MEMORY_FIELD_BY_TARGET: Record<RoleMemorySaveTarget, keyof Pick<PetPersonality, 'userMemory' | 'chatHistoryMemory'>> = {
  roleMemory: 'userMemory',
  chatMemory: 'chatHistoryMemory',
};

function appendMemoryEntry(currentValue: string, nextEntry: string) {
  const currentMemory = currentValue.trim();
  return currentMemory ? `${currentMemory}\n\n${nextEntry}` : nextEntry;
}

function saveGroupChatMessageToMemory(
  config: PetConfig,
  message: ChatMessage,
  groupId?: string,
) {
  const record = createManualGroupMemoryRecord(message);
  if (!record || !evaluateGroupMemoryWrite({ explicitUserSave: true, record }).accepted) {
    return config;
  }
  const storedRecord = toStoredGroupMemoryRecord(record, groupId);
  if (!storedRecord) return config;
  const repository = upsertGroupMemoryRecord(config.groupMemoryRepository, storedRecord);
  const withScope = appendGroupMemoryEvidenceScopeSnapshot(repository, {
    capturedAt: storedRecord.createdAt, groupId: storedRecord.groupId,
    id: `group-memory-scope-manual-${storedRecord.id}`, recordId: storedRecord.id,
    source: 'manual-save', sourceMessageId: message.id ?? `message-${storedRecord.createdAt}`,
    sourceRoleId: storedRecord.sourceRoleId, topicId: storedRecord.topicId,
  });
  return {
    ...config,
    groupMemoryRepository: withScope,
  };
}

function saveGroupChatMessageToCandidateInbox(config: PetConfig, message: ChatMessage) {
  const candidate = createManualGroupMemoryCandidate(message);
  if (!candidate) return config;
  return {
    ...config,
    groupMemoryRepository: enqueueGroupMemoryCandidate(config.groupMemoryRepository, candidate),
  };
}

function formatMemorySavedAt(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildSavedChatMemoryEntry(message: ChatMessage) {
  const speakerName = message.role === 'user'
    ? '用户'
    : (message.petName?.trim() || '角色');
  const savedAt = formatMemorySavedAt(message.createdAt ?? Date.now());

  return [
    `【手动保存｜${savedAt}｜${speakerName}】`,
    message.text.trim(),
  ].join('\n');
}

export function saveChatMessageToMemory(
  config: PetConfig,
  activePetId: string,
  message: ChatMessage,
  target: ChatMemorySaveTarget,
  groupId?: string,
) {
  const messageText = message.text.trim();
  if (!messageText) {
    return config;
  }
  if (target === 'groupMemory') {
    return saveGroupChatMessageToMemory(config, { ...message, text: messageText }, groupId);
  }
  if (target === 'groupMemoryCandidate') {
    return saveGroupChatMessageToCandidateInbox(config, { ...message, text: messageText });
  }

  const messagePetId = message.petId && getDesktopPetSlot(config, message.petId)
    ? message.petId
    : null;
  // User messages legitimately go to the active pet's memory; a model message
  // from an unknown speaker (group chat without a resolvable petId) must not
  // be silently written into the currently active pet's memory.
  const targetPetId = messagePetId ?? (message.role === 'user' ? activePetId : null);
  if (!targetPetId) {
    return config;
  }
  const targetSlot = getDesktopPetSlot(config, targetPetId) ?? getDesktopPetSlots(config)[0];
  if (!targetSlot) {
    return config;
  }

  const memoryField = CHAT_MEMORY_FIELD_BY_TARGET[target];
  const nextEntry = buildSavedChatMemoryEntry({
    ...message,
    text: messageText,
  });

  return applyDesktopPetSlotChanges(config, targetSlot.id, {
    personality: {
      ...targetSlot.personality,
      [memoryField]: appendMemoryEntry(targetSlot.personality[memoryField], nextEntry),
    },
  });
}
