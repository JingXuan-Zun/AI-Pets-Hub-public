import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../../multiPetRoster';
import { type ChatMessage, type PetConfig } from '../../../types';
import { resolveChatUserDisplayName } from '../chatAppearanceUtils';

type MessageTextSegment = {
  isBracketContent: boolean;
  text: string;
};

export type MemoryMenuPosition = {
  x: number;
  y: number;
};

const OPENING_BRACKETS = new Set(['(', '（', '[', '【']);

const CLOSING_BRACKETS = new Set([')', '）', ']', '】']);

const MEMORY_MENU_WIDTH = 188;

const MEMORY_MENU_HEIGHT = 44;

const MEMORY_MENU_OFFSET = 10;

export function splitMessageTextByBrackets(text: string) {
  const segments: MessageTextSegment[] = [];
  let buffer = '';
  let bracketDepth = 0;

  const pushBuffer = (isBracketContent: boolean) => {
    if (!buffer) {
      return;
    }

    segments.push({ isBracketContent, text: buffer });
    buffer = '';
  };

  for (const character of text) {
    if (OPENING_BRACKETS.has(character)) {
      pushBuffer(bracketDepth > 0);
      bracketDepth += 1;
      buffer += character;
      continue;
    }

    if (CLOSING_BRACKETS.has(character)) {
      buffer += character;
      pushBuffer(true);
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    buffer += character;
  }

  pushBuffer(bracketDepth > 0);
  return segments;
}

export function clampMemoryMenuPosition(x: number, y: number): MemoryMenuPosition {
  return {
    x: Math.max(8, Math.min(x + MEMORY_MENU_OFFSET, window.innerWidth - MEMORY_MENU_WIDTH - 8)),
    y: Math.max(8, Math.min(y + MEMORY_MENU_OFFSET, window.innerHeight - MEMORY_MENU_HEIGHT - 8)),
  };
}

export function isPointInsideElement(element: HTMLElement | null, x: number, y: number) {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function resolveAvatarFallbackText(message: ChatMessage, config: PetConfig) {
  if (message.role === 'user') {
    return resolveChatUserDisplayName(config);
  }

  return message.petName?.trim() || '桌宠';
}

export function resolveModelMessagePetId(message: ChatMessage) {
  return message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
}

export function isPromiseLike<T>(value: Promise<T> | T | void): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === 'function';
}
