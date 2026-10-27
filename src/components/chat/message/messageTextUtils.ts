import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../../multiPetRoster';
import { type ChatMessage, type PetConfig } from '../../../types';
import { resolveChatUserDisplayName } from '../chatAppearanceUtils';
import { CLOSING_ACTION_BRACKETS, endsActionBracketLine, OPENING_ACTION_BRACKETS } from '../actionBrackets';

type MessageTextSegment = {
  bold?: boolean;
  isBracketContent: boolean;
  text: string;
};

export type MemoryMenuPosition = {
  x: number;
  y: number;
};


const MEMORY_MENU_WIDTH = 188;

const MEMORY_MENU_HEIGHT = 44;

const MEMORY_MENU_OFFSET = 10;

// Models write markdown bold (**名字**, ***台词***) even when told not to; the bubble shows it
// as bold instead of literal asterisks. A marker with no partner (the other half sits past a
// kaomoji, which splits the text, or is still streaming) is dropped rather than shown.
const BOLD_PATTERN = /\*{2,3}(?=[^\s*])([\s\S]*?[^\s*])\*{2,3}/gu;
const STRAY_BOLD_MARKER_PATTERN = /\*{2,}/gu;

function splitBoldRuns(text: string) {
  const runs: Array<{ bold: boolean; text: string }> = [];
  let last = 0;
  for (const match of text.matchAll(BOLD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ bold: false, text: text.slice(last, index) });
    runs.push({ bold: true, text: match[1] });
    last = index + match[0].length;
  }
  if (last < text.length) runs.push({ bold: false, text: text.slice(last) });
  return runs
    .map((run) => ({ ...run, text: run.text.replace(STRAY_BOLD_MARKER_PATTERN, '') }))
    .filter((run) => run.text);
}

export function splitMessageTextByBrackets(text: string) {
  const segments: MessageTextSegment[] = [];
  let buffer = '';
  let bracketDepth = 0;
  let bold = false;

  const pushBuffer = (isBracketContent: boolean) => {
    if (!buffer) {
      return;
    }

    segments.push({ isBracketContent, text: buffer, ...(bold ? { bold: true } : {}) });
    buffer = '';
  };

  for (const run of splitBoldRuns(text)) {
    pushBuffer(bracketDepth > 0);
    bold = run.bold;
    for (const character of run.text) {
      if (endsActionBracketLine(character) && bracketDepth > 0) {
        pushBuffer(true);
        bracketDepth = 0;
      }
      if (OPENING_ACTION_BRACKETS.has(character)) {
        pushBuffer(bracketDepth > 0);
        bracketDepth += 1;
        buffer += character;
        continue;
      }

      if (CLOSING_ACTION_BRACKETS.has(character)) {
        buffer += character;
        pushBuffer(true);
        bracketDepth = Math.max(0, bracketDepth - 1);
        continue;
      }

      buffer += character;
    }
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
