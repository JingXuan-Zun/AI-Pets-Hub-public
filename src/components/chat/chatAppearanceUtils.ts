import { type CSSProperties } from 'react';
import { applyDesktopPetSlotChanges, getDesktopPetSlot } from '../../multiPetRoster';
import { type ChatMessage, type PetConfig } from '../../types';
import {
  CHAT_AVATAR_DISPLAY_SIZE_DEFAULT,
  CHAT_BACKGROUND_IMAGE_SIZE_DEFAULT,
  CHAT_BACKGROUND_IMAGE_VISIBILITY_DEFAULT,
  clampChatAvatarDisplaySize,
  clampChatBackgroundImageSize,
  clampChatBackgroundImageVisibility,
} from '../../chatAppearanceSettings';

export const CHAT_AVATAR_IMAGE_MAX_EDGE = 256;
export const CHAT_BACKGROUND_IMAGE_MAX_EDGE = 4096;

const DEFAULT_CHAT_USER_NAME = '\u4f60';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeCssUrlValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function resolveChatUserDisplayName(config: PetConfig) {
  return trimString(config.settings.chatUserDisplayName) || DEFAULT_CHAT_USER_NAME;
}

export function resolveChatUserDisplayId(config: PetConfig) {
  return trimString(config.settings.chatUserDisplayId);
}

export function resolveChatUserDisplayLabel(config: PetConfig) {
  const userDisplayName = resolveChatUserDisplayName(config);
  const userDisplayId = resolveChatUserDisplayId(config);

  return userDisplayId ? `${userDisplayName} #${userDisplayId}` : userDisplayName;
}

export function resolveChatUserAvatarUrl(config: PetConfig) {
  return trimString(config.settings.chatUserAvatarUrl);
}

export function resolveChatBackgroundImageUrl(config: PetConfig) {
  if (!config.settings.chatBackgroundImageEnabled) {
    return '';
  }

  return trimString(config.settings.chatBackgroundImageUrl);
}

export function resolveChatPetAvatarUrl(config: PetConfig, petId: string | null | undefined) {
  return trimString(getDesktopPetSlot(config, petId ?? '')?.personality.chatAvatarUrl);
}

export function resolveChatMessageAvatarUrl(config: PetConfig, message: ChatMessage) {
  if (message.storyMessageKind === 'narration') {
    return '';
  }

  return message.role === 'user'
    ? resolveChatUserAvatarUrl(config)
    : resolveChatPetAvatarUrl(config, message.petId ?? 'primary');
}

export function resolveChatAvatarDisplaySize(config: PetConfig) {
  return clampChatAvatarDisplaySize(config.settings.chatAvatarSize, CHAT_AVATAR_DISPLAY_SIZE_DEFAULT);
}

function resolveChatBackgroundOverlayAlpha(visibility: number) {
  const normalizedVisibility = clampChatBackgroundImageVisibility(
    visibility,
    CHAT_BACKGROUND_IMAGE_VISIBILITY_DEFAULT,
  );
  const alpha = ((100 - normalizedVisibility) / 100) * 0.16;

  return Number(Math.min(0.16, Math.max(0, alpha)).toFixed(2));
}

export function buildChatBackgroundStyle(config: PetConfig): CSSProperties | undefined {
  if (!config.settings.chatBackgroundImageEnabled) {
    return undefined;
  }

  const backgroundImageUrl = trimString(config.settings.chatBackgroundImageUrl);
  if (!backgroundImageUrl) {
    return undefined;
  }

  const backgroundImageSize = clampChatBackgroundImageSize(
    config.settings.chatBackgroundImageSize,
    CHAT_BACKGROUND_IMAGE_SIZE_DEFAULT,
  );
  const backgroundVisibility = clampChatBackgroundImageVisibility(
    config.settings.chatBackgroundImageVisibility,
    CHAT_BACKGROUND_IMAGE_VISIBILITY_DEFAULT,
  );
  const overlayAlpha = resolveChatBackgroundOverlayAlpha(backgroundVisibility);

  return {
    backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, ${overlayAlpha}), rgba(255, 255, 255, ${overlayAlpha})), url("${escapeCssUrlValue(backgroundImageUrl)}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  };
}

