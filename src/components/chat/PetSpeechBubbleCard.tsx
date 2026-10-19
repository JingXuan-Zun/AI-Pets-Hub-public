import { CLOSING_ACTION_BRACKETS, endsActionBracketLine, OPENING_ACTION_BRACKETS } from './actionBrackets';

const BRACKET_TEXT_COLOR = '#111827';

/** Bubble motion and frame shared by every pet so all bubbles look the same. */
export const PET_SPEECH_BUBBLE_MOTION = {
  initial: { opacity: 0, y: 8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.96 },
} as const;

export const PET_SPEECH_BUBBLE_FRAME_CLASS =
  'pointer-events-auto absolute w-72 max-w-[80vw] -translate-x-1/2 overflow-visible rounded-2xl text-center text-sm leading-relaxed';

export function splitBubbleText(text: string) {
  const parts: Array<{ isBracket: boolean; text: string }> = [];
  let buffer = '';
  let depth = 0;
  const push = (isBracket: boolean) => {
    if (buffer) parts.push({ isBracket, text: buffer });
    buffer = '';
  };
  for (const character of text) {
    if (endsActionBracketLine(character) && depth > 0) {
      push(true);
      depth = 0;
    }
    if (OPENING_ACTION_BRACKETS.has(character)) {
      push(depth > 0);
      depth += 1;
      buffer += character;
    } else if (CLOSING_ACTION_BRACKETS.has(character)) {
      buffer += character;
      push(true);
      depth = Math.max(0, depth - 1);
    } else {
      buffer += character;
    }
  }
  push(depth > 0);
  return parts;
}

interface PetSpeechBubbleCardProps {
  text: string;
  textColor: string;
}

/** White rounded speech card with a tail; bracketed actions render dark. */
export function PetSpeechBubbleCard({ text, textColor }: PetSpeechBubbleCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words border border-white/80 bg-white/90 px-3 py-2 font-semibold shadow-[0_8px_24px_rgba(158,84,140,0.24)] backdrop-blur-sm [scrollbar-width:thin]"
        style={{ color: textColor }}
        onWheel={(event) => {
          // The bubble sits above the transparent desktop-pet surface; keep
          // wheel input inside it instead of letting pet drag/zoom consume it.
          event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {splitBubbleText(text).map((part, index) => (
          <span key={`${index}-${part.text}`} style={part.isBracket ? { color: BRACKET_TEXT_COLOR } : undefined}>
            {part.text}
          </span>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/80 bg-white/90"
      />
    </div>
  );
}
