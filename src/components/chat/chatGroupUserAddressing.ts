import { type DesktopPetSlot } from '../../multiPetRoster';
import type { ChatMessage } from '../../types';
import { type GroupChatInteractionPlan } from './chatGroupInteractionPlanner';

function normalizeAddressText(text: string) {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, '');
}

function createNameFragmentAliases(name: string) {
  const normalizedName = normalizeAddressText(name);
  const aliases = new Set<string>();

  for (let startIndex = 0; startIndex < normalizedName.length - 1; startIndex += 1) {
    aliases.add(normalizedName.slice(startIndex, startIndex + 2));
  }

  return [...aliases];
}

function createAddressAliases(targetSlot: DesktopPetSlot, temporaryAliases: string[] = []) {
  const personalityName = targetSlot.personality.name.trim();
  return [
    personalityName,
    ...createNameFragmentAliases(personalityName),
    targetSlot.label,
    `${targetSlot.slotNumber}号`,
    `${targetSlot.slotNumber}号桌宠`,
    targetSlot.isPrimary ? '主宠' : '',
    targetSlot.isPrimary ? '一号桌宠' : '',
    ...temporaryAliases,
  ]
    .map((alias) => alias.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function isExplicitAddressMatch(normalizedInput: string, normalizedAlias: string) {
  if (!normalizedAlias) {
    return false;
  }

  if (normalizedInput.includes(`@${normalizedAlias}`) || normalizedInput.includes(`＠${normalizedAlias}`)) {
    return true;
  }

  return normalizedAlias.length >= 2 && normalizedInput.includes(normalizedAlias);
}

function resolveAddressMatchIndex(normalizedInput: string, normalizedAlias: string) {
  const halfWidthMentionIndex = normalizedInput.indexOf(`@${normalizedAlias}`);
  if (halfWidthMentionIndex >= 0) {
    return halfWidthMentionIndex;
  }

  const fullWidthMentionIndex = normalizedInput.indexOf(`＠${normalizedAlias}`);
  if (fullWidthMentionIndex >= 0) {
    return fullWidthMentionIndex;
  }

  if (normalizedAlias.length >= 2) {
    return normalizedInput.indexOf(normalizedAlias);
  }

  return -1;
}

export function resolveUserAddressedGroupChatSlots(
  userInput: string,
  targetSlots: DesktopPetSlot[],
  temporaryAliasesById: Record<string, string[]> = {},
) {
  const normalizedInput = normalizeAddressText(userInput);
  if (!normalizedInput) {
    return [];
  }

  const matchedSlots = targetSlots
    .flatMap((targetSlot, slotIndex) => createAddressAliases(
      targetSlot,
      temporaryAliasesById[targetSlot.id],
    ).map((alias) => ({
      alias,
      matchIndex: resolveAddressMatchIndex(normalizedInput, normalizeAddressText(alias)),
      normalizedAlias: normalizeAddressText(alias),
      slotIndex,
      targetSlot,
    })))
    .filter((candidate) => isExplicitAddressMatch(normalizedInput, candidate.normalizedAlias))
    .sort((left, right) => (
      left.matchIndex - right.matchIndex
      || right.normalizedAlias.length - left.normalizedAlias.length
      || left.slotIndex - right.slotIndex
    ))
    .reduce<DesktopPetSlot[]>((slots, candidate) => {
      if (!slots.some((slot) => slot.id === candidate.targetSlot.id)) {
        slots.push(candidate.targetSlot);
      }

      return slots;
    }, []);

  return matchedSlots;
}

export function resolveUserAddressedGroupChatSlot(
  userInput: string,
  targetSlots: DesktopPetSlot[],
  temporaryAliasesById: Record<string, string[]> = {},
) {
  return resolveUserAddressedGroupChatSlots(userInput, targetSlots, temporaryAliasesById)[0] ?? null;
}

export function resolveTemporaryGroupPetAliases(
  userInput: string,
  targetSlots: DesktopPetSlot[],
  temporaryAliasesById: Record<string, string[]> = {},
) {
  const aliasesById: Record<string, string[]> = {};

  targetSlots.forEach((targetSlot) => {
    const aliases = createAddressAliases(targetSlot, temporaryAliasesById[targetSlot.id])
      .filter((alias) => normalizeAddressText(alias).length >= 2);
    aliases.forEach((alias) => {
      const renamePattern = new RegExp(
        `(?:@|＠)?${escapeRegExp(alias)}(?:，|,)?(?:以后|从现在起|今后)?(?:叫你|叫|改叫|改名为|称呼为)([^\\s，,。！？!?：:]{2,16})`,
        'gu',
      );
      for (const match of userInput.matchAll(renamePattern)) {
        const nextAlias = match[1]?.trim() ?? '';
        if (!nextAlias) continue;
        aliasesById[targetSlot.id] = [...(aliasesById[targetSlot.id] ?? []), nextAlias];
      }
    });
  });

  Object.keys(aliasesById).forEach((petId) => {
    aliasesById[petId] = Array.from(new Set(aliasesById[petId])).slice(-8);
    if (aliasesById[petId].length === 0) {
      delete aliasesById[petId];
    }
  });

  return aliasesById;
}

export function resolveUnansweredGroupUserTopicSlots(
  messages: ChatMessage[],
  userMessageId: string,
  targetSlots: DesktopPetSlot[],
) {
  const userIndex = messages.findIndex((message) => message.id === userMessageId);
  if (userIndex < 0) return targetSlots;
  const answeredRoleIds = new Set(messages.slice(userIndex + 1)
    .filter((message) => message.role === 'model' && message.chatMode === 'group')
    .map((message) => message.petId)
    .filter(Boolean));
  return targetSlots.filter((slot) => !answeredRoleIds.has(slot.id));
}

export function createUserAddressedGroupInteractionPlan(
  targetSlot: DesktopPetSlot,
  addressedTargetSlots: DesktopPetSlot[] = [targetSlot],
): GroupChatInteractionPlan {
  return {
    groupInteractionKind: 'direct',
    pullInPetId: null,
    pullInPetName: null,
    replyToPetId: null,
    replyToPetName: null,
    replyToPetIds: [],
    replyToPetNames: [],
    userAddressedPetId: targetSlot.id,
    userAddressedPetName: targetSlot.personality.name,
    userAddressedPetIds: addressedTargetSlots.map((slot) => slot.id),
    userAddressedPetNames: addressedTargetSlots.map((slot) => slot.personality.name),
  };
}

export function createUserAddressedFollowupGroupInteractionPlan(
  basePlan: GroupChatInteractionPlan,
  addressedTargetSlots: DesktopPetSlot[],
): GroupChatInteractionPlan {
  return {
    ...basePlan,
    userAddressedPetIds: addressedTargetSlots.map((slot) => slot.id),
    userAddressedPetNames: addressedTargetSlots.map((slot) => slot.personality.name),
    followsUserAddressedExchange: true,
  };
}
