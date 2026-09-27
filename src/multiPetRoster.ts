import { type CompanionPetConfig, type PetConfig, type PetPersonality, type PetStats } from './types';
import { MAX_DESKTOP_PET_COUNT } from './desktopPetSlotLimits';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  pruneDirectedRelationshipsForRole,
} from './character-relationship';

export const PRIMARY_DESKTOP_PET_SLOT_ID = 'primary';
export const MAX_DESKTOP_PET_SLOTS = MAX_DESKTOP_PET_COUNT;

const NEW_COMPANION_PET_POSITIONS = [
  { x: -240, y: -120 },
  { x: 240, y: -120 },
  { x: -320, y: 120 },
  { x: 320, y: 120 },
  { x: -120, y: 220 },
  { x: 120, y: 220 },
  { x: 0, y: -240 },
] as const;

const COMPANION_PET_SLOT_ID_PATTERN = /^companion-pet-(\d+)$/u;

export interface DesktopPetSlot {
  id: string;
  slotNumber: number;
  label: string;
  isPrimary: boolean;
  enabled: boolean;
  modelVisible: boolean;
  autoMovementEnabled: boolean;
  pointerLookEnabled: boolean;
  modelType: PetConfig['modelType'];
  modelUrl: string;
  personality: PetPersonality;
  scale: number;
  position: { x: number; y: number };
  stats: PetStats;
  currentAction: PetConfig['currentAction'];
}

function resolveDesktopPetSlotNumber(slotId: string, fallbackSlotNumber: number) {
  const slotNumber = Number(slotId.match(COMPANION_PET_SLOT_ID_PATTERN)?.[1]);

  return Number.isInteger(slotNumber) && slotNumber >= 2
    ? slotNumber
    : fallbackSlotNumber;
}

export function getDesktopPetSlots(config: PetConfig): DesktopPetSlot[] {
  return [
    {
      id: PRIMARY_DESKTOP_PET_SLOT_ID,
      slotNumber: 1,
      label: '1号桌宠',
      isPrimary: true,
      enabled: true,
      modelVisible: true,
      autoMovementEnabled: config.autoMovementEnabled,
      pointerLookEnabled: config.pointerLookEnabled,
      modelType: config.modelType,
      modelUrl: config.modelUrl,
      personality: config.personality,
      scale: config.scale,
      position: config.position,
      stats: config.stats,
      currentAction: config.currentAction,
    },
    ...config.companionPets.map((pet, index) => {
      const slotNumber = resolveDesktopPetSlotNumber(pet.id, index + 2);

      return {
        id: pet.id,
        slotNumber,
        label: `${slotNumber}号桌宠`,
        isPrimary: false,
        enabled: pet.enabled,
        modelVisible: pet.modelVisible,
        autoMovementEnabled: pet.autoMovementEnabled,
        pointerLookEnabled: pet.pointerLookEnabled,
        modelType: pet.modelType,
        modelUrl: pet.modelUrl,
        personality: pet.personality,
        scale: pet.scale,
        position: pet.position,
        stats: pet.stats,
        currentAction: pet.currentAction,
      };
    }),
  ];
}

export function getDesktopPetSlot(config: PetConfig, slotId: string) {
  return getDesktopPetSlots(config).find((slot) => slot.id === slotId) ?? null;
}

export function getRenderableDesktopPetSlots(config: PetConfig) {
  return getDesktopPetSlots(config).filter((slot) => slot.isPrimary || slot.enabled);
}

export function getVisibleDesktopPetModelSlots(config: PetConfig) {
  return getDesktopPetSlots(config).filter((slot) => (
    slot.isPrimary || (slot.enabled && slot.modelVisible)
  ));
}

function resolveNextDesktopPetSlotNumber(config: PetConfig) {
  const usedSlotNumbers = new Set(
    getDesktopPetSlots(config).map((slot) => slot.slotNumber),
  );

  for (let slotNumber = 2; slotNumber <= MAX_DESKTOP_PET_SLOTS; slotNumber += 1) {
    if (!usedSlotNumbers.has(slotNumber)) {
      return slotNumber;
    }
  }

  return null;
}

export function canAddDesktopPetSlot(config: PetConfig) {
  return getDesktopPetSlots(config).length < MAX_DESKTOP_PET_SLOTS
    && resolveNextDesktopPetSlotNumber(config) !== null;
}

