import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  getRenderableDesktopPetSlots,
  type DesktopPetSlot,
} from '../../multiPetRoster';
import type { DesktopPetChatMode, PetConfig } from '../../types';

export interface ChatTargetOption {
  id: string;
  label: string;
  name: string;
}

function formatTargetLabel(slot: DesktopPetSlot) {
  return `${slot.personality.name} 路 ${slot.slotNumber}号桌宠`;
}

function getRenderableChatSlots(config: PetConfig) {
  return getRenderableDesktopPetSlots(config);
}

export function createChatMessageId(prefix = 'chat-message') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function getChatTargetOptions(config: PetConfig): ChatTargetOption[] {
  return getRenderableChatSlots(config).map((slot) => ({
    id: slot.id,
    label: formatTargetLabel(slot),
    name: slot.personality.name,
  }));
}

export function resolveActiveChatPetId(
  config: PetConfig,
  activePetId: string | null | undefined,
) {
  const renderableSlots = getRenderableChatSlots(config);
  const matchedSlot = renderableSlots.find((slot) => slot.id === activePetId);

  return matchedSlot?.id ?? renderableSlots[0]?.id ?? PRIMARY_DESKTOP_PET_SLOT_ID;
}

export function resolveActiveChatSlot(
  config: PetConfig,
  activePetId: string | null | undefined,
) {
  const resolvedPetId = resolveActiveChatPetId(config, activePetId);
  return getRenderableChatSlots(config).find((slot) => slot.id === resolvedPetId) ?? null;
}

export function resolveChatTargetSlots(
  config: PetConfig,
  chatMode: DesktopPetChatMode,
  activePetId: string | null | undefined,
  storyParticipantIds: string[] = [],
) {
  const renderableSlots = getRenderableChatSlots(config);
  if (chatMode === 'group') {
    return renderableSlots;
  }
  if (chatMode === 'story') {
    const selectedIds = new Set(storyParticipantIds);
    const selectedSlots = renderableSlots.filter((slot) => selectedIds.has(slot.id));
    return selectedSlots.length > 0 ? selectedSlots : renderableSlots.slice(0, 4);
  }

  const activeSlot = resolveActiveChatSlot(config, activePetId);
  return activeSlot ? [activeSlot] : renderableSlots.slice(0, 1);
}