export function buildChatBackgroundImageStyle(config: PetConfig): CSSProperties {
  const backgroundImageSize = clampChatBackgroundImageSize(
    config.settings.chatBackgroundImageSize,
    CHAT_BACKGROUND_IMAGE_SIZE_DEFAULT,
  );
  const scale = Math.max(1, backgroundImageSize / 100);

  return {
    transform: `scale(${Number(scale.toFixed(2))})`,
    transformOrigin: 'center',
  };
}

export function buildChatBackgroundOverlayStyle(config: PetConfig): CSSProperties {
  const backgroundVisibility = clampChatBackgroundImageVisibility(
    config.settings.chatBackgroundImageVisibility,
    CHAT_BACKGROUND_IMAGE_VISIBILITY_DEFAULT,
  );
  const overlayAlpha = resolveChatBackgroundOverlayAlpha(backgroundVisibility);

  return {
    background: `linear-gradient(180deg, rgba(255, 255, 255, ${overlayAlpha}), rgba(255, 255, 255, ${overlayAlpha}))`,
  };
}

function normalizeImageUrl(value: unknown) {
  return trimString(value);
}

export async function fileToChatImageDataUrl(file: File, maxEdge = CHAT_AVATAR_IMAGE_MAX_EDGE) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error(`Unable to read image: ${file.name}`));
      nextImage.src = objectUrl;
    });

    const longestEdge = Math.max(imageElement.naturalWidth, imageElement.naturalHeight, 1);
    const scale = Math.min(1, maxEdge / longestEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imageElement.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(imageElement.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function updateChatPetAvatarUrl(config: PetConfig, petId: string, avatarUrl: string) {
  const slot = getDesktopPetSlot(config, petId);
  if (!slot) {
    return config;
  }
  const normalizedAvatarUrl = normalizeImageUrl(avatarUrl);

  return applyDesktopPetSlotChanges({
    ...config,
    settings: {
      ...config.settings,
      chatAvatarsEnabled: normalizedAvatarUrl ? true : config.settings.chatAvatarsEnabled,
    },
  }, slot.id, {
    personality: {
      ...slot.personality,
      chatAvatarUrl: normalizedAvatarUrl,
    },
  });
}

export function updateChatUserIdentity(
  config: PetConfig,
  updates: {
    displayName?: string;
    displayId?: string;
    avatarUrl?: string;
  },
) {
  const nextUserAvatarUrl = typeof updates.avatarUrl === 'string'
    ? normalizeImageUrl(updates.avatarUrl)
    : config.settings.chatUserAvatarUrl;

  return {
    ...config,
    settings: {
      ...config.settings,
      chatAvatarsEnabled: typeof updates.avatarUrl === 'string' && nextUserAvatarUrl
        ? true
        : config.settings.chatAvatarsEnabled,
      chatUserDisplayName: typeof updates.displayName === 'string'
        ? normalizeImageUrl(updates.displayName)
        : config.settings.chatUserDisplayName,
      chatUserDisplayId: typeof updates.displayId === 'string'
        ? normalizeImageUrl(updates.displayId)
        : config.settings.chatUserDisplayId,
      chatUserAvatarUrl: nextUserAvatarUrl,
    },
  };
}

export function updateChatAvatarDisplaySize(config: PetConfig, avatarSize: number) {
  return {
    ...config,
    settings: {
      ...config.settings,
      chatAvatarSize: clampChatAvatarDisplaySize(avatarSize, config.settings.chatAvatarSize),
    },
  };
}

export function updateChatBackgroundImageUrl(config: PetConfig, backgroundImageUrl: string) {
  return {
    ...config,
    settings: {
      ...config.settings,
      chatBackgroundImageUrl: normalizeImageUrl(backgroundImageUrl),
      chatBackgroundImageEnabled: Boolean(trimString(backgroundImageUrl)),
    },
  };
}

export function updateChatBackgroundImageSize(config: PetConfig, backgroundImageSize: number) {
  return {
    ...config,
    settings: {
      ...config.settings,
      chatBackgroundImageSize: clampChatBackgroundImageSize(
        backgroundImageSize,
        config.settings.chatBackgroundImageSize,
      ),
    },
  };
}

export function updateChatBackgroundImageVisibility(config: PetConfig, backgroundVisibility: number) {
  return {
    ...config,
    settings: {
      ...config.settings,
      chatBackgroundImageVisibility: clampChatBackgroundImageVisibility(
        backgroundVisibility,
        config.settings.chatBackgroundImageVisibility,
      ),
    },
  };
}