function buildAddedCompanionPersonality(slotNumber: number): PetPersonality {
  const name = `桌宠 ${slotNumber}`;

  return {
    beginDialogs: [],
    chatAvatarUrl: '',
    chatHistoryMemory: '',
    customErrorMessage: '',
    greeting: '',
    knowledgeBase: '',
    dialogueCompletionPreset: '',
    neuralPersonaChatEnabled: false,
    neuralPersonaSourceText: '',
    name,
    systemInstruction:
      `你现在扮演桌宠“${name}”。你性格安静、灵动、可爱，会用轻柔简洁的语气和用户交流。`
      + ' 你平时会在桌面上自由活动、散步、跑步或游动，也会观察周围的文件和环境。'
      + ' 你有一点贪吃，饿的时候会主动靠近桌面上的食物。'
      + ' 请始终保持桌宠角色感，回复简短自然，带一点陪伴感。',
    traits: ['安静', '灵动', '贪吃'],
    userMemory: '',
    webLearningEnabled: false,
    webSearchEnabled: false,
  };
}

function createAddedCompanionPet(
  config: PetConfig,
  slotNumber: number,
  positionIndex: number,
): CompanionPetConfig {
  const fallbackPosition = NEW_COMPANION_PET_POSITIONS[positionIndex % NEW_COMPANION_PET_POSITIONS.length]
    ?? { x: 0, y: 0 };

  return {
    autoMovementEnabled: true,
    currentAction: 'IDLE',
    enabled: true,
    id: `companion-pet-${slotNumber}`,
    modelVisible: true,
    modelType: config.modelType,
    modelUrl: config.modelUrl,
    personality: buildAddedCompanionPersonality(slotNumber),
    pointerLookEnabled: true,
    position: {
      x: fallbackPosition.x,
      y: fallbackPosition.y,
    },
    scale: 1,
    stats: {
      affection: 80,
      fatigue: 8,
      hunger: 24,
    },
  };
}

export function addDesktopPetSlot(config: PetConfig) {
  const nextSlotNumber = resolveNextDesktopPetSlotNumber(config);

  if (!nextSlotNumber || getDesktopPetSlots(config).length >= MAX_DESKTOP_PET_SLOTS) {
    return config;
  }

  return {
    ...config,
    companionPets: [
      ...config.companionPets,
      createAddedCompanionPet(config, nextSlotNumber, config.companionPets.length),
    ],
  };
}

export function removeDesktopPetSlot(config: PetConfig, slotId: string) {
  if (slotId === PRIMARY_DESKTOP_PET_SLOT_ID) {
    return config;
  }

  if (!config.companionPets.some((pet) => pet.id === slotId)) {
    return config;
  }

  return {
    ...config,
    companionPets: config.companionPets.filter((pet) => pet.id !== slotId),
    directedRelationshipRepository: pruneDirectedRelationshipsForRole(
      config.directedRelationshipRepository ?? EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
      slotId,
    ),
  };
}

export function applyDesktopPetSlotChanges(
  config: PetConfig,
  slotId: string,
  updates: Partial<Pick<DesktopPetSlot, 'enabled' | 'modelVisible' | 'autoMovementEnabled' | 'pointerLookEnabled' | 'modelType' | 'modelUrl' | 'personality' | 'scale' | 'position' | 'stats' | 'currentAction'>>,
) {
  if (slotId === PRIMARY_DESKTOP_PET_SLOT_ID) {
    return {
      ...config,
      autoMovementEnabled: updates.autoMovementEnabled ?? config.autoMovementEnabled,
      pointerLookEnabled: updates.pointerLookEnabled ?? config.pointerLookEnabled,
      modelType: updates.modelType ?? config.modelType,
      modelUrl: updates.modelUrl ?? config.modelUrl,
      personality: updates.personality ?? config.personality,
      scale: updates.scale ?? config.scale,
      position: updates.position ?? config.position,
      stats: updates.stats ?? config.stats,
      currentAction: updates.currentAction ?? config.currentAction,
    };
  }

  return {
    ...config,
    companionPets: config.companionPets.map((pet) => (
      pet.id === slotId
        ? {
            ...pet,
            enabled: updates.enabled ?? pet.enabled,
            modelVisible: updates.modelVisible ?? pet.modelVisible,
            autoMovementEnabled: updates.autoMovementEnabled ?? pet.autoMovementEnabled,
            pointerLookEnabled: updates.pointerLookEnabled ?? pet.pointerLookEnabled,
            modelType: updates.modelType ?? pet.modelType,
            modelUrl: updates.modelUrl ?? pet.modelUrl,
            personality: updates.personality ?? pet.personality,
            scale: updates.scale ?? pet.scale,
            position: updates.position ?? pet.position,
            stats: updates.stats ?? pet.stats,
            currentAction: updates.currentAction ?? pet.currentAction,
          } satisfies CompanionPetConfig
        : pet
    )),
  };
}

export function applyDesktopPetModelSelection(
  config: PetConfig,
  slotId: string,
  selection: Pick<DesktopPetSlot, 'modelType' | 'modelUrl'>,
) {
  return applyDesktopPetSlotChanges(config, slotId, {
    enabled: true,
    modelType: selection.modelType,
    modelUrl: selection.modelUrl,
    modelVisible: true,
  });
}
