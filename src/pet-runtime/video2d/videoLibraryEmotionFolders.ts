import {
  type PetAction,
  type PetVideoEmotionAction,
  type PetVideoEmotionFolderAliases,
} from '../../types';

export const VIDEO_EMOTION_ACTIONS: readonly PetVideoEmotionAction[] = ['HAPPY', 'SAD', 'SLEEPING', 'EATING'];

export const DEFAULT_VIDEO_EMOTION_FOLDER_ALIASES: Readonly<Record<PetVideoEmotionAction, readonly string[]>> = {
  EATING: ['吃', '吃东西', '吃饭', 'eat', 'eating'],
  HAPPY: ['开心', '高兴', 'happy'],
  SAD: ['伤心', '难过', 'sad'],
  SLEEPING: ['睡觉', '困', '睡', 'sleep', 'sleeping'],
};

const MAX_ALIASES_PER_EMOTION = 12;
const MAX_ALIAS_LENGTH = 40;

export function isVideoEmotionAction(action: PetAction | null | undefined): action is PetVideoEmotionAction {
  return action === 'HAPPY' || action === 'SAD' || action === 'SLEEPING' || action === 'EATING';
}

/**
 * Folder names that count as the given emotion. A user override replaces the
 * defaults for that emotion so a renamed folder cannot be shadowed by them.
 */
export function resolveVideoEmotionFolderNames(
  action: PetVideoEmotionAction,
  customAliases?: PetVideoEmotionFolderAliases | null,
): string[] {
  const custom = customAliases?.[action];
  return [...(custom && custom.length > 0 ? custom : DEFAULT_VIDEO_EMOTION_FOLDER_ALIASES[action])];
}

export function normalizeVideoEmotionFolderAliases(value: unknown): PetVideoEmotionFolderAliases | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const normalized: PetVideoEmotionFolderAliases = {};
  VIDEO_EMOTION_ACTIONS.forEach((action) => {
    const aliases = source[action];
    if (!Array.isArray(aliases)) return;
    const names = Array.from(new Set(
      aliases
        .filter((alias): alias is string => typeof alias === 'string')
        .map((alias) => alias.trim().slice(0, MAX_ALIAS_LENGTH))
        .filter(Boolean),
    )).slice(0, MAX_ALIASES_PER_EMOTION);
    if (names.length > 0) normalized[action] = names;
  });
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
